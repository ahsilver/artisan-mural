import type { ColorFamily } from "@/lib/design-taxonomy";

/** Finds a design's main colors from its picture: every pixel goes to the nearest shop color (by how the eye sees
 *  color, not raw RGB), and the colors covering enough of the picture are returned, biggest first. */
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function toLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const hex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** pixels: RGBA bytes. Returns the labels of the main colors (at most `max`, each covering at least `minShare`). */
export function colorFamiliesOf(pixels: Uint8ClampedArray | Uint8Array, colors: ColorFamily[], max = 3, minShare = 0.12): string[] {
  if (!colors.length) return [];
  const labs = colors.map((c) => toLab(...hex(c.swatch)));
  const count = new Array(colors.length).fill(0); let n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue;
    const [L, A, B] = toLab(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    let best = 0, bd = Infinity;
    for (let k = 0; k < labs.length; k++) { const [l2, a2, b2] = labs[k]!; const d = (L - l2) ** 2 * 0.6 + (A - a2) ** 2 + (B - b2) ** 2; if (d < bd) { bd = d; best = k; } }
    count[best]++; n++;
  }
  if (!n) return [];
  return count.map((c, k) => [c / n, k] as [number, number]).filter(([s]) => s >= minShare).sort((a, b) => b[0] - a[0]).slice(0, max).map(([, k]) => colors[k]!.label);
}

/** The same from a picture link or file (made small first: 96 px is plenty to see the main colors). */
export async function findColors(src: string | Blob, colors: ColorFamily[]): Promise<string[]> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; await img.decode();
    const k = 96 / Math.max(img.naturalWidth, img.naturalHeight), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!; x.drawImage(img, 0, 0, w, h);
    return colorFamiliesOf(x.getImageData(0, 0, w, h).data, colors);
  } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
}
