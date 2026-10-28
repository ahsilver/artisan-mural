/** Seamless repeat check (plain pixel math, no AI): compares opposite edges against how much neighbouring pixels normally differ
 * inside the same picture — both the average colour step AND sharp lines (a thin line that breaks at a seam barely moves the
 * average colour, so lines are counted separately). Half-drop: the right edge is compared with the left edge shifted half the tile height. */
export type Verdict = "ok" | "borderline" | "bad";
export type SeamResult = { score: number; line: number; ok: boolean; verdict: Verdict };
export type RepeatResult = { lr: SeamResult; tb: SeamResult | null; verdict: Verdict; tiled: string };
export type RepeatStyle = "both" | "horizontal" | "halfdrop";

/** Limits: colour score = seam colour step ÷ normal step; line score = broken sharp lines at the seam ÷ normal rate. */
export const REPEAT_LIMITS = { colorWarn: 2.2, colorBad: 3.2, lineWarn: 3, lineBad: 6, strong: 48 };

const worst = (a: Verdict, b: Verdict): Verdict => (a === "bad" || b === "bad" ? "bad" : a === "borderline" || b === "borderline" ? "borderline" : "ok");

/** Pure scoring on raw RGBA pixels (testable without a browser). */
export function seamScores(d: ArrayLike<number>, W: number, H: number, style: RepeatStyle) {
  const px = (x: number, y: number) => (y * W + x) * 4;
  const diff = (a: number, b: number) => (Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2])) / 3;
  const L = REPEAT_LIMITS;
  // what "normal" looks like inside the picture: evenly spaced neighbouring column pairs and row pairs
  let cSum = 0, cN = 0, cStrong = 0, rSum = 0, rN = 0, rStrong = 0;
  const NC = Math.min(48, W - 2), NR = Math.min(48, H - 2);
  for (let k = 0; k < NC; k++) { const x = 1 + Math.floor(((k + 0.5) * (W - 3)) / NC); for (let y = 0; y < H; y++) { const v = diff(px(x, y), px(x + 1, y)); cSum += v; cN++; if (v > L.strong) cStrong++; } }
  for (let k = 0; k < NR; k++) { const y = 1 + Math.floor(((k + 0.5) * (H - 3)) / NR); for (let x = 0; x < W; x++) { const v = diff(px(x, y), px(x, y + 1)); rSum += v; rN++; if (v > L.strong) rStrong++; } }
  const judge = (sum: number, strong: number, n: number, baseSum: number, baseStrong: number, baseN: number): SeamResult => {
    const score = (sum / n) / (baseSum / baseN + 1.5);
    const line = (strong / n + 2 / n) / (baseStrong / baseN + 2 / n);
    const verdict: Verdict = score >= L.colorBad || line >= L.lineBad ? "bad" : score >= L.colorWarn || line >= L.lineWarn ? "borderline" : "ok";
    return { score: Math.round(score * 10) / 10, line: Math.round(line * 10) / 10, ok: verdict === "ok", verdict };
  };
  // left/right seam (half-drop: the next column sits half a tile lower)
  let lSum = 0, lStrong = 0;
  const shift = style === "halfdrop" ? Math.floor(H / 2) : 0;
  for (let y = 0; y < H; y++) { const v = diff(px(W - 1, y), px(0, (y + shift) % H)); lSum += v; if (v > L.strong) lStrong++; }
  const lr = judge(lSum, lStrong, H, cSum, cStrong, cN);
  let tb: SeamResult | null = null;
  if (style !== "horizontal") { let tSum = 0, tStrong = 0; for (let x = 0; x < W; x++) { const v = diff(px(x, H - 1), px(x, 0)); tSum += v; if (v > L.strong) tStrong++; } tb = judge(tSum, tStrong, W, rSum, rStrong, rN); }
  return { lr, tb, verdict: tb ? worst(lr.verdict, tb.verdict) : lr.verdict };
}

export async function checkRepeat(src: string, style: RepeatStyle): Promise<RepeatResult> {
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = src; await img.decode();
  const s = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(8, Math.round(img.naturalWidth * s)), H = Math.max(8, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, W, H);
  const r = seamScores(ctx.getImageData(0, 0, W, H).data, W, H, style);
  // 2 x 2 tiled preview so the designer can see the joins; seams that don't connect are marked with a red dashed line
  const t = document.createElement("canvas"); const tw = Math.min(W, 600), th = Math.round((tw / W) * H);
  t.width = tw * 2; t.height = th * 2; const tc = t.getContext("2d")!;
  for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) { const off = style === "halfdrop" && i === 1 ? th / 2 : 0; tc.drawImage(c, i * tw, k * th + off, tw, th); if (off) tc.drawImage(c, i * tw, -th + off, tw, th); }
  tc.save(); tc.lineWidth = Math.max(3, Math.round(tw / 150)); tc.setLineDash([12, 8]);
  const mark = (v: Verdict, x1: number, y1: number, x2: number, y2: number) => { if (v === "ok") return; tc.strokeStyle = v === "bad" ? "#DC2626" : "#F59E0B"; tc.beginPath(); tc.moveTo(x1, y1); tc.lineTo(x2, y2); tc.stroke(); };
  mark(r.lr.verdict, tw, 0, tw, th * 2);
  if (r.tb) { mark(r.tb.verdict, 0, th, tw, th); if (style === "halfdrop") { mark(r.tb.verdict, tw, th / 2, tw * 2, th / 2); mark(r.tb.verdict, tw, th * 1.5, tw * 2, th * 1.5); } else mark(r.tb.verdict, tw, th, tw * 2, th); }
  tc.restore();
  return { ...r, tiled: t.toDataURL("image/jpeg", 0.8) };
}
