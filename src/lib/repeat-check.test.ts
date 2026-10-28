import { describe, expect, it } from "vitest";
import { seamScores } from "./repeat-check";

const W = 240, H = 240;
function tile(paint: (x: number, y: number) => number) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = paint(x, y), i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  return d;
}
// soft periodic waves: seamless on all sides, straight
const waves = tile((x, y) => 128 + 60 * Math.sin((2 * Math.PI * x) / W) * Math.cos((4 * Math.PI * y) / H));
// a thin dark diagonal line drawn for HALF-DROP: it enters the left edge at y and leaves the right edge at y + H/2
const hdLine = tile((x, y) => { const t = (x / W) * (H / 2), dy = Math.abs(y - t), wrap = Math.min(dy, H - dy); return wrap < 3 ? 30 : 230; });
// a picture that does not repeat at all (left half dark, right half light, top/bottom different)
const mural = tile((x, y) => (x < W / 2 ? 40 : 220) - (y > H * 0.8 ? 20 : 0));

describe("seamless check", () => {
  it("passes a real straight repeat", () => { const r = seamScores(waves, W, H, "both"); expect(r.verdict).toBe("ok"); });
  it("passes the half-drop line tile as half-drop", () => { const r = seamScores(hdLine, W, H, "halfdrop"); expect(r.lr.verdict).toBe("ok"); expect(r.verdict).toBe("ok"); });
  it("catches the broken diagonal line when the half-drop tile is used straight", () => { const r = seamScores(hdLine, W, H, "both"); expect(r.lr.verdict).toBe("bad"); expect(r.lr.line).toBeGreaterThanOrEqual(3); });
  it("catches a mural uploaded as a repeat", () => { const r = seamScores(mural, W, H, "both"); expect(r.verdict).toBe("bad"); });
});
