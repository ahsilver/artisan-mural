import type { DetectedWall } from "@/lib/room-composite";

/** Session-only, bounded reuse. Personal room photos never leave the browser cache. */
export class SessionCache<T> {
  private entries = new Map<string, Promise<T>>();
  constructor(private limit: number) {}

  getOrCreate(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }
    const pending = load().catch(error => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, pending);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return pending;
  }
}

export async function roomPhotoKey(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export const roomDetectionCache = new SessionCache<DetectedWall[]>(6);
export const roomRenderCache = new SessionCache<string>(6);