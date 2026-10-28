import { describe, expect, it } from "vitest";
import { designerScaleSelection, tileGeometry, frameGeometry, initialWall, orderSqft, panelGeometry, wallSelectionSchema, wallSearchSchema, MAX_REPEAT_ZOOM } from "./wall-selection";
import { toSqft } from "./catalog";
const cmWall = { ...initialWall, width: 320, height: 250, unit: "cm" as const };
describe("wall selections", () => {
  it("allows repeats to zoom out beyond the previous limit without changing wall area", () => {
    const design = { kind: "repeating" as const, repeat: "both" as const, repeatCm: 64 };
    const smaller = wallSelectionSchema.parse({ ...cmWall, zoom: MAX_REPEAT_ZOOM });
    expect(MAX_REPEAT_ZOOM).toBe(32);
    expect(wallSearchSchema.parse(smaller).zoom).toBe(32);
    expect(tileGeometry(design, smaller).tw * 320).toBeCloseTo(4);
    expect(orderSqft(smaller)).toBe(orderSqft(cmWall));
  });
  it("restores the full mural at its designer wall proportions without changing measurements", () => {
    const wall = { ...cmWall, width: 600, height: 400, artRatio: 1.5, zoom: 0.1, x: 0.1, y: 0.9 };
    const reset = designerScaleSelection({ kind: "mural", maxWidthCm: 600 }, wall);
    expect(frameGeometry(reset)).toEqual({ w: 1, h: 1, x: 0.5, y: 0.5 });
    expect(reset.width).toBe(600);
    expect(reset.height).toBe(400);
  });
  it("restores the designer's repeat size without changing wall or price", () => {
    const design = { kind: "repeating" as const, repeat: "both" as const, repeatCm: 64 };
    const selection = { ...cmWall, width: 400, height: 250, zoom: 0.2, x: 0.1 };
    const reset = designerScaleSelection(design, selection);
    expect(tileGeometry(design, reset).tw * 400).toBeCloseTo(64);
    expect(orderSqft(reset)).toBe(orderSqft(selection));
    expect(reset.x).toBe(0.5);
  });
  it("restores mural physical size for a smaller wall", () => {
    const reset = designerScaleSelection({ kind: "mural", maxWidthCm: 600 }, { ...cmWall, width: 300, height: 200, artRatio: 1.5 });
    expect(frameGeometry(reset).w).toBeCloseTo(0.5);
    expect(reset.width / frameGeometry(reset).w).toBeCloseTo(600);
  });
  it("restores the supplied printed height for sideways repeats", () => {
    const design = { kind: "repeating" as const, repeat: "horizontal" as const, repeatCm: 120, printHeightCm: 300 };
    const reset = designerScaleSelection(design, { ...cmWall, artRatio: 1.25 });
    expect(tileGeometry(design, reset).th * reset.height).toBeCloseTo(300);
  });
  it("preserves measurements and crop through preview links", () => { expect(wallSearchSchema.parse({ ...initialWall, width: "50", height: "30", unit: "ft", x: "0.6" })).toEqual({ ...initialWall, width: 50, height: 30, unit: "ft", x: 0.6 }); });
  it("defaults invalid preview link measurements safely", () => { expect(wallSearchSchema.parse({ width: "-5" })).toEqual(initialWall); });
  it("prices measurements in feet accurately", () => { expect(toSqft(50, 100, "ft")).toBeCloseTo(5000, 1); });
  it("uses 52-inch panels with 3-inch overlaps", () => {
    expect(panelGeometry(52, "in").count).toBe(1);
    expect(panelGeometry(101, "in").count).toBe(2);
    expect(panelGeometry(102, "in").count).toBe(3);
    expect(panelGeometry(10, "ft").count).toBe(3);
    expect(panelGeometry(254, "cm").count).toBe(2);
    expect(panelGeometry(120, "in").guides[0]?.start).toBeCloseTo(49 / 120);
  });
  it("does not add waste from old saved links or order selections", () => {
    expect(wallSearchSchema.parse({ ...initialWall, waste: 15 }).waste).toBe(0);
    expect(wallSelectionSchema.parse({ ...initialWall, waste: 10 }).waste).toBe(0);
    expect(orderSqft({ width: 10, height: 8, unit: "ft", waste: 15 })).toBe(80);
  });
  it("keeps a tall wall crop in the artwork boundaries", () => {
    const frame = frameGeometry({ ...cmWall, width: 50, height: 100, x: 0, y: 1 });
    expect(frame.w * initialWall.artRatio / frame.h).toBeCloseTo(0.5);
    expect(frame.x - frame.w / 2).toBeGreaterThanOrEqual(0);
    expect(frame.y + frame.h / 2).toBeLessThanOrEqual(1);
  });
  it("rejects negative or invalid selections", () => { expect(wallSelectionSchema.safeParse({ ...initialWall, width: -10 }).success).toBe(false); });
});

describe("default unit", () => { it("product pages start in feet", () => { expect(initialWall.unit).toBe("ft"); }); });
