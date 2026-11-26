/**
 * Shop search: every word the customer types is looked for on its own, anywhere in the design's
 * name, designer, rooms, styles, themes, tags, colors and description. It understands plurals
 * ("flowers" = "flower"), color words ("navy" finds blue designs), a few everyday synonyms
 * ("kids" = "children" = "nursery") and small typos ("botanicl"), and ranks the best matches first:
 * a word in the name counts more than a word in the description.
 */
import type { ColorFamily } from "./design-taxonomy";

export type SearchDoc = {
  title: string; sku?: string | undefined; designer?: string | undefined; kind?: string | undefined;
  palette?: string | undefined; colorways?: string[] | undefined; tags?: string[] | undefined;
  rooms?: string[] | undefined; styles?: string[] | undefined; extra?: string | undefined; description?: string | undefined;
};

const STOP = new Set(["a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "my", "me", "i", "some", "any", "wallpaper", "wallpapers", "design", "designs", "print", "prints", "please", "like", "style", "room"]);

/** everyday words that mean the same thing in a wallpaper shop (each group searches as one) */
const SYNONYMS: string[][] = [
  ["kid", "kids", "child", "children", "nursery", "baby", "toddler", "playroom"],
  ["flower", "floral", "blossom", "bloom", "rose", "peony"],
  ["leaf", "foliage", "botanical", "plant", "greenery", "palm", "fern"],
  ["tree", "forest", "wood", "woodland", "jungle"],
  ["sea", "ocean", "beach", "coastal", "nautical", "wave"],
  ["mountain", "landscape", "scenic", "view", "hill"],
  ["animal", "wildlife", "safari", "zoo"],
  ["bird", "birds", "aviary"],
  ["geometric", "geo", "shape", "line", "stripe"],
  ["vintage", "retro", "classic", "traditional", "antique"],
  ["modern", "contemporary", "minimal", "minimalist", "simple"],
  ["mural", "scene", "panorama"],
  ["repeat", "repeating", "pattern", "seamless"],
  ["bedroom", "bed"], ["bathroom", "bath"], ["office", "study", "workspace"],
  ["gold", "golden", "metallic", "brass"],
];

export function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ves") && w.length > 4) return w.slice(0, -3) + "f";
  if (/(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}
export const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

/** edit distance, stopping early once it is beyond `max` */
function close(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  // two letters swapped ("flaoral") count as one typo
  if (a.length === b.length) for (let i = 0; i < a.length - 1; i++) if (a[i] !== b[i]) { if (a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2) === b) return true; break; }
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

const FIELDS: [keyof SearchDoc, number][] = [["sku", 10], ["title", 6], ["designer", 4], ["palette", 3], ["colorways", 3], ["tags", 3], ["rooms", 3], ["styles", 3], ["kind", 2], ["extra", 2], ["description", 1]];

export type Query = { raw: string; terms: string[][] };

/** Turns what the customer typed into terms; each term is a list of words that all count as the same thing. */
export function parseQuery(raw: string, colors: ColorFamily[]): Query {
  const ws = words(raw).filter((w) => !STOP.has(w));
  const terms = ws.map((w) => {
    const s = stem(w), alts = new Set([w, s]);
    for (const g of SYNONYMS) if (g.some((x) => x === w || stem(x) === s)) g.forEach((x) => alts.add(stem(x)));
    // a color word stands for its whole color family ("navy" → every blue)
    for (const c of colors) if (c.words.some((x) => x === w || x === s || (x.length >= 4 && w.startsWith(x))) || words(c.label).includes(s)) { c.words.forEach((x) => alts.add(x)); words(c.label).forEach((x) => alts.add(x)); }
    return [...alts];
  });
  return { raw, terms };
}

/** How well one design matches (0 = not at all). `all`: every term must be found. */
export function scoreDoc(doc: SearchDoc, q: Query, all = true): { score: number; hits: number } {
  if (!q.terms.length) return { score: 1, hits: 0 };
  const fieldWords = FIELDS.map(([k, wt]) => {
    const v = doc[k]; const text = Array.isArray(v) ? v.join(" ") : (v ?? "");
    return { wt, ws: words(String(text)).map((w) => ({ w, s: stem(w) })) };
  });
  let score = 0, hits = 0;
  q.terms.forEach((alts, ti) => {
    const typed = alts[0]!; let best = 0;
    for (const f of fieldWords) for (const { w, s } of f.ws) {
      let m = 0;
      for (const a of alts) {
        const exact = a === typed || a === stem(typed);
        if (w === a || s === a) m = Math.max(m, exact ? 1 : 0.75);
        else if (a.length >= 3 && w.startsWith(a)) m = Math.max(m, exact ? 0.8 : 0.5); // typing in progress: "botan"
        else if (exact && a.length >= 5 && close(a, s, a.length >= 8 ? 2 : 1)) m = Math.max(m, 0.45); // small typo
      }
      if (m) best = Math.max(best, m * f.wt);
    }
    if (best) { hits++; score += best * (ti === 0 ? 1.1 : 1); }
  });
  if (all && hits < q.terms.length) return { score: 0, hits };
  // the whole phrase in the name ranks first
  if (q.terms.length > 1 && words(doc.title).join(" ").includes(words(q.raw).filter((w) => !STOP.has(w)).join(" "))) score += 8;
  return { score, hits };
}

/** Searches a list. If nothing has every word, returns the closest designs (most words found) and says so. */
export function smartSearch<T>(items: T[], toDoc: (t: T) => SearchDoc, raw: string, colors: ColorFamily[]): { list: T[]; closest: boolean } {
  const q = parseQuery(raw, colors);
  if (!q.terms.length) return { list: items, closest: false };
  const scored = items.map((t, i) => ({ t, i, ...scoreDoc(toDoc(t), q) })).filter((x) => x.score > 0);
  if (scored.length) return { list: scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.t), closest: false };
  const loose = items.map((t, i) => ({ t, i, ...scoreDoc(toDoc(t), q, false) })).filter((x) => x.hits > 0);
  return { list: loose.sort((a, b) => b.hits - a.hits || b.score - a.score || a.i - b.i).map((x) => x.t), closest: loose.length > 0 };
}
