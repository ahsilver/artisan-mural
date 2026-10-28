import { useSyncExternalStore } from "react";

/** Designs the shopper picked to compare side by side, kept in this browser only. */
const KEY = "am-compare";
export const COMPARE_MAX = 4;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]").filter((s: unknown) => typeof s === "string").slice(0, COMPARE_MAX); } catch { cache = []; }
  return cache!;
}
function write(next: string[]) { cache = next; localStorage.setItem(KEY, JSON.stringify(next)); listeners.forEach(l => l()); }
const empty: string[] = [];

export function useCompare() {
  const list = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, read, () => empty);
  return {
    list,
    has: (slug: string) => list.includes(slug),
    toggle: (slug: string) => write(list.includes(slug) ? list.filter(s => s !== slug) : list.length >= COMPARE_MAX ? list : [...list, slug]),
    remove: (slug: string) => write(list.filter(s => s !== slug)),
    clear: () => write([]),
    full: list.length >= COMPARE_MAX,
  };
}
