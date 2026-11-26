// Artisan Murals: read-only list of a Google Drive folder shared as "Anyone with the link".
// Nothing is stored; no Google account or key is used.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...h } });
const dec = (x) => x.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// The small picture Photoshop saves inside every TIFF (about 160 px, a few KB): shown the moment a folder opens,
// so designers see their designs right away. Read with a few small byte ranges; never the whole file. Kept a week.
const dl = (id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
async function part(id, start, len) {
  for (let a = 0; a < 2; a++) {
    try { const r = await fetch(dl(id), { headers: { range: `bytes=${start}-${start + len - 1}` } }); if (r.status === 206 || r.status === 200) { const b = new Uint8Array(await r.arrayBuffer()); return b.length > len ? b.subarray(0, len) : b; } } catch (e) {}
  }
  return new Uint8Array(0);
}
function findThumb(block) {
  // Photoshop image resources: "8BIM", id, name (Pascal, even length), size, data (even length)
  let p = 0; const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  while (p + 12 <= block.length) {
    if (block[p] !== 56 || block[p + 1] !== 66 || block[p + 2] !== 73 || block[p + 3] !== 77) break;
    const rid = dv.getUint16(p + 4); let q = p + 6; const nl = block[q]; q += 1 + nl; if ((1 + nl) % 2) q++;
    const size = dv.getUint32(q); const data = block.subarray(q + 4, q + 4 + size);
    if ((rid === 1036 || rid === 1033) && data.length > 28 && data[28] === 0xff && data[29] === 0xd8) return data.subarray(28);
    p = q + 4 + size + (size % 2);
  }
  return null;
}
function xmpThumb(text) {
  const m = text.match(/<xmpGImg:image>([^<]+)<\/xmpGImg:image>/) || text.match(/xmpGImg:image="([^"]+)"/);
  if (!m) return null;
  try { const bin = atob(m[1].replace(/&#xA;|\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u[0] === 0xff && u[1] === 0xd8 ? u : null; } catch (e) { return null; }
}
async function thumb(id) {
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) return json({ error: 'Bad file' }, 400);
  const key = new Request(`https://cache.artisan/thumb/v1/${id}`);
  const hit = await caches.default.match(key); if (hit) return new Response(hit.body, { headers: { 'content-type': hit.headers.get('content-type') || 'image/jpeg', 'cache-control': 'public, max-age=86400', ...CORS } });
  const h = await part(id, 0, 16); if (h.length < 8) return json({ error: 'not readable' }, 404);
  const le = h[0] === 0x49; const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  const magic = dv.getUint16(2, le), big = magic === 43; if (magic !== 42 && !big) return json({ error: 'not a TIFF' }, 415);
  const ifdOff = big ? Number(dv.getBigUint64(8, le)) : dv.getUint32(4, le);
  const ifd = await part(id, ifdOff, 8192); const iv = new DataView(ifd.buffer, ifd.byteOffset, ifd.byteLength);
  const n = big ? Number(iv.getBigUint64(0, le)) : iv.getUint16(0, le), es = big ? 20 : 12, base = big ? 8 : 2;
  const tags = {};
  for (let i = 0; i < n && base + (i + 1) * es <= ifd.length; i++) {
    const o = base + i * es, tag = iv.getUint16(o, le), cnt = big ? Number(iv.getBigUint64(o + 4, le)) : iv.getUint32(o + 4, le), val = big ? Number(iv.getBigUint64(o + 12, le)) : iv.getUint32(o + 8, le);
    tags[tag] = { cnt, val };
  }
  let jpg = null;
  if (tags[34377] && tags[34377].cnt > 12) jpg = findThumb(await part(id, tags[34377].val, Math.min(tags[34377].cnt, 6 * 1024 * 1024)));
  if (!jpg && tags[700] && tags[700].cnt > 20) jpg = xmpThumb(new TextDecoder().decode(await part(id, tags[700].val, Math.min(tags[700].cnt, 2 * 1024 * 1024))));
  if (!jpg) return json({ error: 'no built-in picture' }, 404, { 'cache-control': 'public, max-age=3600' });
  const res = new Response(jpg, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' } });
  await caches.default.put(key, res.clone());
  return new Response(jpg, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', ...CORS } });
}
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method === 'GET' && new URL(req.url).pathname === '/thumb') return thumb(new URL(req.url).searchParams.get('id') || '');
    if (req.method === 'POST' && new URL(req.url).pathname === '/ranges') {
      // small byte ranges of one shared Drive file, so the page can draw a preview of a big TIFF without downloading it
      const b = await req.json().catch(() => ({})); const id = String(b.id || '');
      if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) return json({ error: 'Bad file' }, 400);
      const rs = (Array.isArray(b.ranges) ? b.ranges : []).slice(0, 24).map((x) => [Math.max(0, Number(x[0]) || 0), Math.min(8 * 1024 * 1024, Math.max(1, Number(x[1]) || 1))]);
      const key = new Request(`https://cache.artisan/ranges/${id}/${encodeURIComponent(JSON.stringify(rs))}`); const hit = await caches.default.match(key); if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/octet-stream', ...CORS } });
      const url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
      const parts = await Promise.all(rs.map(async ([o, l]) => { for (let a = 0; a < 2; a++) { try { const r = await fetch(url, { headers: { range: `bytes=${o}-${o + l - 1}` } }); if (r.status === 206 || r.status === 200) { const u = new Uint8Array(await r.arrayBuffer()); return r.status === 200 ? u.subarray(o, o + l) : u.subarray(0, l); } } catch (e) {} } return new Uint8Array(0); }));
      const total = parts.reduce((n, x) => n + x.length + 4, 0); const buf = new Uint8Array(total); const dv = new DataView(buf.buffer); let o = 0;
      for (const x of parts) { dv.setUint32(o, x.length); o += 4; buf.set(x, o); o += x.length; }
      if (parts.every((x) => x.length)) await caches.default.put(key, new Response(buf.slice(), { headers: { 'cache-control': 'public, max-age=604800' } }));
      return new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=600', ...CORS } });
    }
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) return json({ error: "That isn't a Google Drive folder link." }, 400);
    const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: { 'accept-language': 'en-US,en' } });
    const notShared = { error: "Google Drive didn't share this folder. In Drive, set sharing to 'Anyone with the link', then try again." };
    if (!r.ok) return json(notShared, 404);
    const html = (await r.text()).slice(0, 3000000);
    const name = dec((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const files = []; const re = /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g; let x;
    while ((x = re.exec(html)) && files.length < 500) {
      const seg = x[0], folder = /\/drive\/folders\//.test(seg) || /vnd\.google-apps\.folder/.test(seg);
      const th = (seg.match(/<img[^>]+src="(https:\/\/lh\d\.googleusercontent\.com\/[^"]+)"/) || [])[1] || '';
      files.push({ id: x[1], name: dec(x[2]), folder, type: folder ? 'folder' : ((seg.match(/\/type\/([a-z0-9.+-]+\/[a-z0-9.+-]+)/i) || [])[1] || ''), thumb: th.replace(/&amp;/g, '&') });
    }
    if (!files.length && !name) return json(notShared, 404);
    files.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.folder ? -1 : 1));
    return json({ id, name, files }, 200, { 'cache-control': 'public, max-age=60' });
  },
};
