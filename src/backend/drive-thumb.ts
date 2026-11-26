// The small picture Photoshop (or other apps) saves inside a TIFF, read from a Google Drive file shared as
// "Anyone with the link". A few small byte ranges, never the whole file; kept a week in the edge cache.
// Lets the designer studio show every design in a Drive folder the moment it opens.
const dl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

async function part(id: string, start: number, len: number): Promise<Uint8Array> {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(dl(id), { headers: { range: `bytes=${start}-${start + len - 1}` } });
      if (r.status === 206 || r.status === 200) { const b = new Uint8Array(await r.arrayBuffer()); return b.length > len ? b.subarray(0, len) : b; }
      try { await r.body?.cancel(); } catch {}
    } catch {}
  }
  return new Uint8Array(0);
}

/** Photoshop image resources ("8BIM" blocks): resource 1036 (or the older 1033) holds a JPEG thumbnail after a 28-byte header. */
export function photoshopThumb(block: Uint8Array): Uint8Array | null {
  let p = 0; const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  while (p + 12 <= block.length) {
    if (block[p] !== 56 || block[p + 1] !== 66 || block[p + 2] !== 73 || block[p + 3] !== 77) break;
    const rid = dv.getUint16(p + 4); let q = p + 6; const nl = block[q]!; q += 1 + nl; if ((1 + nl) % 2) q++;
    const size = dv.getUint32(q); const data = block.subarray(q + 4, q + 4 + size);
    if ((rid === 1036 || rid === 1033) && data.length > 30 && data[28] === 0xff && data[29] === 0xd8) return data.subarray(28);
    p = q + 4 + size + (size % 2);
  }
  return null;
}
/** XMP can carry a base64 JPEG thumbnail too (Illustrator, some exporters). */
export function xmpThumb(text: string): Uint8Array | null {
  const m = text.match(/<xmpGImg:image>([^<]+)<\/xmpGImg:image>/) || text.match(/xmpGImg:image="([^"]+)"/);
  if (!m) return null;
  try { const bin = atob(m[1]!.replace(/&#xA;|\s/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u[0] === 0xff && u[1] === 0xd8 ? u : null; } catch { return null; }
}

export async function driveThumb(id: string): Promise<Response> {
  const json = (b: any, s: number) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) return json({ error: "Bad file" }, 400);
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(`https://cache.artisan/drive-thumb/v1/${id}`);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return new Response(hit.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
  const h = await part(id, 0, 16); if (h.length < 8) return json({ error: "not readable" }, 404);
  const le = h[0] === 0x49; const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  const magic = dv.getUint16(2, le), big = magic === 43; if (magic !== 42 && !big) return json({ error: "not a TIFF" }, 415);
  const ifdOff = big ? Number(dv.getBigUint64(8, le)) : dv.getUint32(4, le);
  const ifd = await part(id, ifdOff, 8192); const iv = new DataView(ifd.buffer, ifd.byteOffset, ifd.byteLength);
  if (ifd.length < 8) return json({ error: "not readable" }, 404);
  const n = big ? Number(iv.getBigUint64(0, le)) : iv.getUint16(0, le), es = big ? 20 : 12, base = big ? 8 : 2;
  const tags: Record<number, { cnt: number; val: number }> = {};
  for (let i = 0; i < n && base + (i + 1) * es <= ifd.length; i++) {
    const o = base + i * es, tag = iv.getUint16(o, le);
    tags[tag] = { cnt: big ? Number(iv.getBigUint64(o + 4, le)) : iv.getUint32(o + 4, le), val: big ? Number(iv.getBigUint64(o + 12, le)) : iv.getUint32(o + 8, le) };
  }
  let jpg: Uint8Array | null = null;
  if (tags[34377] && tags[34377].cnt > 12) jpg = photoshopThumb(await part(id, tags[34377].val, Math.min(tags[34377].cnt, 6 * 1024 * 1024)));
  if (!jpg && tags[700] && tags[700].cnt > 20) jpg = xmpThumb(new TextDecoder().decode(await part(id, tags[700].val, Math.min(tags[700].cnt, 2 * 1024 * 1024))));
  if (!jpg) return json({ error: "no built-in picture" }, 404);
  if (cache) await cache.put(key, new Response(jpg.slice(), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800" } }));
  return new Response(jpg.slice() as unknown as BodyInit, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
}
