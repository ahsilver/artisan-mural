import type { WallSelection } from "@/lib/wall-selection";

/** "Your own image": the customer's own picture, stored full size in their private folder, printed as a mural. */
export type OwnFile = { key: string; filename: string; width: number; height: number; thumb?: string };
export const OWN_SLUG = "own-image";
/** Sharp enough to go straight to the cart (owner can change it: Settings → General). Below it the customer sees a
 *  warning and chooses: print anyway, or send it to a designer to sharpen. */
export const OWN_GOOD_DPI = 100;

/** How the picture is placed on the wall, as print geometry: the visible part of the picture (normalized). */
export function ownSelection(o: { wallW: number; wallH: number; picW: number; picH: number; zoom: number; pos: [number, number] }): WallSelection {
  const ar = o.picW / o.picH, wallAr = o.wallW / o.wallH;
  const coverW = (ar >= wallAr ? o.wallH * ar : o.wallW) * o.zoom; // printed picture width (ft)
  const coverH = coverW / ar;
  const fw = Math.min(1, o.wallW / coverW), fh = Math.min(1, o.wallH / coverH);
  const cx = ((coverW - o.wallW) * (o.pos[0] / 100) + o.wallW / 2) / coverW, cy = ((coverH - o.wallH) * (o.pos[1] / 100) + o.wallH / 2) / coverH;
  return { width: o.wallW, height: o.wallH, unit: "ft", zoom: Math.max(0.05, fw), x: Math.min(1 - fw / 2, Math.max(fw / 2, cx)), y: Math.min(1 - fh / 2, Math.max(fh / 2, cy)), artRatio: ar, waste: 0 } as WallSelection;
}
/** Dots per inch the picture gets on the wall at this placement. */
export function ownDpi(o: { wallW: number; wallH: number; picW: number; picH: number; zoom: number }) {
  const ar = o.picW / o.picH, wallAr = o.wallW / o.wallH;
  const coverW = (ar >= wallAr ? o.wallH * ar : o.wallW) * o.zoom;
  return Math.round(o.picW / (coverW * 12));
}
/** A design-like line for the cart and checkout. */
export function ownDesign(own: OwnFile) {
  return { slug: OWN_SLUG, title: "Your own image", image: own.thumb || "", kind: "mural" as const, repeat: "none" as const, designer: "", categories: [] as string[], room: [] as string[] } as any;
}
