import { describe, it, expect } from "vitest";
import { planParts, partRange, verifyCopy, builtSize, importSummary, DRIVE_PART } from "./drive-verify";
import { imageDims } from "./image-dims";

const A = 2194217280, B = 2384697324; // the owner's two 200 DPI TIFFs on Drive

/** Minimal little-endian TIFF header: width, height, 4 samples (CMYK), LZW, X/Y resolution, unit inch. */
function tiffHeader(w: number, h: number, dpi: number) {
  const b = new Uint8Array(512); const dv = new DataView(b.buffer);
  b.set([73, 73, 42, 0]); dv.setUint32(4, 8, true);
  const tags: [number, number, number, number][] = [[256, 4, 1, w], [257, 4, 1, h], [259, 3, 1, 5], [262, 3, 1, 5], [277, 3, 1, 4], [282, 5, 1, 300], [283, 5, 1, 308], [296, 3, 1, 2]];
  dv.setUint16(8, tags.length, true);
  tags.forEach(([t, ty, c, v], i) => { const o = 10 + i * 12; dv.setUint16(o, t, true); dv.setUint16(o + 2, ty, true); dv.setUint32(o + 4, c, true); if (ty === 3) dv.setUint16(o + 8, v, true); else dv.setUint32(o + 8, v, true); });
  dv.setUint32(300, dpi, true); dv.setUint32(304, 1, true); dv.setUint32(308, dpi, true); dv.setUint32(312, 1, true);
  return b;
}

describe("Drive import pieces", () => {
  it("plans multi-GB files within R2's part limit", () => {
    expect(planParts(A, 20)).toEqual({ parts: 66 });
    expect(planParts(B, 20)).toEqual({ parts: 72 });
    expect(planParts(5 * 1024 ** 3, 20)).toEqual({ parts: 160 });
    expect(planParts(20 * 1024 ** 3, 20)).toEqual({ parts: 640 });
    expect(planParts(21 * 1024 ** 3, 20)).toEqual({ error: "Files up to 20 GB." });
    expect("error" in planParts(0, 20)).toBe(true);
  });
  it("pieces cover every byte exactly once", () => {
    const n = (planParts(B, 20) as any).parts; let sum = 0, next = 0;
    for (let i = 1; i <= n; i++) { const r = partRange(i, B)!; expect(r.start).toBe(next); next = r.end + 1; sum += r.length; if (i < n) expect(r.length).toBe(DRIVE_PART); }
    expect(sum).toBe(B); expect(partRange(n + 1, B)).toBeNull(); expect(partRange(0, B)).toBeNull();
  });
});

describe("size check after copy", () => {
  const parts = (total: number) => { const out: number[] = []; for (let i = 1; partRange(i, total); i++) out.push(partRange(i, total)!.length); return out; };
  it("passes only when storage holds exactly Drive's bytes", () => {
    expect(verifyCopy({ driveBytes: A, partBytes: parts(A), partsExpected: 66, storedBytes: A, driveBytesNow: A })).toEqual({ ok: true });
  });
  it("fails on a missing piece, short piece, wrong stored size, or a file changed on Drive", () => {
    expect(verifyCopy({ driveBytes: A, partBytes: parts(A).slice(1), partsExpected: 66, storedBytes: A }).ok).toBe(false);
    const short = parts(A); short[3] -= 1;
    expect((verifyCopy({ driveBytes: A, partBytes: short, partsExpected: 66, storedBytes: A }) as any).error).toMatch(/incomplete/);
    expect((verifyCopy({ driveBytes: A, partBytes: parts(A), partsExpected: 66, storedBytes: 392991892 }) as any).error).toMatch(/Size check failed/);
    expect((verifyCopy({ driveBytes: A, partBytes: parts(A), partsExpected: 66, storedBytes: null }) as any).error).toMatch(/missing/);
    expect((verifyCopy({ driveBytes: A, partBytes: parts(A), partsExpected: 66, storedBytes: A, driveBytesNow: A + 5 }) as any).error).toMatch(/changed/);
  });
});

describe("pixels + DPI from the TIFF header", () => {
  it("reads the real 200 DPI originals", () => {
    const a = imageDims(tiffHeader(35600, 27400, 200))!; const b = imageDims(tiffHeader(38800, 26600, 200))!;
    expect([a.width, a.height, a.dpi]).toEqual([35600, 27400, 200]);
    expect([b.width, b.height, b.dpi]).toEqual([38800, 26600, 200]);
    expect(builtSize(a)).toMatchObject({ dpi: 200, fromFile: true, widthIn: 178, heightIn: 137 });
    expect(builtSize(b)).toMatchObject({ dpi: 200, fromFile: true, widthIn: 194, heightIn: 133 });
  });
  it("warns about a 72 DPI copy and names the sharp size", () => {
    const d = imageDims(tiffHeader(13824, 7344, 72))!;
    const s = importSummary({ name: "192x102 Tiff new updated.tif", bytes: 392991892, driveBytes: 392991892, dims: d, minDpi: 150 });
    expect(s.line).toMatch(/matches Google Drive/); expect(s.line).toMatch(/72 DPI = 192 × 102 in/);
    expect(s.warn).toMatch(/92.2 × 49 in/);
    const ok = importSummary({ name: "194x133.tif", bytes: B, driveBytes: B, dims: imageDims(tiffHeader(38800, 26600, 200)), minDpi: 150 });
    expect(ok.warn).toBeNull(); expect(ok.line).toMatch(/200 DPI = 194 × 133 in/);
  });
  it("says so when sizes differ", () => {
    expect(importSummary({ name: "x.tif", bytes: 10, driveBytes: 11, dims: null }).line).toMatch(/DOES NOT match/);
  });
});
