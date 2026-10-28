export const categories = ["Botanical", "Floral", "Landscape", "Geometric", "Abstract", "Tropical", "Minimal", "Kids & nursery", "Art deco", "Textured neutrals", "Japanese", "Hospitality"] as const;
export const roomOptions = [
  { label: "Bedroom", match: ["bedroom"] },
  { label: "Living room", match: ["living room", "lounge"] },
  { label: "Kids & nursery", match: ["nursery", "kids", "kids room", "kids friendly", "kid friendly", "kids-friendly", "playroom", "children", "child friendly"] },
  { label: "Dining room", match: ["dining room"] },
  { label: "Kitchen", match: ["kitchen"] },
  { label: "Bathroom", match: ["bathroom", "powder room"] },
  { label: "Hallway & stairs", match: ["hallway", "hallway & stairs", "stairwell", "entryway"] },
  { label: "Office & study", match: ["office", "study", "office & study"] },
  { label: "Commercial", match: ["commercial", "restaurant", "bar", "hotel", "cafe"] },
] as const;
export const roomLabels = roomOptions.map(r => r.label);
export function matchRoom(design: { room: readonly string[]; categories: readonly string[] }, label: string) {
  const option = roomOptions.find(r => r.label === label);
  const values = design.room.map(r => r.toLowerCase().trim());
  return values.includes(label.toLowerCase()) || Boolean(option?.match.some(m => values.includes(m))) ||
    (label === "Kids & nursery" && design.categories.includes("Kids & nursery")) ||
    (label === "Commercial" && design.categories.includes("Hospitality"));
}
export function effectiveCategories(rooms: readonly string[], styles: readonly string[], t?: Taxonomy) {
  return [...new Set([...canonicalCategories(styles, t), ...(matchRoom({ room: rooms, categories: styles }, "Kids & nursery") ? ["Kids & nursery"] : [])])];
}
export function searchableDesignText(design: { room: readonly string[]; categories: readonly string[] }) {
  return roomOptions.filter(r => matchRoom(design, r.label)).flatMap(r => [r.label, ...r.match]).join(" ");
}
export function mockupRooms(rooms: readonly string[], styles: readonly string[]) {
  if (matchRoom({ room: rooms, categories: styles }, "Kids & nursery")) return [
    { label: "Playroom", scene: "bright children's playroom with low toy storage and a small play table, no people" },
    { label: "Nursery", scene: "gentle nursery with a low cot and soft child-safe furnishings, no people" },
    { label: "Kids bedroom", scene: "cheerful children's bedroom with a low child-sized bed, no people" },
  ];
  const scenes: Record<string, string> = {
    Bedroom: "serene bedroom with a low bed", "Living room": "bright contemporary living room with a low sofa",
    "Dining room": "airy dining room with a small table", Kitchen: "bright kitchen breakfast nook with a low table",
    Bathroom: "beautiful bathroom with a low freestanding tub", "Hallway & stairs": "light spacious hallway with a low bench",
    "Office & study": "calm home office with a low desk", Commercial: "welcoming boutique cafe with small low tables",
  };
  const chosen = roomOptions.filter(r => matchRoom({ room: rooms, categories: styles }, r.label)).map(r => r.label);
  const labels = [...new Set([...chosen, "Living room", "Bedroom", "Dining room"])].slice(0, 3);
  return labels.map(label => ({ label, scene: scenes[label] ?? "bright contemporary room with low furniture" }));
}

// ---- Shop taxonomy (owner-editable in Back office > Settings > Categories) ----
export const defaultStyles = ["Modern", "Traditional", "Minimal", "Abstract", "Geometric", "Botanical", "Floral", "Damask", "Toile", "Chinoiserie", "Art deco", "Mid-century", "Boho", "Coastal", "Scandinavian", "Japanese", "Vintage", "Watercolor", "Textured neutrals"];
export const defaultThemes = ["Tropical", "Landscape", "Animals & birds", "Trees & forest", "Sky & clouds", "Ocean & water", "Mountains", "Maps & travel", "Stripes", "Textures", "Marble & stone", "Celestial", "City & architecture", "Fruit & food", "Kids & nursery", "Hospitality"];
export type Taxonomy = { styles: string[]; themes: string[]; rooms: string[] };
export const defaultTaxonomy: Taxonomy = { styles: defaultStyles, themes: defaultThemes, rooms: roomOptions.map((r) => r.label) };
const ALIASES: Record<string, string> = {
  kids: "Kids & nursery", kid: "Kids & nursery", nursery: "Kids & nursery", children: "Kids & nursery", "kids room": "Kids & nursery",
  animals: "Animals & birds", animal: "Animals & birds", birds: "Animals & birds", texture: "Textures", textured: "Textures",
  landscapes: "Landscape", "art-deco": "Art deco", deco: "Art deco", "mid century": "Mid-century", midcentury: "Mid-century", "mid-century modern": "Mid-century",
  florals: "Floral", flowers: "Floral", trees: "Trees & forest", forest: "Trees & forest", maps: "Maps & travel", map: "Maps & travel", ocean: "Ocean & water", sea: "Ocean & water",
  sky: "Sky & clouds", clouds: "Sky & clouds", marble: "Marble & stone", stone: "Marble & stone", city: "City & architecture", stripe: "Stripes", geometrics: "Geometric",
  neutral: "Textured neutrals", neutrals: "Textured neutrals", minimalist: "Minimal", scandi: "Scandinavian", bohemian: "Boho", "boho chic": "Boho",
};
const ROOM_ALIASES: Record<string, string> = Object.fromEntries(roomOptions.flatMap((r) => [[r.label.toLowerCase(), r.label], ...r.match.map((m) => [m, r.label])]));
const cleanList = (v: unknown, fallback: string[]): string[] => {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : null;
  if (!arr) return fallback;
  const out = [...new Set(arr.map((x) => String(x ?? "").replace(/[,|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean))].slice(0, 80);
  return out.length ? out : fallback;
};
/** Reads the owner's saved lists (one label per line, or arrays). Empty lists fall back to the defaults. */
export function parseTaxonomy(v: any): Taxonomy {
  return { styles: cleanList(v?.styles, defaultStyles), themes: cleanList(v?.themes, defaultThemes), rooms: cleanList(v?.rooms, defaultTaxonomy.rooms) };
}
let current: Taxonomy = defaultTaxonomy;
export function setTaxonomy(t?: Partial<Taxonomy> | null) { if (t) current = parseTaxonomy(t); }
export function getTaxonomy(): Taxonomy { return current; }
/** One spelling per category: matches the owner's lists case-insensitively (and old designer-editor words like "kids" or "texture"). */
export function canonicalCategory(s: string, t: Taxonomy = current): string {
  const v = String(s ?? "").trim(); const k = v.toLowerCase();
  if (!k) return "";
  const hit = [...t.styles, ...t.themes, ...categories].find((x) => x.toLowerCase() === k);
  if (hit) return hit;
  if (ALIASES[k]) return ALIASES[k];
  return v.charAt(0).toUpperCase() + v.slice(1);
}
export function canonicalCategories(list: readonly string[] | null | undefined, t: Taxonomy = current): string[] {
  return [...new Set((list ?? []).map((x) => canonicalCategory(x, t)).filter(Boolean))];
}
/** Room words from designers ("Kids room", "Office") become the shop's room labels. */
export function canonicalRoom(s: string, t: Taxonomy = current): string {
  const v = String(s ?? "").trim(); const k = v.toLowerCase();
  if (!k) return "";
  return t.rooms.find((x) => x.toLowerCase() === k) ?? ROOM_ALIASES[k] ?? v;
}
export function canonicalRooms(list: readonly string[] | null | undefined, t: Taxonomy = current): string[] {
  return [...new Set((list ?? []).map((x) => canonicalRoom(x, t)).filter(Boolean))];
}
