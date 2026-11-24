import { describe, expect, it } from "vitest";
import { findRepeat } from "./repeat-aligner";

// a soft random picture (like a painted scene): seeded noise, blurred
function scene(W: number, H: number, seed = 7) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = rnd() * 255;
  const out = new Float32Array(W * H); const r = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0, n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { t += g[yy * W + xx]!; n++; } } out[y * W + x] = t / n; }
  return out;
}

describe("findRepeat", () => {
  it("leaves a picture that was never made as a repeat unchanged", () => {
    const W = 300, H = 120, g = scene(W, H);
    const r = findRepeat(g, W, H, "sideways");
    expect(r.verdict).toBe("none");
    expect(r.w).toBe(W);
    expect(r.blend).toBe(false);
  });

  it("finds the repeat when the pattern starts again inside the file", () => {
    const P = 220, extra = 60, W = P + extra, H = 120, one = scene(P, H, 11);
    const g = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = one[y * P + (x % P)]!;
    const r = findRepeat(g, W, H, "sideways");
    expect(r.verdict).toBe("inside");
    expect(Math.abs(r.w - P)).toBeLessThanOrEqual(1);
  });
});
