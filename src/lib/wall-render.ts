import type { Design } from "@/lib/catalog";
import { cropArtwork, panelGeometry, tileGeometry, initialWall, repeatStyle, type WallSelection } from "@/lib/wall-selection";
import { autoFurnitureMask, maskCanvas, type AutoMask } from "@/lib/room-mask";

export type P = { x: number; y: number };
export type RoomWall = { side: string; corners: P[]; objects?: { label: string; polygon: P[] }[]; widthIn: number; heightIn: number };
export type RoomStroke = { mode: "paper" | "keep"; r: number; pts: P[] };

/** Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) to quad q. */
export function homography(q: P[]) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u: number, v: number): P => { const w = g * u + h * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }; };
}
export function drawTri(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: P[], d: P[]) {
  const [s0, s1, s2] = s, [d0, d1, d2] = d;
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (!den) return;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const b = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const c = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - b * s0.y, f = d0.y - c * s0.x - dd * s0.y;
  // grow the clip triangle slightly to hide seams
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (p: P) => { const vx = p.x - cx, vy = p.y - cy, l = Math.hypot(vx, vy) || 1; return { x: p.x + (vx / l) * 0.8, y: p.y + (vy / l) * 0.8 }; };
  const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.closePath(); ctx.clip();
  ctx.setTransform(a, c, b, dd, e, f); ctx.drawImage(img, 0, 0); ctx.restore();
}
export function warp(ctx: CanvasRenderingContext2D, art: HTMLCanvasElement, quadPx: P[]) {
  const H = homography(quadPx), N = 14, W = art.width, Ht = art.height;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
    const s00 = { x: u0 * W, y: v0 * Ht }, s10 = { x: u1 * W, y: v0 * Ht }, s11 = { x: u1 * W, y: v1 * Ht }, s01 = { x: u0 * W, y: v1 * Ht };
    const d00 = H(u0, v0), d10 = H(u1, v0), d11 = H(u1, v1), d01 = H(u0, v1);
    drawTri(ctx, art, [s00, s10, s11], [d00, d10, d11]);
    drawTri(ctx, art, [s00, s11, s01], [d00, d11, d01]);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
export const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load the picture.")); i.src = src; });

/** The wallpaper exactly as it would be printed for a wall of widthIn x heightIn, with panel guides. */
export async function wallArt(design: Design, selection: WallSelection, widthIn: number, heightIn: number, panels: boolean) {
  const unit = selection.unit, conv = (inch: number) => (unit === "cm" ? inch * 2.54 : unit === "ft" ? inch / 12 : inch);
  const sel: WallSelection = { ...selection, width: conv(widthIn), height: conv(heightIn) };
  const W = 1400, H = Math.max(40, Math.round((W * heightIn) / widthIn));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  if (design.kind === "mural") {
    const blob = await cropArtwork(design.image, sel);
    const url = URL.createObjectURL(blob);
    try { const img = await loadImg(url); ctx.drawImage(img, 0, 0, W, H); } finally { URL.revokeObjectURL(url); }
  } else {
    const img = await loadImg(design.image);
    const { tw, th } = tileGeometry(design as any, { ...sel, artRatio: img.naturalWidth / img.naturalHeight });
    const pw = Math.max(4, tw * W), ph = Math.max(4, th * H);
    const hd = (design as any).match === "halfdrop" && repeatStyle(design as any) === "both";
    for (let i = 0, x = 0; x < W; i++, x += pw) for (let y = hd && i % 2 ? -ph / 2 : 0; y < H; y += ph) ctx.drawImage(img, x, y, pw, ph);
  }
  if (panels) {
    const g = panelGeometry(widthIn, "in");
    ctx.save();
    g.guides.forEach((gd) => { ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillRect(gd.start * W, 0, Math.max(2, gd.overlap * W), H); ctx.fillStyle = "rgba(20,20,20,0.85)"; ctx.fillRect(gd.start * W - 1.5, 0, 3, H); });
    ctx.font = `600 ${Math.max(18, Math.round(W / 40))}px system-ui, sans-serif`; ctx.textBaseline = "top";
    const starts = [0, ...g.guides.map((gd) => gd.start)];
    starts.forEach((s, i) => { const label = String(i + 1); const x = s * W + 10; ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(x - 4, 8, ctx.measureText(label).width + 12, Math.max(22, W / 34)); ctx.fillStyle = "#111"; ctx.fillText(label, x + 2, 10); });
    ctx.restore();
  }
  return c;
}

/** Hue (degrees) and saturation of a colour; both stay put when light or shadow changes its brightness. */
export function hueSat(r: number, g: number, b: number): [number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (!mx || !c) return [0, 0];
  const h = mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return [h * 60, c / mx];
}
const wallHS = (wc: [number, number]) => hueSat(wc[0], wc[1], 1 - wc[0] - wc[1]);
const hueDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** A wall painted a clear colour (not white / grey / beige): furniture can be told apart pixel by pixel by its colour. */
export const isColouredWall = (wc?: [number, number]) => !!wc && wallHS(wc)[1] > 0.3;
/** How much a pixel looks like the coloured wall (1 = wall, 0 = something else). */
function wallLike(r: number, g: number, b: number, h0: number, s0: number) {
  const [h, s] = hueSat(r, g, b);
  const hs = 1 - Math.min(1, Math.max(0, (hueDiff(h, h0) - 20) / 14));
  const ss = Math.min(1, Math.max(0, (s - 0.3 * s0) / (0.15 * s0)));
  return hs * ss;
}
export function colourWallCanvas(px: ImageData, quad: P[], wc: [number, number]) {
  const W = px.width, H = px.height, d = px.data;
  const [h0, s0] = wallHS(wc);
  const q = quad.map((p) => ({ x: p.x * W, y: p.y * H }));
  const out = new ImageData(W, H), o = out.data;
  const minX = Math.max(0, Math.floor(Math.min(...q.map((p) => p.x)))), maxX = Math.min(W - 1, Math.ceil(Math.max(...q.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...q.map((p) => p.y)))), maxY = Math.min(H - 1, Math.ceil(Math.max(...q.map((p) => p.y))));
  const edges = q.map((a, i) => { const b = q[(i + 1) % 4]; return [a.x, a.y, b.x - a.x, b.y - a.y]; });
  const sgn = Math.sign((q[1].x - q[0].x) * (q[2].y - q[0].y) - (q[1].y - q[0].y) * (q[2].x - q[0].x)) || 1;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    let ins = true;
    for (const [ax, ay, ex, ey] of edges) if (sgn * (ex * (y + 0.5 - ay) - ey * (x + 0.5 - ax)) < 0) { ins = false; break; }
    if (!ins) continue;
    const k = (y * W + x) * 4, r = d[k], g = d[k + 1], b = d[k + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    let a = 1 - wallLike(r, g, b, h0, s0);
    if (L < 22) a = 1;
    o[k] = o[k + 1] = o[k + 2] = 255; o[k + 3] = Math.round(a * 255);
  }
  // drop specks (a 1-2 px fleck of off-colour on the wall is noise, not furniture)
  const a2 = new Uint8ClampedArray(W * H);
  for (let y = minY + 1; y < maxY; y++) for (let x = minX + 1; x < maxX; x++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += o[((y + dy) * W + x + dx) * 4 + 3];
    a2[y * W + x] = s / 9 < 100 ? 0 : o[(y * W + x) * 4 + 3];
  }
  for (let i = 0; i < W * H; i++) o[i * 4 + 3] = a2[i];
  const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d")!.putImageData(out, 0, 0);
  return c;
}

/** Where the wall probably is, when nothing better is known: the area around the middle of the photo that shares the
 *  wall's colour (shadows allowed), as 4 corners. A clear-coloured wall gets a little extra margin, because anything
 *  that is not the wall's colour is kept in front anyway. */
export function guessWall(px: ImageData): P[] {
  return guessWallFound(px) ?? [{ x: 0.03, y: 0.04 }, { x: 0.97, y: 0.04 }, { x: 0.97, y: 0.82 }, { x: 0.03, y: 0.82 }];
}
/** Same as guessWall, but null when nothing wall-like was found (never a whole-photo rectangle). */
export function guessWallFound(px: ImageData): P[] | null {
  const s = Math.min(1, 220 / Math.max(px.width, px.height));
  const W = Math.max(16, Math.round(px.width * s)), H = Math.max(16, Math.round(px.height * s)), d = px.data;
  const cr = new Float32Array(W * H), cg = new Float32Array(W * H), L = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (Math.min(px.height - 1, Math.floor((y + 0.5) / s)) * px.width + Math.min(px.width - 1, Math.floor((x + 0.5) / s))) * 4;
    const r = d[k], g = d[k + 1], b = d[k + 2], t = r + g + b + 1, i = y * W + x;
    cr[i] = r / t; cg[i] = g / t; L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const med = (a: number[]) => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1] ?? 0; };
  const ref: number[] = [];
  for (let y = Math.round(H * 0.18); y < H * 0.45; y++) for (let x = Math.round(W * 0.3); x < W * 0.7; x++) ref.push(y * W + x);
  const wc: [number, number] = [med(ref.map((i) => cr[i])), med(ref.map((i) => cg[i]))], wl = med(ref.map((i) => L[i]));
  const coloured = isColouredWall(wc);
  const [h0, s0] = wallHS(wc);
  const match = (i: number) => coloured ? L[i] > 18 && wallLike(cr[i], cg[i], 1 - cr[i] - cg[i], h0, s0) > 0.5 : Math.hypot(cr[i] - wc[0], cg[i] - wc[1]) < 0.022 && L[i] > wl * 0.7 && L[i] < wl * 1.22;
  const fallback = null;
  const colCov = (x: number, y0: number, y1: number) => { let n = 0, m = 0; for (let y = y0; y < y1; y++) { n++; if (match(y * W + x)) m++; } return n ? m / n : 0; };
  const rowCov = (y: number, x0: number, x1: number) => { let n = 0, m = 0; for (let x = x0; x <= x1; x++) { n++; if (match(y * W + x)) m++; } return n ? m / n : 0; };
  const spread = (from: number, step: number, lim: number, cov: (v: number) => number, th: number, gap: number) => {
    let edge = from, miss = 0;
    for (let v = from; step > 0 ? v <= lim : v >= lim; v += step) { if (cov(v) >= th) { edge = v; miss = 0; } else if (++miss > gap) break; }
    return edge;
  };
  const yb0 = Math.round(H * 0.15), yb1 = Math.round(H * 0.55), cx = Math.round(W / 2);
  if (colCov(cx, yb0, yb1) < 0.3) return fallback;
  const left = spread(cx, -1, 0, (x) => colCov(x, yb0, yb1), 0.3, Math.round(W * 0.04));
  const right = spread(cx, 1, W - 1, (x) => colCov(x, yb0, yb1), 0.3, Math.round(W * 0.04));
  const cy = Math.round(H * 0.3);
  const top = spread(cy, -1, 0, (y) => rowCov(y, left, right), 0.4, Math.round(H * 0.03));
  const bottom = spread(cy, 1, H - 1, (y) => rowCov(y, left, right), 0.12, Math.round(H * 0.03));
  if ((right - left) < W * 0.25 || (bottom - top) < H * 0.25) return fallback;
  const m = coloured ? 0.015 : 0;
  const X0 = Math.max(0, left / W - m), X1 = Math.min(1, (right + 1) / W + m), Y0 = Math.max(0, top / H - m), Y1 = Math.min(1, (bottom + 1) / H + m);
  return [{ x: X0, y: Y0 }, { x: X1, y: Y0 }, { x: X1, y: Y1 }, { x: X0, y: Y1 }];
}

/** A saved room photo, ready to draw on: its pixels at working size (max 1280 px). */
export type LoadedRoom = { key: string; url: string; w: number; h: number; pixels: ImageData; walls: RoomWall[]; keep: boolean; strokes: RoomStroke[]; autos: (AutoMask | null)[]; exact?: HTMLCanvasElement };

/** A sample room's hand-checked furniture mask (white = in front) as an alpha canvas at w x h. */
export async function exactMaskCanvas(src: string, w: number, h: number) {
  const mimg = await loadImg(src);
  const mc = document.createElement("canvas"); mc.width = w; mc.height = h; const mx = mc.getContext("2d")!; mx.drawImage(mimg, 0, 0, w, h);
  const md = mx.getImageData(0, 0, w, h); for (let k = 0; k < md.data.length; k += 4) { const v = md.data[k]; md.data[k] = md.data[k + 1] = md.data[k + 2] = 255; md.data[k + 3] = v; } mx.putImageData(md, 0, 0);
  return mc;
}

export async function loadRoom(key: string, src: Blob | string, walls: RoomWall[], keep = true, strokes: RoomStroke[] = [], mask?: string): Promise<LoadedRoom> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = await loadImg(url);
  const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const exact = mask ? await exactMaskCanvas(mask, w, h).catch(() => undefined) : undefined;
  const autos = walls.map((wl) => (exact || wl.objects?.length ? null : autoFurnitureMask(pixels, wl.corners)));
  return { key, url, w, h, pixels, walls, keep, strokes, autos, exact };
}

/** Furniture in front of the wall: automatic cut-out (when sure) or the shopper's outlines, then their brush strokes. */
export function furnitureAlpha(room: LoadedRoom): Uint8ClampedArray {
  const fc = document.createElement("canvas"); fc.width = room.w; fc.height = room.h;
  const fx = fc.getContext("2d")!; fx.fillStyle = "#fff";
  if (room.keep && room.exact) fx.drawImage(room.exact, 0, 0, room.w, room.h);
  else if (room.keep) room.walls.forEach((wl, n) => {
    if (wl.objects?.length) for (const o of wl.objects) { fx.beginPath(); o.polygon.forEach((p, k) => (k ? fx.lineTo(p.x * room.w, p.y * room.h) : fx.moveTo(p.x * room.w, p.y * room.h))); fx.closePath(); fx.fill(); }
    else { const a = room.autos[n]; if (a && isColouredWall(a.wc)) fx.drawImage(colourWallCanvas(room.pixels, wl.corners, a.wc!), 0, 0); else if (a && a.sure && a.frac > 0) fx.drawImage(maskCanvas(a), 0, 0, room.w, room.h); }
  });
  fx.lineCap = "round"; fx.lineJoin = "round"; fx.strokeStyle = "#fff";
  for (const st of room.strokes) {
    fx.globalCompositeOperation = st.mode === "keep" ? "source-over" : "destination-out";
    const lw = st.r * 2 * room.w; fx.lineWidth = lw;
    fx.beginPath(); st.pts.forEach((p, k) => (k ? fx.lineTo(p.x * room.w, p.y * room.h) : fx.moveTo(p.x * room.w, p.y * room.h)));
    if (st.pts.length === 1) { fx.arc(st.pts[0].x * room.w, st.pts[0].y * room.h, lw / 2, 0, Math.PI * 2); fx.fill(); } else fx.stroke();
  }
  fx.globalCompositeOperation = "source-over";
  return fx.getImageData(0, 0, room.w, room.h).data;
}

/** Blend a warped wallpaper layer into the photo, keeping the wall's light and shadow. */
export function blendWallpaper(out: ImageData, photo: ImageData, layer: ImageData, F: Uint8ClampedArray) {
  const A = layer.data, Pp = photo.data, R = out.data;
  let sum = 0, n = 0;
  for (let i = 0; i < A.length; i += 16) if (A[i + 3] > 200 && F[i + 3] < 128) { sum += 0.299 * Pp[i] + 0.587 * Pp[i + 1] + 0.114 * Pp[i + 2]; n++; }
  const L = n ? sum / n : 200;
  for (let i = 0; i < A.length; i += 4) {
    const a = (A[i + 3] / 255) * (1 - F[i + 3] / 255);
    if (a <= 0) { R[i] = Pp[i]; R[i + 1] = Pp[i + 1]; R[i + 2] = Pp[i + 2]; R[i + 3] = 255; continue; }
    const sh = Math.min(1.15, Math.max(0.3, (0.299 * Pp[i] + 0.587 * Pp[i + 1] + 0.114 * Pp[i + 2]) / L));
    R[i] = Pp[i] * (1 - a) + Math.min(255, A[i] * sh) * a; R[i + 1] = Pp[i + 1] * (1 - a) + Math.min(255, A[i + 1] * sh) * a; R[i + 2] = Pp[i + 2] * (1 - a) + Math.min(255, A[i + 2] * sh) * a; R[i + 3] = 255;
  }
  return out;
}

const renderCache = new Map<string, string>();
let furnCache: { key: string; F: Uint8ClampedArray } | null = null;
/** The room with this design on its walls, as a JPEG object URL (cached per room + design). */
export async function renderOnRoom(room: LoadedRoom, design: Design): Promise<string> {
  const ck = `${room.key}|${design.slug}|${design.image}`;
  const hit = renderCache.get(ck); if (hit) return hit;
  const lc = document.createElement("canvas"); lc.width = room.w; lc.height = room.h;
  const lctx = lc.getContext("2d")!;
  for (const wl of room.walls) {
    const art = await wallArt(design, initialWall, wl.widthIn, wl.heightIn, false);
    warp(lctx, art, wl.corners.map((c) => ({ x: c.x * room.w, y: c.y * room.h })));
  }
  if (!furnCache || furnCache.key !== room.key) furnCache = { key: room.key, F: furnitureAlpha(room) };
  const out = new ImageData(room.w, room.h);
  blendWallpaper(out, room.pixels, lctx.getImageData(0, 0, room.w, room.h), furnCache.F);
  const oc = document.createElement("canvas"); oc.width = room.w; oc.height = room.h; oc.getContext("2d")!.putImageData(out, 0, 0);
  const blob: Blob = await new Promise((res, rej) => oc.toBlob((b) => (b ? res(b) : rej(new Error("Could not draw the wallpaper."))), "image/jpeg", 0.86));
  const url = URL.createObjectURL(blob);
  if (renderCache.size > 40) { const [k, v] = renderCache.entries().next().value!; URL.revokeObjectURL(v); renderCache.delete(k); }
  renderCache.set(ck, url);
  return url;
}
