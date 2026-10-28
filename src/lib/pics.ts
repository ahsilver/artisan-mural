import type { Design, ThumbPic, ThumbSet } from "@/lib/catalog";
import { STATIC_PICS } from "@/lib/static-pics.gen";

/** Small pictures: each design's pictures are pre-made in a few widths (WebP) and kept in storage with a year-long cache.
 *  Cards use 320/480/720 px, the product gallery 720/1400 px; the full original only opens on zoom. */
export const CARD_W = [320, 480, 720];
export const BIG_W = [720, 1080, 1400];
export const ALL_W = [320, 480, 720, 1080, 1400];
export const GEN_ROOM = "gen:room";

/** A picture's stable id: its path without the signature (signed links change, the path does not). */
export function srcId(url: string): string {
  if (url === GEN_ROOM) return url;
  let p = url;
  try { p = new URL(url, "https://x.invalid").pathname; } catch {}
  p = p.replace(/^\/storage\/v1\/object\/(sign|public|authenticated)\//, "");
  try { return decodeURIComponent(p); } catch { return p; }
}
export function keyOf(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return "p" + (h >>> 0).toString(36) + id.length.toString(36);
}
export type Pic = { src: string; srcSet?: string; lq?: string; ar?: number; small: boolean };
const fileUrl = (slug: string, t: ThumbSet, p: ThumbPic, w: number) => `/backend/img/${slug}/${p.k}-${w}?v=${t.v}`;

/** The best small version of one picture of a design, or the original when none was made yet. */
export function pic(design: Pick<Design, "slug" | "thumbs">, src: string | undefined, widths: number[] = CARD_W): Pic | undefined {
  if (!src) return undefined;
  const t = design.thumbs;
  const p = t?.imgs[srcId(src)];
  if (!t || !p) return src === GEN_ROOM ? undefined : staticPic(src, widths.includes(1400) ? [720, 1080, 1440] : widths);
  const ws = p.w.filter((w) => widths.includes(w));
  const use = ws.length ? ws : [Math.max(...p.w)];
  return { src: fileUrl(design.slug, t, p, use[Math.min(1, use.length - 1)]), srcSet: use.map((w) => `${fileUrl(design.slug, t, p, w)} ${w}w`).join(", "), lq: p.lq, ar: p.ar, small: true };
}
/** Built-in pictures (sample designs, hero, showcase): small WebP versions made at build time in /s/. */
export function staticPic(url: string | undefined, widths?: number[]): Pic | undefined {
  if (!url) return undefined;
  const m = url.match(/\/(?:assets|media)\/([^/?]+)\.(?:jpg|jpeg|png|webp)(?:\?|$)/);
  const base = m?.[1] ?? "";
  const s = STATIC_PICS[base] ?? STATIC_PICS[base.replace(/-[A-Za-z0-9_-]{8}$/, "")];
  if (!s) return { src: url, small: false };
  const idx = s.w.map((w, i) => [w, i] as const).filter(([w]) => !widths || widths.includes(w));
  const use = idx.length ? idx : [[s.w[s.w.length - 1], s.w.length - 1] as const];
  const mid = use[Math.min(1, use.length - 1)];
  return { src: "/s/" + s.f[mid[1]], srcSet: use.map(([w, i]) => `/s/${s.f[i]} ${w}w`).join(", "), lq: s.lq, ar: s.ar, small: true };
}
/** Room pictures for a design: the designer's mockups, else the room picture made for it. */
export function roomSources(design: Pick<Design, "mockups" | "thumbs">): string[] {
  if (design.mockups?.length) return design.mockups;
  return design.thumbs?.imgs[GEN_ROOM] ? [GEN_ROOM] : [];
}

// ---------- making them (runs in the owner's or designer's browser) ----------
type Src = { id: string; url?: string; blob?: Blob };
export function thumbSources(design: Design): string[] {
  const ids = new Set<string>();
  const add = (u?: string) => { if (u) ids.add(srcId(u)); };
  add(design.image);
  for (const c of design.colorways ?? []) { add(c.image); (c.mockups ?? []).forEach(add); }
  (design.mockups ?? []).forEach(add);
  return [...ids];
}
/** True when some picture of the design has no small version yet. */
export function needsThumbs(design: Design): boolean {
  const t = design.thumbs;
  if (!t) return true;
  if (thumbSources(design).some((id) => !t.imgs[id])) return true;
  const anyRooms = (design.mockups?.length ?? 0) > 0 || (design.colorways ?? []).some((c) => c.mockups?.length);
  return !anyRooms && !t.imgs[GEN_ROOM];
}
function loadImg(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Could not load a picture"));
    im.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });
}
function scaled(im: HTMLImageElement | HTMLCanvasElement, w: number): HTMLCanvasElement {
  let cur: HTMLImageElement | HTMLCanvasElement = im;
  let cw = "naturalWidth" in cur ? cur.naturalWidth : cur.width, ch = "naturalHeight" in cur ? cur.naturalHeight : cur.height;
  const h = Math.max(1, Math.round((ch * w) / cw));
  while (cw / 2 >= w * 1.5) { // halve in steps for a clean result
    const c = document.createElement("canvas"); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, w, h);
  return c;
}
function encode(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => {
    if (b && b.type === "image/webp") return res(b);
    c.toBlob((j) => (j ? res(j) : rej(new Error("Could not save a picture"))), "image/jpeg", q + 0.06);
  }, "image/webp", q));
}
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/** Makes and uploads the small pictures of one design, then saves the list. Returns how many files were made. */
export async function buildThumbs(design: Design, token: string, onStep?: (done: number, total: number) => void): Promise<number> {
  const srcs: Src[] = [];
  const urlById = new Map<string, string>();
  const reg = (u?: string) => { if (u) { const id = srcId(u); if (!urlById.has(id)) { urlById.set(id, u); srcs.push({ id, url: u }); } } };
  reg(design.image);
  for (const c of design.colorways ?? []) { reg(c.image); (c.mockups ?? []).forEach(reg); }
  (design.mockups ?? []).forEach(reg);
  const anyRooms = (design.mockups?.length ?? 0) > 0 || (design.colorways ?? []).some((c) => (c.mockups?.length ?? 0) > 0);
  if (!anyRooms) {
    try { // no room picture yet: make one at true scale in a free room scene
      const { makeMockup, pickRooms } = await import("@/lib/auto-mockup");
      const im = await loadImg(design.image);
      const ar = im.naturalWidth / im.naturalHeight;
      const mural = design.kind === "mural";
      const widthCm = mural ? design.maxWidthCm ?? 400 : design.repeatCm ?? 64;
      const heightCm = mural ? widthCm / ar : design.printHeightCm ?? widthCm / ar;
      const room = pickRooms(design.slug, 0, 1, [...(design.room ?? []), ...(design.categories ?? [])])[0];
      if (room) srcs.push({ id: GEN_ROOM, blob: await makeMockup(design.image, { kind: design.kind, widthCm, heightCm, repeat: design.match === "halfdrop" && design.repeat !== "horizontal" ? "halfdrop" : design.repeat }, room) });
    } catch (e) { console.warn("room picture", e); }
  }
  const v = Math.floor(Date.now() / 1000);
  const imgs: Record<string, ThumbPic> = { ...(design.thumbs?.imgs ?? {}) };
  const total = srcs.length; let done = 0, files = 0;
  const auth = { authorization: `Bearer ${token}` };
  await pool(srcs, 3, async (s) => {
    try {
      const im = await loadImg(s.blob ?? s.url!);
      const k = keyOf(s.id);
      const nw = im.naturalWidth;
      const ws = ALL_W.filter((w) => w <= nw * 1.05);
      if (!ws.length) ws.push(Math.min(nw, 320));
      for (const w of ws) {
        const blob = await encode(scaled(im, w), w >= 1000 ? 0.8 : 0.74);
        const r = await fetch(`/backend/thumbs/put?slug=${encodeURIComponent(design.slug)}&file=${k}-${w}`, { method: "POST", headers: { ...auth, "content-type": blob.type }, body: blob });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "upload failed");
        files++;
      }
      const tiny = scaled(im, 16);
      let lq = tiny.toDataURL("image/webp", 0.5);
      if (!lq.startsWith("data:image/webp")) lq = tiny.toDataURL("image/jpeg", 0.5);
      imgs[s.id] = { k, w: ws, lq, ar: Math.round((im.naturalWidth / im.naturalHeight) * 1000) / 1000 };
      if (s.blob) URL.revokeObjectURL(im.src);
    } finally { onStep?.(++done, total); }
  });
  // forget pictures the design no longer has
  const keep = new Set(srcs.map((s) => s.id));
  for (const id of Object.keys(imgs)) if (!keep.has(id)) delete imgs[id];
  const r = await fetch("/backend/thumbs/save", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ slug: design.slug, data: { v, imgs } }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "save failed");
  return files;
}
