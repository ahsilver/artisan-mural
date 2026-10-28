import { describe, expect, it, vi } from "vitest";
import { SessionCache } from "./room-preview-cache";

describe("room preview reuse", () => {
  it("reuses both in-flight and completed work without another AI request", async () => {
    const cache = new SessionCache<string>(6);
    const load = vi.fn(async () => "preview");
    const a = cache.getOrCreate("same-photo-and-crop", load);
    const b = cache.getOrCreate("same-photo-and-crop", load);
    expect(a).toBe(b);
    expect(await a).toBe("preview");
    expect(await cache.getOrCreate("same-photo-and-crop", load)).toBe("preview");
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("doesn't reuse changed geometry and caps retained photos", async () => {
    const cache = new SessionCache<string>(1);
    const load = vi.fn(async () => "preview");
    await cache.getOrCreate("crop-a", load);
    await cache.getOrCreate("crop-b", load);
    await cache.getOrCreate("crop-a", load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("allows a manual retry after failure instead of caching errors", async () => {
    const cache = new SessionCache<string>(6);
    await expect(cache.getOrCreate("room", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(await cache.getOrCreate("room", async () => "success")).toBe("success");
  });
});