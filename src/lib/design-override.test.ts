import { describe, expect, it } from "vitest";
import { applyOverride, designRate, designs, PRICE_PER_SQFT } from "./catalog";

describe("owner design edits", () => {
  const base = designs[0]!;
  it("uses the standard $4.50 when no price is set", () => { expect(designRate(base)).toBe(4.5); expect(PRICE_PER_SQFT).toBe(4.5); });
  it("uses the owner's price per sq ft for that design", () => { expect(designRate(applyOverride(base, { slug: base.slug, pricePerSqft: 6.25, removed: [], added: [] }))).toBe(6.25); });
  it("removes and adds room photos", () => {
    const first = base.mockups?.[0];
    const out = applyOverride(base, { slug: base.slug, removed: first ? [first] : [], added: ["https://x/new.jpg"] });
    if (first) expect(out.mockups).not.toContain(first);
    expect(out.mockups).toContain("https://x/new.jpg");
  });
});
