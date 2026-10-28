import fern from "@/assets/design-fern.jpg";
import mist from "@/assets/design-mist.jpg";
import arches from "@/assets/design-arches.jpg";
import cranes from "@/assets/design-cranes.jpg";
import dots from "@/assets/design-dots.jpg";
import waves from "@/assets/design-waves.jpg";
import cranesBlushAsset from "@/assets/design-cranes-blush.webp.asset.json";
import cranesIvoryAsset from "@/assets/design-cranes-ivory.webp.asset.json";
import cranesMidnightAsset from "@/assets/design-cranes-midnight.webp.asset.json";
import canvasTexture from "@/assets/texture-canvas.jpg.asset.json";
import grassclothTexture from "@/assets/texture-grasscloth.jpg.asset.json";
import linenTexture from "@/assets/texture-linen.jpg.asset.json";
import suedeTexture from "@/assets/texture-suede.jpg.asset.json";
import { categories, setTaxonomy, type Taxonomy } from "./design-taxonomy";
export { categories } from "./design-taxonomy";

/** Retail print price, US dollars per square foot. */
export const PRICE_PER_SQFT = 4.5;
/** Optional service where our studio adapts a mural to an awkward wall. */
export const FIT_SERVICE_FEE = 45;
/** Our commission on a custom design commission. */
export const COMMISSION_RATE = 0.1;
export const SQFT_PER_SQM = 10.7639;

export const ROYALTY_TIERS = [
  { label: "Starter", from: 0, rate: 0.5 },
  { label: "Studio", from: 2500, rate: 0.55 },
  { label: "Atelier", from: 5000, rate: 0.6 },
] as const;

export function royaltyRateFor(monthlySqft: number): number {
  return [...ROYALTY_TIERS].reverse().find((t) => monthlySqft >= t.from)!.rate;
}

export type Unit = "cm" | "in" | "ft";

export function toSqft(width: number, height: number, unit: Unit): number {
  if (!width || !height) return 0;
  if (unit === "ft") return width * height;
  const wM = unit === "cm" ? width / 100 : (width * 2.54) / 100;
  const hM = unit === "cm" ? height / 100 : (height * 2.54) / 100;
  return wM * hM * SQFT_PER_SQM;
}

export function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export type Material = {
  id: string;
  name: string;
  /** Picture for the finish ball (a designer's own sample); else the texture. */
  ball?: string | undefined;
  blurb: string;
  /** Multiplier applied to the base per-sq-ft price. */
  factor: number;
  /** Unprinted manufacturer texture close-up, for visual reference only. */
  texture?: string | undefined;
  /** Owner price adjustment in $ per sq ft (+ or −) against the standard finish. */
  priceAdj?: number | undefined;
  /** Inches of material the texture photo covers (for real-scale preview). */
  sampleIn?: number | undefined;
  /** The house standard finish (list price). */
  standard?: boolean | undefined;
};

export const defaultMaterials: Material[] = [
  { id: "canvas", name: "Canvas", blurb: "A woven canvas texture with the character of an artist’s canvas.", factor: 1, priceAdj: 0.5, sampleIn: 2, texture: canvasTexture.url },
  { id: "grasscloth", name: "Grasscloth", blurb: "An organic grasscloth-style surface with a pronounced woven texture.", factor: 1, priceAdj: 1.0, sampleIn: 2, texture: grassclothTexture.url },
  { id: "linen", name: "Linen", blurb: "A finely woven linen texture for a subtle fabric-like finish.", factor: 1, priceAdj: 0.5, sampleIn: 2, texture: linenTexture.url },
  { id: "suede", name: "Suede", blurb: "A softly embossed suede texture with a fine, understated grain.", factor: 1, priceAdj: 1.0, sampleIn: 2, texture: suedeTexture.url },
  {
    id: "matte-smooth",
    name: "Matte smooth (house standard)",
    blurb: "Low-sheen paper-weave, paste the wall. Our everyday finish.",
    factor: 1, standard: true, priceAdj: 0,
  },
  {
    id: "textured-plaster",
    name: "Textured plaster",
    blurb: "Fine grain that reads like hand-finished plaster. Hides wall flaws.",
    factor: 1, priceAdj: 0.75, sampleIn: 2,
  },
  {
    id: "heavy-linen",
    name: "Heavy linen weave",
    blurb: "Woven look with real depth. Best for murals and feature walls.",
    factor: 1, priceAdj: 1.25, sampleIn: 2,
  },
  {
    id: "peel-stick",
    name: "Peel & stick",
    blurb: "Removable self-adhesive. Renters, nurseries, temporary rooms.",
    factor: 1, priceAdj: 1.0, sampleIn: 2,
  },
  {
    id: "scrub-vinyl",
    name: "Scrubbable vinyl",
    blurb: "Wipe-clean and moisture resistant. Kitchens, bathrooms, cafés.",
    factor: 1, priceAdj: 1.5, sampleIn: 2,
  },
];

export const materials: Material[] = [...defaultMaterials];
export type MaterialSetting = Material & { active: boolean };
/** The finishes a design is offered in: the designer's varieties (own name + sample picture), else every shop finish. */
export function offeredFinishes(design: { varieties?: Variety[] | undefined } | undefined, all: Material[]): Material[] {
  const offered = design?.varieties?.length ? design.varieties.map((v) => { const m = all.find((x) => x.id === v.id); return m ? { ...m, name: v.name || m.name, ball: v.image || undefined } : null; }).filter((m): m is NonNullable<typeof m> => !!m) : [];
  return offered.length ? offered : all;
}
/** The designer's recommended finishes that this design is actually offered in, in the designer's order. */
export function recommendedOf(design: { recommendedFinishes?: string[] | undefined } | undefined, offered: Pick<Material, "id">[]): string[] {
  return (design?.recommendedFinishes ?? []).filter((id) => offered.some((m) => m.id === id));
}
export function resolvedMaterials(settings: MaterialSetting[] = []): Material[] {
  const merged = new Map(defaultMaterials.map(m => [m.id, { ...m, active: true }]));
  settings.forEach(m => merged.set(m.id, m));
  return [...merged.values()].filter(m => m.active).sort((a, b) => Number(!!b.standard) - Number(!!a.standard));
}

export type Designer = {
  slug: string;
  name: string;
  location: string;
  initials: string;
  tagline: string;
  bio: string;
  since: string;
  rating: number;
  reviews: number;
  customFrom: number;
  /** What this designer charges to re-work an existing design for an odd wall. */
  adaptFee: number;
  responseTime: string;
  specialties: string[];
  photo?: string;
  responseLabel?: string;
  turnaroundDays?: number;
  hidden?: boolean;
};

export const designers: Designer[] = [
  {
    slug: "maren-holt",
    name: "Maren Holt",
    location: "Copenhagen, Denmark",
    initials: "MH",
    tagline: "Botanical repeats, drawn by hand in ink and gouache",
    bio: "I draw every leaf by hand before it ever touches a screen. My repeats are built for calm rooms — hallways, bedrooms, the quiet corner of a restaurant.",
    since: "2019",
    rating: 0,
    reviews: 0,
    customFrom: 480,
    adaptFee: 65,
    responseTime: "under 4 hours",
    specialties: ["Botanical", "Repeating", "Hand-painted"],
  },
  {
    slug: "ines-okafor",
    name: "Inès Okafor",
    location: "Lagos, Nigeria",
    initials: "IO",
    tagline: "Bold geometry and block-print colour",
    bio: "Pattern as architecture. I work in flat colour and strong structure, usually printed large so a single wall carries the whole room.",
    since: "2020",
    rating: 0,
    reviews: 0,
    customFrom: 620,
    adaptFee: 80,
    responseTime: "same day",
    specialties: ["Geometric", "Repeating", "Colour-blocked"],
  },
  {
    slug: "tomas-reyes",
    name: "Tomás Reyes",
    location: "Valparaíso, Chile",
    initials: "TR",
    tagline: "Panoramic murals, painted wall by wall",
    bio: "Every mural I make is a one-off scene, scaled to your exact wall. Send me your measurements and a photo and I will compose around your windows.",
    since: "2017",
    rating: 0,
    reviews: 0,
    customFrom: 850,
    adaptFee: 120,
    responseTime: "within a day",
    specialties: ["Murals", "Landscape", "Custom scale"],
  },
  {
    slug: "yuki-arai",
    name: "Yuki Arai",
    location: "Kyoto, Japan",
    initials: "YA",
    tagline: "Ink, gold leaf, and a lot of empty space",
    bio: "Trained in traditional screen painting. I like murals that leave room to breathe, with one or two moments of real detail.",
    since: "2018",
    rating: 0,
    reviews: 0,
    customFrom: 940,
    adaptFee: 140,
    responseTime: "within 2 days",
    specialties: ["Murals", "Minimal", "Gold leaf"],
  },
];

/** Categories designers pick from when they upload. */
export type Category = string; // labels come from the owner-editable taxonomy (lib/design-taxonomy.ts)

export type Design = {
  slug: string;
  sku?: string;
  mockups?: string[] | undefined;
  title: string;
  designer: string;
  image: string;
  kind: "repeating" | "mural";
  room: string[];
  categories: Category[];
  palette: string;
  /** Repeating only: "horizontal" tiles sideways (height limited), "both" tiles every direction. */
  repeat?: "horizontal" | "both";
  /** Full repeats: "halfdrop" offsets every other column by half a tile. */
  match?: "halfdrop" | "straight";
  /** Width of one pattern repeat at print size. */
  repeatCm?: number;
  /** Horizontal repeats: printed height of one repeat (wall height limit). */
  printHeightCm?: number;
  /** Murals: printed width of the full artwork (height follows the image). */
  maxWidthCm?: number;
  orientation: "portrait" | "landscape";
  description: string;
  /** The designer's story behind the design. */
  story?: string;
  orders: number;
  /** Finishes this design is offered in (empty = every shop finish). */
  varieties?: Variety[] | undefined;
  /** The designer's recommended finish ids (first = preselected), and a short note shown under the finish picker. */
  recommendedFinishes?: string[] | undefined;
  finishNote?: string | undefined;
  /** Color versions; the first is the original. */
  colorways?: Colorway[];
  /** Designer's keywords (search). */
  tags?: string[];
  /** Owner-set price per sq ft; falls back to PRICE_PER_SQFT. */
  pricePerSqft?: number;
  /** Small pre-made pictures for cards and the gallery (see lib/pics.ts). */
  thumbs?: ThumbSet;
};
/** One picture's small versions: file key, widths made, tiny blurred placeholder, width/height ratio. */
export type ThumbPic = { k: string; w: number[]; lq: string; ar: number };
/** All small pictures of one design, by source id (the picture's path; "gen:room" = a room picture made for designs without one). */
export type ThumbSet = { v: number; imgs: Record<string, ThumbPic> };

/** Price per sq ft for one design (owner override or the standard rate). */
let defaultRate: number = PRICE_PER_SQFT;
export function designRate(design?: Pick<Design, "pricePerSqft">): number {
  return design?.pricePerSqft && design.pricePerSqft > 0 ? design.pricePerSqft : defaultRate;
}

/** Price per sq ft for a design in a finish: design price (or the default) + the finish's adjustment. */
export function unitPrice(design?: Pick<Design, "pricePerSqft">, material?: Pick<Material, "factor" | "priceAdj"> | null): number {
  return Math.max(0, Math.round((designRate(design) * (material?.factor ?? 1) + (material?.priceAdj ?? 0)) * 100) / 100);
}
export function finishPriceLabel(m: Pick<Material, "priceAdj" | "standard">): string {
  const a = m.priceAdj ?? 0;
  if (m.standard || !a) return "Standard price";
  return `${a > 0 ? "+" : "−"}$${Math.abs(a).toFixed(2)}/sq ft`;
}

/** Owner edits for one design, with photo URLs already resolved. Removed keys match photo URLs for sample designs. */
export type DesignOverride = { slug: string; title?: string | undefined; description?: string | undefined; story?: string | undefined; pricePerSqft?: number | undefined; image?: string | null | undefined; removed: string[]; added: string[]; categories?: string[] | undefined; room?: string[] | undefined };

/** Applies owner edits to a design and its original colorway. */
export function applyOverride(design: Design, o?: DesignOverride): Design {
  if (!o) return design;
  const keep = (list?: string[]) => [...(list ?? []).filter((src) => !o.removed.includes(src)), ...o.added];
  const image = o.image ?? design.image;
  const mockups = keep(design.mockups);
  const colorways = design.colorways?.map((c, i) => (i === 0 ? { ...c, image: o.image ?? c.image, swatch: o.image ? `url("${o.image}")` : c.swatch, mockups: keep(c.mockups) } : c));
  const out: Design = { ...design, title: o.title || design.title, description: o.description || design.description, image, mockups };
  if (o.categories?.length) out.categories = o.categories;
  if (o.room?.length) out.room = o.room;
  const story = o.story || design.story; if (story) out.story = story;
  const rate = o.pricePerSqft ?? design.pricePerSqft; if (rate) out.pricePerSqft = rate;
  if (colorways) out.colorways = colorways;
  return out;
}

export type Colorway = { id: string; name: string; swatch: string; image: string; mockups?: string[] | undefined; originalId?: string | undefined; /** square piece of the picture shown in the ball (fractions) */ crop?: { x: number; y: number; w: number; h: number } | undefined };
/** A finish/variety the design is offered in (a shop material id), with an optional own name and sample picture. */
export type Variety = { id: string; name?: string | undefined; image?: string | undefined };

/** The chosen color version, when the design has more than one. */
export function colorOf(design: Design | undefined, color?: string): Colorway | undefined {
  if (!design?.colorways || design.colorways.length < 2) return undefined;
  return design.colorways.find((x) => x.id === color) ?? design.colorways[0];
}
/** CSS background for a color dot: the designer's swatch color, or a crop of the picture. */
export function swatchStyle(c: Colorway): Record<string, string> {
  if (!c.swatch.startsWith("url(")) return { backgroundColor: c.swatch };
  const k = c.crop;
  return k && k.w > 0 && k.h > 0 ? { backgroundImage: c.swatch, backgroundSize: `${100 / k.w}% ${100 / k.h}%`, backgroundPosition: `${k.w < 1 ? (k.x / (1 - k.w)) * 100 : 50}% ${k.h < 1 ? (k.y / (1 - k.h)) * 100 : 50}%`, backgroundRepeat: "no-repeat" } : { backgroundImage: c.swatch, backgroundSize: "cover", backgroundPosition: "center" };
}

/** Returns the design with the chosen color version applied (image + palette name). */
export function withColorway(design: Design, color?: string): Design {
  const c = design.colorways?.find((x) => x.id === color);
  return c ? { ...design, image: c.image, mockups: c.mockups } : design;
}

export const designs: Design[] = [
  {
    slug: "fernhouse",
    title: "Fernhouse",
    designer: "maren-holt",
    image: fern,
    kind: "repeating",
    room: ["Bedroom", "Hallway", "Bathroom"],
    categories: ["Botanical", "Textured neutrals", "Minimal"],
    palette: "Oatmeal, olive, clay",
    repeat: "both",
    repeatCm: 64,
    orientation: "portrait",
    description:
      "Pressed ferns and wild grasses on a warm oatmeal ground. A seamless repeat, so we print to any wall size you give us with no visible join.",
    orders: 312,
  },
  {
    slug: "long-mist",
    title: "Long Mist",
    designer: "tomas-reyes",
    image: mist,
    kind: "mural",
    room: ["Living room", "Office", "Dining room"],
    categories: ["Landscape", "Minimal", "Abstract"],
    palette: "Dusty blue, pale sand",
    maxWidthCm: 620,
    orientation: "landscape",
    description:
      "A panoramic watercolour of layered ridges and drifting cloud. One continuous scene — we scale and crop it to your exact wall before printing.",
    orders: 148,
  },
  {
    slug: "deco-arches",
    title: "Deco Arches",
    designer: "ines-okafor",
    image: arches,
    kind: "repeating",
    room: ["Dining room", "Bar", "Powder room"],
    categories: ["Art deco", "Geometric", "Hospitality"],
    palette: "Charcoal, terracotta, cream",
    repeat: "horizontal",
    repeatCm: 120,
    printHeightCm: 300,
    orientation: "portrait",
    description:
      "Hand-blocked arches in terracotta and cream on deep charcoal. Dramatic in small rooms, and it tiles perfectly across any width.",
    orders: 204,
  },
  {
    slug: "cranes-at-dusk",
    title: "Cranes at Dusk",
    designer: "yuki-arai",
    image: cranes,
    colorways: [
      { id: "ink-teal", name: "Ink Teal", swatch: "#1f4a4f", image: cranes },
      { id: "blush", name: "Blush", swatch: "#e7b7b5", image: cranesBlushAsset.url },
      { id: "ivory", name: "Ivory Ink", swatch: "#efe6d2", image: cranesIvoryAsset.url },
      { id: "midnight", name: "Midnight", swatch: "#1c2340", image: cranesMidnightAsset.url },
    ],
    kind: "mural",
    room: ["Bedroom", "Entryway", "Restaurant"],
    categories: ["Japanese", "Floral", "Hospitality"],
    palette: "Ink teal, bone, gold",
    maxWidthCm: 540,
    orientation: "landscape",
    description:
      "Cranes among plum blossom on ink teal, with gold-leaf cloud. A single composition — tell us the wall and we place the birds where you want them.",
    story: "Yuki painted this after a winter evening on the Kushiro marshes, watching red-crowned cranes settle in the last light. Each bird was sketched from life in ink first, then layered with washes of teal until the paper felt as cold and quiet as the evening itself.",
    orders: 96,
  },
  {
    slug: "soft-rain",
    title: "Soft Rain",
    designer: "maren-holt",
    image: dots,
    kind: "repeating",
    room: ["Nursery", "Bedroom", "Study"],
    categories: ["Kids & nursery", "Minimal", "Textured neutrals"],
    palette: "Dusty rose, cream",
    repeat: "both",
    repeatCm: 90,
    orientation: "portrait",
    description:
      "A quiet hand-stamped dot and dash on dusty rose. Small repeat, forgiving on uneven walls, and gentle in a child's room.",
    orders: 421,
  },
  {
    slug: "tide-marks",
    title: "Tide Marks",
    designer: "ines-okafor",
    image: waves,
    kind: "mural",
    room: ["Living room", "Office", "Stairwell"],
    categories: ["Abstract", "Minimal", "Hospitality"],
    palette: "Charcoal, ochre, bone",
    maxWidthCm: 700,
    orientation: "landscape",
    description:
      "Oversized brushstroke waves on raw canvas. Works as a full mural or you can take just one section of it for a smaller wall.",
    orders: 173,
  },
];

/** Approved designer uploads, loaded from the backend and registered at runtime. */
const extraDesigns = new Map<string, Design>();
const extraDesigners = new Map<string, Designer>();
let hiddenSlugs = new Set<string>();

export type ShopData = { taxonomy?: Taxonomy; thumbs?: Record<string, ThumbSet>; defaultRate?: number; designs: Design[]; designers: Designer[]; hidden: string[]; materialSettings?: MaterialSetting[]; overrides?: DesignOverride[]; ratings?: { slug: string; rating: number; reviews: number }[]; designRatings?: { slug: string; rating: number; reviews: number }[]; collections?: { id: string; designerSlug: string; title: string; description: string; designs: string[] }[] };
const ratingMap = new Map<string, { rating: number; reviews: number }>();
// Only real reviews count: a designer with none shows "No reviews yet" (sample numbers are never shown).
const withRating = (d: Designer): Designer => { const r = ratingMap.get(d.slug); return r ? { ...d, rating: r.rating, reviews: r.reviews } : { ...d, rating: 0, reviews: 0 }; };
const designRatingMap = new Map<string, { rating: number; reviews: number }>();
export const designRating = (slug: string) => designRatingMap.get(slug) ?? null;
const staticOverrides = new Map<string, Design>();

const thumbMap = new Map<string, ThumbSet>();
const withThumbs = (d: Design, map: Map<string, ThumbSet> | Record<string, ThumbSet> = thumbMap): Design => { const t = map instanceof Map ? map.get(d.slug) : map[d.slug]; return t && !d.thumbs ? { ...d, thumbs: t } : d; };
export function registerShop(shop: ShopData) {
  setTaxonomy(shop.taxonomy);
  if (shop.thumbs) { thumbMap.clear(); Object.entries(shop.thumbs).forEach(([k, v]) => thumbMap.set(k, v)); }
  defaultRate = shop.defaultRate && shop.defaultRate > 0 ? shop.defaultRate : PRICE_PER_SQFT;
  materials.splice(0, materials.length, ...resolvedMaterials(shop.materialSettings));
  extraDesigns.clear(); extraDesigners.clear();
  shop.designs.forEach((d) => extraDesigns.set(d.slug, d));
  shop.designers.forEach((d) => { if (!designers.some((x) => x.slug === d.slug)) extraDesigners.set(d.slug, d); });
  hiddenSlugs = new Set(shop.hidden);
  if (shop.ratings) { ratingMap.clear(); shop.ratings.forEach((r) => ratingMap.set(r.slug, r)); }
  if (shop.designRatings) { designRatingMap.clear(); shop.designRatings.forEach((r) => designRatingMap.set(r.slug, r)); }
  if (shop.overrides) {
    staticOverrides.clear();
    shop.overrides.forEach((o) => { const base = designs.find((d) => d.slug === o.slug); if (base) staticOverrides.set(o.slug, applyOverride(base, o)); });
  }
}

export function isHidden(slug: string): boolean {
  return hiddenSlugs.has(slug);
}

/** Every design currently live in the shop (sample catalog + approved uploads, minus removed ones). */
export function liveDesigns(shop?: ShopData): Design[] {
  const hidden = shop ? new Set(shop.hidden) : hiddenSlugs;
  return [...designs.map((d) => withThumbs(staticOverrides.get(d.slug) ?? d, shop?.thumbs ?? thumbMap)), ...(shop ? shop.designs : [...extraDesigns.values()])].filter((d) => !hidden.has(d.slug));
}

/** Sample designers plus approved designers from the backend. */
export function allDesigners(): Designer[] {
  return [...designers, ...extraDesigners.values()].map(withRating);
}

export function designerBySlug(slug: string): Designer | undefined {
  const d = designers.find((x) => x.slug === slug) ?? extraDesigners.get(slug);
  return d && withRating(d);
}

export function designBySlug(slug: string): Design | undefined {
  const d = staticOverrides.get(slug) ?? designs.find((d) => d.slug === slug) ?? extraDesigns.get(slug);
  return d && withThumbs(d);
}

export function designsByDesigner(slug: string): Design[] {
  return [...designs.map((d) => withThumbs(staticOverrides.get(d.slug) ?? d)), ...extraDesigns.values()].filter((d) => d.designer === slug && !hiddenSlugs.has(d.slug));
}
