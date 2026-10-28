// read pixel size from the first bytes of an image (jpeg/png/tiff/webp/psd)
export function imageDims(b: Uint8Array): { width: number; height: number; type: string } | null {
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
