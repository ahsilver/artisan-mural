/** Free, in-browser guess of a room's walls from one photo (no AI, no network).
 *  Model: one-point perspective. Lines where the side walls meet the floor and the ceiling run to one vanishing point
 *  (VP); the back wall is the upright rectangle around it; each side wall runs from the back wall's edge to the photo edge.
 *  Steps: edges (Sobel) -> VP by line voting -> the 4 rays from the VP (floor/ceiling, left/right) -> back-wall corners
 *  where the rays' edges stop and an upright edge sits -> walls. Says how sure it is; unsure = ask the shopper to tap. */
export type GP = { x: number; y: number };
export type GuessedWall = { side: "left" | "back" | "right"; corners: GP[]; widthIn: number; heightIn: number };
export type WallGuess = { walls: GuessedWall[]; confident: boolean; score: number; vp?: GP; why: string };

type Img = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
const D2R = Math.PI / 180;

export function guessRoomWalls(px: Img, backWidthIn = 120): WallGuess {
  const s = Math.min(1, 320 / Math.max(px.width, px.height));
  const W = Math.max(32, Math.round(px.width * s)), H = Math.max(32, Math.round(px.height * s)), N = W * H, d = px.data;
  // grey, box-averaged from the source (anti-aliased downscale)
  const g = new Float32Array(N);
  const fx = px.width / W, fy = px.height / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 0, n = 0;
    const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)), y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let yy = y0; yy < y1; yy += 1 + (fy > 3 ? 1 : 0)) for (let xx = x0; xx < x1; xx += 1 + (fx > 3 ? 1 : 0)) { const k = (yy * px.width + xx) * 4; t += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; n++; }
    g[y * W + x] = t / Math.max(1, n);
  }
  // light blur against wall/ceiling texture
  const blur = (a: Float32Array) => { const b = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { t += a[yy * W + xx]; n++; } } b[y * W + x] = t / n; } return b; };
  const b = blur(blur(g));
  const gx = new Float32Array(N), gy = new Float32Array(N), mag = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const a = b[i - W - 1], c = b[i - W + 1], e = b[i + W - 1], f = b[i + W + 1];
    gx[i] = (c + 2 * b[i + 1] + f) - (a + 2 * b[i - 1] + e);
    gy[i] = (e + 2 * b[i + W] + f) - (a + 2 * b[i - W] + c);
    mag[i] = Math.hypot(gx[i], gy[i]);
  }
  // keep the strongest ~9% (non-max suppressed along the gradient)
  const sorted = Float32Array.from(mag).sort();
  const thr = Math.max(6, sorted[Math.floor(N * 0.91)]);
  const ex: number[] = [], ey: number[] = [], edx: number[] = [], edy: number[] = [], ew: number[] = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, m = mag[i]; if (m < thr) continue;
    const ux = gx[i] / m, uy = gy[i] / m;
    const m1 = mag[Math.round(y + uy) * W + Math.round(x + ux)], m2 = mag[Math.round(y - uy) * W + Math.round(x - ux)];
    if (m < m1 || m < m2) continue;
    ex.push(x); ey.push(y); edx.push(-uy); edy.push(ux); ew.push(Math.min(m, thr * 4));
  }
  const E = ex.length;
  if (E < 200) return { walls: [], confident: false, score: 0, why: "too few edges" };

  // 1) vanishing point: every slanted edge pixel votes along its line
  const AX0 = Math.round(W * 0.08), AX1 = Math.round(W * 0.92), AY0 = Math.round(H * 0.12), AY1 = Math.round(H * 0.88);
  const AW = AX1 - AX0 + 1, AH = AY1 - AY0 + 1, acc = new Float32Array(AW * AH);
  for (let k = 0; k < E; k++) {
    const dx = edx[k], dy = edy[k];
    const ang = Math.abs(Math.atan2(dy, dx)) / D2R, a2 = ang > 90 ? 180 - ang : ang; // 0 = flat, 90 = upright
    if (a2 < 4 || a2 > 80) continue;
    if (Math.abs(dx) >= Math.abs(dy)) { const sl = dy / dx; for (let X = AX0; X <= AX1; X++) { const Y = Math.round(ey[k] + (X - ex[k]) * sl); if (Y >= AY0 && Y <= AY1) acc[(Y - AY0) * AW + (X - AX0)] += ew[k]; } }
    else { const sl = dx / dy; for (let Y = AY0; Y <= AY1; Y++) { const X = Math.round(ex[k] + (Y - ey[k]) * sl); if (X >= AX0 && X <= AX1) acc[(Y - AY0) * AW + (X - AX0)] += ew[k]; } }
  }
  // smooth with a 7x7 box and take the peak
  let best = -1, bx = 0, by = 0, sum = 0;
  const R = 3;
  for (let Y = R; Y < AH - R; Y++) for (let X = R; X < AW - R; X++) {
    let t = 0; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) t += acc[(Y + j) * AW + X + i];
    sum += t; if (t > best) { best = t; bx = X; by = Y; }
  }
  const meanAcc = sum / Math.max(1, (AW - 2 * R) * (AH - 2 * R));
  const vpRatio = best / Math.max(1e-6, meanAcc);
  const vx = bx + AX0, vy = by + AY0;

  // 2) rays from the VP: edge pixels lined up with the ray to the VP, binned by angle (0.5 deg) and distance
  const NB = 720, RB = 48, rmax = Math.hypot(W, H);
  const ray = new Float32Array(NB), rayR = new Float32Array(NB * RB);
  for (let k = 0; k < E; k++) {
    const rx = ex[k] - vx, ry = ey[k] - vy, rl = Math.hypot(rx, ry); if (rl < W * 0.05) continue;
    const cr = Math.abs((rx * edy[k] - ry * edx[k]) / rl); if (cr > Math.sin(2.5 * D2R)) continue;
    let a = Math.atan2(ry, rx) / D2R; if (a < 0) a += 360;
    const bi = Math.floor(a * 2) % NB; ray[bi] += ew[k];
    rayR[bi * RB + Math.min(RB - 1, Math.floor((rl / rmax) * RB))] += ew[k];
  }
  const sm = (bi: number) => { let t = 0; for (let j = -2; j <= 2; j++) t += ray[(bi + j + NB) % NB] * (j === 0 ? 1 : Math.abs(j) === 1 ? 0.8 : 0.4); return t; };
  // length of a ray inside the photo
  const rayLen = (a: number) => { const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R); let t = 1e9; if (ca > 1e-6) t = Math.min(t, (W - 1 - vx) / ca); if (ca < -1e-6) t = Math.min(t, -vx / ca); if (sa > 1e-6) t = Math.min(t, (H - 1 - vy) / sa); if (sa < -1e-6) t = Math.min(t, -vy / sa); return t; };
  type Ray = { a: number; score: number; dens: number };
  const pickRay = (lo: number, hi: number, flatEnd: number): Ray | null => {
    const cand: Ray[] = [];
    let qmax = 0;
    for (let bi = Math.ceil(lo * 2); bi <= Math.floor(hi * 2); bi++) qmax = Math.max(qmax, sm(bi % NB));
    if (qmax <= 0) return null;
    for (let bi = Math.ceil(lo * 2); bi <= Math.floor(hi * 2); bi++) {
      const v = sm(bi % NB); if (v < sm((bi - 1 + NB) % NB) || v < sm((bi + 1) % NB)) continue;
      const a = bi / 2, L = rayLen(a); const dens = v / Math.max(1, L * thr);
      if ((globalThis as any).__WGDEBUG && v >= qmax * 0.3) console.log("cand", lo, a, (v / qmax).toFixed(2), dens.toFixed(3));
      if (v >= qmax * 0.45 && dens > 0.06) cand.push({ a, score: v, dens });
    }
    if (!cand.length) return null;
    // the wall's edge is the strong ray nearest to flat (floor boards / ceiling lines sit on the other side)
    return cand.reduce((acc0, c) => (Math.abs(angDiff(c.a, flatEnd)) < Math.abs(angDiff(acc0.a, flatEnd)) ? c : acc0));
  };
  const floorR = pickRay(10, 80, 0), floorL = pickRay(100, 170, 180), ceilL = pickRay(185, 262, 180), ceilR = pickRay(278, 355, 360);
  const rayY = (r: Ray, x: number) => vy + (x - vx) * Math.tan(r.a * D2R);
  // where a ray's edges start (going out from the VP): the back wall's edge on that side
  const runStart = (r: Ray): number | null => {
    const bi = Math.round(r.a * 2) % NB, L = rayLen(r.a);
    const prof = new Float32Array(RB);
    for (let j = -2; j <= 2; j++) { const bb = (bi + j + NB) % NB; for (let q = 0; q < RB; q++) prof[q] += rayR[bb * RB + q]; }
    const qEnd = Math.min(RB - 1, Math.floor((L / rmax) * RB));
    const tot = prof.reduce((t, v, q) => (q <= qEnd ? t + v : t), 0); if (tot <= 0) return null;
    // the first distance from which 80% of the ray's support lies further out
    let run = 0;
    for (let q = 0; q <= qEnd; q++) { if (run >= tot * 0.12) return ((q - 0.5) / RB) * rmax; run += prof[q]; }
    return null;
  };
  const vert = (x: number, y0: number, y1: number) => { // share of an upright line with a same-signed upright edge
    const X = Math.round(x); if (X < 2 || X > W - 3) return 0;
    let n = 0, pos = 0, neg = 0;
    for (let y = Math.max(2, Math.round(y0)); y <= Math.min(H - 3, Math.round(y1)); y++) {
      n++; let bp = 0, bn = 0;
      for (let i = -1; i <= 1; i++) { const k = y * W + X + i, v = gx[k]; if (Math.abs(v) > 1.5 * Math.abs(gy[k]) && Math.abs(v) > thr * 0.35) { if (v > 0) bp = 1; else bn = 1; } }
      pos += bp; neg += bn;
    }
    return n ? Math.max(pos, neg) / n : 0;
  };
  const corner = (side: "left" | "right", fl: Ray | null, ce: Ray | null): { x: number; sure: number } | null => {
    if (!fl && !ce) return null;
    const ests: number[] = [];
    for (const r of [fl, ce]) if (r) { const rs = runStart(r); if (rs != null) ests.push(vx + Math.cos(r.a * D2R) * rs); }
    const lo = side === "left" ? W * 0.02 : vx + W * 0.03, hi = side === "left" ? vx - W * 0.03 : W * 0.98;
    let x0 = ests.length ? ests.reduce((t, v) => t + v, 0) / ests.length : (lo + hi) / 2;
    x0 = Math.min(hi, Math.max(lo, x0));
    const win = ests.length ? W * 0.08 : (hi - lo) / 2;
    let bxx = x0, bs = -1;
    for (let x = Math.max(lo, x0 - win); x <= Math.min(hi, x0 + win); x++) {
      const yt = ce ? rayY(ce, x) : 0, yb = fl ? rayY(fl, x) : H - 1;
      const v = vert(x, Math.max(0, yt), Math.min(H - 1, yb)) - Math.abs(x - x0) / (W * 0.5);
      if (v > bs) { bs = v; bxx = x; }
    }
    if ((globalThis as any).__WGDEBUG) console.log("corner", side, ests.map((e) => (e / W).toFixed(3)), (bxx / W).toFixed(3), bs.toFixed(2));
    return { x: bxx, sure: Math.max(0, bs) };
  };
  // a side wall counts only when its corner is a real upright edge
  const cl0 = corner("left", floorL, ceilL), cr0 = corner("right", floorR, ceilR);
  const cl = cl0 && cl0.sure >= 0.5 ? cl0 : null, cr2 = cr0 && cr0.sure >= 0.5 ? cr0 : null;
  const why: string[] = [`vp ${(vx / W).toFixed(2)},${(vy / H).toFixed(2)} x${vpRatio.toFixed(1)}`, `rays fl${floorL ? floorL.a : "-"} fr${floorR ? floorR.a : "-"} cl${ceilL ? ceilL.a : "-"} cr${ceilR ? ceilR.a : "-"}`];
  if (!cl && !cr2) return { walls: [], confident: false, score: 0, vp: { x: vx / W, y: vy / H }, why: why.concat("no side walls").join("; ") };
  const xL = cl ? cl.x : 0, xR = cr2 ? cr2.x : W - 1;
  const tops: number[] = [], bots: number[] = [];
  if (ceilL && cl) tops.push(rayY(ceilL, xL)); if (ceilR && cr2) tops.push(rayY(ceilR, xR));
  if (floorL && cl) bots.push(rayY(floorL, xL)); if (floorR && cr2) bots.push(rayY(floorR, xR));
  const avg = (a: number[]) => a.reduce((t, v) => t + v, 0) / a.length;
  let yT = tops.length ? avg(tops) : 0, yB = bots.length ? avg(bots) : H - 1;
  // refine the back wall's bottom on a flat edge (baseboard) near the estimate
  if (bots.length && xR - xL > W * 0.08) {
    let bestY = yB, bv = -1;
    for (let y = Math.round(yB - H * 0.03); y <= Math.round(yB + H * 0.03); y++) {
      if (y < 2 || y > H - 3) continue; let m = 0, n = 0;
      for (let x = Math.round(xL + (xR - xL) * 0.1); x <= Math.round(xR - (xR - xL) * 0.1); x++) { n++; const k = y * W + x; if (Math.abs(gy[k]) > 2 * Math.abs(gx[k]) && Math.abs(gy[k]) > thr * 0.6) m++; }
      const v = n ? m / n - Math.abs(y - yB) / (H * 0.2) : 0; if (v > bv) { bv = v; bestY = y; }
    }
    if (bv > 0.3) yB = bestY;
  }
  yT = Math.max(0, yT); yB = Math.min(H - 1, yB);
  const bw = xR - xL, bh = yB - yT;
  // sanity: the back wall has a size, the VP sits roughly inside it, the floor is below and the ceiling above
  const reasons: string[] = [];
  if (bw < W * 0.1) reasons.push("back wall too narrow");
  if (bh < H * 0.1) reasons.push("back wall too short");
  if (vx < xL - W * 0.05 || vx > xR + W * 0.05) reasons.push("vp outside back wall");
  if (vpRatio < 2.2) reasons.push("weak vp");
  const sides = (cl && floorL ? 1 : 0) + (cr2 && floorR ? 1 : 0);
  if (sides === 0) reasons.push("no floor lines");
  else if (!(cl && cr2) && !((cl && floorL && ceilL) || (cr2 && floorR && ceilR))) reasons.push("only one side, half seen");
  const n = (p: GP): GP => ({ x: p.x / W, y: p.y / H });
  const f = 0.78 * Math.max(W, H), sc = backWidthIn / Math.max(1, bw); // inches per pixel on the back wall
  const backH = Math.round(Math.min(240, Math.max(24, bh * sc)));
  const walls: GuessedWall[] = [{ side: "back", corners: [n({ x: xL, y: yT }), n({ x: xR, y: yT }), n({ x: xR, y: yB }), n({ x: xL, y: yB })], widthIn: Math.round(backWidthIn), heightIn: backH }];
  const sideWall = (side: "left" | "right", xc: number): GuessedWall | null => {
    const xe = side === "left" ? 0 : W - 1; if (Math.abs(xe - xc) < W * 0.06) return null;
    const lineY = (y0: number, x: number) => vy + (y0 - vy) * (x - vx) / (xc - vx); // through the VP and (xc, y0)
    let x = xe; const lim = (xx: number) => lineY(yT, xx) > -0.8 * H && lineY(yB, xx) < 1.8 * H;
    for (let t = 0; t < 60 && !lim(x); t++) x = x + (xc - x) * 0.1;
    const t0 = lineY(yT, x), b0 = lineY(yB, x);
    const h0 = b0 - t0, h1 = bh; if (h0 <= h1 * 1.05) return null;
    const len = Math.round(Math.min(600, Math.max(24, f * sc * (1 - h1 / h0))));
    const near = [n({ x, y: t0 }), n({ x, y: b0 })], far = [n({ x: xc, y: yT }), n({ x: xc, y: yB })];
    return side === "left" ? { side, corners: [near[0], far[0], far[1], near[1]], widthIn: len, heightIn: backH } : { side, corners: [far[0], near[0], near[1], far[1]], widthIn: len, heightIn: backH };
  };
  if (cl && (floorL || ceilL)) { const w = sideWall("left", xL); if (w) walls.unshift(w); }
  if (cr2 && (floorR || ceilR)) { const w = sideWall("right", xR); if (w) walls.push(w); }
  const score = Math.min(1, (vpRatio / 6) * 0.4 + sides * 0.2 + ((cl?.sure ?? 0) + (cr2?.sure ?? 0)) * 0.1);
  why.push(`corners ${cl ? (cl.x / W).toFixed(2) + "@" + cl.sure.toFixed(2) : "-"} ${cr2 ? (cr2.x / W).toFixed(2) + "@" + cr2.sure.toFixed(2) : "-"}`, `top ${(yT / H).toFixed(2)} bottom ${(yB / H).toFixed(2)}`);
  if (reasons.length) why.push(reasons.join(", "));
  return { walls, confident: reasons.length === 0, score, vp: { x: vx / W, y: vy / H }, why: why.join("; ") };
}
const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** Snap wall outlines (AI or hand) onto the photo's real lines: each wall's top edge onto the ceiling line and its
 *  bottom edge onto the floor / baseboard line, searching a band around the given edge. Upright edges are kept.
 *  Corners shared by two walls move together. Coordinates are fractions of the photo. */
export function snapWalls<T extends { side: string; corners: GP[] }>(px: Img, walls: T[], band = 0.12): T[] {
  const s = Math.min(1, 480 / Math.max(px.width, px.height));
  const W = Math.max(32, Math.round(px.width * s)), H = Math.max(32, Math.round(px.height * s)), d = px.data;
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (Math.min(px.height - 1, Math.floor((y + 0.5) / s)) * px.width + Math.min(px.width - 1, Math.floor((x + 0.5) / s))) * 4; g[y * W + x] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
  // contrast across a line: mean |above - below| over the line (3 px apart), so a ceiling/wall or wall/floor change scores high
  const across = (ax: number, ay: number, bx: number, by: number) => {
    const L = Math.hypot((bx - ax) * W, (by - ay) * H); const n = Math.max(8, Math.round(L / 2)); let t = 0, m = 0;
    const nx = -(by - ay) * H / Math.max(1e-6, L), ny = (bx - ax) * W / Math.max(1e-6, L); // unit normal in pixels
    for (let i = 1; i < n; i++) { const f = i / n; const x = (ax + (bx - ax) * f) * W, y = (ay + (by - ay) * f) * H;
      const x1 = Math.round(x + nx * 3), y1 = Math.round(y + ny * 3), x2 = Math.round(x - nx * 3), y2 = Math.round(y - ny * 3);
      if (x1 < 0 || x2 < 0 || y1 < 0 || y2 < 0 || x1 >= W || x2 >= W || y1 >= H || y2 >= H) continue;
      t += Math.abs(g[y1 * W + x1] - g[y2 * W + x2]); m++; }
    return m > n * 0.5 ? t / m : 0;
  };
  const out = walls.map((w) => ({ ...w, corners: w.corners.map((c) => ({ ...c })) }));
  const fixed = new Set<string>(); // "wallIndex:corner" already placed by a neighbour
  const key = (i: number, k: number) => `${i}:${k}`;
  const order = out.map((w, i) => ({ w, i })).sort((a, b) => (a.w.side === "back" ? -1 : 0) - (b.w.side === "back" ? -1 : 0));
  for (const { w, i } of order) {
    for (const [ka, kb, top] of [[0, 1, true], [3, 2, false]] as [number, number, boolean][]) {
      const A = w.corners[ka], B = w.corners[kb]; if (!A || !B) continue;
      const fa = fixed.has(key(i, ka)), fb = fixed.has(key(i, kb));
      const steps = 24, span = band; let best = -1, bestA = A.y, bestB = B.y;
      const cand: { ya: number; yb: number; v: number }[] = [];
      for (let ia = fa ? 0 : -steps; ia <= (fa ? 0 : steps); ia++) for (let ib = fb ? 0 : -steps; ib <= (fb ? 0 : steps); ib++) {
        if (Math.abs(ia - ib) > 8) continue; // keep the edge's angle close
        const ya = A.y + (ia / steps) * span, yb = B.y + (ib / steps) * span;
        if (top ? (ya > A.y + span * 0.3 || yb > B.y + span * 0.3) : (ya < A.y - span * 0.3 || yb < B.y - span * 0.3)) continue;
        const v = across(A.x, ya, B.x, yb); cand.push({ ya, yb, v }); if (v > best) { best = v; bestA = ya; bestB = yb; }
      }
      if (best < 12) continue; // no clear line: leave it
      if (top) { // the ceiling line is the topmost strong line (cabinet tops and trim sit below it)
        const strong = cand.filter((c) => c.v >= best * 0.75).sort((p, q) => (p.ya + p.yb) - (q.ya + q.yb))[0];
        if (strong) { bestA = strong.ya; bestB = strong.yb; }
      }
      const clamp = (v: number) => Math.min(1.5, Math.max(-0.5, v));
      w.corners[ka] = { x: A.x, y: clamp(bestA) }; w.corners[kb] = { x: B.x, y: clamp(bestB) };
      // the neighbour that shares this corner follows
      for (const [k, P0] of [[ka, A], [kb, B]] as [number, GP][]) out.forEach((o, j) => { if (j === i) return; o.corners.forEach((c, m) => { if (Math.abs(c.x - P0.x) < 0.02 && Math.abs(c.y - P0.y) < 0.03) { o.corners[m] = { ...w.corners[k] }; fixed.add(key(j, m)); } }); });
    }
  }
  return out;
}
