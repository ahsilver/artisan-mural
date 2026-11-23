import { api } from "@/components/bo/common";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/designer-files";
import type { RepeatFit } from "@/components/designer/repeat-aligner";

/** Saves a lined-up repeat: for every colorway a corrected print file holding exactly one repeat (the original is kept
 *  as an earlier version) and a matching shop picture; then the repeat type, size and check on the design. */
type Say = (text: string, frac?: number) => void;

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ""; }

/** Full-resolution TIFF crop streamed straight into storage in parts (never the whole file in memory). */
async function cropTiffToStorage(uploadId: string, url: string, box: { x: number; y: number; w: number; h: number }, filename: string, say: Say, blendX = 0) {
  const { tiffCrop, urlReader, readTiff } = await import("@/lib/tiff");
  const info = await readTiff(urlReader(url));
  const est = box.w * box.h * info.spp + 1024 * 1024;
  if (est > 4_200_000_000) throw new Error("This repeat is over 4 GB as a print file. Please send a smaller or compressed file for this design.");
  const start = await api("designer/files/start", { body: { uploadId, purpose: "original", filename, size: Math.max(est, 95 * 1024 * 1024), type: "image/tiff" } });
  const parts: { partNumber: number; etag: string }[] = [];
  const t = await token();
  await tiffCrop(urlReader(url), box, async (chunk) => {
    const n = parts.length + 1;
    for (let a = 1; ; a++) {
      try {
        const r = await fetch(`/backend/designer/files/part?key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}&part=${n}`, { method: "PUT", headers: { authorization: `Bearer ${t}`, "content-type": "application/octet-stream" }, body: chunk.slice() });
        if (!r.ok) throw new Error(`upload failed (${r.status})`);
        parts.push(await r.json()); break;
      } catch (e) { if (a >= 4) throw e; await new Promise((res) => setTimeout(res, 1500 * a)); }
    }
  }, (f) => say("Making the corrected print file", f), { blendX });
  const done = await api("designer/files/complete", { body: { key: start.key, uploadId: start.uploadId, parts, type: "image/tiff" } });
  return { key: start.key as string, size: done.size as number, dims: done.dims, filename, mime: "image/tiff" };
}

/** JPG / PNG / WebP: cut in the browser and saved as a lossless PNG. */
/** One repeat from a picture; with blend the strip past the end fades into the start (same as the print file). */
function oneRepeat(src: CanvasImageSource, W: number, H: number, fit: { w: number; h: number; blend?: boolean }) {
  const w = Math.round(W * fit.w), h = Math.round(H * fit.h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!; x.drawImage(src, 0, 0, w, h, 0, 0, w, h);
  const ov = Math.min(W - w, w);
  if (fit.blend && ov > 0) {
    const s2 = document.createElement("canvas"); s2.width = ov; s2.height = h; const y = s2.getContext("2d")!;
    y.drawImage(src, w, 0, ov, h, 0, 0, ov, h);
    const g = y.createLinearGradient(0, 0, ov, 0); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    y.globalCompositeOperation = "destination-in"; y.fillStyle = g; y.fillRect(0, 0, ov, h); x.drawImage(s2, 0, 0);
  }
  return c;
}
async function cropImageToStorage(uploadId: string, url: string, fit: { w: number; h: number; blend?: boolean }, filename: string, say: Say) {
  say("Making the corrected print file", 0.1);
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const c = oneRepeat(bmp, bmp.width, bmp.height, fit); bmp.close();
  const out: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("This file is too large for the browser to correct. Please send a corrected file."))), "image/png"));
  return uploadFile(out, { uploadId, purpose: "original", filename }, (d, t) => say("Saving the corrected print file", t ? d / t : 0));
}

async function cropPreview(uploadId: string, src: string, fit: { w: number; h: number; blend?: boolean }) {
  const im = new Image(); im.crossOrigin = "anonymous"; im.src = src; await im.decode();
  const c = oneRepeat(im, im.naturalWidth, im.naturalHeight, fit);
  const { crispJpeg } = await import("@/lib/tiff");
  const blob = await crispJpeg(c, false);
  return (await uploadFile(blob, { uploadId, purpose: "preview", filename: "preview.jpg" }, () => {})).key;
}

export async function applyRepeatFit(design: any, fit: RepeatFit, say: Say) {
  const id = design.id as string;
  const trims = fit.w < 0.999 || fit.h < 0.999;
  if (trims) {
    const colors: any[] = design.colors ?? [];
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i]; const o = c.original;
      const each: Say = (t, f) => say(colors.length > 1 ? `${t} · colorway ${i + 1} of ${colors.length}` : t, f);
      let saved: any = null;
      if (o?.key) {
        const url = (await api("designer/files/url", { body: { key: o.key } })).url as string;
        const base = String(o.filename || "design").replace(/\.[a-z0-9]+$/i, "");
        const isTiff = /tiff?$/i.test(o.mime || "") || /\.tiff?$/i.test(o.filename || "");
        saved = isTiff
          ? await cropTiffToStorage(id, url, { x: 0, y: 0, w: Math.round(o.width * fit.w), h: Math.round(o.height * fit.h) }, `${base}-one-repeat.tif`, each, fit.blend ? o.width - Math.round(o.width * fit.w) : 0)
          : await cropImageToStorage(id, url, fit, `${base}-one-repeat.png`, each);
      }
      each("Making the shop picture", 1);
      const previewKey = await cropPreview(id, c.preview, fit);
      await api(`designer/uploads/${id}/colorways`, { body: { colorwayId: c.id, name: c.name, previewKey, ...(saved ? { originalKey: saved.key, filename: saved.filename, mime: saved.mime, size: saved.size, width: saved.dims?.width, height: saved.dims?.height, dpi: saved.dims?.dpi ?? o?.dpi ?? null } : {}) } });
    }
  }
  const meta = design.meta ?? {};
  const repeat = fit.mode === "sideways" ? "horizontal" : fit.mode === "halfdrop" ? "halfdrop" : "both";
  const size = design.widthCm ? { widthCm: Math.round(design.widthCm * fit.w * 10) / 10, ...(design.heightCm ? { heightCm: Math.round(design.heightCm * fit.h * 10) / 10 } : {}) } : {};
  await api(`designer/uploads/${id}`, { body: { kind: "repeating", repeat, ...size, meta: { ...meta, repeatChosen: true, repeatFit: { w: fit.w, h: fit.h, mode: fit.mode, blend: !!fit.blend, at: new Date().toISOString() }, repeatCheck: { confirmed: true, lined: true, style: repeat, at: new Date().toISOString() } } } });
}
