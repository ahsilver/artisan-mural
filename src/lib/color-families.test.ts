import { describe, expect, it } from "vitest";
import { colorFamiliesOf } from "./color-families";
import { defaultColors } from "./design-taxonomy";

const px = (parts: [number, [number, number, number]][]) => { const out: number[] = []; for (const [n, [r, g, b]] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, 255); return new Uint8ClampedArray(out); };

describe("colorFamiliesOf", () => {
  it("names the main colors of a picture from the shop's color list, biggest first", () => {
    const found = colorFamiliesOf(px([[60, [120, 150, 100]], [30, [240, 235, 225]], [10, [200, 60, 50]]]), defaultColors);
    expect(found).toEqual(["Green", "White & cream"]);
  });
  it("leaves out colors that cover only a small part", () => {
    expect(colorFamiliesOf(px([[95, [40, 40, 40]], [5, [230, 170, 180]]]), defaultColors)).toEqual(["Black"]);
  });
});
