import { describe, it, expect } from "vitest";
import { canSubmitArtwork, canApproveArtwork, artworkReviewLabel, summarizeDesignOrders } from "./designer-workflow";
import { effectiveCategories, matchRoom, mockupRooms, searchableDesignText } from "./design-taxonomy";
describe("Designer submission", () => {
  it("only approves completed submitted designs", () => {
    expect(canApproveArtwork({ status: "ready", submitted_at: "2026-10-18" })).toBe(true);
    expect(canApproveArtwork({ status: "ready", submitted_at: null })).toBe(false);
    expect(canApproveArtwork({ status: "generating", submitted_at: "2026-10-18" })).toBe(false);
  });
  it("allows submission before any room mockups finish", () => {
    expect(canSubmitArtwork({ status: "ready", submitted_at: null, colors: 2, mockups: 6 })).toBe(true);
    expect(canSubmitArtwork({ status: "generating", submitted_at: null, colors: 2, mockups: 0 })).toBe(true);
    expect(canSubmitArtwork({ status: "draft", submitted_at: null, colors: 0, mockups: 0 })).toBe(false);
  });
  it("does not resubmit an already submitted design", () => {
    expect(canSubmitArtwork({ status: "ready", submitted_at: "2026-10-18", colors: 1, mockups: 3 })).toBe(false);
  });
  it("separates private drafts from waiting for approval", () => {
    expect(artworkReviewLabel({ submitted_at: null, review_status: "pending" })).toBe("Draft · not submitted");
    expect(artworkReviewLabel({ submitted_at: "2026-10-18", review_status: "pending" })).toBe("Waiting for approval");
  });
});
describe("Shared kids categories", () => {
  it("matches existing Kids room uploads in the shop and kids friendly search", () => {
    const design = { room: ["Kids room"], categories: [] };
    expect(matchRoom(design, "Kids & nursery")).toBe(true);
    expect(effectiveCategories(design.room, design.categories)).toEqual(["Kids & nursery"]);
    expect(searchableDesignText(design)).toContain("kids friendly");
  });
  it("uses three child-oriented rooms instead of living or dining rooms", () => {
    expect(mockupRooms(["Kids room"], []).map(r => r.label)).toEqual(["Playroom", "Nursery", "Kids bedroom"]);
  });
  it("respects an uploaded kitchen category", () => {
    expect(mockupRooms(["Kitchen"], [])[0]?.label).toBe("Kitchen");
  });
});
it("separates printed square feet from unpaid orders and excludes cancellations", () => {
  const result = summarizeDesignOrders([
    { status: "awaiting_payment", square_feet: 100, created_at: "2026-10-17" },
    { status: "printing", square_feet: 40, created_at: "2026-10-18" },
    { status: "delivered", square_feet: 25, created_at: "2026-10-16" },
    { status: "cancelled", square_feet: 200, created_at: "2026-10-19" },
  ]);
  expect(result).toEqual({ orders: 3, sqft: 165, printedSqft: 65, lastOrder: "2026-10-18" });
});