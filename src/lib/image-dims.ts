// read pixel size from the first bytes of an image (jpeg/png/tiff/webp/psd)
export type Dims = { width: number; height: number; type: string; dpi?: number; vector?: boolean };
/** Pixel size + the DPI saved in the file (TIFF/PNG/JPEG/PSD), or for vector files (SVG/PDF/AI/EPS) the page size in points (72 per inch) with vector: true. */
export function imageDims(b: Uint8Array): Dims | null {
  const d = rasterDims(b);
  if (d) { const dpi = fileDpi(b, d.type); return dpi ? { ...d, dpi } : d; }
  return vectorDims(b);
}
const okDpi = (v: number) => (v >= 10 && v <= 5000 ? Math.round(v * 100) / 100 : undefined);
function fileDpi(b: Uint8Array, type: string): number | undefined {
  const u16 = (o: number, le = false) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number, le = false) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const tiffAt = (base: number, max: number) => { // TIFF/EXIF IFD0 X resolution + unit
    const le = b[base] === 0x49; let ifd = base + u32(base + 4, le); if (ifd + 2 > max) return undefined;
    const n = u16(ifd, le); let x = 0, unit = 2;
    for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (e + 12 > max) break; const tag = u16(e, le), type = u16(e + 2, le);
      if (tag === 282 && type === 5) { const o = base + u32(e + 8, le); if (o + 8 <= max) { const den = u32(o + 4, le); x = den ? u32(o, le) / den : 0; } }
      if (tag === 296) unit = u16(e + 8, le); }
    return x ? okDpi(unit === 3 ? x * 2.54 : x) : undefined;
  };
  try {
    if (type === "tiff") return tiffAt(0, b.length);
    if (type === "png") { let o = 8; while (o + 12 < b.length) { const len = u32(o), t = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]); if (t === "pHYs") { const x = u32(o + 8); return b[o + 16] === 1 ? okDpi(x * 0.0254) : undefined; } if (t === "IDAT" || t === "IEND") break; o += 12 + len; } return undefined; }
    if (type === "jpeg") { let o = 2, jfif: number | undefined;
      while (o + 4 < b.length && b[o] === 0xff) { const m = b[o + 1], len = u16(o + 2);
        if (m === 0xe0 && b[o + 4] === 0x4a && b[o + 5] === 0x46 && b[o + 6] === 0x49 && b[o + 7] === 0x46) { const unit = b[o + 11], x = u16(o + 12); if (unit === 1) jfif = okDpi(x); else if (unit === 2) jfif = okDpi(x * 2.54); }
        if (m === 0xe1 && b[o + 4] === 0x45 && b[o + 5] === 0x78 && b[o + 6] === 0x69 && b[o + 7] === 0x66) { const v = tiffAt(o + 10, Math.min(b.length, o + 2 + len)); if (v) return v; }
        if (m === 0xda) break; o += 2 + len; }
      return jfif; }
    if (type === "psd") { const cm = u32(26); let o = 30 + cm + 4; const end = o + u32(o - 4);
      while (o + 12 < end && o + 12 < b.length) { if (b[o] !== 0x38) break; const id = u16(o + 4); const nl = b[o + 6]; let p = o + 6 + 1 + nl; if ((1 + nl) % 2) p++; const sz = u32(p); p += 4;
        if (id === 0x03ed) { const h = u32(p) / 65536, unit = u16(p + 4); return okDpi(unit === 2 ? h * 2.54 : h); } o = p + sz + (sz % 2); } }
  } catch {}
  return undefined;
}
function vectorDims(b: Uint8Array): Dims | null {
  const head = new TextDecoder("latin1").decode(b.subarray(0, Math.min(b.length, 4 * 1024 * 1024)));
  const num = (s: string | undefined) => { const m = s?.match(/^\s*([\d.]+)\s*(px|pt|in|mm|cm)?/); if (!m) return 0; const v = parseFloat(m[1]); return m[2] === "in" ? v * 72 : m[2] === "mm" ? v * 72 / 25.4 : m[2] === "cm" ? v * 72 / 2.54 : m[2] === "px" ? v * 0.75 : v; };
  if (/^(\xef\xbb\xbf)?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head.slice(0, 4000)) || /<svg[\s>]/i.test(head.slice(0, 2000))) {
    const tag = head.match(/<svg[^>]*>/i)?.[0] ?? "";
    const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const w = num(tag.match(/\swidth\s*=\s*["']([^"']+)/i)?.[1]) || (vb ? parseFloat(vb[1]) * 0.75 : 0), h = num(tag.match(/\sheight\s*=\s*["']([^"']+)/i)?.[1]) || (vb ? parseFloat(vb[2]) * 0.75 : 0);
    return { width: Math.round(w) || 1000, height: Math.round(h) || 1000, type: "svg", vector: true };
  }
  if (head.startsWith("%PDF") || head.startsWith("%!PS")) {
    const bb = head.match(/\/(?:CropBox|MediaBox)\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/) || head.match(/%%(?:HiRes)?BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    const w = bb ? Math.abs(parseFloat(bb[3]) - parseFloat(bb[1])) : 0, h = bb ? Math.abs(parseFloat(bb[4]) - parseFloat(bb[2])) : 0;
    const type = head.startsWith("%PDF") ? (/Illustrator/i.test(head.slice(0, 200000)) ? "ai" : "pdf") : "eps";
    return { width: Math.round(w) || 1000, height: Math.round(h) || 1000, type, vector: true };
  }
  return null;
}
function rasterDims(b: Uint8Array): { width: number; height: number; type: string } | null {
  const u16 = (o: number, le = false) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number, le = false) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  if (b[0] === 0x89 && b[1] === 0x50) return { width: u32(16), height: u32(20), type: "png" };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o < b.length - 9) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { height: u16(o + 5), width: u16(o + 7), type: "jpeg" };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      o += 2 + u16(o + 2);
    }
    return null;
  }
  if ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)) {
    const le = b[0] === 0x49; const big = u16(2, le) === 43;
    if (big) return null;
    let ifd = u32(4, le); if (ifd + 2 > b.length) return null;
    const n = u16(ifd, le); let w = 0, h = 0;
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12; if (e + 12 > b.length) break;
      const tag = u16(e, le), type = u16(e + 2, le);
      const val = type === 3 ? u16(e + 8, le) : u32(e + 8, le);
      if (tag === 256) w = val; if (tag === 257) h = val;
    }
    return w && h ? { width: w, height: h, type: "tiff" } : null;
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const f = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (f === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), type: "webp" };
    if (f === "VP8 ") return { width: u16(26, true) & 0x3fff, height: u16(28, true) & 0x3fff, type: "webp" };
    if (f === "VP8L") { const v = u32(21, true); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1, type: "webp" }; }
  }
  if (b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53) return { height: u32(14), width: u32(18), type: "psd" };
  return null;
}
