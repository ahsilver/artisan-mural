import sampleRooms from "./sample-rooms.json";
/** Furniture masks for "See it in your room": exact hand-made masks for the built-in sample rooms, and a careful
 * automatic mask for uploaded photos (keeps only things standing on the floor that clearly differ from the wall). */
export type P = { x: number; y: number };

/** Built-in sample rooms (config: lib/sample-rooms.json; pictures: public/s/rooms/). Corners are the feature wall
 * (fractions of the photo, TL, TR, BR, BL); widthIn/heightIn its real size; mask: grayscale, white = furniture in front. */
export type SampleRoom = { id: string; type: string; name: string; image: string; thumb: string; mask: string; corners: P[]; widthIn: number; heightIn: number; category?: string };
export const ROOM_CATEGORIES = [{ id: "home", name: "Home" }, { id: "office", name: "Office" }, { id: "healthcare", name: "Healthcare" }] as const;
export const categoryOf = (r: { category?: string } | null | undefined) => r?.category || "home";
export const SAMPLE_ROOMS: SampleRoom[] = sampleRooms as SampleRoom[];
/** One room per type (the first variant), in the config's order. */
export const SAMPLE_TYPES: SampleRoom[] = SAMPLE_ROOMS.filter((r, i) => SAMPLE_ROOMS.findIndex((x) => x.type === r.type) === i);
export const variantsOf = (type: string) => SAMPLE_ROOMS.filter((r) => r.type === type);

/** 3x3 homography taking the unit square (0,0),(1,0),(1,1),(0,1) to quad q. */
function squareToQuad(q: P[]) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h, 1];
}
function inv3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

export type AutoMask = { W: number; H: number; m: Float32Array; sure: boolean; frac: number; why: string; wc?: [number, number] };

/** Careful automatic cut-out for an uploaded photo.
 * - The wall's colour and brightness are read from the upper part of the chosen wall, per column (light changes across a wall).
 * - Furniture stands on the floor: each column is scanned up from the bottom of the wall while there is "stuff"
 *   (edges, or colours that clearly differ from the wall). A smooth stretch of plain wall ends the scan.
 * - The top of a piece can never be a pale pixel with the wall's own colour (sunlit or lamp-lit wall stays wall).
 * - Narrow dips are closed and 1-2 px spikes removed, then the edges are softened.
 * - Doubtful result (much unexplained detail low on the wall, or too much area): sure=false and an empty mask. */
export function autoFurnitureMask(px: ImageData, quad: P[]): AutoMask {
  const s = Math.min(1, 360 / Math.max(px.width, px.height));
  const W = Math.max(8, Math.round(px.width * s)), H = Math.max(8, Math.round(px.height * s));
  const N = W * H, src = px.data;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const bx = px.width / W, by = px.height / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * bx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * bx)), y0 = Math.floor(y * by), y1 = Math.max(y0 + 1, Math.floor((y + 1) * by));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const k = (yy * px.width + xx) * 4; r += src[k]; g += src[k + 1]; b += src[k + 2]; n++; }
    const i = y * W + x; R[i] = r / n; G[i] = g / n; B[i] = b / n;
  }
  const Hi = inv3(squareToQuad(quad.map((q) => ({ x: q.x * W, y: q.y * H }))));
  const U = new Float32Array(N), V = new Float32Array(N), inside = new Uint8Array(N);
  let wallArea = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + 0.5, Y = y + 0.5, w = Hi[6] * X + Hi[7] * Y + Hi[8];
    const u = (Hi[0] * X + Hi[1] * Y + Hi[2]) / w, v = (Hi[3] * X + Hi[4] * Y + Hi[5]) / w, i = y * W + x;
    U[i] = u; V[i] = v;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { inside[i] = 1; wallArea++; }
  }
  const empty = (why: string): AutoMask => ({ W, H, m: new Float32Array(N), sure: false, frac: 0, why });
  if (wallArea < 200) return empty("wall too small");
  const L = new Float32Array(N), CR = new Float32Array(N), CG = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i]; const t = R[i] + G[i] + B[i] + 1; CR[i] = R[i] / t; CG[i] = G[i] / t; }
  const refIdx: number[] = [];
  for (let i = 0; i < N; i++) if (inside[i] && V[i] < 0.45) refIdx.push(i);
  if (refIdx.length < 100) return empty("not enough wall");
  const med = (a: ArrayLike<number>) => { const b = Array.from(a).sort((p, q) => p - q); return b[b.length >> 1]; };
  const rcr = med(refIdx.map((i) => CR[i])), rcg = med(refIdx.map((i) => CG[i]));
  const DC = new Float32Array(N);
  for (let i = 0; i < N; i++) DC[i] = Math.hypot(CR[i] - rcr, CG[i] - rcg);
  const refL = med(refIdx.map((i) => L[i]));
  const colSum = new Float32Array(W), colN = new Float32Array(W);
  for (const i of refIdx) if (DC[i] < 0.025) { const x = i % W; colSum[x] += L[i]; colN[x]++; }
  const col = new Float32Array(W);
  for (let x = 0; x < W; x++) col[x] = colN[x] >= 4 ? colSum[x] / colN[x] : refL;
  const C = new Float32Array(W);
  for (let x = 0; x < W; x++) { let t = 0; for (let k = -6; k <= 6; k++) t += col[Math.min(W - 1, Math.max(0, x + k))]; C[x] = t / 13; }
  // edges
  const Gm = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; Gm[i] = Math.hypot(L[i + 1] - L[i - 1], L[i + W] - L[i - W]); }
  const T = Math.max(14, 3 * med(refIdx.map((i) => Gm[i])));
  const pale = new Uint8Array(N), busy = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    const c = C[i % W];
    pale[i] = (L[i] >= 0.8 * c && DC[i] < 0.05) || (L[i] >= 1.1 * c && DC[i] < 0.12) ? 1 : 0;
    const solid = !pale[i] && (DC[i] > 0.045 || L[i] < 0.55 * c);
    busy[i] = Gm[i] > T || solid ? 1 : 0;
  }
  // per column: furniture height above the bottom of the wall
  const h = new Float32Array(W), bot = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let y0 = -1, y1 = -1;
    for (let y = 0; y < H; y++) { const i = y * W + x; if (inside[i] && U[i] > 0.012 && U[i] < 0.988) { if (y0 < 0) y0 = y; y1 = y; } }
    if (y0 < 0 || y1 - y0 < 10) continue;
    bot[x] = y1; const gap = Math.max(3, Math.round(0.05 * (y1 - y0)));
    let last = -1, smooth = 0;
    for (let y = y1; y >= y0; y--) {
      const i = y * W + x;
      if (busy[i]) { smooth = 0; if (!pale[i] || Gm[i] > 2 * T) last = y; }
      else if (++smooth > gap) break;
    }
    if (last >= 0) h[x] = y1 - last + 1;
  }
  const win = (a: Float32Array, size: number, f: (v: number[]) => number) => { const o = new Float32Array(a.length), r = size >> 1; for (let x = 0; x < a.length; x++) { const v: number[] = []; for (let k = -r; k <= r; k++) v.push(a[Math.min(a.length - 1, Math.max(0, x + k))]); o[x] = f(v); } return o; };
  const mx = (v: number[]) => Math.max(...v), mn = (v: number[]) => Math.min(...v);
  const hc = win(win(h, 11, mx), 11, mn); // close narrow dips (pale cushions)
  const ho = win(win(hc, 3, mn), 3, mx);  // drop 1-2 px spikes
  const keep = new Uint8Array(N);
  for (let x = 0; x < W; x++) if (ho[x] > 0) for (let y = Math.max(0, Math.round(bot[x] - ho[x] + 1)); y < H; y++) if (inside[y * W + x]) keep[y * W + x] = 1;
  let kept = 0, lowN = 0, lowUnexplained = 0;
  for (let i = 0; i < N; i++) kept += keep[i];
  // unexplained detail low on the wall (things the cut-out missed) => doubtful
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!inside[i] || V[i] <= 0.5) continue; lowN++;
    if (Gm[i] <= T) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && keep[yy * W + xx]) { near = true; break; } }
    if (!near) lowUnexplained++;
  }
  const frac = kept / wallArea, unexplained = lowN ? lowUnexplained / lowN : 0;
  if (frac > 0.45) return { ...empty("too much would be cut out"), wc: [rcr, rcg] };
  if (unexplained > 0.03) return { ...empty("furniture hard to tell from the wall"), wc: [rcr, rcg] };
  // soften edges
  let m = new Float32Array(N);
  for (let i = 0; i < N; i++) m[i] = keep[i];
  const o = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { t += m[yy * W + xx]; n++; } }
    o[y * W + x] = inside[y * W + x] ? t / n : 0;
  }
  m = o;
  return { W, H, m, sure: true, frac, why: frac ? "ok" : "nothing in front", wc: [rcr, rcg] };
}

/** The auto mask as a canvas (white where furniture), for scaling up with smoothing. */
export function maskCanvas(a: { W: number; H: number; m: Float32Array }) {
  const c = document.createElement("canvas"); c.width = a.W; c.height = a.H;
  const ctx = c.getContext("2d")!; const img = ctx.createImageData(a.W, a.H);
  for (let i = 0; i < a.m.length; i++) { const k = i * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a.m[i] * 255); }
  ctx.putImageData(img, 0, 0); return c;
}
