import { useSyncExternalStore } from "react";
import type { WallSelection } from "@/lib/wall-selection";

/** Browser-held cart; prices are always recomputed on the server at checkout. */
export type CartItem = { id: string; design: string; finish: string; selection: WallSelection; name?: string };
const KEY = "artisan-cart";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;
const EMPTY: CartItem[] = [];

function read(): CartItem[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); cache = Array.isArray(v) ? v.slice(0, 30) : []; }
  catch { cache = []; }
  return cache!;
}
function write(items: CartItem[]) {
  cache = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}
export const cart = {
  add(item: Omit<CartItem, "id">) { const id = crypto.randomUUID(); write([...read(), { ...item, id }].slice(-30)); return id; },
  get(id: string) { return read().find((i) => i.id === id) ?? null; },
  /** Change one line in place (Edit from the cart, wall name). */
  update(id: string, patch: Partial<Omit<CartItem, "id">>) { write(read().map((i) => (i.id === id ? { ...i, ...patch } : i))); },
  /** Same design + finish for another wall, right after the line; lines of that design get "Wall n" names. */
  duplicate(id: string) {
    const items = read(); const k = items.findIndex((i) => i.id === id); if (k < 0) return null;
    const same = items.filter((i) => i.design === items[k].design);
    const named = items.map((i) => (i.design === items[k].design && !i.name ? { ...i, name: `Wall ${same.indexOf(i) + 1}` } : i));
    const copy: CartItem = { ...named[k], id: crypto.randomUUID(), name: `Wall ${same.length + 1}` };
    write([...named.slice(0, k + 1), copy, ...named.slice(k + 1)].slice(-30));
    return copy.id;
  },
  remove(id: string) { write(read().filter((i) => i.id !== id)); },
  clear() { write([]); },
};
export function useCart() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); const s = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } }; window.addEventListener("storage", s); return () => { listeners.delete(l); window.removeEventListener("storage", s); }; },
    read,
    () => EMPTY,
  );
}
