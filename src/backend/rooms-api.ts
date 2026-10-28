// Customer "My rooms": room photos a signed-in shopper uploaded to try wallpaper on, with the wall corners they set.
import type { Who } from "./policies";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const ID = /^[0-9a-f-]{8,40}$/i;
let ready = false;
async function ensure(env: Env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_rooms (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, image_key TEXT NOT NULL, w INTEGER, h INTEGER, data TEXT, created_at TEXT, updated_at TEXT)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS customer_rooms_user ON customer_rooms (user_id, created_at)`).run();
  ready = true;
}

export async function roomRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  if (!who.uid) return bad("Please sign in.", 401);
  await ensure(env);
  const uid = who.uid, DB = env.DB;
  if (p === "" && m === "GET") {
    const r = (await DB.prepare(`SELECT id, name, w, h, data, created_at, updated_at FROM customer_rooms WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`).bind(uid).all()).results ?? [];
    return j({ rooms: r.map((x: any) => ({ id: x.id, name: x.name, w: x.w, h: x.h, createdAt: Date.parse(x.created_at) || 0, ...(JSON.parse(x.data || "{}")) })) });
  }
  if (p === "put" && m === "POST") {
    const id = url.searchParams.get("id") ?? "";
    if (!ID.test(id)) return bad("bad room", 400);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 4_000_000) return bad("That photo is too big.", 413);
    const n: any = await DB.prepare(`SELECT COUNT(*) c FROM customer_rooms WHERE user_id = ?`).bind(uid).first();
    const own: any = await DB.prepare(`SELECT user_id FROM customer_rooms WHERE id = ?`).bind(id).first();
    if (own && own.user_id !== uid) return bad("bad room", 403);
    if (!own && (n?.c ?? 0) >= 40) return bad("You can keep up to 40 room photos. Delete one first.", 409);
    const key = `rooms/${uid}/${id}.jpg`;
    await env.FILES.put(key, buf, { httpMetadata: { contentType: "image/jpeg" } });
    const now = new Date().toISOString();
    const created = Number(url.searchParams.get("t")) || Date.now();
    await DB.prepare(`INSERT INTO customer_rooms (id, user_id, name, image_key, w, h, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?) ON CONFLICT(id) DO UPDATE SET image_key = excluded.image_key, updated_at = excluded.updated_at`)
      .bind(id, uid, (url.searchParams.get("name") ?? "Room photo").slice(0, 80), key, Number(url.searchParams.get("w")) || null, Number(url.searchParams.get("h")) || null, new Date(created).toISOString(), now).run();
    return j({ ok: true });
  }
  if (p === "meta" && m === "POST") {
    if (!ID.test(body.id ?? "")) return bad("bad room", 400);
    const data = JSON.stringify({ walls: Array.isArray(body.walls) ? body.walls.slice(0, 4) : [], keep: body.keep !== false, strokes: Array.isArray(body.strokes) ? body.strokes.slice(0, 60) : [] });
    if (data.length > 150_000) return bad("too big", 413);
    const r = await DB.prepare(`UPDATE customer_rooms SET data = ?, name = COALESCE(?, name), updated_at = ? WHERE id = ? AND user_id = ?`).bind(data, typeof body.name === "string" ? body.name.slice(0, 80) : null, new Date().toISOString(), body.id, uid).run();
    return j({ ok: true, changed: r.meta?.changes ?? 0 });
  }
  if (p.startsWith("img/") && m === "GET") {
    const id = p.slice(4);
    if (!ID.test(id)) return bad("bad room", 400);
    const row: any = await DB.prepare(`SELECT image_key FROM customer_rooms WHERE id = ? AND user_id = ?`).bind(id, uid).first();
    if (!row) return bad("not found", 404);
    const obj = await env.FILES.get(row.image_key);
    if (!obj) return bad("not found", 404);
    return new Response(obj.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
  }
  if (p === "delete" && m === "POST") {
    if (!ID.test(body.id ?? "")) return bad("bad room", 400);
    const row: any = await DB.prepare(`SELECT image_key FROM customer_rooms WHERE id = ? AND user_id = ?`).bind(body.id, uid).first();
    if (row) { await env.FILES.delete(row.image_key).catch(() => {}); await DB.prepare(`DELETE FROM customer_rooms WHERE id = ? AND user_id = ?`).bind(body.id, uid).run(); }
    return j({ ok: true });
  }
  return bad("not found", 404);
}
