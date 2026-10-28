import { api } from "@/components/bo/common";
import { supabase } from "@/integrations/supabase/client";
import { imageDims } from "@/lib/image-dims";

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ""; }
export async function readDims(file: Blob) {
  const head = new Uint8Array(await file.slice(0, 4 * 1024 * 1024).arrayBuffer());
  return imageDims(head);
}
function xhrPut(url: string, body: Blob, type: string, onProgress: (n: number) => void): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("authorization", `Bearer ${await token()}`);
    x.setRequestHeader("content-type", type || "application/octet-stream");
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? resolve(j) : reject(new Error(j.error || `Upload failed (${x.status})`)); } catch { reject(new Error(`Upload failed (${x.status})`)); } };
    x.onerror = () => reject(new Error("Network error during upload"));
    x.send(body);
  });
}
/** Uploads any size: one request under 90 MB, otherwise 32 MB parts, 3 at a time, each retried. */
export async function uploadFile(file: File | Blob, opts: { uploadId: string; purpose: "original" | "preview" | "mockup"; filename?: string }, onProgress: (done: number, total: number) => void) {
  const name = opts.filename ?? (file as File).name ?? "file.jpg";
  const type = file.type || "application/octet-stream";
  const start = await api("designer/files/start", { body: { uploadId: opts.uploadId, purpose: opts.purpose, filename: name, size: file.size, type } });
  if (start.single) {
    const r = await xhrPut(`/backend/designer/files/put?key=${encodeURIComponent(start.key)}`, file, type, (n) => onProgress(n, file.size));
    onProgress(file.size, file.size);
    return { key: start.key as string, size: r.size as number, dims: r.dims, filename: name, mime: type };
  }
  const size = start.partSize as number; const n = Math.ceil(file.size / size);
  const loaded = new Array(n).fill(0); const parts: any[] = [];
  let next = 0;
  const worker = async () => {
    while (next < n) {
      const i = next++;
      const blob = file.slice(i * size, Math.min(file.size, (i + 1) * size));
      for (let attempt = 1; ; attempt++) {
        try {
          const r = await xhrPut(`/backend/designer/files/part?key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}&part=${i + 1}`, blob, "application/octet-stream", (b) => { loaded[i] = b; onProgress(loaded.reduce((a, c) => a + c, 0), file.size); });
          parts[i] = { partNumber: r.partNumber, etag: r.etag }; loaded[i] = blob.size; break;
        } catch (e) { if (attempt >= 4) throw e; await new Promise((res) => setTimeout(res, 1500 * attempt)); }
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const done = await api("designer/files/complete", { body: { key: start.key, uploadId: start.uploadId, parts, type } });
  onProgress(file.size, file.size);
  return { key: start.key as string, size: done.size as number, dims: done.dims, filename: name, mime: type };
}
/** Google Drive: the server copies the whole file into our storage in 32 MB pieces, 3 at a time. */
export async function driveImport(link: string, uploadId: string, onProgress: (done: number, total: number, name: string) => void) {
  const s = await api("designer/drive/start", { body: { uploadId, link } });
  onProgress(0, s.total, s.filename);
  if (s.reused) { const r = await api("designer/drive/finish", { body: { job: s.job } }); onProgress(Number(r.total), Number(r.total), r.filename ?? s.filename); return { key: r.key as string, size: Number(r.total), dims: r.dims, filename: r.filename ?? s.filename, mime: r.mime || s.mime || "application/octet-stream", reused: true }; }
  const n = s.parts as number; const doneBytes = new Array(n).fill(0); let next = 1;
  const worker = async () => {
    while (next <= n) {
      const part = next++;
      for (let attempt = 1; ; attempt++) {
        try { await api("designer/drive/part", { body: { job: s.job, part } }); break; }
        catch (e) { if (attempt >= 5) throw new Error(`Drive import stopped at piece ${part} of ${n}: ${(e as Error).message}`); await new Promise((r) => setTimeout(r, 2000 * attempt)); }
      }
      doneBytes[part - 1] = Math.min(s.partSize, s.total - (part - 1) * s.partSize);
      onProgress(doneBytes.reduce((a, b) => a + b, 0), s.total, s.filename);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const r = await api("designer/drive/finish", { body: { job: s.job } });
  return { key: r.key as string, size: Number(r.total), dims: r.dims, filename: r.filename ?? s.filename, mime: r.mime || s.mime || "application/octet-stream" };
}
export async function driveFolder(link: string) { return (await api("designer/drive/list", { body: { link } })).files as { id: string; name: string; link: string }[]; }
export type DriveEntry = { id: string; name: string; link: string; folder: boolean; type: string; modified?: string; copied?: boolean; size?: number; usedIn?: string[] };
export async function driveFolderFull(link: string) { return (await api("designer/drive/list", { body: { link } })) as { folderId: string; name: string; files: DriveEntry[] }; }
export async function driveInfo(ids: string[]) { return (await api("designer/drive/info", { body: { ids } })).info as { id: string; ok: boolean; size?: number; name?: string; mime?: string }[]; }
/** Small picture of a Drive file before anything is copied: Google's own thumbnail, else (TIFF) read just enough of the file. */
export async function driveTiffThumb(id: string, maxSide = 260): Promise<string | null> {
  const { readTiff, tiffPreview } = await import("@/lib/tiff");
  const call = async (ranges: [number, number][]) => {
    const r = await fetch("/backend/designer/drive/ranges", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify({ id, ranges }) });
    if (!r.ok) throw new Error(`read failed (${r.status})`);
    const b = new Uint8Array(await r.arrayBuffer()); const dv = new DataView(b.buffer); const out: Uint8Array[] = []; let o = 0;
    while (o < b.length) { const n = dv.getUint32(o); o += 4; out.push(b.subarray(o, o + n)); o += n; }
    return out;
  };
  const readMany = async (ranges: [number, number][]) => { const groups: [number, number][][] = []; for (let i = 0; i < ranges.length; i += 20) groups.push(ranges.slice(i, i + 20)); return (await Promise.all(groups.map(call))).flat(); };
  const reader = async (s: number, l: number) => (await call([[s, l]]))[0];
  const info = await readTiff(reader);
  const step = Math.max(1, Math.ceil(Math.max(info.width, info.height) / maxSide));
  const strips = new Set<number>(); for (let j = 0; j < Math.floor(info.height / step); j++) strips.add(Math.floor(Math.min(info.height - 1, j * step + Math.floor(step / 2)) / info.rps));
  let bytes = 0; for (const st of strips) bytes += info.counts[st] ?? 0;
  if (bytes > 60 * 1024 * 1024) return null; // would need most of the file
  const { blob } = await tiffPreview(reader, maxSide, undefined, readMany);
  return URL.createObjectURL(blob);
}
/** The color most of a picture is made of (for the round color dot). */
export async function dominantColor(src: string | Blob): Promise<string | null> {
  try {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d")!; g.drawImage(img, 0, 0, 48, 48);
    if (typeof src !== "string") URL.revokeObjectURL(url);
    const d = g.getImageData(0, 0, 48, 48).data; const buckets = new Map<number, [number, number, number, number]>();
    for (let i = 0; i < d.length; i += 4) { const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); const b = buckets.get(k) ?? [0, 0, 0, 0]; b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++; buckets.set(k, b); }
    let best: [number, number, number, number] | null = null; for (const b of buckets.values()) if (!best || b[3] > best[3]) best = b;
    if (!best) return null;
    const hex = (n: number) => Math.round(n / best![3]).toString(16).padStart(2, "0");
    return `#${hex(best[0])}${hex(best[1])}${hex(best[2])}`;
  } catch { return null; }
}
export async function signedUrl(key: string) { return (await api("designer/files/url", { body: { key } })).url as string; }

/** Low-res product picture (2000 px) made in the browser from the original. */
export async function makePreview(file: Blob, dims?: { width: number; height: number } | null, maxSide = 2000): Promise<Blob> {
  const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d")!;
  let bmp: ImageBitmap;
  if (file.type === "image/tiff" || /\.tiff?$/i.test((file as File).name ?? "")) {
    const { tiffPreview, fileReader } = await import("@/lib/tiff");
    return (await tiffPreview(fileReader(file), maxSide)).blob;
  }
  if (file.type === "application/pdf") {
    const { makeOriginalPreview } = await import("@/lib/original-preview");
    return makeOriginalPreview(file);
  }
  if (dims && Math.max(dims.width, dims.height) > maxSide) {
    const s = maxSide / Math.max(dims.width, dims.height);
    bmp = await createImageBitmap(file, { resizeWidth: Math.round(dims.width * s), resizeHeight: Math.round(dims.height * s), resizeQuality: "high" });
  } else bmp = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  canvas.width = Math.round(bmp.width * s); canvas.height = Math.round(bmp.height * s);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height); bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the product picture."))), "image/jpeg", 0.86));
}
export const fmtBytes = (n: number) => n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + " GB" : n >= 1024 ** 2 ? (n / 1024 ** 2).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

/** Product picture straight from our stored copy, reading only what's needed (TIFF of any size, or images up to 300 MB). */
export async function previewFromStored(key: string, mime: string, size: number, dims: any, onProgress?: (f: number) => void): Promise<Blob | null> {
  const url = await signedUrl(key);
  if (mime === "image/tiff" || /\.tiff?$/i.test(key)) {
    const { tiffPreview, urlReader } = await import("@/lib/tiff");
    const readMany = async (ranges: [number, number][]) => {
      const { data } = await supabase.auth.getSession();
      for (let a = 1; ; a++) {
        try {
          const r = await fetch("/backend/designer/files/ranges", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ key, ranges }) });
          if (!r.ok) throw new Error(`read failed (${r.status})`);
          const b = new Uint8Array(await r.arrayBuffer()); const dv = new DataView(b.buffer); const out: Uint8Array[] = []; let o = 0;
          while (o < b.length) { const n = dv.getUint32(o); o += 4; out.push(b.subarray(o, o + n)); o += n; }
          return out;
        } catch (e) { if (a >= 4) throw e; await new Promise((res) => setTimeout(res, 1000 * a)); }
      }
    };
    return (await tiffPreview(urlReader(url), 2000, onProgress, readMany)).blob;
  }
  if (size < 300 * 1024 * 1024 && /image\/(jpeg|png|webp)/.test(mime)) { const blob = await (await fetch(url)).blob(); return makePreview(new File([blob], "x", { type: mime }), dims); }
  return null;
}
