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
/** Version 2 added these so the whole category structure exists before designers upload (owner lists saved earlier get them once). */
const NEW_STYLES_V2 = ["Ombre", "Hand-painted", "Line art", "Art", "Faux finishes", "Funky & quirky", "Maximalist", "Retro"];
const NEW_THEMES_V2 = ["Leaves", "Nature", "Jungle", "Butterflies", "Panoramic", "Feature wall"];
export const defaultStyles = ["Modern", "Traditional", "Minimal", "Abstract", "Geometric", "Botanical", "Floral", "Damask", "Toile", "Chinoiserie", "Art deco", "Mid-century", "Boho", "Coastal", "Scandinavian", "Japanese", "Vintage", "Watercolor", "Textured neutrals", ...NEW_STYLES_V2];
export const defaultThemes = ["Tropical", "Landscape", "Animals & birds", "Trees & forest", "Sky & clouds", "Ocean & water", "Mountains", "Maps & travel", "Stripes", "Textures", "Marble & stone", "Celestial", "City & architecture", "Fruit & food", "Kids & nursery", "Hospitality", ...NEW_THEMES_V2];
/** Shop colors: the shop's Color filter, the designer's color picker and the automatic color finder all use this list. */
export type ColorFamily = { id: string; label: string; swatch: string; words: string[] };
const cf = (label: string, swatch: string, words: string[]): ColorFamily => ({ id: colorId(label), label, swatch, words });
export function colorId(label: string) { const w = label.toLowerCase().split(/[\s&,]+/).filter(Boolean)[0] ?? "color"; return w.replace(/[^a-z0-9-]/g, "") || "color"; }
export const defaultColors: ColorFamily[] = [
  cf("White & cream", "#F4F2EC", ["white", "cream", "ivory", "chalk", "bone"]),
  cf("Beige & neutral", "#D9CDB8", ["beige", "sand", "linen", "oat", "neutral", "taupe", "stone"]),
  cf("Grey", "#9A9A98", ["grey", "gray", "silver", "slate", "smok"]),
  cf("Black", "#2A2A2A", ["black", "ink", "midnight", "charcoal"]),
  cf("Blue", "#6F8FB4", ["blue", "navy", "indigo", "sky", "teal"]),
  cf("Green", "#7D9A6A", ["green", "olive", "sage", "moss", "fern", "emerald", "jungle", "palm"]),
  cf("Pink", "#E8B4B8", ["pink", "blush", "rose"]),
  cf("Red & terracotta", "#B5523B", ["red", "terracotta", "rust", "clay", "coral"]),
  cf("Yellow & gold", "#C9A24D", ["yellow", "gold", "ochre", "mustard"]),
  cf("Brown", "#7A5236", ["brown", "walnut", "umber", "tan"]),
];
/** One color per line: "Name | #hex | other words, comma separated". */
export const colorsToText = (c: ColorFamily[]) => c.map((x) => `${x.label} | ${x.swatch} | ${x.words.join(", ")}`).join("\n");
export function parseColors(v: unknown): ColorFamily[] {
  const lines = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : null;
  if (!lines) return defaultColors;
  const out: ColorFamily[] = []; const seen = new Set<string>();
  for (const l of lines) {
    const o: any = typeof l === "object" && l ? l : null;
    const parts = o ? [o.label, o.swatch, Array.isArray(o.words) ? o.words.join(",") : o.words] : String(l ?? "").split("|").map((x) => x.trim());
    const label = String(parts[0] ?? "").replace(/\s+/g, " ").trim().slice(0, 30); if (!label) continue;
    let id = colorId(label); while (seen.has(id)) id += "2"; seen.add(id);
    const swatch = /^#[0-9a-f]{6}$/i.test(String(parts[1] ?? "").trim()) ? String(parts[1]).trim() : "#999999";
    const words = [...new Set([...label.toLowerCase().split(/[\s&,]+/), ...String(parts[2] ?? "").toLowerCase().split(",")].map((w) => w.trim()).filter((w) => w.length > 1))].slice(0, 20);
    out.push({ id, label, swatch, words });
  }
  return out.length ? out.slice(0, 40) : defaultColors;
}
export type Taxonomy = { styles: string[]; themes: string[]; rooms: string[]; colors: ColorFamily[]; version?: number };
export const defaultTaxonomy: Taxonomy = { styles: defaultStyles, themes: defaultThemes, rooms: roomOptions.map((r) => r.label), colors: defaultColors };
const ALIASES: Record<string, string> = {
  kids: "Kids & nursery", kid: "Kids & nursery", nursery: "Kids & nursery", children: "Kids & nursery", "kids room": "Kids & nursery",
  animals: "Animals & birds", animal: "Animals & birds", birds: "Animals & birds", texture: "Textures", textured: "Textures",
  landscapes: "Landscape", "art-deco": "Art deco", deco: "Art deco", "mid century": "Mid-century", midcentury: "Mid-century", "mid-century modern": "Mid-century",
  florals: "Floral", flowers: "Floral", trees: "Trees & forest", forest: "Trees & forest", maps: "Maps & travel", map: "Maps & travel", ocean: "Ocean & water", sea: "Ocean & water",
  sky: "Sky & clouds", clouds: "Sky & clouds", marble: "Marble & stone", stone: "Marble & stone", city: "City & architecture", stripe: "Stripes", striped: "Stripes", geometrics: "Geometric", leaf: "Leaves", butterfly: "Butterflies", panorama: "Panoramic", "feature-wall": "Feature wall", "hand painted": "Hand-painted", lineart: "Line art", "line drawing": "Line art", quirky: "Funky & quirky", funky: "Funky & quirky", faux: "Faux finishes", maximal: "Maximalist", "70s": "Retro",
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
  let styles = cleanList(v?.styles, defaultStyles), themes = cleanList(v?.themes, defaultThemes);
  // lists saved before version 2 get the new categories once; after that, what the owner removes stays removed
  if (v && !(Number(v.version) >= 2)) { const has = new Set([...styles, ...themes].map((x) => x.toLowerCase())); styles = [...styles, ...NEW_STYLES_V2.filter((x) => !has.has(x.toLowerCase()))]; themes = [...themes, ...NEW_THEMES_V2.filter((x) => !has.has(x.toLowerCase()))]; }
  return { styles, themes, rooms: cleanList(v?.rooms, defaultTaxonomy.rooms), colors: parseColors(v?.colors), version: 2 };
}
/** "Shop by design" menu: the categories in columns. Anything the owner adds lands in Styles (styles) or General (themes). */
export type MenuLink = { label: string; search: Record<string, string> };
const COLS: [string, string[]][] = [
  ["Art & design", ["Abstract", "Geometric", "Stripes", "Watercolor", "Ombre", "Hand-painted", "Line art", "Art", "Marble & stone", "Textures", "Textured neutrals", "Faux finishes", "Damask", "Toile", "Chinoiserie"]],
  ["Animals & nature", ["Floral", "Botanical", "Tropical", "Jungle", "Leaves", "Trees & forest", "Animals & birds", "Butterflies", "Landscape", "Mountains", "Sky & clouds", "Ocean & water", "Nature", "Celestial"]],
  ["Styles", ["Art deco", "Boho", "Coastal", "Funky & quirky", "Japanese", "Maximalist", "Mid-century", "Minimal", "Modern", "Retro", "Scandinavian", "Traditional", "Vintage"]],
  ["General", ["Panoramic", "Feature wall", "Maps & travel", "City & architecture", "Fruit & food", "Kids & nursery", "Hospitality"]],
];
/** The same columns as the menu, as plain category names: the upload forms group their style buttons this way. */
export function categoryGroups(t: Taxonomy = current): { title: string; items: string[] }[] {
  const all = [...t.styles, ...t.themes]; const placed = new Set<string>();
  const groups = COLS.map(([title, names]) => ({ title, items: names.filter((n) => all.includes(n) && !placed.has(n) && (placed.add(n), true)) }));
  for (const x of t.styles) if (!placed.has(x)) { groups[2]!.items.push(x); placed.add(x); }
  for (const x of t.themes) if (!placed.has(x)) { groups[3]!.items.push(x); placed.add(x); }
  return groups.filter((g) => g.items.length);
}
export function menuColumns(t: Taxonomy = current): { title: string; links: MenuLink[] }[] {
  const link = (x: string): MenuLink => ({ label: x === "Stripes" ? "Striped" : x, search: t.themes.includes(x) && !t.styles.includes(x) ? { theme: x } : { category: x } });
  const all = new Set([...t.styles, ...t.themes]); const placed = new Set<string>();
  const cols = COLS.map(([title, names]) => ({ title, links: names.filter((n) => all.has(n)).map((n) => { placed.add(n); return link(n); }) }));
  for (const x of t.styles) if (!placed.has(x)) { cols[2]!.links.push(link(x)); placed.add(x); }
  for (const x of t.themes) if (!placed.has(x)) { cols[3]!.links.push(link(x)); placed.add(x); }
  const has = (n: string) => all.has(n);
  const popular: MenuLink[] = [{ label: "Best sellers", search: { sort: "popular" } }, { label: "New in", search: { sort: "new" } }, { label: "Murals", search: { kind: "mural" } }, { label: "Repeating patterns", search: { kind: "repeating" } },
    ...["Floral", "Botanical", "Abstract", "Geometric", "Tropical", "Kids & nursery"].filter(has).map(link)];
  return [{ title: "Popular", links: popular }, ...cols.filter((c) => c.links.length)];
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
