import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomStroke, RoomWall } from "@/lib/wall-render";
import { SAMPLE_ROOMS } from "@/lib/room-mask";

/**
 * "My rooms": room photos the shopper uploaded to try wallpaper on.
 * Always kept in this browser (IndexedDB); for signed-in shoppers also saved to their account.
 */
export type MyRoomPhoto = { id: string; name: string; blob: Blob; w?: number; h?: number; walls?: RoomWall[]; keep?: boolean; strokes?: RoomStroke[]; createdAt: number; account?: string | null; sample?: string; mask?: string };
const DBNAME = "artisan-room-photos", STORE = "photos", CUR = "am-room-current", MAX_LOCAL = 12;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DBNAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function op<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode); const r = run(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

async function token() { try { const { data } = await supabase.auth.getSession(); return data.session ? { t: data.session.access_token, uid: data.session.user.id } : null; } catch { return null; } }
async function call(path: string, init: RequestInit = {}, raw = false) {
  const s = await token(); if (!s) throw new Error("signed out");
  const r = await fetch("/backend/rooms" + path, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${s.t}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `Request failed (${r.status})`);
  return raw ? r : r.json();
}

// ---- tiny store ----
type State = { rooms: MyRoomPhoto[]; current: string | null; uid: string | null; ready: boolean; synced: boolean; sample: MyRoomPhoto | null };
let state: State = { rooms: [], current: null, uid: null, ready: false, synced: false, sample: null };
const empty: State = { rooms: [], current: null, uid: null, ready: false, synced: false, sample: null };
const listeners = new Set<() => void>();
function set(patch: Partial<State>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
let loading: Promise<void> | null = null;

async function localAll(): Promise<MyRoomPhoto[]> {
  try { return ((await op("readonly", (s) => s.getAll())) as MyRoomPhoto[]).filter((r) => r && r.blob).sort((a, b) => b.createdAt - a.createdAt); } catch { return []; }
}

/** Load the rooms in this browser, then (signed in) merge the account's rooms. */
export function loadMyRooms(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loading && !force) return loading;
  loading = (async () => {
    let rooms = await localAll();
    const s = await token();
    const uid = s?.uid ?? null;
    // rooms that belong to another signed-in account stay hidden
    const visible = (r: MyRoomPhoto) => !r.account || r.account === uid;
    let current = localStorage.getItem(CUR);
    if (current && isSampleId(current) && state.sample?.id !== current) await openSample(current.slice(7)).catch(() => null);
    set({ rooms: rooms.filter(visible), uid, current: current && (isSampleId(current) || rooms.some((r) => r.id === current && visible(r))) ? current : rooms.filter(visible)[0]?.id ?? null, ready: true, synced: !uid });
    if (!uid) return;
    try {
      const d = await call("");
      const have = new Map(rooms.map((r) => [r.id, r]));
      for (const x of d.rooms as any[]) {
        const mine = have.get(x.id);
        if (mine) { // the account copy has the latest wall corners
          const next = { ...mine, account: uid, walls: x.walls ?? mine.walls, keep: x.keep ?? mine.keep, strokes: x.strokes ?? mine.strokes, name: x.name ?? mine.name };
          await op("readwrite", (st) => st.put(next));
          continue;
        }
        try {
          const blob = await (await call(`/img/${x.id}`, {}, true) as Response).blob();
          await op("readwrite", (st) => st.put({ id: x.id, name: x.name, blob, w: x.w, h: x.h, walls: x.walls, keep: x.keep, strokes: x.strokes, createdAt: x.createdAt || Date.now(), account: uid }));
        } catch {}
      }
      rooms = await localAll();
      current = localStorage.getItem(CUR);
      const vis = rooms.filter(visible);
      set({ rooms: vis, current: current && (isSampleId(current) || vis.some((r) => r.id === current)) ? current : vis[0]?.id ?? null, synced: true });
    } catch { set({ synced: true }); }
  })();
  return loading;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") { if (state.ready) loadMyRooms(true); } });
}

export function useMyRooms() {
  const s = useSyncExternalStore((cb) => { listeners.add(cb); if (!state.ready) loadMyRooms(); return () => listeners.delete(cb); }, () => state, () => empty);
  const room = s.current && isSampleId(s.current) ? (s.sample?.id === s.current ? s.sample : null) : s.rooms.find((r) => r.id === s.current) ?? null;
  return { ...s, room, guestRooms: s.uid ? s.rooms.filter((r) => !r.account) : [] };
}

export function chooseRoom(id: string | null) {
  if (id) localStorage.setItem(CUR, id); else localStorage.removeItem(CUR);
  set({ current: id });
}

// ---- built-in sample rooms: work like an uploaded photo, never saved to "My rooms"; the last one picked is remembered ----
export const isSampleId = (id: string | null | undefined) => !!id && id.startsWith("sample:");
const sampleCache = new Map<string, MyRoomPhoto>();
async function openSample(sid: string): Promise<MyRoomPhoto | null> {
  const def = SAMPLE_ROOMS.find((r) => r.id === sid); if (!def) return null;
  let r = sampleCache.get(sid);
  if (!r) {
    const blob = await (await fetch(def.image)).blob();
    const bmp = await createImageBitmap(blob).catch(() => null);
    r = { id: "sample:" + sid, name: def.name, blob, w: bmp?.width, h: bmp?.height, walls: [{ side: "back", corners: def.corners, objects: [], widthIn: def.widthIn, heightIn: def.heightIn }], keep: true, strokes: [], createdAt: 0, account: null, sample: sid, mask: def.mask };
    bmp?.close?.();
    sampleCache.set(sid, r);
  }
  set({ sample: r });
  return r;
}
/** Use a built-in sample room as the current room (instead of an uploaded photo). */
export async function chooseSample(sid: string) {
  const r = await openSample(sid); if (!r) return null;
  localStorage.setItem(CUR, r.id);
  set({ current: r.id, sample: r });
  return r;
}

async function upload(r: MyRoomPhoto, uid: string) {
  const q = new URLSearchParams({ id: r.id, name: r.name, w: String(r.w ?? ""), h: String(r.h ?? ""), t: String(r.createdAt) });
  await call(`/put?${q}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: r.blob });
  await call("/meta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, walls: r.walls ?? [], keep: r.keep !== false, strokes: r.strokes ?? [] }) });
  const next = { ...r, account: uid };
  await op("readwrite", (s) => s.put(next));
  return next;
}

/** Save a newly uploaded room photo (and to the account when signed in). Becomes the current room. */
export async function saveRoomPhoto(blob: Blob, name: string, w: number, h: number): Promise<MyRoomPhoto> {
  let r: MyRoomPhoto = { id: crypto.randomUUID(), name: name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Room photo", blob, w, h, createdAt: Date.now(), walls: [], keep: true, strokes: [], account: null };
  await op("readwrite", (s) => s.put(r));
  // keep the browser copy small: oldest guest photos beyond the limit go
  const all = await localAll();
  await Promise.all(all.filter((x) => !x.account).slice(MAX_LOCAL).map((x) => op("readwrite", (s) => s.delete(x.id))));
  localStorage.setItem(CUR, r.id);
  set({ rooms: [r, ...state.rooms.filter((x) => x.id !== r.id)], current: r.id });
  const s = await token();
  if (s) { try { r = await upload(r, s.uid); set({ rooms: state.rooms.map((x) => (x.id === r.id ? r : x)) }); } catch {} }
  return r;
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();
/** Remember the walls / cut-out choices for a room (debounced to the account). */
export async function updateRoom(id: string, patch: Partial<Pick<MyRoomPhoto, "walls" | "keep" | "strokes" | "name">>) {
  if (isSampleId(id)) { if (state.sample?.id === id) set({ sample: { ...state.sample, ...patch } }); return; }
  const cur = (await localAll()).find((r) => r.id === id); if (!cur) return;
  const next = { ...cur, ...patch };
  await op("readwrite", (s) => s.put(next));
  set({ rooms: state.rooms.map((x) => (x.id === id ? next : x)) });
  if (!next.account) return;
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => { call("/meta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, walls: next.walls ?? [], keep: next.keep !== false, strokes: next.strokes ?? [], name: next.name }) }).catch(() => {}); }, 800));
}

export async function deleteRoom(id: string) {
  if (isSampleId(id)) return;
  const cur = state.rooms.find((r) => r.id === id);
  await op("readwrite", (s) => s.delete(id)).catch(() => {});
  const rooms = state.rooms.filter((r) => r.id !== id);
  const current = state.current === id ? rooms[0]?.id ?? null : state.current;
  if (current) localStorage.setItem(CUR, current); else localStorage.removeItem(CUR);
  set({ rooms, current });
  if (cur?.account) await call("/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
}

/** Guest photos taken before signing in: save them to the account now. */
export async function attachGuestRooms() {
  const s = await token(); if (!s) return 0;
  let n = 0;
  for (const r of state.rooms.filter((x) => !x.account)) { try { await upload(r, s.uid); n++; } catch {} }
  await loadMyRooms(true);
  return n;
}

/** Guest photos the shopper chose not to keep in the account: hide the offer for this browser. */
export function dismissAttach() { localStorage.setItem("am-room-attach-off", "1"); set({}); }
export function attachDismissed() { try { return localStorage.getItem("am-room-attach-off") === "1"; } catch { return false; } }
