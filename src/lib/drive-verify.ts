// Checks for copying a Google Drive file into our storage (R2) in pieces.
// Pure functions so they can be tested without Cloudflare.

export const DRIVE_PART = 32 * 1024 * 1024; // every piece the same size except the last (R2 multipart rule)
export const R2_MAX_PARTS = 10000;

/** How many pieces a file of `total` bytes needs, or an error when it can't be copied. */
export function planParts(total: number, maxGb: number, part = DRIVE_PART): { parts: number } | { error: string } {
  if (!Number.isFinite(total) || total <= 0) return { error: "Google Drive didn't say how big the file is." };
  if (total > maxGb * 1024 ** 3) return { error: `Files up to ${maxGb} GB.` };
  const parts = Math.ceil(total / part);
  if (parts > R2_MAX_PARTS) return { error: `Files up to ${Math.floor((R2_MAX_PARTS * part) / 1024 ** 3)} GB.` };
  return { parts };
}

/** Byte range of piece `n` (1-based), inclusive end, as Drive's Range header wants it. */
export function partRange(n: number, total: number, part = DRIVE_PART): { start: number; end: number; length: number } | null {
  const start = (n - 1) * part;
  if (!(n >= 1) || !Number.isInteger(n) || start >= total) return null;
  const end = Math.min(total, start + part) - 1;
  return { start, end, length: end - start + 1 };
}

const gb = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${Math.round(n / 1024 ** 2)} MB`);
const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** After the copy: every piece arrived, the pieces add up, and the stored file is exactly Drive's size. */
export function verifyCopy(o: { driveBytes: number; driveBytesNow?: number | null; partBytes: number[]; partsExpected: number; storedBytes: number | null }): { ok: true } | { ok: false; error: string } {
  if (o.partBytes.length !== o.partsExpected) return { ok: false, error: `Only ${o.partBytes.length} of ${o.partsExpected} pieces arrived. Try again.` };
  const sum = o.partBytes.reduce((a, b) => a + Number(b || 0), 0);
  if (sum !== o.driveBytes) return { ok: false, error: `The copy is incomplete: ${num(sum)} of ${num(o.driveBytes)} bytes arrived from Google Drive. Nothing was saved; try again.` };
  if (o.storedBytes == null) return { ok: false, error: "The copied file is missing from storage. Try again." };
  if (o.storedBytes !== o.driveBytes) return { ok: false, error: `Size check failed: Google Drive has ${num(o.driveBytes)} bytes (${gb(o.driveBytes)}) but storage has ${num(o.storedBytes)} (${gb(o.storedBytes)}). Nothing was saved; try again.` };
  if (o.driveBytesNow != null && o.driveBytesNow > 0 && o.driveBytesNow !== o.driveBytes) return { ok: false, error: `The file on Google Drive changed while it was being copied (now ${gb(o.driveBytesNow)}, was ${gb(o.driveBytes)}). Import it again.` };
  return { ok: true };
}

export type FileDims = { width: number; height: number; type?: string; dpi?: number; vector?: boolean } | null | undefined;

/** The size a raster file was built for: pixels ÷ the DPI saved in it (if believable), else ÷ fallbackDpi. */
export function builtSize(d: FileDims, fallbackDpi = 150): { dpi: number; fromFile: boolean; widthIn: number; heightIn: number; widthCm: number; heightCm: number } | null {
  if (!d || !d.width || !d.height || d.vector) return null;
  const fileDpi = d.dpi && d.dpi >= 50 && d.dpi <= 1200 ? d.dpi : 0;
  const dpi = fileDpi || fallbackDpi;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return { dpi, fromFile: !!fileDpi, widthIn: r1(d.width / dpi), heightIn: r1(d.height / dpi), widthCm: r1((d.width / dpi) * 2.54), heightCm: r1((d.height / dpi) * 2.54) };
}

/** One plain line for the designer after an import, plus a warning when the file is low resolution. */
export function importSummary(o: { name: string; bytes: number; driveBytes: number; dims: FileDims; minDpi?: number }): { line: string; warn: string | null } {
  const min = o.minDpi || 150;
  const same = o.bytes === o.driveBytes ? `matches Google Drive (${num(o.driveBytes)} bytes)` : `DOES NOT match Google Drive (${num(o.driveBytes)} bytes)`;
  const d = o.dims;
  if (!d || !d.width || !d.height) return { line: `Copied "${o.name}" from Google Drive: ${gb(o.bytes)}, ${same}.`, warn: null };
  if (d.vector) return { line: `Copied "${o.name}" from Google Drive: ${gb(o.bytes)}, ${same}. Vector file, prints at any size.`, warn: null };
  const b = builtSize(d, min)!;
  const sharpW = Math.round((d.width / min) * 10) / 10, sharpH = Math.round((d.height / min) * 10) / 10;
  const line = `Copied "${o.name}" from Google Drive: ${gb(o.bytes)}, ${same} · ${num(d.width)} × ${num(d.height)} px` + (b.fromFile ? ` · ${b.dpi} DPI = ${b.widthIn} × ${b.heightIn} in` : "");
  const warn = b.dpi < min ? `Heads up: this file is saved at ${b.dpi} DPI. At a sharp ${min} DPI it prints only up to ${sharpW} × ${sharpH} in. If you have a bigger version of this design (more pixels), import that one instead.` : null;
  return { line, warn };
}

/** DPI from a TIFF's XResolution + ResolutionUnit (2 = inch, 3 = cm). */
export function tiffDpi(xres: [number, number] | undefined, unit: number): number | undefined {
  if (!xres || !xres[1]) return undefined;
  const v = (xres[0] / xres[1]) * (unit === 3 ? 2.54 : 1);
  return unit === 1 || !(v >= 10 && v <= 5000) ? undefined : Math.round(v * 100) / 100;
}
