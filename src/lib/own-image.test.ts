import { describe, expect, it } from "vitest";
import { ownDpi, ownSelection } from "./own-image";
import { printGeometry } from "./print-pdf";

describe("own image placement", () => {
  it("prints exactly the part placed on the wall", () => {
    // an 8000 × 4000 picture on a 12 × 9 ft wall, not zoomed, centered: it prints 18 ft wide, so the wall shows the middle two thirds
    const sel = ownSelection({ wallW: 12, wallH: 9, picW: 8000, picH: 4000, zoom: 1, pos: [50, 50] });
    expect(sel.zoom).toBeCloseTo(2 / 3, 5); expect(sel.x).toBeCloseTo(0.5, 5); expect(sel.y).toBeCloseTo(0.5, 5);
    const g = printGeometry({ kind: "mural", repeat: "none" } as any, sel);
    expect(g.widthIn).toBe(144); expect(g.heightIn).toBe(108);
    expect(g.draws[0]!.w).toBeCloseTo(1.5, 5); // drawn 1.5× the wall width, so two thirds of it fill the wall
    expect(g.draws[0]!.x).toBeCloseTo(-0.25, 5); // starting one sixth in from its left edge
  });
  it("moved fully to the right shows the right edge", () => {
    const sel = ownSelection({ wallW: 12, wallH: 9, picW: 8000, picH: 4000, zoom: 1, pos: [100, 50] });
    expect(sel.x).toBeCloseTo(1 - 1 / 3, 5);
  });
  it("measures sharpness on the wall", () => {
    expect(ownDpi({ wallW: 12, wallH: 9, picW: 8000, picH: 4000, zoom: 1 })).toBe(37); // 8000 px over 18 ft
    expect(ownDpi({ wallW: 3, wallH: 2, picW: 8000, picH: 4000, zoom: 1 })).toBe(167);
  });
});
