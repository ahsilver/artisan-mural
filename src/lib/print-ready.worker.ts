/// <reference lib="webworker" />
// Builds the ready-to-print TIFF off the page thread: download original -> decode -> render strips -> LZW -> file.
import * as UTIFmod from "utif";
import { columnMap, lzwEncode, outSize, renderRows, renderRowsWindow, rowsNeeded, tiffTail, type Plan, type Src } from "./print-ready-core";
import { readTiff, urlReader, decodeStrip, type TiffInfo } from "./tiff";

const post = (m: any) => (self as any).postMessage(m);

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not download the original (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  let buf = new Uint8Array(total || 64 * 1024 * 1024), got = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    if (got + value.length > buf.length) { const b2 = new Uint8Array(Math.max(buf.length * 2, got + value.length)); b2.set(buf.subarray(0, got)); buf = b2; }
    buf.set(value, got); got += value.length;
    if (got - last > 8 * 1024 * 1024) { last = got; post({ type: "progress", stage: "Downloading the original", pct: total ? got / total : 0 }); }
  }
  return got === buf.length ? buf : buf.slice(0, got);
}

function fromRGBA(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Src {
  const out = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { const a = rgba[i + 3] / 255, k = 255 * (1 - a); out[j] = rgba[i] * a + k; out[j + 1] = rgba[i + 1] * a + k; out[j + 2] = rgba[i + 2] * a + k; }
  return { w, h, n: 3, data: out, photometric: 2 };
}

async function decode(bytes: Uint8Array, mime: string): Promise<Src> {
  const isTiff = (bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d);
  if (isTiff) {
    const mod: any = UTIFmod; const UTIF = mod.default ?? mod;
    const ifds = UTIF.decode(bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer);
    const ifd = ifds.reduce((a: any, b: any) => ((b.t256?.[0] ?? 0) * (b.t257?.[0] ?? 0) > (a.t256?.[0] ?? 0) * (a.t257?.[0] ?? 0) ? b : a), ifds[0]);
    UTIF.decodeImage(bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer, ifd);
    const w = ifd.width ?? ifd.t256[0], h = ifd.height ?? ifd.t257[0];
    const spp = ifd.t277?.[0] ?? 1, bps = ifd.t258?.[0] ?? 8, ph = ifd.t262?.[0] ?? 2, planar = ifd.t284?.[0] ?? 1;
    const raw: Uint8Array = ifd.data;
    const n = ph === 2 ? 3 : ph === 5 ? 4 : ph <= 1 ? 1 : 0;
    if (bps === 8 && planar === 1 && n && spp >= n && raw && raw.length >= w * h * spp) {
      if (spp === n && ph !== 0) return { w, h, n, data: raw.length === w * h * n ? raw : raw.subarray(0, w * h * n), photometric: ph };
      const out = new Uint8Array(w * h * n);
      for (let i = 0, j = 0, p = 0; p < w * h; p++, i += spp, j += n) for (let c = 0; c < n; c++) out[j + c] = ph === 0 ? 255 - raw[i + c] : raw[i + c];
      return { w, h, n, data: out, photometric: ph === 0 ? 1 : ph };
    }
    const rgba = UTIF.toRGBA8(ifd); return fromRGBA(rgba, w, h);
  }
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime || "image/png" }));
  const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0); const id = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return fromRGBA(id.data, bmp.width, bmp.height);
}

/** Rows of a stored TIFF read strip by strip over HTTP ranges (never the whole file in memory), averaged down by f. */
async function* tiffRows(info: TiffInfo, url: string, sx0: number, sx1: number, sy0: number, sy1: number, f: number, n: number) {
  const read = urlReader(url), ph = info.photometric, spp = info.spp;
  const rw = Math.ceil((sx1 - sx0) / f); const acc = new Float64Array(rw * n); let cnt = 0;
  const first = Math.floor(sy0 / info.rps), last = Math.floor((sy1 - 1) / info.rps);
  let s = first; const total = last - first + 1;
  while (s <= last) {
    // read many strips per request: strips usually follow each other (sometimes with a pad byte between)
    let e = s;
    while (e + 1 <= last) { const end = info.offsets[e] + info.counts[e], nx = info.offsets[e + 1]; if (nx < end || nx - end > 65536 || nx + info.counts[e + 1] - info.offsets[s] > 24 * 1024 * 1024) break; e++; }
    const bytes = info.offsets[e] + info.counts[e] - info.offsets[s];
    const blob = await read(info.offsets[s], bytes);
    for (let k = s; k <= e; k++) {
      const raw = blob.subarray(info.offsets[k] - info.offsets[s], info.offsets[k] - info.offsets[s] + info.counts[k]);
      const { rows, data, rowLen } = await decodeStrip(info, raw.slice(), k);
      for (let r = 0; r < rows; r++) {
        const y = k * info.rps + r; if (y < sy0 || y >= sy1) continue;
        const ro = r * rowLen;
        for (let ox = 0; ox < rw; ox++) for (let dx = 0; dx < f; dx++) { const x = sx0 + ox * f + dx; if (x >= sx1) break; const si = ro + x * spp; for (let c = 0; c < n; c++) acc[ox * n + c] += ph === 0 ? 255 - data[si + c] : data[si + c]; }
        cnt++;
        if (cnt === f || y === sy1 - 1) {
          const out = new Uint8Array(rw * n);
          for (let ox = 0; ox < rw; ox++) { const xs = Math.min(f, sx1 - (sx0 + ox * f)); const div = cnt * xs; for (let c = 0; c < n; c++) out[ox * n + c] = (acc[ox * n + c] / div + 0.5) | 0; }
          acc.fill(0); cnt = 0; yield out;
        }
      }
    }
    post({ type: "progress", stage: "Reading the original", pct: (e - first + 1) / total });
    s = e + 1;
  }
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

self.onmessage = async (e: MessageEvent) => {
  let { url, mime, plan, raster, handle } = e.data as { url?: string; mime?: string; plan: Plan; raster?: Src; handle?: any };
  try {
    const t0 = Date.now();
    let src: Src | null = null; let win: { info: TiffInfo; gen: AsyncGenerator<Uint8Array>; rows: Map<number, Uint8Array>; next: number; w: number; h: number } | null = null;
    const { W, H } = outSize(plan);
    if (raster) src = raster;
    else {
      // stored TIFFs are read strip by strip: only the rows and columns the print needs, averaged down to the print resolution
      let info: TiffInfo | null = null;
      if (/tif/i.test(mime || "") || /\.tiff?(\?|&|$)/i.test(url || "")) { try { info = await readTiff(urlReader(url!)); } catch { info = null; } }
      const ph = info?.photometric ?? -1, nn = ph === 2 ? 3 : ph === 5 ? 4 : ph === 0 || ph === 1 ? 1 : 0;
      if (info && nn && info.spp >= nn && (info.bps === 8 || info.bps === 16) && [1, 5, 8, 32946, 32773].includes(info.compression) && info.offsets.length) {
        const d = plan.draws[0];
        let a0 = 0, a1 = 1, b0 = 0, b1 = 1;
        if (!plan.repeat) { a0 = clamp01(-d.x / d.w); a1 = clamp01((1 - d.x) / d.w); b0 = clamp01(-d.y / d.h); b1 = clamp01((1 - d.y) / d.h); }
        const sx0 = Math.floor(a0 * info.width), sx1 = Math.max(sx0 + 1, Math.ceil(a1 * info.width)), sy0 = Math.floor(b0 * info.height), sy1 = Math.max(sy0 + 1, Math.ceil(b1 * info.height));
        const f = Math.max(1, Math.floor(info.width / Math.max(1, d.w * W)));
        const rw = Math.ceil((sx1 - sx0) / f), rh = Math.ceil((sy1 - sy0) / f);
        const sub: Plan = plan.repeat ? plan : { ...plan, draws: [{ x: d.x + (sx0 / info.width) * d.w, y: d.y + (sy0 / info.height) * d.h, w: ((sx1 - sx0) / info.width) * d.w, h: ((sy1 - sy0) / info.height) * d.h }] };
        plan = sub;
        const gen = tiffRows(info, url!, sx0, sx1, sy0, sy1, f, nn);
        if (plan.repeat) { // the whole tile in memory (tiles are small)
          const data = new Uint8Array(rw * rh * nn); let y = 0; for await (const row of gen) { data.set(row, y * rw * nn); y++; }
          src = { w: rw, h: rh, n: nn, data, photometric: ph === 0 ? 1 : ph };
        } else win = { info, gen, rows: new Map(), next: 0, w: rw, h: rh };
        (self as any).__ph = ph === 0 ? 1 : ph; (self as any).__n = nn;
      } else { const bytes = await download(url!); post({ type: "progress", stage: "Reading the original", pct: 0 }); src = await decode(bytes, mime || ""); }
    }
    const n = src ? src.n : (self as any).__n as number; const photometric = src ? src.photometric : (self as any).__ph as number;
    if (W > 4_000_000 || H > 4_000_000) throw new Error("This wall is too large for one file.");
    const R = Math.max(1, Math.min(H, Math.floor(6_000_000 / (W * n))));
    const cmap = columnMap(src ?? ({ w: win!.w, h: win!.h, n, data: new Uint8Array(0), photometric } as Src), plan, W);
    const buf = new Uint8Array(W * R * n);
    const offsets: number[] = [], counts: number[] = [];
    let pos = 16; const parts: Blob[] = [];
    const writer = handle ? await handle.createWritable() : null;
    if (writer) await writer.write({ type: "write", position: 0, data: new Uint8Array(16) });
    for (let y = 0; y < H; y += R) {
      const rows = Math.min(R, H - y), view = rows === R ? buf : buf.subarray(0, W * rows * n);
      if (src) renderRows(src, plan, W, H, y, rows, view, cmap);
      else {
        const wn = win!; const { lo, hi } = rowsNeeded(plan, wn.h, H, y, rows);
        while (wn.next <= hi) { const r = await wn.gen.next(); if (r.done) break; wn.rows.set(wn.next, r.value); wn.next++; }
        for (const k of [...wn.rows.keys()]) if (k < lo) wn.rows.delete(k);
        const lastRow = wn.rows.get(wn.next - 1)!;
        renderRowsWindow(wn.w, wn.h, n, photometric, (yy) => wn.rows.get(yy) ?? lastRow, plan, W, H, y, rows, view, cmap);
      }
      let c = lzwEncode(view);
      if (c.length % 2) { const c2 = new Uint8Array(c.length + 1); c2.set(c); offsets.push(pos); counts.push(c.length); c = c2; } else { offsets.push(pos); counts.push(c.length); }
      if (writer) await writer.write({ type: "write", position: pos, data: c }); else parts.push(new Blob([c]));
      pos += c.length;
      post({ type: "progress", stage: "Making the print file", pct: (y + rows) / H });
    }
    const tail = tiffTail({ W, H, n, photometric: photometric === 0 ? 1 : photometric, rowsPerStrip: R, dpi: plan.dpi, offsets, counts, ifdOffset: pos });
    const size = pos + tail.ifd.length;
    if (writer) { await writer.write({ type: "write", position: pos, data: tail.ifd }); await writer.write({ type: "write", position: 0, data: tail.header }); await writer.close(); post({ type: "done", size, W, H, n, big: tail.big, secs: Math.round((Date.now() - t0) / 1000) }); }
    else { const blob = new Blob([tail.header, ...parts, tail.ifd], { type: "image/tiff" }); post({ type: "done", blob, size, W, H, n, big: tail.big, secs: Math.round((Date.now() - t0) / 1000) }); }
  } catch (err: any) {
    post({ type: "error", message: String(err?.message || err).slice(0, 300) });
  }
};
