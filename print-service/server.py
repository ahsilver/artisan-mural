"""Artisan Murals print service: makes the exact print file from a huge original.

Runs inside a Cloudflare Container (see Dockerfile). The site sends one job:
  POST /job  {"sourceUrl": "...", "widthIn": 144, "heightIn": 108, "dpi": 150,
              "draws": [{"x": -0.1, "y": 0, "w": 1.25, "h": 1.0}, ...], "name": "pink-trees-12x9ft"}
"draws" are the placements from printGeometry() in src/lib/print-pdf.ts, in fractions of the wall: each one is
the whole source picture placed at (x, y) with size (w, h). One draw = a mural crop; many = a repeat. These are the
same numbers the wall preview is drawn from, so the print file is exactly what the customer saw.
The answer is the finished TIFF (LZW, exact wall size, the chosen DPI written in the file).

libvips works on strips of the picture, so a 2.8 GB TIFF needs a few hundred MB of memory, not the whole picture.
"""
import json, math, os, shutil, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pyvips

pyvips.cache_set_max(0)
MAX_PIXELS = 2_000_000_000          # output larger than this needs a lower DPI
ONE_JOB = threading.Lock()          # one job at a time per container: they are big


def download(url: str, path: str):
    req = urllib.request.Request(url, headers={"user-agent": "ArtisanMuralsPrint/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r, open(path, "wb") as f:
        ctype = r.headers.get("content-type", "")
        if "text/html" in ctype:
            raise ValueError("The original isn't shared as a file (Google Drive: share it as 'Anyone with the link').")
        shutil.copyfileobj(r, f, 8 * 1024 * 1024)


def make(job: dict, src_path: str, out_path: str) -> dict:
    W_in, H_in = float(job["widthIn"]), float(job["heightIn"])
    src = pyvips.Image.new_from_file(src_path)
    if src.bands == 4 and src.interpretation != "cmyk":
        src = src.flatten(background=[255, 255, 255])              # transparent parts print white
    # a lined-up repeat: the one clean repeat is the top-left part of the file (fractions from the repeat tool)
    crop = job.get("crop")
    if crop and (crop.get("w", 1) < 0.9999 or crop.get("h", 1) < 0.9999):
        src = src.crop(0, 0, max(1, round(src.width * float(crop["w"]))), max(1, round(src.height * float(crop["h"]))))
    dpi = float(job.get("dpi") or 150)
    W, H = round(W_in * dpi), round(H_in * dpi)
    if W * H > MAX_PIXELS:
        raise ValueError(f"{W:,} x {H:,} pixels is too big at {dpi:g} DPI. Use a lower DPI.")
    SW, SH = src.width, src.height
    bg = [255] * src.bands if src.interpretation != "cmyk" else [0] * src.bands
    canvas = pyvips.Image.black(W, H, bands=src.bands).new_from_image(bg).copy(interpretation=src.interpretation)
    placed = 0
    for d in job["draws"]:
        # where this copy of the picture lands on the wall, in output pixels
        dx, dy, dw, dh = d["x"] * W, d["y"] * H, d["w"] * W, d["h"] * H
        vx0, vy0, vx1, vy1 = max(0.0, dx), max(0.0, dy), min(float(W), dx + dw), min(float(H), dy + dh)
        if vx1 - vx0 < 0.5 or vy1 - vy0 < 0.5:
            continue
        # the part of the source that becomes visible, then scaled to its exact size on the wall
        sx0, sy0 = (vx0 - dx) / dw * SW, (vy0 - dy) / dh * SH
        sx1, sy1 = (vx1 - dx) / dw * SW, (vy1 - dy) / dh * SH
        cx, cy = int(math.floor(sx0)), int(math.floor(sy0))
        cw, ch = max(1, min(SW - cx, int(math.ceil(sx1)) - cx)), max(1, min(SH - cy, int(math.ceil(sy1)) - cy))
        tw, th = max(1, round(vx1) - round(vx0)), max(1, round(vy1) - round(vy0))
        piece = src.crop(cx, cy, cw, ch).resize(tw / cw, vscale=th / ch, kernel="lanczos3")
        piece = piece.crop(0, 0, min(tw, piece.width), min(th, piece.height))
        canvas = canvas.insert(piece, round(vx0), round(vy0))
        placed += 1
    if not placed:
        raise ValueError("Nothing of the picture lands on the wall. Check the crop.")
    res = dpi / 25.4
    canvas.tiffsave(out_path, compression="lzw", predictor="horizontal", xres=res, yres=res, resunit="inch",
                    bigtiff=W * H * src.bands > 3_500_000_000, strip=False)
    return {"width": W, "height": H, "dpi": dpi, "sourceWidth": SW, "sourceHeight": SH, "copies": placed}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(time.strftime("%H:%M:%S"), fmt % args, flush=True)

    def _json(self, code, body):
        b = json.dumps(body).encode()
        self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "vips": f"{pyvips.version(0)}.{pyvips.version(1)}"})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/job":
            return self._json(404, {"error": "not found"})
        try:
            job = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
            assert job.get("sourceUrl") and job.get("draws") and job.get("widthIn") and job.get("heightIn"), "Missing sourceUrl, draws or wall size."
        except Exception as e:
            return self._json(400, {"error": str(e)})
        if not ONE_JOB.acquire(blocking=False):
            return self._json(429, {"error": "Busy with another print file. Try again in a minute."})
        tmp = tempfile.mkdtemp(dir=os.environ.get("WORK_DIR") or None)
        try:
            t0 = time.time(); src_path, out_path = os.path.join(tmp, "source"), os.path.join(tmp, "out.tif")
            download(job["sourceUrl"], src_path)
            t1 = time.time(); info = make(job, src_path, out_path); t2 = time.time()
            os.remove(src_path)                                   # free the disk before sending
            size = os.path.getsize(out_path)
            self.send_response(200)
            self.send_header("content-type", "image/tiff"); self.send_header("content-length", str(size))
            self.send_header("x-print-info", json.dumps({**info, "bytes": size, "downloadSeconds": round(t1 - t0, 1), "makeSeconds": round(t2 - t1, 1)}))
            self.end_headers()
            with open(out_path, "rb") as f:
                shutil.copyfileobj(f, self.wfile, 8 * 1024 * 1024)
        except Exception as e:
            try: self._json(422, {"error": str(e)})
            except Exception: pass
        finally:
            ONE_JOB.release(); shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"print service on :{port}", flush=True)
    ThreadingHTTPServer((os.environ.get("HOST", "0.0.0.0"), port), Handler).serve_forever()
