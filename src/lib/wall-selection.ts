import { z } from "zod";
import { toSqft } from "@/lib/catalog";

/** Area to print: exact wall measurements, without trimming/waste extras. */
export function orderSqft(s: { width: number; height: number; unit: "cm" | "in" | "ft"; waste?: number }) {
  return toSqft(s.width, s.height, s.unit);
}

export const PANEL_WIDTH_IN = 52;
export const PANEL_OVERLAP_IN = 3;
export function measurementInches(value: number, unit: "cm" | "in" | "ft") {
  return unit === "cm" ? value / 2.54 : unit === "ft" ? value * 12 : value;
}
/** First panel covers 52 inches; each following panel adds 49 usable inches. */
export function panelGeometry(width: number, unit: "cm" | "in" | "ft") {
  const inches = measurementInches(width, unit);
  const advance = PANEL_WIDTH_IN - PANEL_OVERLAP_IN;
  const count = Math.max(1, 1 + Math.ceil(Math.max(0, inches - PANEL_WIDTH_IN) / advance - 1e-9));
  const guides = Array.from({ length: Math.min(count - 1, 200) }, (_, i) => ({
    start: ((i + 1) * advance) / inches,
    overlap: Math.min(PANEL_OVERLAP_IN / inches, 1 - ((i + 1) * advance) / inches),
  }));
  return { count, guides };
}

export const MIN_ARTWORK_ZOOM = 0.05;
export const MAX_REPEAT_ZOOM = 32;

export const wallSelectionSchema = z.object({
  width: z.number().positive().max(100000),
  height: z.number().positive().max(100000),
  unit: z.enum(["cm", "in", "ft"]),
  zoom: z.number().min(MIN_ARTWORK_ZOOM).max(MAX_REPEAT_ZOOM),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  artRatio: z.number().positive().max(100),
  waste: z
    .number()
    .min(0)
    .max(30)
    .default(0)
    .transform(() => 0),
  color: z.string().max(40).optional(),
});
export type WallSelection = z.infer<typeof wallSelectionSchema>;
export const initialWall: WallSelection = {
  width: 10,
  height: 8,
  unit: "ft",
  zoom: 0.7,
  x: 0.5,
  y: 0.5,
  artRatio: 1.25,
  waste: 0,
};
export const wallSearchSchema = z.object({
  width: z.coerce.number().positive().max(100000).catch(initialWall.width),
  height: z.coerce.number().positive().max(100000).catch(initialWall.height),
  unit: wallSelectionSchema.shape.unit.catch(initialWall.unit),
  zoom: z.coerce.number().min(MIN_ARTWORK_ZOOM).max(MAX_REPEAT_ZOOM).catch(initialWall.zoom),
  x: z.coerce.number().min(0).max(1).catch(initialWall.x),
  y: z.coerce.number().min(0).max(1).catch(initialWall.y),
  artRatio: z.coerce.number().positive().max(100).catch(initialWall.artRatio),
  waste: z.coerce
    .number()
    .min(0)
    .max(30)
    .catch(0)
    .transform(() => 0),
  color: z.string().max(40).optional().catch(undefined),
  finish: z.string().max(60).optional().catch(undefined),
});
export function frameGeometry(selection: WallSelection) {
  const ratio = selection.width / selection.height;
  const w = Math.min(1, selection.zoom, ratio / selection.artRatio);
  const h = (w * selection.artRatio) / ratio;
  const x = Math.min(1 - w / 2, Math.max(w / 2, selection.x));
  const y = Math.min(1 - h / 2, Math.max(h / 2, selection.y));
  return { w, h, x, y };
}

export async function cropArtwork(src: string, selection: WallSelection): Promise<Blob> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const frame = frameGeometry({ ...selection, artRatio: image.naturalWidth / image.naturalHeight });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * frame.w);
  canvas.height = Math.round(image.naturalHeight * frame.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the artwork.");
  ctx.drawImage(
    image,
    (frame.x - frame.w / 2) * image.naturalWidth,
    (frame.y - frame.h / 2) * image.naturalHeight,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare artwork"))), "image/png"),
  );
}
/** Preview page search: wall selection plus which view and finish are open. */
export const previewSearchSchema = wallSearchSchema.extend({
  view: z.enum(["artwork", "room"]).optional().catch(undefined),
  finish: z.string().max(60).optional().catch(undefined),
  line: z.string().max(60).optional().catch(undefined), // the cart line being edited
});
export type PreviewSearch = z.infer<typeof previewSearchSchema>;
export function pickSelection(search: WallSelection & Record<string, unknown>): WallSelection {
  return {
    width: search.width,
    height: search.height,
    unit: search.unit,
    zoom: search.zoom,
    x: search.x,
    y: search.y,
    artRatio: search.artRatio,
    waste: search.waste ?? 0,
  };
}

type SizedDesign = {
  kind: "repeating" | "mural";
  repeat?: "horizontal" | "both" | undefined;
  repeatCm?: number | undefined;
  printHeightCm?: number | undefined;
  maxWidthCm?: number | undefined;
};
/** Allowed stretch beyond the designer's size before the designer must adapt it. */
export const STRETCH = 1.1;
export function repeatStyle(d: SizedDesign) {
  return d.kind === "mural" ? "none" : (d.repeat ?? "both");
}
/** Largest wall (cm) printable without the designer; undefined = unlimited. */
export function sizeLimits(d: SizedDesign, artRatio: number) {
  const style = repeatStyle(d);
  if (style === "both") return {};
  if (style === "horizontal") return { maxHeightCm: d.printHeightCm ? d.printHeightCm * STRETCH : undefined };
  // Murals: the designer's size is the largest printable; no stretch.
  return d.maxWidthCm ? { maxWidthCm: d.maxWidthCm, maxHeightCm: d.maxWidthCm / artRatio } : {};
}
export function sizeIssue(d: SizedDesign, s: WallSelection) {
  const lim = sizeLimits(d, s.artRatio);
  const w = measurementInches(s.width, s.unit) * 2.54,
    h = measurementInches(s.height, s.unit) * 2.54;
  const fmt = (cm: number) =>
    s.unit === "cm"
      ? `${Math.floor(cm)} cm`
      : s.unit === "in"
        ? `${Math.floor(cm / 2.54)} in`
        : `${Math.floor((cm / 30.48) * 10) / 10} ft`;
  const tooWide = lim.maxWidthCm !== undefined && w > lim.maxWidthCm,
    tooTall = lim.maxHeightCm !== undefined && h > lim.maxHeightCm;
  if (!tooWide && !tooTall) return null;
  return [tooWide && `wider than ${fmt(lim.maxWidthCm!)}`, tooTall && `taller than ${fmt(lim.maxHeightCm!)}`]
    .filter(Boolean)
    .join(" and ");
}
/** The repeat type in plain words, for shoppers. */
export function repeatWords(d: SizedDesign & { match?: string }, unit: "cm" | "in" | "ft" = "ft") {
  const style = repeatStyle(d);
  const fmt = (cm: number) => unit === "cm" ? `${Math.floor(cm)} cm` : unit === "in" ? `${Math.floor(cm / 2.54)} in` : `${Math.floor((cm / 30.48) * 10) / 10} ft`;
  if (style === "both") return { label: "Repeats in every direction", detail: `Tiles sideways and up and down${d.match === "halfdrop" ? " (half-drop match)" : ""}, so it fits any wall size.` };
  if (style === "horizontal") {
    const max = d.printHeightCm ? d.printHeightCm * STRETCH : undefined;
    return { label: max ? `Repeats sideways, fixed height up to ${fmt(max)}` : "Repeats sideways, fixed height", detail: `Any width; it does not repeat upward${max ? `, so walls up to ${fmt(max)} tall` : ""}.` };
  }
  return { label: "Mural, one scene, custom size", detail: "One picture printed once and sized to your wall, never tiled." };
}
/** Repeat tile layout in wall fractions: tile width/height as fractions of the wall. */
export function tileGeometry(d: SizedDesign, s: WallSelection) {
  const wallW = measurementInches(s.width, s.unit) * 2.54,
    wallH = measurementInches(s.height, s.unit) * 2.54;
  const style = repeatStyle(d);
  const baseW = d.repeatCm ?? (d.printHeightCm ? d.printHeightCm * s.artRatio : 60);
  let scale = (style === "both" ? 2 : 0.7) / s.zoom;
  if (style === "horizontal") scale = Math.max(scale, wallH / (baseW / s.artRatio));
  const tw = (baseW * scale) / wallW;
  const th = (baseW * scale) / s.artRatio / wallH;
  return { tw, th, style };
}

/** Restore physical artwork scale without changing wall measurements, color, or price. */
export function designerScaleSelection(d: SizedDesign, s: WallSelection): WallSelection {
  const style = repeatStyle(d);
  const wallW = measurementInches(s.width, s.unit) * 2.54;
  const baseW = d.repeatCm ?? (d.printHeightCm ? d.printHeightCm * s.artRatio : 60);
  const horizontalZoom = d.printHeightCm ? 0.7 * baseW / s.artRatio / d.printHeightCm : 0.7;
  return {
    ...s,
    zoom: style === "both" ? 2 : style === "horizontal" ? Math.min(MAX_REPEAT_ZOOM, Math.max(MIN_ARTWORK_ZOOM, horizontalZoom)) : Math.min(1, Math.max(MIN_ARTWORK_ZOOM, wallW / (d.maxWidthCm ?? wallW))),
    x: 0.5,
    y: 0.5,
  };
}
