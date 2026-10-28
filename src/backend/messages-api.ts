// Unified messages inbox: designer <-> customer request chats (project_messages) and store <-> anyone chats (store_threads).
// Conversation keys: "p.<projectId>.<designerUid>" and "s.<threadId>". Read marks live in chat_reads (owner side = user_id 'store').
import type { Who } from "./policies";
import { signUrl } from "./storage";
import { getSettings } from "./app-api";
import { notify, testEmail } from "./projects-api";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const nowIso = () => new Date().toISOString();
const parseJ = (v: any, d: any = null) => { if (v == null) return d; try { return JSON.parse(v); } catch { return d; } };
const IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
const signed = async (env: Env, key: string | null) => { if (!key) return null; const i = key.indexOf("/"); return env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, key.slice(0, i), key.slice(i + 1), 3600)); };
const files = (env: Env, raw: any) => Promise.all(parseJ(raw, []).map(async (a: any) => ({ name: a.name, url: await signed(env, a.key), image: IMG.test(a.name || a.key || "") })));
const all = async (env: Env, sql: string, ...b: any[]) => ((await env.DB.prepare(sql).bind(...b).all()).results ?? []) as any[];
const one = (env: Env, sql: string, ...b: any[]) => env.DB.prepare(sql).bind(...b).first() as Promise<any>;
const short = (id: string | null) => (id ? id.slice(0, 8).toUpperCase() : "");

async function storeName(env: Env) { const s = await getSettings(env); return String(s.general?.siteName || "Artisan Mural"); }
async function emailOf(env: Env, uid: string | null) { if (!uid) return null; const u = await one(env, `SELECT email FROM auth_users WHERE id = ?`, uid); return u?.email ?? null; }
async function designerName(env: Env, uid: string) { const p = await one(env, `SELECT full_name, studio_name FROM designer_profiles WHERE user_id = ?`, uid); return p ? (p.studio_name || p.full_name || "Designer") : null; }
async function personName(env: Env, uid: string | null, email: string | null) {
  if (uid) { const d = await designerName(env, uid); if (d) return d; const o = await one(env, `SELECT customer_name FROM order_requests WHERE user_id = ? AND customer_name IS NOT NULL AND customer_name <> '' ORDER BY created_at DESC LIMIT 1`, uid); if (o?.customer_name) return o.customer_name; const p = await one(env, `SELECT customer_name FROM projects WHERE customer_id = ? AND customer_name IS NOT NULL ORDER BY created_at DESC LIMIT 1`, uid); if (p?.customer_name) return p.customer_name; }
  if (email) { const o = await one(env, `SELECT customer_name FROM order_requests WHERE lower(customer_email) = lower(?) AND customer_name <> '' ORDER BY created_at DESC LIMIT 1`, email); if (o?.customer_name) return o.customer_name; return email.split("@")[0]; }
  return "Customer";
}
async function admins(env: Env) { return (await all(env, `SELECT user_id FROM user_roles WHERE role = 'admin'`)).map((r) => r.user_id as string); }
async function readsOf(env: Env, uid: string) { const m: Record<string, string> = {}; for (const r of await all(env, `SELECT conv, read_at FROM chat_reads WHERE user_id = ?`, uid)) m[r.conv] = r.read_at; return m; }
async function markRead(env: Env, reader: string, conv: string) { await env.DB.prepare(`INSERT INTO chat_reads (user_id, conv, read_at) VALUES (?, ?, ?) ON CONFLICT(user_id, conv) DO UPDATE SET read_at = excluded.read_at`).bind(reader, conv, nowIso()).run(); }
const isDesigner = async (env: Env, uid: string) => !!(await one(env, `SELECT 1 AS x FROM designer_profiles WHERE user_id = ?`, uid));
async function designTitle(env: Env, slug: string | null) {
  if (!slug) return null;
  if (slug.startsWith("u-")) { const u = await one(env, `SELECT title FROM artwork_uploads WHERE id = ?`, slug.slice(2)); return u?.title ?? null; }
  const o = await one(env, `SELECT title FROM design_overrides WHERE slug = ?`, slug); return o?.title ?? slug.replace(/-/g, " ");
}
const preview = (body: string, atts: any, mine: boolean) => { const b = (body || "").replace(/\s+/g, " ").trim(); const n = parseJ(atts, []).length; return (mine ? "You: " : "") + (b || (n ? (n > 1 ? `${n} attachments` : "Attachment") : "")); };

/** All conversations visible to this viewer, newest first. */
async function list(env: Env, who: Who) {
  const uid = who.uid as string; const out: any[] = [];
  const store = await storeName(env);
  const reads = await readsOf(env, who.admin ? "store" : uid);
  // project chats
  let prs: any[];
  if (who.admin) prs = await all(env, `SELECT * FROM projects ORDER BY updated_at DESC LIMIT 300`);
  else {
    const em = (who.email || (await emailOf(env, uid)) || "").toLowerCase();
    if (em) await env.DB.prepare(`UPDATE projects SET customer_id = ? WHERE customer_id = 'guest' AND lower(customer_email) = ?`).bind(uid, em).run();
    prs = await all(env, `SELECT * FROM projects WHERE customer_id = ? OR designer_user_id = ? OR id IN (SELECT project_id FROM project_messages WHERE designer_user_id = ?) ORDER BY updated_at DESC`, uid, uid, uid);
  }
  if (prs.length) {
    const ids = prs.map((p) => p.id);
    const msgs = await all(env, `SELECT project_id, designer_user_id, sender_id, body, attachments, created_at FROM project_messages WHERE project_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at`, ...ids);
    const dn: Record<string, string> = {};
    for (const p of prs) {
      const asDesigner = !who.admin && p.customer_id !== uid;
      const dids = asDesigner ? [uid] : [...new Set([...(p.designer_user_id ? [p.designer_user_id] : []), ...msgs.filter((m) => m.project_id === p.id).map((m) => m.designer_user_id)])];
      for (const did of dids) {
        const ms = msgs.filter((m) => m.project_id === p.id && m.designer_user_id === did);
        if (who.admin && !ms.length) continue;
        const last = ms[ms.length - 1];
        dn[did] ??= (await designerName(env, did)) ?? "Designer";
        const key = `p.${p.id}.${did}`;
        const name = who.admin ? `${dn[did]} and ${p.customer_name || "customer"}` : asDesigner ? (p.customer_name || "Customer") : dn[did];
        const at = last?.created_at ?? p.updated_at ?? p.created_at;
        out.push({ key, kind: "project", name, initials: asDesigner || who.admin ? (p.customer_name || "C") : dn[did], sub: `${p.kind === "edit" ? "Change request" : p.kind === "message" ? "Message" : "Custom design"} · ${p.title}`, preview: last ? preview(last.body, last.attachments, !who.admin && last.sender_id === uid) : "No messages yet", at, unread: !who.admin && !!last && last.sender_id !== uid && (!reads[key] || reads[key] < last.created_at) });
      }
    }
  }
  // store chats
  const sts = who.admin ? await all(env, `SELECT * FROM store_threads ORDER BY last_at DESC LIMIT 300`)
    : await all(env, `SELECT * FROM store_threads WHERE user_id = ? OR (user_email IS NOT NULL AND lower(user_email) = lower(?)) ORDER BY last_at DESC`, uid, who.email || (await emailOf(env, uid)) || "-");
  for (const t of sts) {
    const key = `s.${t.id}`; const fromOther = who.admin ? t.last_from === "user" : t.last_from === "store";
    out.push({ key, kind: "store", store: !who.admin, name: who.admin ? (t.user_name || t.user_email || "Customer") : store, initials: who.admin ? (t.user_name || t.user_email || "C") : store, role: who.admin ? t.user_role : undefined,
      sub: t.subject || (t.order_id ? `Order #${short(t.order_id)}` : who.admin ? (t.user_role === "designer" ? "Designer" : "Customer") : "Message from the store"),
      preview: t.last_body != null ? (fromOther ? "" : "You: ") + t.last_body : "No messages yet", at: t.last_at ?? t.created_at, unread: fromOther && !!t.last_at && (!reads[key] || reads[key] < t.last_at) });
  }
  out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return out;
}

/** One conversation for this viewer (marks it read). */
async function thread(env: Env, who: Who, key: string) {
  const uid = who.uid as string; const store = await storeName(env);
  if (key.startsWith("p.")) {
    const [, pid, did] = key.split(".");
    const p = await one(env, `SELECT * FROM projects WHERE id = ?`, pid); if (!p) return null;
    const role = p.customer_id === uid ? "customer" : did === uid ? "designer" : who.admin ? "admin" : null;
    if (!role) return null;
    const dname = (await designerName(env, did)) ?? "Designer"; const cname = p.customer_name || "Customer";
    const ms = await all(env, `SELECT * FROM project_messages WHERE project_id = ? AND designer_user_id = ? ORDER BY created_at`, pid, did);
    if (role !== "admin") await markRead(env, uid, key);
    if (role !== "admin") await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND kind = 'message' AND (instr(link, ?) > 0 OR instr(link, ?) > 0)`).bind(nowIso(), uid, `c=${key}`, pid).run();
    const dt = await designTitle(env, p.design_slug);
    const link = p.kind === "message" ? (p.design_slug ? { label: "See the design", href: `/design/${p.design_slug}` } : null) : role === "designer" ? { label: "Open the request", href: `/dashboard?view=requests&project=${pid}` } : role === "admin" ? { label: "Open the request", href: `/admin#jobs:${pid}` } : { label: "Open the request", href: `/projects/${pid}` };
    return { key, kind: "project", guarded: true, canWrite: role !== "admin" && p.status !== "cancelled" && p.status !== "closed", readOnly: role === "admin",
      name: role === "admin" ? `${dname} and ${cname}` : role === "designer" ? cname : dname, initials: role === "customer" ? dname : cname,
      sub: `${p.kind === "edit" ? "Change request" : p.kind === "message" ? "Message" : "Custom design"} · ${p.title}${dt && !String(p.title).includes(dt) ? ` · ${dt}` : ""}`, link, order: p.order_id ? { id: p.order_id, label: `Order #${short(p.order_id)}` } : null,
      messages: await Promise.all(ms.map(async (m) => ({ id: m.id, mine: role === "admin" ? m.sender_role === "designer" : m.sender_id === uid, who: m.sender_role === "designer" ? dname : cname, role: m.sender_role, body: m.body, at: m.created_at, files: await files(env, m.attachments) }))) };
  }
  if (key.startsWith("s.")) {
    const t = await one(env, `SELECT * FROM store_threads WHERE id = ?`, key.slice(2)); if (!t) return null;
    const myEmail = (who.email || (await emailOf(env, uid)) || "").toLowerCase();
    const isUser = t.user_id === uid || (!!t.user_email && t.user_email.toLowerCase() === myEmail);
    if (!isUser && !who.admin) return null;
    const asStore = who.admin && !isUser;
    if (!t.user_id && isUser) await env.DB.prepare(`UPDATE store_threads SET user_id = ? WHERE id = ?`).bind(uid, t.id).run();
    await markRead(env, asStore ? "store" : uid, key);
    if (!asStore) await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND kind = 'message' AND instr(link, ?) > 0`).bind(nowIso(), uid, `c=${key}`).run();
    else await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND kind = 'message' AND instr(link, ?) > 0 AND user_id IN (SELECT user_id FROM user_roles WHERE role = 'admin')`).bind(nowIso(), `#messages:${key}`).run();
    const ms = await all(env, `SELECT * FROM store_messages WHERE thread_id = ? ORDER BY created_at`, t.id);
    const uname = t.user_name || t.user_email || "Customer";
    let link: any = null;
    if (t.order_id) link = asStore ? { label: "Open order", href: `/admin#orders:${t.order_id}` } : { label: "My orders", href: `/account?view=orders` };
    return { key, kind: "store", guarded: false, canWrite: true, store: !asStore, name: asStore ? uname : store, initials: asStore ? uname : store,
      sub: t.subject || (t.order_id ? `Order #${short(t.order_id)}` : asStore ? `${t.user_role === "designer" ? "Designer" : "Customer"}${t.user_email ? " · " + t.user_email : ""}` : "Message from the store"),
      email: asStore ? t.user_email : undefined, noAccount: asStore && !t.user_id, link,
      messages: await Promise.all(ms.map(async (m) => ({ id: m.id, mine: asStore ? m.sender_role === "store" : m.sender_role === "user", who: m.sender_role === "store" ? store : uname, role: m.sender_role, body: m.body, at: m.created_at, files: await files(env, m.attachments) }))) };
  }
  return null;
}

async function storeSend(env: Env, who: Who, t: any, text: string, atts: any[], asStore: boolean) {
  const store = await storeName(env); const at = nowIso();
  await env.DB.prepare(`INSERT INTO store_messages (id, thread_id, sender_id, sender_role, body, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), t.id, who.uid, asStore ? "store" : "user", text.slice(0, 4000), JSON.stringify(atts), at).run();
  const lastBody = (text || (atts.length ? "Attachment" : "")).replace(/\s+/g, " ").slice(0, 160);
  await env.DB.prepare(`UPDATE store_threads SET last_at = ?, last_body = ?, last_from = ? WHERE id = ?`).bind(at, lastBody, asStore ? "store" : "user", t.id).run();
  await markRead(env, asStore ? "store" : (who.uid as string), `s.${t.id}`);
  const key = `s.${t.id}`;
  if (asStore) {
    const userRead = t.user_id ? (await one(env, `SELECT read_at FROM chat_reads WHERE user_id = ? AND conv = ?`, t.user_id, key))?.read_at : null;
    const alreadyWaiting = t.last_from === "store" && t.last_at && (!userRead || userRead < t.last_at); // one email per unread batch
    const base = t.user_role === "designer" ? "/dashboard?view=messages" : "/account?view=messages";
    if (t.user_id) await notify(env, t.user_id, "message", `You have a new message from ${store}`, lastBody, `${base}&c=${key}`);
    if (!alreadyWaiting && t.user_email) await testEmail(env, t.user_email, `You have a new message from ${store}`, `Hello ${t.user_name || ""},\n\nYou have a new message from ${store}${t.order_id ? ` about your order #${short(t.order_id)}` : ""}:\n\n"${lastBody}"\n\nReply on the website: ${env.PUBLIC_ORIGIN}${base}&c=${key}\n\n${store}`, "store_message");
  } else {
    for (const a of await admins(env)) await notify(env, a, "message", `New message from ${t.user_name || t.user_email || "a customer"}`, lastBody, `/admin#messages:${key}`);
  }
}

async function findOrCreate(env: Env, who: Who, o: { userId: string | null; email: string | null; name?: string | null; orderId?: string | null; subject?: string | null }) {
  const ex = o.orderId ? await one(env, `SELECT * FROM store_threads WHERE order_id = ? ORDER BY created_at LIMIT 1`, o.orderId)
    : o.userId ? await one(env, `SELECT * FROM store_threads WHERE user_id = ? AND order_id IS NULL ORDER BY created_at LIMIT 1`, o.userId)
    : await one(env, `SELECT * FROM store_threads WHERE lower(user_email) = lower(?) AND order_id IS NULL AND user_id IS NULL ORDER BY created_at LIMIT 1`, o.email);
  if (ex) { if (o.subject && !ex.subject) { await env.DB.prepare(`UPDATE store_threads SET subject = ? WHERE id = ?`).bind(o.subject, ex.id).run(); ex.subject = o.subject; } return ex; }
  const id = crypto.randomUUID();
  const role = o.userId && (await isDesigner(env, o.userId)) ? "designer" : "customer";
  const name = o.name || (await personName(env, o.userId, o.email));
  await env.DB.prepare(`INSERT INTO store_threads (id, user_id, user_email, user_name, user_role, order_id, subject, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, o.userId, o.email, name, role, o.orderId ?? null, o.subject ?? null, who.uid, nowIso()).run();
  return await one(env, `SELECT * FROM store_threads WHERE id = ?`, id);
}

const attsOf = (body: any, uid: string) => (Array.isArray(body.attachments) ? body.attachments : []).filter((a: any) => typeof a?.key === "string" && a.key.startsWith(`project-files/${uid}/`)).slice(0, 6).map((a: any) => ({ key: a.key, name: String(a.name ?? "file").slice(0, 100) }));

export async function inboxRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  if (!who.uid) return bad("Please sign in.", 401);
  const uid = who.uid;
  if (p === "" && m === "GET") return j({ conversations: await list(env, who), admin: who.admin, store: await storeName(env) });
  if (p === "unread" && m === "GET") { const l = await list(env, who); return j({ count: l.filter((c) => c.unread).length }); }
  if (p === "thread" && m === "GET") { const t = await thread(env, who, url.searchParams.get("key") || ""); return t ? j(t) : bad("This conversation was not found.", 404); }
  if (p === "send" && m === "POST") {
    const key = String(body.key || ""); const text = String(body.body ?? "").trim(); const atts = attsOf(body, uid);
    if (!text && !atts.length) return bad("Write a message first.");
    if (key.startsWith("p.")) {
      const [, pid, did] = key.split(".");
      const { projectRoutes } = await import("./projects-api");
      return await projectRoutes(req, env, who, `${pid}/messages`, "POST", { body: text, attachments: atts, designer: did }, url);
    }
    if (key.startsWith("s.")) {
      const t = await one(env, `SELECT * FROM store_threads WHERE id = ?`, key.slice(2)); if (!t) return bad("This conversation was not found.", 404);
      const myEmail = (who.email || (await emailOf(env, uid)) || "").toLowerCase();
      const isUser = t.user_id === uid || (!!t.user_email && t.user_email.toLowerCase() === myEmail);
      if (!isUser && !who.admin) return bad("Not your conversation.", 403);
      await storeSend(env, who, t, text, atts, who.admin && !isUser);
      return j({ ok: true });
    }
    return bad("Unknown conversation.");
  }
  // ---- owner only below ----
  if (!who.admin) return bad("Only the owner can do this.", 403);
  if (p === "people" && m === "GET") {
    const q = `%${(url.searchParams.get("q") || "").trim().toLowerCase()}%`;
    const out: Record<string, any> = {};
    for (const d of await all(env, `SELECT d.user_id, d.full_name, d.studio_name, u.email FROM designer_profiles d LEFT JOIN auth_users u ON u.id = d.user_id WHERE lower(coalesce(d.full_name,'')) LIKE ? OR lower(coalesce(d.studio_name,'')) LIKE ? OR lower(coalesce(u.email,'')) LIKE ? LIMIT 20`, q, q, q))
      out[d.user_id] = { userId: d.user_id, email: d.email, name: d.studio_name || d.full_name || d.email, role: "designer" };
    for (const o of await all(env, `SELECT user_id, customer_email, customer_name, count(*) AS n FROM order_requests WHERE lower(coalesce(customer_name,'')) LIKE ? OR lower(coalesce(customer_email,'')) LIKE ? GROUP BY coalesce(user_id, lower(customer_email)) LIMIT 30`, q, q)) {
      const k = o.user_id || `e:${String(o.customer_email).toLowerCase()}`; if (out[k]) continue;
      let userId = o.user_id; if (!userId && o.customer_email) userId = (await one(env, `SELECT id FROM auth_users WHERE lower(email) = lower(?)`, o.customer_email))?.id ?? null;
      out[userId || k] ??= { userId, email: o.customer_email, name: o.customer_name || o.customer_email, role: "customer", orders: o.n };
    }
    for (const u of await all(env, `SELECT id, email FROM auth_users WHERE lower(email) LIKE ? AND id NOT IN (SELECT user_id FROM user_roles WHERE role = 'admin') ORDER BY created_at DESC LIMIT 20`, q))
      if (!out[u.id]) out[u.id] = { userId: u.id, email: u.email, name: await personName(env, u.id, u.email), role: (await isDesigner(env, u.id)) ? "designer" : "customer" };
    return j({ people: Object.values(out).slice(0, 15) });
  }
  if (p === "start" && m === "POST") {
    let userId: string | null = body.userId || null; let email: string | null = body.email || null; let name: string | null = null; let orderId: string | null = null; let subject: string | null = String(body.subject || "").trim().slice(0, 120) || null;
    if (body.orderId) {
      const o = await one(env, `SELECT id, user_id, customer_email, customer_name FROM order_requests WHERE id = ?`, String(body.orderId)); if (!o) return bad("Order not found.", 404);
      orderId = o.id; userId = o.user_id; email = o.customer_email; name = o.customer_name;
      if (!userId && email) userId = (await one(env, `SELECT id FROM auth_users WHERE lower(email) = lower(?)`, email))?.id ?? null;
      subject ??= `Order #${short(o.id)}`;
    }
    if (userId && !email) email = await emailOf(env, userId);
    if (!userId && !email) return bad("Pick who to write to.");
    if (userId === uid) return bad("Pick a customer or designer, not yourself.");
    const t = await findOrCreate(env, who, { userId, email, name, orderId, subject });
    const text = String(body.body ?? "").trim(); const atts = attsOf(body, uid);
    if (text || atts.length) await storeSend(env, who, t, text, atts, true);
    return j({ ok: true, key: `s.${t.id}` });
  }
  if (p === "delete" && m === "POST") { // owner removes a store chat (used for test chats)
    const key = String(body.key || ""); if (!key.startsWith("s.")) return bad("Only store chats can be removed.");
    await env.DB.prepare(`DELETE FROM store_messages WHERE thread_id = ?`).bind(key.slice(2)).run();
    await env.DB.prepare(`DELETE FROM store_threads WHERE id = ?`).bind(key.slice(2)).run();
    await env.DB.prepare(`DELETE FROM chat_reads WHERE conv = ?`).bind(key).run();
    await env.DB.prepare(`DELETE FROM notifications WHERE kind = 'message' AND instr(link, ?) > 0`).bind(key).run();
    return j({ ok: true });
  }
  return bad("Not found", 404);
}
