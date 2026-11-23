import { api } from "@/components/bo/common";
import { uploadFile, driveImport, makePreview, previewFromStored, readDims, dominantColor } from "@/lib/designer-files";
import { importSummary } from "@/lib/drive-verify";
import { checkRepeat } from "@/lib/repeat-check";

/** Adding one print file to a design as a colorway, the same steps the design editor uses:
 *  original into private storage -> shop picture made in the browser -> colorway row -> (first file) repeat check and starting size. */
export type Say = (text: string, frac?: number) => void;
const VECTOR_MAX_CM = 4876.8;

export const niceName = (file: string) => {
  const t = file.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return t.replace(/\b\w/g, (m) => m.toUpperCase());
};

export async function newDraft(title: string): Promise<string> {
  const r: any = await api("designer/uploads", { body: { title: title || "Untitled design", kind: "repeating", repeat: "both" } });
  return r.id as string;
}

async function addColorway(uploadId: string, orig: any, preview: Blob, name: string, first: boolean, rules: any) {
  const pv = await uploadFile(preview, { uploadId, purpose: "preview", filename: "preview.jpg" }, () => {});
  const sw = (await dominantColor(preview)) ?? undefined;
  const dims = orig.dims;
  const saved: any = await api(`designer/uploads/${uploadId}/colorways`, { body: { name, swatch: sw, sourceName: orig.filename, previewKey: pv.key, originalKey: orig.key, filename: orig.filename, mime: orig.mime, size: orig.size, width: dims?.width, height: dims?.height, dpi: dims?.vector ? null : dims?.dpi } });
  if (!first) return;
  try {
    const url = URL.createObjectURL(preview);
    const r = await checkRepeat(url, "both"); URL.revokeObjectURL(url);
    const seamless = r.lr.ok && !!r.tb?.ok, sideways = r.lr.ok && !r.tb?.ok;
    const t = seamless ? "full" : sideways ? "sideways" : "mural";
    const m: any = { ...(saved?.meta ?? {}), autoDetect: { seamless, sideways, lr: r.lr.score, tb: r.tb?.score } };
    if (seamless || sideways) m.repeatCheck = { confirmed: true, auto: true, lr: r.lr, tb: r.tb, style: t === "sideways" ? "horizontal" : "both", at: new Date().toISOString() };
    let size: any = {};
    if (dims?.width && dims?.height) {
      const fileDpi = dims.vector ? 72 : dims.dpi && dims.dpi >= 50 && dims.dpi <= 1200 ? dims.dpi : 0;
      const dpi = fileDpi || (t === "mural" ? rules?.minDpi || 150 : rules?.targetDpi || 150);
      const wcm = Math.round((dims.width / dpi) * 25.4) / 10, hcm = Math.round((dims.height / dpi) * 25.4) / 10;
      const big = dims.vector ? { maxWidthCm: VECTOR_MAX_CM, maxHeightCm: Math.round((VECTOR_MAX_CM * dims.height) / dims.width) } : { maxWidthCm: wcm, maxHeightCm: hcm };
      size = t === "mural" ? { widthCm: wcm, heightCm: hcm, ...big } : { widthCm: wcm, heightCm: hcm };
      m.fileDpi = dims.vector ? null : fileDpi || null; m.vector = !!dims.vector;
      if (t === "mural") { m.originalWidthCm = wcm; m.originalHeightCm = hcm; }
      m.unit = t === "mural" ? "ft" : "in";
    }
    await api(`designer/uploads/${uploadId}`, { body: { kind: t === "mural" ? "mural" : "repeating", repeat: t === "mural" ? "none" : t === "sideways" ? "horizontal" : "both", ...size, meta: m } });
  } catch {}
}

/** A file from the computer. Returns a short line about what arrived (pixels, sharpness). */
export async function importLocal(uploadId: string, f: File, name: string, first: boolean, rules: any, say: Say): Promise<string> {
  const dims = await readDims(f);
  if (dims?.width && !dims.vector && Math.max(dims.width, dims.height) < 1500) throw new Error(`${f.name} is only ${dims.width} × ${dims.height} px, too small to print sharply. Please use the full-size original.`);
  say("Making the shop picture…", 0);
  let preview: Blob | null = null;
  try { preview = await makePreview(f, dims); } catch { preview = null; }
  if (!preview) throw new Error(`${f.name}: this file type can't be shown in the browser. Use a JPG, PNG or TIFF.`);
  const orig: any = await uploadFile(f, { uploadId, purpose: "original" }, (d, t) => say(`Uploading ${f.name}`, t ? d / t : 0));
  orig.dims = orig.dims ?? dims;
  say("Saving…", 1);
  await addColorway(uploadId, orig, preview, name, first, rules);
  return dims?.width ? `${dims.width.toLocaleString()} × ${dims.height.toLocaleString()} px` : "";
}

/** A file in a shared Google Drive folder: copied byte for byte into our storage, checked against Drive. */
export async function importDrive(uploadId: string, fileId: string, fileName: string, name: string, first: boolean, rules: any, say: Say): Promise<string> {
  say("Copying from Google Drive…", 0);
  const orig: any = await driveImport(`https://drive.google.com/file/d/${fileId}/view`, uploadId, (d, t) => say(`Copying ${fileName} from Google Drive`, t ? d / t : 0));
  const chk = importSummary({ name: orig.filename, bytes: orig.size, driveBytes: orig.driveBytes, dims: orig.dims, minDpi: rules?.minDpi || 150 });
  say("Making the shop picture from your file…", 0);
  let preview: Blob | null = null;
  try { preview = await previewFromStored(orig.key, orig.mime, orig.size, orig.dims, (x) => say("Making the shop picture from your file…", x)); } catch { preview = null; }
  if (!preview) throw new Error(`${fileName}: can't make a picture from this file type. Use a JPG, PNG or TIFF.`);
  say("Saving…", 1);
  await addColorway(uploadId, orig, preview, name, first, rules);
  return chk.line + (chk.warn ? ` · ${chk.warn}` : "");
}
