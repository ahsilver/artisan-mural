// Big-TIFF tools that never load the whole file: read by byte ranges (local File or a URL with Range support).
export type Reader = (start: number, length: number) => Promise<Uint8Array>;
export const fileReader = (f: Blob): Reader => async (s, l) => new Uint8Array(await f.slice(s, s + l).arrayBuffer());
export const urlReader = (url: string): Reader => async (s, l) => {
  for (let a = 1; ; a++) {
    try {
      const r = await fetch(url, { headers: { range: `bytes=${s}-${s + l - 1}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error(`read failed (${r.status})`);
      const b = new Uint8Array(await r.arrayBuffer());
      return r.status === 200 ? b.subarray(s, s + l) : b;
    } catch (e) { if (a >= 4) throw e; await new Promise((res) => setTimeout(res, 800 * a)); }
  }
};
export type TiffInfo = { le: boolean; width: number; height: number; bps: number; spp: number; compression: number; photometric: number; predictor: number; rps: number; offsets: number[]; counts: number[]; planar: number; xres?: [number, number]; yres?: [number, number]; resUnit: number; icc?: Uint8Array; inkSet?: number };

export async function readTiff(read: Reader): Promise<TiffInfo> {
  const h = await read(0, 16);
  const le = h[0] === 0x49;
  const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
  const hv = dv(h);
  if (hv.getUint16(2, le) === 43) throw new Error("BigTIFF files aren't supported yet. Please upload a JPG preview.");
  const ifd = hv.getUint32(4, le);
  const nb = await read(ifd, 2); const n = dv(nb).getUint16(0, le);
  const ent = dv(await read(ifd + 2, n * 12));
  const SZ: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
  const tags: Record<number, { type: number; count: number; off: number; idx: number }> = {};
  for (let i = 0; i < n; i++) { const e = i * 12; const tag = ent.getUint16(e, le), type = ent.getUint16(e + 2, le), count = ent.getUint32(e + 4, le); tags[tag] = { type, count, off: ent.getUint32(e + 8, le), idx: i }; }
  async function vals(tag: number): Promise<number[]> {
    const t = tags[tag]; if (!t) return [];
    const size = (SZ[t.type] ?? 1) * t.count;
    const out: number[] = [];
    if (size <= 4) { // inline
      const base = t.idx * 12 + 8;
      for (let i = 0; i < t.count; i++) out.push(t.type === 3 ? ent.getUint16(base + i * 2, le) : t.type === 1 ? ent.getUint8(base + i) : ent.getUint32(base, le));
      return out;
    }
    const b = dv(await read(t.off, size));
    for (let i = 0; i < t.count; i++) out.push(t.type === 3 ? b.getUint16(i * 2, le) : t.type === 4 ? b.getUint32(i * 4, le) : t.type === 5 ? b.getUint32(i * 8, le) / (b.getUint32(i * 8 + 4, le) || 1) : b.getUint8(i));
    return out;
  }
  async function rational(tag: number): Promise<[number, number] | undefined> { const t = tags[tag]; if (!t) return; const b = dv(await read(t.off, 8)); return [b.getUint32(0, le), b.getUint32(4, le)]; }
  if (tags[322]) throw new Error("Tiled TIFF files aren't supported yet. Please upload a JPG preview.");
  const width = (await vals(256))[0], height = (await vals(257))[0];
  const bpsA = await vals(258); const spp = (await vals(277))[0] ?? 1;
  const info: TiffInfo = { le, width, height, bps: bpsA[0] ?? 8, spp, compression: (await vals(259))[0] ?? 1, photometric: (await vals(262))[0] ?? 2, predictor: (await vals(317))[0] ?? 1, rps: Math.min((await vals(278))[0] ?? height, height), offsets: await vals(273), counts: await vals(279), planar: (await vals(284))[0] ?? 1, xres: await rational(282), yres: await rational(283), resUnit: (await vals(296))[0] ?? 2, inkSet: (await vals(332))[0] };
  if (tags[34675]) { const t = tags[34675]; info.icc = await read(t.off, t.count); }
  if (info.planar !== 1) throw new Error("This TIFF stores colors in separate planes; please re-save it as 'interleaved'.");
  if (![1, 5, 8, 32946, 32773].includes(info.compression)) throw new Error(`This TIFF compression (${info.compression}) isn't supported yet. Please upload a JPG preview.`);
  return info;
}

function lzw(src: Uint8Array, outLen: number): Uint8Array {
  const out = new Uint8Array(outLen);
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Int32Array(4096), first = new Uint8Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; suffix[i] = i; len[i] = 1; first[i] = i; }
  let next = 258, width = 9, old = -1, op = 0, bitBuf = 0, bitCnt = 0, ip = 0;
  const write = (c: number) => { const L = len[c]; let p = op + L - 1; if (p >= outLen) { let cc = c; while (cc >= 0 && p >= outLen) { cc = prefix[cc]; p--; } c = cc; } let q = Math.min(op + L, outLen) - 1; let cc = c; while (cc >= 0 && q >= op) { out[q--] = suffix[cc]; cc = prefix[cc]; } op = Math.min(op + L, outLen); };
  while (op < outLen) {
    while (bitCnt < width) { if (ip >= src.length) return out; bitBuf = ((bitBuf << 8) | src[ip++]) >>> 0; bitCnt += 8; }
    const code = (bitBuf >>> (bitCnt - width)) & ((1 << width) - 1); bitCnt -= width;
    if (code === 257) break;
    if (code === 256) { next = 258; width = 9; old = -1; continue; }
    if (old === -1) { write(code); old = code; continue; }
    let f: number;
    if (code < next) { write(code); f = first[code]; }
    else { f = first[old]; prefix[next] = old; suffix[next] = f; len[next] = len[old] + 1; first[next] = first[old]; write(next); next++; if (next + 1 >= 1 << width && width < 12) width++; old = code; continue; }
    if (next < 4096) { prefix[next] = old; suffix[next] = f; len[next] = len[old] + 1; first[next] = first[old]; next++; }
    if (next + 1 >= 1 << width && width < 12) width++;
    old = code;
  }
  return out;
}
function packbits(src: Uint8Array, outLen: number) { const out = new Uint8Array(outLen); let i = 0, o = 0; while (o < outLen && i < src.length) { const n = (src[i++] << 24) >> 24; if (n >= 0) { for (let k = 0; k <= n; k++) out[o++] = src[i++]; } else if (n !== -128) { const v = src[i++]; for (let k = 0; k < 1 - n; k++) out[o++] = v; } } return out; }
async function inflate(src: Uint8Array) { const ds = new DecompressionStream("deflate"); const s = new Blob([src]).stream().pipeThrough(ds); return new Uint8Array(await new Response(s).arrayBuffer()); }

/** Decodes one strip into 8-bit samples (rows × width × spp). */
export async function decodeStrip(info: TiffInfo, raw: Uint8Array, strip: number) {
  const rows = Math.min(info.rps, info.height - strip * info.rps);
  const bpp = info.spp * (info.bps / 8); const rowBytes = info.width * bpp; const outLen = rows * rowBytes;
  let d: Uint8Array = info.compression === 1 ? raw : info.compression === 5 ? lzw(raw, outLen) : info.compression === 32773 ? packbits(raw, outLen) : await inflate(raw);
  if (info.predictor === 2) {
    if (info.bps === 8) for (let r = 0; r < rows; r++) { const o = r * rowBytes; for (let x = info.spp; x < rowBytes; x++) d[o + x] = (d[o + x] + d[o + x - info.spp]) & 255; }
    else if (info.bps === 16) { const v = new DataView(d.buffer, d.byteOffset, d.byteLength); const sp = info.spp; for (let r = 0; r < rows; r++) { const o = r * rowBytes; for (let x = sp; x < info.width * sp; x++) v.setUint16(o + x * 2, (v.getUint16(o + x * 2, info.le) + v.getUint16(o + (x - sp) * 2, info.le)) & 65535, info.le); } }
  }
  if (info.bps === 16) { const o8 = new Uint8Array(rows * info.width * info.spp); for (let i = 0; i < o8.length; i++) o8[i] = d[i * 2 + (info.le ? 1 : 0)]; d = o8; }
  return { rows, data: d, rowLen: info.width * info.spp };
}
function toRgb(info: TiffInfo, s: Uint8Array, i: number, out: Uint8ClampedArray, o: number) {
  const p = info.photometric;
  if (p === 5 && info.spp >= 4) {
    // simple ink model (process inks on coated paper) – much closer to a real print than 255-C
    const c = s[i] / 255, m = s[i + 1] / 255, y = s[i + 2] / 255, k = s[i + 3] / 255;
    const kk = 1 - k * 0.88;
    out[o] = 255 * (1 - c * 1.0) * (1 - m * 0.11) * (1 - y * 0.0) * kk * 0.97;
    out[o + 1] = 255 * (1 - c * 0.38) * (1 - m * 1.0) * (1 - y * 0.07) * kk * 0.97;
    out[o + 2] = 255 * (1 - c * 0.12) * (1 - m * 0.52) * (1 - y * 1.0) * kk * 0.97;
  }
  else if (p === 1 || p === 0) { const v = p === 0 ? 255 - s[i] : s[i]; out[o] = out[o + 1] = out[o + 2] = v; }
  else { out[o] = s[i]; out[o + 1] = s[i + 1]; out[o + 2] = s[i + 2]; }
  out[o + 3] = 255;
}

/** Low-res picture from a TIFF of any size (reads only the rows it needs). */
export type ReadMany = (ranges: [number, number][]) => Promise<Uint8Array[]>;
export async function tiffPreview(read: Reader, maxSide = 2000, onProgress?: (f: number) => void, readMany?: ReadMany): Promise<{ blob: Blob; width: number; height: number }> {
  const info = await readTiff(read);
  const step = Math.max(1, Math.ceil(Math.max(info.width, info.height) / maxSide));
  const ow = Math.floor(info.width / step), oh = Math.floor(info.height / step);
  const img = new ImageData(ow, oh);
  let done = 0;
  const rowOf = (j: number) => Math.min(info.height - 1, j * step + Math.floor(step / 2));
  const tmp = new Uint8ClampedArray(4);
  const processRow = async (j: number, raw: Uint8Array) => {
    const y = rowOf(j); const strip = Math.floor(y / info.rps);
    const { data, rowLen } = await decodeStrip(info, raw, strip);
    const r0 = (y - strip * info.rps) * rowLen;
    for (let x = 0; x < ow; x++) {
      let R = 0, G = 0, B = 0; const n = Math.min(step, 4);
      for (let q = 0; q < n; q++) { const sx = x * step + Math.floor((q * step) / n); toRgb(info, data, r0 + sx * info.spp, tmp, 0); R += tmp[0]; G += tmp[1]; B += tmp[2]; }
      const o = (j * ow + x) * 4; img.data[o] = R / n; img.data[o + 1] = G / n; img.data[o + 2] = B / n; img.data[o + 3] = 255;
    }
    done++; if (onProgress && done % 20 === 0) onProgress(done / oh);
  };
  if (readMany) {
    const groups: number[][] = []; for (let j = 0; j < oh; j += 40) groups.push(Array.from({ length: Math.min(40, oh - j) }, (_, q) => j + q));
    let g = 0;
    const work = async () => { while (g < groups.length) { const grp = groups[g++]; const got = await readMany(grp.map((j) => { const st = Math.floor(rowOf(j) / info.rps); return [info.offsets[st], info.counts[st]] as [number, number]; })); for (let i = 0; i < grp.length; i++) await processRow(grp[i], got[i]); } };
    await Promise.all(Array.from({ length: 4 }, work));
  } else {
    let k = 0;
    const work = async () => { while (k < oh) { const j = k++; const st = Math.floor(rowOf(j) / info.rps); await processRow(j, await read(info.offsets[st], info.counts[st])); } };
    await Promise.all(Array.from({ length: 16 }, work));
  }
  const c = document.createElement("canvas"); c.width = ow; c.height = oh; c.getContext("2d")!.putImageData(img, 0, 0);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the preview."))), "image/jpeg", 0.86));
  return { blob, width: info.width, height: info.height };
}

/** Full-resolution crop written as an uncompressed TIFF (keeps color mode, DPI and ICC profile), streamed out in parts. */
export async function tiffCrop(read: Reader, box: { x: number; y: number; w: number; h: number }, sink: (chunk: Uint8Array, last: boolean) => Promise<void>, onProgress?: (f: number) => void) {
  const info = await readTiff(read);
  const x0 = Math.max(0, Math.round(box.x)), y0 = Math.max(0, Math.round(box.y));
  const w = Math.min(info.width - x0, Math.round(box.w)), h = Math.min(info.height - y0, Math.round(box.h));
  const spp = info.spp; const dataLen = w * h * spp;
  if (dataLen + 100000 > 4294967295) throw new Error("This crop is over 4 GB; make it smaller.");
  const le = true; const CH = 32 * 1024 * 1024;
  let buf = new Uint8Array(CH); let bo = 0;
  const push = async (bytes: Uint8Array) => { let i = 0; while (i < bytes.length) { const n = Math.min(CH - bo, bytes.length - i); buf.set(bytes.subarray(i, i + n), bo); bo += n; i += n; if (bo === CH) { await sink(buf, false); buf = new Uint8Array(CH); bo = 0; } } };
  // header
  const ifdOff = 8 + dataLen + (dataLen % 2);
  const hd = new DataView(new ArrayBuffer(8)); hd.setUint8(0, 0x49); hd.setUint8(1, 0x49); hd.setUint16(2, 42, le); hd.setUint32(4, ifdOff, le);
  await push(new Uint8Array(hd.buffer));
  // rows, fetched in ~8 MB batches of consecutive strips
  const s0 = Math.floor(y0 / info.rps), s1 = Math.floor((y0 + h - 1) / info.rps);
  let s = s0; let rowsDone = 0;
  while (s <= s1) {
    let e = s; let bytes = info.counts[s];
    while (e + 1 <= s1 && info.offsets[e + 1] === info.offsets[e] + info.counts[e] && bytes + info.counts[e + 1] < 8 * 1024 * 1024) { e++; bytes += info.counts[e]; }
    const raw = await read(info.offsets[s], bytes);
    for (let st = s; st <= e; st++) {
      const off = info.offsets[st] - info.offsets[s];
      const { rows, data, rowLen } = await decodeStrip(info, raw.subarray(off, off + info.counts[st]), st);
      for (let r = 0; r < rows; r++) { const y = st * info.rps + r; if (y < y0 || y >= y0 + h) continue; await push(data.subarray(r * rowLen + x0 * spp, r * rowLen + (x0 + w) * spp)); rowsDone++; }
    }
    if (onProgress) onProgress(rowsDone / h);
    s = e + 1;
  }
  if (dataLen % 2) await push(new Uint8Array(1));
  // IFD
  const extra: Uint8Array[] = []; let extraOff = ifdOff + 2 + 14 * 12 + 4 + (info.icc ? 12 : 0) + (info.inkSet ? 12 : 0);
  const entries: [number, number, number, number][] = [];
  const addExtra = (b: Uint8Array) => { const o = extraOff; extra.push(b); extraOff += b.length + (b.length % 2); if (b.length % 2) extra.push(new Uint8Array(1)); return o; };
  const bpsB = new Uint8Array(spp * 2); const bv = new DataView(bpsB.buffer); for (let i = 0; i < spp; i++) bv.setUint16(i * 2, 8, le);
  const rat = (r?: [number, number]) => { const b = new Uint8Array(8); const v = new DataView(b.buffer); v.setUint32(0, r?.[0] ?? 300, le); v.setUint32(4, r?.[1] ?? 1, le); return b; };
  entries.push([256, 4, 1, w], [257, 4, 1, h]);
  entries.push([258, 3, spp, spp <= 2 ? 8 | (spp === 2 ? 8 << 16 : 0) : addExtra(bpsB)]);
  entries.push([259, 3, 1, 1], [262, 3, 1, info.photometric], [273, 4, 1, 8], [277, 3, 1, spp], [278, 4, 1, h], [279, 4, 1, dataLen]);
  entries.push([282, 5, 1, addExtra(rat(info.xres))], [283, 5, 1, addExtra(rat(info.yres))], [284, 3, 1, 1], [296, 3, 1, info.resUnit]);
  if (info.inkSet) entries.push([332, 3, 1, info.inkSet]);
  if (info.icc) entries.push([34675, 7, info.icc.length, addExtra(info.icc)]);
  entries.sort((a, b) => a[0] - b[0]);
  const ifd = new DataView(new ArrayBuffer(2 + entries.length * 12 + 4)); ifd.setUint16(0, entries.length, le);
  entries.forEach(([tag, type, count, val], i) => { const o = 2 + i * 12; ifd.setUint16(o, tag, le); ifd.setUint16(o + 2, type, le); ifd.setUint32(o + 4, count, le); if (type === 3 && count === 1) ifd.setUint16(o + 8, val, le); else ifd.setUint32(o + 8, val, le); });
  // offsets above assumed 14 base entries; recompute precisely
  const realExtraStart = ifdOff + ifd.byteLength;
  const assumed = ifdOff + 2 + 14 * 12 + 4 + (info.icc ? 12 : 0) + (info.inkSet ? 12 : 0);
  if (realExtraStart !== assumed) {
    const delta = realExtraStart - assumed;
    entries.forEach(([tag, type, count, val], i) => { const o = 2 + i * 12; const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 } as any)[type] * count; if (size > 4) ifd.setUint32(o + 8, val + delta, le); });
  }
  await push(new Uint8Array(ifd.buffer));
  for (const b of extra) await push(b);
  await sink(buf.subarray(0, bo), true);
  return { width: w, height: h, bytes: ifdOff + ifd.byteLength + extra.reduce((n, b) => n + b.length, 0) };
}
