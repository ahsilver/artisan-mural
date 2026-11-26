/**
 * The homepage's editable parts, in one place: which designs are featured, the "shop by" tiles (name, words,
 * picture and which category they open), the room tiles, the room links under them, the section titles, and a
 * cover picture for every category. The owner edits all of it in the back office (settings group "homepage");
 * anything left empty keeps the standard choice, and empty pictures change by themselves every day.
 */
import type { Design } from "./catalog";
import { getTaxonomy, matchRoom } from "./design-taxonomy";

export type LinkKind = "mural" | "repeat" | "room" | "style" | "theme" | "color" | "all";
export type TileLink = { kind: LinkKind; value?: string | undefined };
export type HomeTile = { title: string; sub?: string | undefined; image?: string | undefined; link: TileLink };

export const LINK_KINDS: [LinkKind, string][] = [["mural", "Murals"], ["repeat", "Repeating patterns"], ["room", "A room"], ["style", "A style"], ["theme", "A theme"], ["color", "A color"], ["all", "All designs"]];

export const DEFAULT_LOOKS: HomeTile[] = [
  { title: "Murals", sub: "Scenic & panoramic", link: { kind: "mural" } },
  { title: "Botanical", sub: "Palms, leaves & ferns", link: { kind: "style", value: "Botanical" } },
  { title: "Floral", sub: "Blooms & bouquets", link: { kind: "style", value: "Floral" } },
  { title: "Animals", sub: "Dogs, birds & wildlife", link: { kind: "theme", value: "Animals & birds" } },
  { title: "Geometric", sub: "Shapes & lines", link: { kind: "style", value: "Geometric" } },
  { title: "Minimal", sub: "Quiet & calm", link: { kind: "style", value: "Minimal" } },
];
export const DEFAULT_MOODS: HomeTile[] = [
  { title: "Black & white", link: { kind: "color", value: "black" } },
  { title: "Moody", link: { kind: "style", value: "Abstract" } },
  { title: "Tropical", link: { kind: "theme", value: "Tropical" } },
  { title: "Kids & nursery", link: { kind: "room", value: "Kids & nursery" } },
];
export const DEFAULT_ROOM_TILES: HomeTile[] = [
  { title: "Living room", image: "/p/img/cover-living-room.webp", link: { kind: "room", value: "Living room" } },
  { title: "Bedroom", image: "/p/img/cover-bedroom.webp", link: { kind: "room", value: "Bedroom" } },
  { title: "Kitchen & bath", image: "/p/img/cover-bathroom.webp", link: { kind: "room", value: "Kitchen" } },
  { title: "Hotels & restaurants", image: "/p/img/cover-restaurant.webp", link: { kind: "room", value: "Commercial" } },
];
export const DEFAULT_ROOM_STRIP: { title: string; room: string }[] = [
  { title: "Dining", room: "Dining room" }, { title: "Kitchen", room: "Kitchen" }, { title: "Kids & nursery", room: "Kids & nursery" },
  { title: "Office", room: "Office & study" }, { title: "Hallway", room: "Hallway & stairs" },
];
export const DEFAULT_HEADINGS = {
  rooms: "Wallpaper for Every Room",
  transformTitle: "Transform your walls.",
  transformText: "Get inspired by the newest work from our artists. Pick a mural or a repeating pattern, choose the paper, and we print it to fit your wall to the inch.",
  transformButton: "Browse all designs",
  trends: "Discover Today's Trends",
  new: "New Arrivals Weekly",
  designers: "Meet Our Designers",
  changesKicker: "Made-to-order changes",
  changesTitle: "Love it, but want one thing changed?",
  changesText: "Our designers can change any design for your wall. Free to ask.",
};
export type Headings = typeof DEFAULT_HEADINGS;

/** Same order every visitor sees on a given day, a new order the next day. */
export function daily<T>(list: T[], salt = 0): T[] {
  let seed = (Math.floor(Date.now() / 864e5) + salt) * 2654435761 % 4294967296;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a;
}

/** Where a tile goes in the shop. */
export function linkSearch(l: TileLink): Record<string, string> {
  switch (l.kind) {
    case "mural": return { kind: "mural" };
    case "repeat": return { kind: "repeating" };
    case "room": return l.value ? { room: l.value } : {};
    case "style": return l.value ? { category: l.value } : {};
    case "theme": return l.value ? { theme: l.value } : {};
    case "color": return l.value ? { color: l.value } : {};
    default: return {};
  }
}
const lc = (s: string) => s.toLowerCase();
/** Does a design belong where the tile goes? (used to pick its automatic picture) */
export function linkMatches(d: Design, l: TileLink): boolean {
  const v = lc(l.value ?? "");
  switch (l.kind) {
    case "mural": return d.kind === "mural";
    case "repeat": return d.kind !== "mural";
    case "room": return !!l.value && matchRoom(d, l.value);
    case "style": case "theme": return !!v && [...d.categories, ...(d.tags ?? [])].some((c) => lc(String(c)) === v || lc(String(c)).includes(v.split(/[\s&]+/)[0]!));
    case "color": { const o = getTaxonomy().colors.find((c) => c.id === l.value); const p = lc([d.palette, ...(d.tags ?? []), ...(d.colorways ?? []).map((c) => c.name)].join(" ")); return o ? o.words.some((w) => p.includes(w)) : !!v && p.includes(v); }
    default: return true;
  }
}
export const coverKey = (l: TileLink) => `${l.kind}:${l.value ?? ""}`;

function cleanTile(t: any, fallback?: HomeTile): HomeTile | null {
  if (!t || typeof t !== "object") return fallback ?? null;
  const link: TileLink = t.link && LINK_KINDS.some(([k]) => k === t.link.kind) ? { kind: t.link.kind, value: typeof t.link.value === "string" && t.link.value ? t.link.value : undefined } : fallback?.link ?? { kind: "all" };
  const title = String(t.title || fallback?.title || "").trim(); if (!title) return null;
  return { title, sub: t.sub || fallback?.sub || undefined, image: t.image || fallback?.image || undefined, link };
}
/** A tile list from settings: a saved list wins; else the standard list with any older single-field edits (name, picture). */
function tiles(saved: unknown, legacy: unknown, offset: number, defaults: HomeTile[]): HomeTile[] {
  if (Array.isArray(saved)) return saved.map((t) => cleanTile(t)).filter(Boolean) as HomeTile[];
  const old = Array.isArray(legacy) ? legacy : [];
  return defaults.map((d, i) => cleanTile({ ...d, ...Object.fromEntries(Object.entries(old[offset + i] ?? {}).filter(([, x]) => x)) }, d)!);
}
export type HomeLayout = { looks: HomeTile[]; moods: HomeTile[]; rooms: HomeTile[]; roomStrip: { title: string; room: string }[]; headings: Headings; covers: Record<string, string>; featured: string[] };
export function homeLayout(home: any): HomeLayout {
  const h = home ?? {};
  const strip = Array.isArray(h.roomStrip) ? h.roomStrip.filter((r: any) => r && r.room).map((r: any) => ({ title: String(r.title || r.room), room: String(r.room) })) : DEFAULT_ROOM_STRIP;
  const headings = { ...DEFAULT_HEADINGS } as Headings;
  for (const k of Object.keys(DEFAULT_HEADINGS) as (keyof Headings)[]) if (typeof h.headings?.[k] === "string" && h.headings[k].trim()) headings[k] = h.headings[k];
  return {
    looks: tiles(h.lookTiles, h.tiles, 0, DEFAULT_LOOKS),
    moods: tiles(h.moodTiles, h.tiles, 6, DEFAULT_MOODS),
    rooms: tiles(h.roomTileList, h.roomTiles, 0, DEFAULT_ROOM_TILES),
    roomStrip: strip, headings,
    covers: h.covers && typeof h.covers === "object" ? h.covers : {},
    featured: Array.isArray(h.featuredSlugs) ? h.featuredSlugs.filter((s: unknown) => typeof s === "string") : [],
  };
}
/** A tile's picture: its own, else the category's cover, else a matching design in a room (a different one each day). */
export function tilePicture(t: HomeTile, layout: HomeLayout, pool: Design[], salt: number, roomPic: (d?: Design) => string | undefined): { img?: string | undefined; d?: Design | undefined } {
  if (t.image) return { img: t.image };
  const cover = layout.covers[coverKey(t.link)]; if (cover) return { img: cover };
  const d = daily(pool.filter((x) => linkMatches(x, t.link)), salt)[0] ?? daily(pool, salt)[0];
  return { img: roomPic(d), d };
}
/** Today's featured design: one of the owner's chosen designs (a different one each day), else any design with room pictures. */
export function featuredToday(live: Design[], layout: HomeLayout): Design | undefined {
  const chosen = live.filter((d) => layout.featured.includes(d.slug));
  return daily(chosen.length ? chosen : live.filter((d) => d.mockups?.length), 7)[0];
}
