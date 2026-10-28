/** Turns a texture photo into a light, seamless "grain" tile for real-scale overlays.
 * Crops away the edges (labels, vignetting), removes large shading (high-pass), keeps the fine grain,
 * centers it on near-white so `multiply` only adds the texture, and mirrors it 2x2 so it repeats without seams.
 * frac = the tile's width as a fraction of the photo's width (the photo covers `sampleIn` inches). */
const cache = new Map<string, Promise<{ url: string; frac: number }>>();
const CROP = 0.6;

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1;
  for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[o + x] = s / d; s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s / d; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}

export function textureTile(src: string): Promise<{ url: string; frac: number }> {
  let p = cache.get(src);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => reject(new Error("texture failed to load"));
    img.onload = () => {
      try {
        const sw = img.naturalWidth * CROP, sh = img.naturalHeight * CROP;
        const scale = Math.min(1, 384 / Math.max(sw, sh));
        const w = Math.max(16, Math.round(sw * scale)), h = Math.max(16, Math.round(sh * scale));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, img.naturalWidth * 0.06, img.naturalHeight * 0.06, sw, sh, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h);
        const g = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) g[i] = 0.299 * px.data[i * 4] + 0.587 * px.data[i * 4 + 1] + 0.114 * px.data[i * 4 + 2];
        const low = boxBlur(g, w, h, Math.max(3, Math.round(w / 24)));
        let sum = 0, sq = 0;
        for (let i = 0; i < w * h; i++) { const v = g[i] - low[i]; g[i] = v; sum += v; sq += v * v; }
        const mean = sum / (w * h), sd = Math.sqrt(Math.max(1e-6, sq / (w * h) - mean * mean));
        const T = document.createElement("canvas"); T.width = w * 2; T.height = h * 2;
        const tctx = T.getContext("2d")!;
        const out = tctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const z = Math.max(-2.5, Math.min(2.5, (g[i] - mean) / sd));
          const v = Math.round(Math.min(255, 232 + z * 22));
          out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
        }
        c.getContext("2d")!.putImageData(out, 0, 0);
        // mirror 2x2 => seamless repeat
        tctx.drawImage(c, 0, 0);
        tctx.save(); tctx.translate(w * 2, 0); tctx.scale(-1, 1); tctx.drawImage(c, 0, 0); tctx.restore();
        tctx.save(); tctx.translate(0, h * 2); tctx.scale(1, -1); tctx.drawImage(c, 0, 0); tctx.restore();
        tctx.save(); tctx.translate(w * 2, h * 2); tctx.scale(-1, -1); tctx.drawImage(c, 0, 0); tctx.restore();
        T.toBlob((b) => b ? resolve({ url: URL.createObjectURL(b), frac: CROP * 2 }) : reject(new Error("tile")), "image/png");
      } catch (e) { reject(e); }
    };
    img.src = src;
  });
  p.catch(() => cache.delete(src));
  cache.set(src, p);
  return p;
}
