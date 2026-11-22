// Fast local seed: write rows and pictures straight into the local test copy (same storage wrangler pages dev uses).
import { Miniflare } from 'miniflare';
import fs from 'fs'; import path from 'path';
const [state, seedDir] = process.argv.slice(2);
const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("") } }', d1Databases: { DB: '00000000-0000-0000-0000-000000000000' }, r2Buckets: { FILES: 'artisan-local' }, d1Persist: path.join(state, 'v3/d1'), r2Persist: path.join(state, 'v3/r2') });
const db = await mf.getD1Database('DB'); const r2 = await mf.getR2Bucket('FILES');
const sql = fs.readFileSync(path.join(seedDir, 'seed.sql'), 'utf8').split('\n').filter(Boolean);
for (const s of sql) await db.prepare(s).run();
const re = /'([0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z0-9-]+\.webp)'/g; const keys = new Set(); let m;
for (const s of sql) while ((m = re.exec(s))) keys.add(m[1]);
for (const k of keys) { const f = path.join(seedDir, 'images', k.split('/').pop()); const b = fs.readFileSync(f); await r2.put('designer-artwork/' + k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { httpMetadata: { contentType: 'image/webp' } }); }
console.log('rows', sql.length, 'pictures', keys.size);
const c = await db.prepare("SELECT count(*) n FROM artwork_uploads WHERE review_status='approved'").first(); console.log('designs in db', c.n);
await mf.dispose();
