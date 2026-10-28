// Design requests ("projects"): a customer asks a designer to change a design (edit) or make a new one (custom).
// Designer answers with a price + days, customer approves, enters the wall size and pays printing + design fee together,
// the order waits on the designer, the designer delivers the final file, the owner prints. Payments + emails are test mode.
import type { Who } from "./policies";
import { signUrl } from "./storage";
import { getSettings } from "./app-api";
import { quote as priceQuote } from "./account-api";
import { findContactDetails, CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import { defaultMaterials, PRICE_PER_SQFT } from "@/lib/catalog";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const nowIso = () => new Date().toISOString();
const parseJ = (v: any, d: any = null) => { if (v == null) return d; try { return JSON.parse(v); } catch { return d; } };
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");

export const PROJECT_LABEL: Record<string, string> = { requested: "Waiting for a price", quoted: "Price sent", approved: "Approved, waiting for size and payment", in_progress: "Paid, designer working", delivered: "Delivered, ready to print", cancelled: "Cancelled", closed: "Closed", message: "Message" };

async function designerOf(env: Env, uid: string) {
  const prof: any = await env.DB.prepare(`SELECT user_id, full_name, studio_name, status FROM designer_profiles WHERE user_id = ?`).bind(uid).first();
  if (!prof) return null;
  const acc: any = await env.DB.prepare(`SELECT slug FROM designer_accounts WHERE user_id = ?`).bind(uid).first();
  return { uid, slug: acc?.slug ?? `studio-${uid.slice(0, 8)}`, name: prof.studio_name || prof.full_name || "Designer", approved: prof.status === "approved" };
}
async function designerBySlug(env: Env, slug: string) {
  const acc: any = await env.DB.prepare(`SELECT user_id FROM designer_accounts WHERE slug = ?`).bind(slug).first();
  let uid = acc?.user_id as string | undefined;
  if (!uid && /^studio-[0-9a-f]{8}$/.test(slug)) { const p: any = await env.DB.prepare(`SELECT user_id FROM designer_profiles WHERE substr(user_id,1,8) = ? AND status = 'approved'`).bind(slug.slice(7)).first(); uid = p?.user_id; }
  return uid ? designerOf(env, uid) : null;
}
async function designTitle(env: Env, slug: string | null) {
  if (!slug) return null;
  if (slug.startsWith("u-")) { const u: any = await env.DB.prepare(`SELECT title FROM artwork_uploads WHERE id = ?`).bind(slug.slice(2)).first(); return u?.title ?? null; }
  const o: any = await env.DB.prepare(`SELECT title FROM design_overrides WHERE slug = ?`).bind(slug).first();
  return o?.title ?? slug.replace(/-/g, " ");
}
async function designThumb(env: Env, slug: string | null) {
  if (!slug) return null;
  const t: any = await env.DB.prepare(`SELECT data FROM design_thumbs WHERE slug = ?`).bind(slug).first();
  const d = parseJ(t?.data, null); if (!d?.imgs) return null;
  const ids = Object.keys(d.imgs); const id = ids.find((x) => x !== "gen:room" && !/mockup/i.test(x)) ?? ids[0];
  const k = id ? d.imgs[id] : null;
  if (k?.k) return `/backend/img/${slug}/${k.k}-${(k.w ?? [320]).includes(320) ? 320 : k.w[0]}?v=${d.v}`;
  return null;
}
const signed = async (env: Env, key: string | null, ttl = 3600, download?: string) => { if (!key) return null; const i = key.indexOf("/"); return env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, key.slice(0, i), key.slice(i + 1), ttl)) + (download != null ? "&download=" + encodeURIComponent(download) : ""); };
export async function notify(env: Env, uid: string, kind: string, title: string, body: string, link: string) {
  await env.DB.prepare(`INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), uid, kind, title, body, link).run();
}
export async function testEmail(env: Env, to: string | null, subject: string, text: string, kind: string) {
  if (!to) return;
  await env.DB.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), to, subject, `<p>${esc(text)}</p>`, text, kind).run();
}
async function emailOf(env: Env, uid: string) { const u: any = await env.DB.prepare(`SELECT email FROM auth_users WHERE id = ?`).bind(uid).first(); return u?.email ?? null; }
async function admins(env: Env) { return ((await env.DB.prepare(`SELECT user_id FROM user_roles WHERE role = 'admin'`).all()).results ?? []).map((r: any) => r.user_id as string); }
async function addEvent(env: Env, orderId: string, kind: string, message: string, actor: string | null) {
  await env.DB.prepare(`INSERT INTO order_events (id, order_id, kind, message, actor) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), orderId, kind, message, actor).run();
}
function guard(text: string) { const what = findContactDetails(text || ""); return what ? `${CONTACT_BLOCKED_MESSAGE} (We found ${what}.)` : null; }
async function logBlocked(env: Env, who: Who, projectId: string | null, text: string, reason: string) {
  await env.DB.prepare(`INSERT INTO blocked_messages (id, user_id, project_id, reason, body) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), who.uid, projectId, reason, String(text).slice(0, 2000)).run();
}
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** Printing price for a wall: the design's price per sq ft (or the default) adjusted by the finish. */
async function printPrice(env: Env, designSlug: string | null, finishId: string, sqft: number) {
  const s = await getSettings(env);
  let rate = Number(s.general?.pricePerSqft) > 0 ? Number(s.general.pricePerSqft) : PRICE_PER_SQFT;
  if (designSlug) { const o: any = await env.DB.prepare(`SELECT price_per_sqft FROM design_overrides WHERE slug = ?`).bind(designSlug).first(); if (o?.price_per_sqft > 0) rate = Number(o.price_per_sqft); }
  const rows = ((await env.DB.prepare(`SELECT * FROM material_settings`).all()).results ?? []) as any[];
  const mats = new Map<string, any>(defaultMaterials.map((m: any) => [m.id, { ...m, active: true }]));
  for (const r of rows) { const b = mats.get(r.id) ?? {}; mats.set(r.id, { ...b, id: r.id, name: r.name ?? b.name, factor: Number(r.factor) || b.factor || 1, priceAdj: r.price_adj == null ? b.priceAdj : Number(r.price_adj), active: !!r.active, standard: !!r.standard }); }
  const list = [...mats.values()].filter((m) => m.active).sort((a, b) => Number(!!b.standard) - Number(!!a.standard));
  const f = list.find((m) => m.id === finishId) ?? list[0];
  const unit = Math.max(0, Math.round((rate * (f?.factor ?? 1) + (f?.priceAdj ?? 0)) * 100) / 100);
  return { finishes: list.map((m) => ({ id: m.id, name: m.name, adj: m.priceAdj ?? 0, standard: !!m.standard })), finish: f?.id, finishName: f?.name, rate, unit, printing: r2(unit * sqft) };
}
function sqftOf(w: number, h: number, unit: string) { const k = unit === "in" ? 1 / 12 : unit === "cm" ? 1 / 30.48 : 1; return r2(w * k * h * k); }

async function quotesOf(env: Env, pid: string) { return ((await env.DB.prepare(`SELECT * FROM project_quotes WHERE project_id = ? ORDER BY created_at`).bind(pid).all()).results ?? []) as any[]; }

/** Full view of one project for one viewer (customer / designer / owner). */
async function view(env: Env, who: Who, pr: any, role: "customer" | "designer" | "admin") {
  const s = await getSettings(env);
  const commission = Number(pr.commission_pct ?? s.general?.commissionRate ?? 10);
  let quotes = await quotesOf(env, pr.id);
  if (role === "designer") quotes = quotes.filter((q) => q.designer_user_id === who.uid);
  const dIds = [...new Set([...(pr.designer_user_id ? [pr.designer_user_id] : []), ...quotes.map((q) => q.designer_user_id)])];
  if (role === "customer" || role === "admin") { const ms = ((await env.DB.prepare(`SELECT DISTINCT designer_user_id FROM project_messages WHERE project_id = ?`).bind(pr.id).all()).results ?? []) as any[]; ms.forEach((x) => { if (!dIds.includes(x.designer_user_id)) dIds.push(x.designer_user_id); }); }
  const threads = [];
  for (const did of role === "designer" ? [who.uid as string] : dIds) {
    const d = await designerOf(env, did);
    const msgs = ((await env.DB.prepare(`SELECT * FROM project_messages WHERE project_id = ? AND designer_user_id = ? ORDER BY created_at`).bind(pr.id, did).all()).results ?? []) as any[];
    threads.push({ designer: d ? { uid: d.uid, slug: d.slug, name: d.name } : { uid: did, slug: "", name: "Designer" }, messages: await Promise.all(msgs.map(async (x) => ({ id: x.id, role: x.sender_role, mine: x.sender_id === who.uid, body: x.body, at: x.created_at, files: await Promise.all(parseJ(x.attachments, []).map(async (a: any) => ({ name: a.name, url: await signed(env, a.key) }))) }))) });
  }
  const names: Record<string, string> = {}; for (const t of threads) names[t.designer.uid] = t.designer.name;
  for (const q of quotes) if (!names[q.designer_user_id]) { const d = await designerOf(env, q.designer_user_id); names[q.designer_user_id] = d?.name ?? "Designer"; }
  const order: any = pr.order_id ? await env.DB.prepare(`SELECT id, status, square_feet, finish, estimated_total, design_fee, amount_due, due_at, selection, shipping_address, created_at FROM order_requests WHERE id = ?`).bind(pr.order_id).first() : null;
  const fee = Number(pr.fee ?? 0);
  let finishName = order?.finish ?? null;
  if (order?.finish) { const ms: any = await env.DB.prepare(`SELECT name FROM material_settings WHERE id = ?`).bind(order.finish).first(); finishName = ms?.name ?? (defaultMaterials as any[]).find((x) => x.id === order.finish)?.name ?? order.finish; }
  return {
    id: pr.id, kind: pr.kind, title: pr.title, brief: pr.brief, room: pr.room, wallSize: pr.wall_size, budget: pr.budget, deadline: pr.deadline ?? null, hidden: !!Number(pr.hidden ?? 0), status: pr.status, statusLabel: PROJECT_LABEL[pr.status] ?? pr.status,
    designSlug: pr.design_slug, designTitle: await designTitle(env, pr.design_slug), designThumb: await designThumb(env, pr.design_slug),
    designerSlug: pr.designer_slug, open: pr.designer_slug === "open", customer: role === "customer" ? null : { name: pr.customer_name, ...(role === "admin" ? { email: pr.customer_email } : {}) },
    attachments: await Promise.all(parseJ(pr.attachments, []).map(async (a: any) => ({ name: a.name, url: await signed(env, a.key) }))),
    quotes: quotes.map((q) => ({ id: q.id, designer: names[q.designer_user_id] ?? "Designer", designerUid: q.designer_user_id, fee: q.fee, days: q.days, note: q.note, status: q.status, at: q.created_at })),
    threads, fee: pr.fee, days: pr.days, quoteId: pr.quote_id, approvedAt: pr.approved_at, paidAt: pr.paid_at, dueAt: pr.due_at, deliveredAt: pr.delivered_at, createdAt: pr.created_at,
    designerEarns: role !== "customer" && pr.fee != null ? r2(fee * (1 - commission / 100)) : undefined, commissionPct: role !== "customer" ? commission : undefined,
    order: order ? { id: order.id, status: order.status, sqft: order.square_feet, finish: finishName, total: order.estimated_total, designFee: order.design_fee, due: order.amount_due, dueAt: order.due_at, selection: parseJ(order.selection, {}), ...(role !== "designer" ? { address: order.shipping_address } : {}) } : null,
    final: role !== "customer" && (pr.final_key || pr.final_link) ? { name: pr.final_name, size: pr.final_size, url: pr.final_key ? await signed(env, pr.final_key, 3600, pr.final_name ?? "") : null, link: pr.final_link, note: pr.final_note } : (pr.delivered_at ? { delivered: true, note: pr.final_note } : null),
    myRole: role,
  };
}
function summary(pr: any, extra: any = {}) {
  return { id: pr.id, kind: pr.kind, title: pr.title, status: pr.status, statusLabel: PROJECT_LABEL[pr.status] ?? pr.status, designSlug: pr.design_slug, designerSlug: pr.designer_slug, deadline: pr.deadline ?? null, hidden: !!Number(pr.hidden ?? 0), open: pr.designer_slug === "open", fee: pr.fee, days: pr.days, dueAt: pr.due_at, paidAt: pr.paid_at, deliveredAt: pr.delivered_at, createdAt: pr.created_at, updatedAt: pr.updated_at, customer: pr.customer_name, orderId: pr.order_id, ...extra };
}
async function roleFor(env: Env, who: Who, pr: any): Promise<"customer" | "designer" | "admin" | null> {
  if (pr.customer_id === who.uid) return "customer";
  if (pr.designer_user_id === who.uid) return "designer";
  if (pr.designer_slug === "open" && who.uid) { const d = await designerOf(env, who.uid); if (d?.approved && !pr.designer_user_id) return "designer"; }
  if (who.admin) return "admin";
  return null;
}
const touch = (env: Env, id: string, set: string, ...vals: any[]) => env.DB.prepare(`UPDATE projects SET ${set}, updated_at = ? WHERE id = ?`).bind(...vals, nowIso(), id).run();

export async function projectRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  if (!who.uid) return bad("Please sign in.", 401);
  const DB = env.DB; const uid = who.uid;
  const origin = env.PUBLIC_ORIGIN || url.origin;

  if (p === "check" && m === "POST") { const g = guard(body.text ?? ""); return j({ ok: !g, message: g }); }

  if (p === "attach" && m === "POST") {
    const name = (url.searchParams.get("name") || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 25 * 1024 * 1024) return bad("Attachments up to 25 MB. Bigger files: share them after the price is agreed.", 413);
    const key = `project-files/${uid}/att/${crypto.randomUUID().slice(0, 8)}-${name}`;
    const mime = req.headers.get("content-type") || "application/octet-stream";
    await env.FILES.put(key, buf, { httpMetadata: { contentType: mime } });
    return j({ key, name, size: buf.byteLength, url: await signed(env, key) });
  }

  // ---------- create a request ----------
  if (p === "create" && m === "POST") {
    const kind = body.kind === "edit" ? "edit" : "custom";
    const brief = String(body.brief ?? "").trim();
    if (brief.length < 10) return bad("Tell the designer a little more (at least a sentence).");
    const g = guard(brief + " " + (body.title ?? "") + " " + (body.room ?? "") + " " + (body.wallSize ?? "")); if (g) { await logBlocked(env, who, null, brief, g); return bad(g, 422); }
    const atts = (Array.isArray(body.attachments) ? body.attachments : []).filter((a: any) => typeof a?.key === "string" && a.key.startsWith(`project-files/${uid}/att/`)).slice(0, 8).map((a: any) => ({ key: a.key, name: String(a.name ?? "file").slice(0, 100) }));
    let designer: any = null; let designSlug: string | null = null; let title = String(body.title ?? "").trim().slice(0, 120);
    if (kind === "edit") {
      designSlug = String(body.designSlug ?? "");
      if (designSlug.startsWith("u-")) { const u: any = await DB.prepare(`SELECT owner_id, title FROM artwork_uploads WHERE id = ?`).bind(designSlug.slice(2)).first(); if (u) { designer = await designerOf(env, u.owner_id); title = title || `Changes to ${u.title}`; } }
      if (!designer) return bad("This design's designer isn't taking change requests on the site yet. Send a custom request instead.");
    } else {
      const ds = String(body.designerSlug ?? "open");
      if (ds === "open") { const cs = (await getSettings(env)).community ?? {}; if (cs.requestsEnabled === false) return bad("Open requests are paused right now. Choose a designer instead."); }
      if (body.basedOn && /^[a-z0-9-]{1,80}$/i.test(String(body.basedOn))) designSlug = String(body.basedOn);
      if (ds !== "open") { designer = await designerBySlug(env, ds); if (!designer?.approved) return bad("That designer can't take requests right now. Choose “Any designer”."); }
      title = title || "Custom design";
    }
    if (designer?.uid === uid) return bad("That's your own design.");
    const me: any = await DB.prepare(`SELECT email FROM auth_users WHERE id = ?`).bind(uid).first();
    const name = String(body.name ?? "").trim().slice(0, 80) || (me?.email ?? "").split("@")[0];
    const id = crypto.randomUUID();
    await DB.prepare(`INSERT INTO projects (id, kind, customer_id, customer_name, customer_email, designer_slug, designer_user_id, design_slug, title, brief, room, wall_size, budget, attachments, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)`)
      .bind(id, kind, uid, name, me?.email ?? null, designer?.slug ?? "open", designer?.uid ?? null, designSlug, title, brief.slice(0, 3000), body.room ? String(body.room).slice(0, 80) : null, body.wallSize ? String(body.wallSize).slice(0, 80) : null, body.budget ? String(body.budget).slice(0, 60) : null, JSON.stringify(atts), /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline ?? "")) ? String(body.deadline) : null).run();
    const link = `/dashboard?view=requests&project=${id}`;
    const targets = designer ? [designer.uid] : ((await DB.prepare(`SELECT user_id FROM designer_profiles WHERE status = 'approved'`).all()).results ?? []).map((r: any) => r.user_id).filter((x: string) => x !== uid);
    for (const t of targets) {
      await notify(env, t, "request", kind === "edit" ? `New change request: ${title}` : designer ? `New custom request: ${title}` : `New open custom request: ${title}`, brief.slice(0, 140), link);
      await testEmail(env, await emailOf(env, t), kind === "edit" ? `New change request on Artisan Mural: ${title}` : `New custom design request: ${title}`, `Hello,\n\n${name} sent ${designer ? "you" : "all designers"} a ${kind === "edit" ? "change request" : "custom design request"}:\n\n"${brief.slice(0, 500)}"\n\nOpen it and send your price and how many days you need:\n${origin}${link}\n\nArtisan Mural`, "project_request");
    }
    return j({ id });
  }

  // ---------- lists ----------
  if (p === "mine" && m === "GET") {
    const rows = ((await DB.prepare(`SELECT * FROM projects WHERE customer_id = ? AND kind <> 'message' ORDER BY updated_at DESC LIMIT 100`).bind(uid).all()).results ?? []) as any[];
    const out = [];
    for (const r of rows) { const qs = (await quotesOf(env, r.id)).filter((q) => q.status === "sent"); out.push(summary(r, { designTitle: await designTitle(env, r.design_slug), designThumb: await designThumb(env, r.design_slug), newQuotes: qs.length, bestQuote: qs.length ? Math.min(...qs.map((q) => q.fee)) : null })); }
    return j({ projects: out });
  }
  if (p === "designer" && m === "GET") {
    const d = await designerOf(env, uid);
    if (!d) return j({ projects: [], open: [] });
    const s = await getSettings(env); const commission = Number(s.general?.commissionRate ?? 10);
    const mine = ((await DB.prepare(`SELECT * FROM projects WHERE kind <> 'message' AND (designer_user_id = ? OR id IN (SELECT project_id FROM project_quotes WHERE designer_user_id = ?)) ORDER BY updated_at DESC LIMIT 200`).bind(uid, uid).all()).results ?? []) as any[];
    const open = d.approved ? ((await DB.prepare(`SELECT * FROM projects WHERE designer_slug = 'open' AND designer_user_id IS NULL AND status IN ('requested','quoted') AND COALESCE(hidden,0) = 0 AND customer_id <> ? AND id NOT IN (SELECT project_id FROM project_quotes WHERE designer_user_id = ?) ORDER BY created_at DESC LIMIT 50`).bind(uid, uid).all()).results ?? []) as any[] : [];
    const out = [];
    for (const r of mine) {
      const q: any = await DB.prepare(`SELECT fee, days, status FROM project_quotes WHERE project_id = ? AND designer_user_id = ? ORDER BY created_at DESC`).bind(r.id, uid).first();
      const lost = r.designer_user_id && r.designer_user_id !== uid;
      out.push(summary(r, { designTitle: await designTitle(env, r.design_slug), designThumb: await designThumb(env, r.design_slug), myQuote: q ? { fee: q.fee, days: q.days, status: q.status } : null, lost: !!lost, earns: r.fee != null && !lost ? r2(Number(r.fee) * (1 - Number(r.commission_pct ?? commission) / 100)) : null, status: lost ? "cancelled" : r.status, statusLabel: lost ? "Customer chose another designer" : PROJECT_LABEL[r.status] }));
    }
    return j({ projects: out, open: await Promise.all(open.map(async (r) => summary(r, { designTitle: await designTitle(env, r.design_slug), brief: r.brief.slice(0, 200) }))), commission });
  }
  if (p === "admin" && m === "GET") {
    if (!who.admin) return bad("Only the owner can open this.", 403);
    const st = url.searchParams.get("status") || "all";
    const rows = ((await DB.prepare(`SELECT * FROM projects WHERE kind <> 'message' ${st !== "all" ? "AND status = ?" : ""} ORDER BY updated_at DESC LIMIT 300`).bind(...(st !== "all" ? [st] : [])).all()).results ?? []) as any[];
    const s = await getSettings(env); const commission = Number(s.general?.commissionRate ?? 10);
    const out = [];
    for (const r of rows) { const d = r.designer_user_id ? await designerOf(env, r.designer_user_id) : null; const nq = (await quotesOf(env, r.id)).length; out.push(summary(r, { designer: d?.name ?? (r.designer_slug === "open" ? "Any designer" : r.designer_slug), quotes: nq, designTitle: await designTitle(env, r.design_slug), commission: r.fee != null ? r2(Number(r.fee) * Number(r.commission_pct ?? commission) / 100) : null })); }
    const counts: Record<string, number> = {}; for (const r of ((await DB.prepare(`SELECT status, COUNT(*) n FROM projects WHERE kind <> 'message' GROUP BY status`).all()).results ?? []) as any[]) counts[r.status] = r.n;
    return j({ projects: out, counts, labels: PROJECT_LABEL, commission });
  }

  // ---------- one project ----------
  const mm = p.match(/^([0-9a-f-]{36})(?:\/([a-z]+))?$/);
  if (!mm) return bad("not found", 404);
  const pr: any = await DB.prepare(`SELECT * FROM projects WHERE id = ?`).bind(mm[1]).first();
  if (!pr) return bad("Request not found", 404);
  const role = await roleFor(env, who, pr);
  if (!role) return bad("This request isn't yours.", 403);
  const act = mm[2] ?? "";
  if (!act && m === "GET") return j(await view(env, who, pr, role));

  if (act === "messages" && m === "POST") {
    const text = String(body.body ?? "").trim();
    const atts = (Array.isArray(body.attachments) ? body.attachments : []).filter((a: any) => typeof a?.key === "string" && a.key.startsWith(`project-files/${uid}/`)).slice(0, 6).map((a: any) => ({ key: a.key, name: String(a.name ?? "file").slice(0, 100) }));
    if (!text && !atts.length) return bad("Write a message first.");
    const g = guard(text); if (g) { await logBlocked(env, who, pr.id, text, g); return bad(g, 422); }
    if (role === "admin") return bad("The owner can read the chat but not write in it.");
    const did = role === "designer" ? uid : String(body.designer || pr.designer_user_id || "");
    if (!did) return bad("Choose which designer to write to.");
    await DB.prepare(`INSERT INTO project_messages (id, project_id, designer_user_id, sender_id, sender_role, body, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), pr.id, did, uid, role, text.slice(0, 3000), JSON.stringify(atts)).run();
    await touch(env, pr.id, "title = title");
    if (role === "designer" && pr.customer_id === "guest") await testEmail(env, pr.customer_email, `New reply about "${pr.title}"`, `Hello ${pr.customer_name},\n\nYou have a reply:\n\n"${text.slice(0, 600)}"\n\nSign in or create an account with this email at ${origin}/account?view=messages to answer.`, "designer_reply");
    else if (role === "designer") await notify(env, pr.customer_id, "message", `New message about ${pr.title}`, text.slice(0, 140), `/account?view=messages&c=p.${pr.id}.${did}`);
    else await notify(env, did, "message", `New message from ${pr.customer_name}`, text.slice(0, 140), `/dashboard?view=messages&c=p.${pr.id}.${did}`);
    return j({ ok: true });
  }

  if (act === "quote" && m === "POST") {
    if (role !== "designer") return bad("Only the designer can send a price.", 403);
    if (!["requested", "quoted"].includes(pr.status)) return bad("This request already has an approved price.");
    const fee = r2(Number(body.fee)); const days = Math.round(Number(body.days));
    if (!(fee >= 1) || fee > 100000) return bad("Enter your price for the work (in dollars).");
    if (!(days >= 1) || days > 365) return bad("Enter how many days you need (1 to 365).");
    const note = String(body.note ?? "").trim().slice(0, 1500);
    const g = guard(note); if (g) { await logBlocked(env, who, pr.id, note, g); return bad(g, 422); }
    const d = await designerOf(env, uid); if (!d?.approved) return bad("Your designer account needs approval first.");
    await DB.prepare(`UPDATE project_quotes SET status = 'replaced', updated_at = ? WHERE project_id = ? AND designer_user_id = ? AND status = 'sent'`).bind(nowIso(), pr.id, uid).run();
    const qid = crypto.randomUUID();
    await DB.prepare(`INSERT INTO project_quotes (id, project_id, designer_user_id, designer_slug, fee, days, note) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(qid, pr.id, uid, d.slug, fee, days, note || null).run();
    await touch(env, pr.id, "status = 'quoted'");
    const link = `/projects/${pr.id}`;
    await notify(env, pr.customer_id, "quote", `${d.name} came back with a price`, `$${fee.toFixed(2)} for the design work, ready in ${days} day${days === 1 ? "" : "s"}. Review and approve it.`, link);
    await testEmail(env, pr.customer_email, `${d.name} came back with a price for "${pr.title}"`, `Hello ${pr.customer_name},\n\n${d.name} sent a price for your request "${pr.title}":\n\nDesign work: $${fee.toFixed(2)}\nReady in: ${days} day${days === 1 ? "" : "s"} after payment${note ? `\nNote: ${note}` : ""}\n\nApprove it, enter your wall size and pay for the printing and the design together:\n${origin}${link}\n\nArtisan Mural`, "project_quote");
    return j({ ok: true, id: qid });
  }

  if ((act === "approve" || act === "decline") && m === "POST") {
    if (role !== "customer") return bad("Only the customer can do this.", 403);
    const q: any = await DB.prepare(`SELECT * FROM project_quotes WHERE id = ? AND project_id = ?`).bind(body.quote, pr.id).first();
    if (!q || q.status !== "sent") return bad("That price isn't open anymore.");
    if (act === "decline") {
      await DB.prepare(`UPDATE project_quotes SET status = 'declined', updated_at = ? WHERE id = ?`).bind(nowIso(), q.id).run();
      const left: any = await DB.prepare(`SELECT COUNT(*) n FROM project_quotes WHERE project_id = ? AND status = 'sent'`).bind(pr.id).first();
      if (!left?.n) await touch(env, pr.id, "status = 'requested'");
      await notify(env, q.designer_user_id, "quote_declined", `Price not accepted: ${pr.title}`, "The customer declined your price. You can send a new one or ask in the chat.", `/dashboard?view=requests&project=${pr.id}`);
      return j({ ok: true });
    }
    if (!["requested", "quoted"].includes(pr.status)) return bad("A price is already approved.");
    const s = await getSettings(env);
    const d = await designerOf(env, q.designer_user_id);
    await DB.prepare(`UPDATE project_quotes SET status = CASE WHEN id = ? THEN 'accepted' ELSE 'declined' END, updated_at = ? WHERE project_id = ? AND status = 'sent'`).bind(q.id, nowIso(), pr.id).run();
    await touch(env, pr.id, "status = 'approved', quote_id = ?, fee = ?, days = ?, designer_user_id = ?, designer_slug = ?, commission_pct = ?, approved_at = ?", q.id, q.fee, q.days, q.designer_user_id, d?.slug ?? q.designer_slug, Number(s.general?.commissionRate ?? 10), nowIso());
    await notify(env, q.designer_user_id, "quote_approved", `Price approved: ${pr.title}`, `The customer approved $${Number(q.fee).toFixed(2)}. Work starts when they pay (they're entering the wall size now).`, `/dashboard?view=requests&project=${pr.id}`);
    return j({ ok: true, next: `/projects/${pr.id}/pay` });
  }

  if (act === "price" && m === "POST") {
    if (role !== "customer") return bad("Only the customer can do this.", 403);
    const w = Number(body.width), h = Number(body.height); const unit = ["ft", "in", "cm"].includes(body.unit) ? body.unit : "ft";
    const sqft = w > 0 && h > 0 ? sqftOf(w, h, unit) : 0;
    const pp = await printPrice(env, pr.design_slug, String(body.finish ?? ""), sqft);
    const fee = Number(pr.fee ?? 0);
    const q = await priceQuote(env, uid, r2(pp.printing + fee), { state: body.state, useCredit: !!body.useCredit });
    return j({ ...pp, sqft, fee, subtotal: r2(pp.printing + fee), quote: q, days: pr.days });
  }

  if (act === "pay" && m === "POST") {
    if (role !== "customer") return bad("Only the customer can pay.", 403);
    if (pr.status !== "approved") return bad(pr.status === "in_progress" || pr.status === "delivered" ? "This is already paid." : "Approve a price first.");
    const w = Number(body.width), h = Number(body.height); const unit = ["ft", "in", "cm"].includes(body.unit) ? body.unit : "ft";
    if (!(w > 0 && h > 0)) return bad("Enter the wall width and height.");
    const sqft = sqftOf(w, h, unit);
    if (sqft < 1 || sqft > 5000) return bad("That wall size doesn't look right.");
    if (!String(body.name ?? "").trim() || String(body.address ?? "").trim().length < 5) return bad("Name and shipping address are needed.");
    const card = String(body.card ?? "").replace(/\s/g, "");
    if (!/^4242424242424242$/.test(card)) return bad("Test mode: use the test card 4242 4242 4242 4242. No real money is taken.");
    const pp = await printPrice(env, pr.design_slug, String(body.finish ?? ""), sqft);
    const fee = Number(pr.fee ?? 0); const sub = r2(pp.printing + fee);
    const q = await priceQuote(env, uid, sub, { state: body.state, useCredit: !!body.useCredit });
    const oid = crypto.randomUUID(); const now = nowIso();
    const due = new Date(Date.now() + Number(pr.days || 7) * 864e5).toISOString();
    const sel = { width: w, height: h, unit, waste: 0 };
    await DB.prepare(`INSERT INTO order_requests (id, user_id, cart_id, design_slug, finish, selection, square_feet, estimated_total, customer_name, customer_email, phone, shipping_address, notes, status, payment_method, source, project_id, design_fee, due_at, tax, discount, credit_applied, amount_due, status_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_on_designer', 'Card (test mode)', 'design request', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(oid, uid, oid, pr.design_slug ?? `project-${pr.id.slice(0, 8)}`, pp.finish, JSON.stringify(sel), sqft, sub, String(body.name).slice(0, 100), pr.customer_email ?? "", body.phone ? String(body.phone).slice(0, 40) : null, String(body.address).slice(0, 600), `${pr.kind === "edit" ? "Change request" : "Custom design"}: ${pr.title}`, pr.id, fee, due, q.tax, r2(q.special + q.couponDiscount), q.credit, q.due, now).run();
    if (q.credit > 0) await DB.prepare(`INSERT INTO store_credit (id, user_id, amount, kind, ref, note) VALUES (?, ?, ?, 'spend', ?, ?)`).bind(crypto.randomUUID(), uid, -q.credit, oid, "Used at checkout").run();
    await addEvent(env, oid, "paid", `Paid $${q.due.toFixed(2)} by card (test mode): printing $${pp.printing.toFixed(2)} + design $${fee.toFixed(2)}${q.shipping ? ` + shipping $${q.shipping.toFixed(2)}` : ""}${q.tax ? ` + tax $${q.tax.toFixed(2)}` : ""}`, uid);
    await addEvent(env, oid, "waiting_on_designer", `Waiting on designer, due ${fmtDay(due)}`, null);
    await touch(env, pr.id, "status = 'in_progress', paid_at = ?, due_at = ?, order_id = ?", now, due, oid);
    const d = pr.designer_user_id ? await designerOf(env, pr.designer_user_id) : null;
    if (pr.designer_user_id) {
      await notify(env, pr.designer_user_id, "paid", `Paid, start work: ${pr.title}`, `The customer paid. Deliver the final file by ${fmtDay(due)}.`, `/dashboard?view=requests&project=${pr.id}`);
      await testEmail(env, await emailOf(env, pr.designer_user_id), `Paid: start "${pr.title}" (due ${fmtDay(due)})`, `Hello ${d?.name ?? ""},\n\nThe customer paid for "${pr.title}". Please make the final file and upload it in your designer page by ${fmtDay(due)}.\nWall: ${w} x ${h} ${unit} (${sqft} sq ft).\n\n${origin}/dashboard?view=requests&project=${pr.id}\n\nArtisan Mural`, "project_paid");
    }
    await testEmail(env, pr.customer_email, `Order confirmed: ${pr.title}`, `Hello ${pr.customer_name},\n\nThank you, your payment of $${q.due.toFixed(2)} is confirmed (test mode, no real charge).\nPrinting: $${pp.printing.toFixed(2)} (${sqft} sq ft, ${pp.finishName})\nDesign work: $${fee.toFixed(2)}\n\n${d?.name ?? "The designer"} is working on it and will be done by ${fmtDay(due)}. Then we print and ship.\n\n${origin}/projects/${pr.id}\n\nArtisan Mural`, "project_receipt");
    for (const a of await admins(env)) await notify(env, a, "order", `New paid design order: ${pr.title}`, `Waiting on ${d?.name ?? "designer"}, due ${fmtDay(due)}`, `/admin#jobs`);
    return j({ ok: true, orderId: oid, dueAt: due, total: q.due });
  }

  if (act === "deliver" && m === "POST") {
    if (role !== "designer" && role !== "admin") return bad("Only the designer can deliver.", 403);
    if (pr.status !== "in_progress" && pr.status !== "delivered") return bad("The customer hasn't paid yet. Deliver after payment.");
    const note = String(body.note ?? "").trim().slice(0, 1000);
    const g = guard(note); if (g) return bad(g, 422);
    let key: string | null = null, name: string | null = null, size: number | null = null, link: string | null = null;
    if (body.key) {
      key = String(body.key);
      if (!key.startsWith(`project-files/${pr.designer_user_id}/${pr.id}/`) || key.includes("..")) return bad("That file isn't from this job.", 403);
      const head = await env.FILES.head(key); if (!head) return bad("The file didn't finish uploading. Try again.");
      name = String(body.filename ?? key.split("/").pop()).slice(0, 160); size = head.size;
    } else if (body.link) {
      link = String(body.link).trim();
      if (!/^https:\/\/(drive|docs)\.google\.com\//.test(link)) return bad("Paste a Google Drive link (https://drive.google.com/...).");
    } else return bad("Upload the final file or paste a Google Drive link.");
    const now = nowIso();
    // a new delivery never loses the earlier one: it stays in storage and on the order as "Earlier delivery"
    if (pr.order_id && (pr.final_key || pr.final_link) && (pr.final_key !== key || pr.final_link !== link)) {
      try {
        if (pr.final_key) await DB.prepare(`INSERT INTO order_files (id, order_id, bucket, path, label, created_by) VALUES (?, ?, 'project-files', ?, ?, ?)`).bind(crypto.randomUUID(), pr.order_id, String(pr.final_key).replace(/^project-files\//, ""), `Earlier delivery from designer: ${pr.final_name ?? "file"}`, uid).run();
        else await addEvent(env, pr.order_id, "file", `Earlier delivery link (replaced by the designer): ${pr.final_link}`, uid);
      } catch {}
    }
    await touch(env, pr.id, "status = 'delivered', final_key = ?, final_name = ?, final_size = ?, final_link = ?, final_note = ?, delivered_at = ?", key, name, size, link, note || null, now);
    if (pr.order_id) {
      await DB.prepare(`UPDATE order_requests SET status = 'ready_to_print', status_updated_at = ? WHERE id = ?`).bind(now, pr.order_id).run();
      await addEvent(env, pr.order_id, "ready_to_print", `Designer delivered the final file${name ? ` (${name})` : link ? " (Google Drive link)" : ""}. Ready to print.`, uid);
      if (key) await DB.prepare(`INSERT INTO order_files (id, order_id, bucket, path, label, created_by) VALUES (?, ?, 'project-files', ?, ?, ?)`).bind(crypto.randomUUID(), pr.order_id, key.slice("project-files/".length), `Final file from designer: ${name}`, uid).run();
    }
    for (const a of await admins(env)) await notify(env, a, "ready", `Ready to print: ${pr.title}`, "The designer delivered the final file.", `/admin#orders`);
    await notify(env, pr.customer_id, "delivered", `Your design is finished: ${pr.title}`, "The designer finished. We're getting it ready to print.", `/projects/${pr.id}`);
    await testEmail(env, pr.customer_email, `Your design is finished: ${pr.title}`, `Hello ${pr.customer_name},\n\nThe designer finished your design. We're getting it ready to print, and we'll email you the tracking number when it ships.\n\n${origin}/projects/${pr.id}\n\nArtisan Mural`, "project_delivered");
    return j({ ok: true });
  }

  if (act === "cancel" && m === "POST") {
    if (!(role === "customer" || role === "admin")) return bad("Only the customer or the owner can cancel.", 403);
    if (["in_progress", "delivered"].includes(pr.status) && role !== "admin") return bad("This is paid. Ask the studio to cancel it.");
    await touch(env, pr.id, "status = 'cancelled'");
    await DB.prepare(`UPDATE project_quotes SET status = 'cancelled' WHERE project_id = ? AND status = 'sent'`).bind(pr.id).run();
    return j({ ok: true });
  }
  return bad("not found", 404);
}

export async function notificationRoutes(env: Env, who: Who, p: string, m: string, body: any): Promise<Response> {
  if (!who.uid) return j({ items: [], unread: 0 });
  if (p === "" && m === "GET") {
    const items = (await env.DB.prepare(`SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`).bind(who.uid).all()).results ?? [];
    const n: any = await env.DB.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL`).bind(who.uid).first();
    return j({ items, unread: n?.n ?? 0 });
  }
  if (p === "read" && m === "POST") {
    if (body.id) await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`).bind(nowIso(), body.id, who.uid).run();
    else await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).bind(nowIso(), who.uid).run();
    return j({ ok: true });
  }
  return bad("not found", 404);
}

/** Collections: designers group their own designs; the owner can manage every collection. */
export async function collectionRoutes(env: Env, who: Who, p: string, m: string, body: any): Promise<Response> {
  if (!who.uid) return bad("Please sign in.", 401);
  const DB = env.DB;
  const me = await designerOf(env, who.uid);
  const asAdmin = who.admin;
  const list = async () => {
    const rows = ((asAdmin && !me ? await DB.prepare(`SELECT * FROM designer_collections ORDER BY created_at DESC`).all() : asAdmin ? await DB.prepare(`SELECT * FROM designer_collections ORDER BY created_at DESC`).all() : await DB.prepare(`SELECT * FROM designer_collections WHERE designer_slug = ? ORDER BY created_at DESC`).bind(me?.slug ?? "-").all()).results ?? []) as any[];
    return rows.map((c) => ({ id: c.id, designerSlug: c.designer_slug, title: c.title, description: c.description, designs: parseJ(c.design_slugs, []), updatedAt: c.updated_at }));
  };
  if (p === "" && m === "GET") {
    const designs = asAdmin ? ((await DB.prepare(`SELECT u.id, u.title, u.owner_id, a.slug FROM artwork_uploads u LEFT JOIN designer_accounts a ON a.user_id = u.owner_id WHERE u.review_status = 'approved' ORDER BY u.title`).all()).results ?? []) as any[]
      : ((await DB.prepare(`SELECT id, title, owner_id, review_status FROM artwork_uploads WHERE owner_id = ? ORDER BY created_at DESC`).bind(who.uid).all()).results ?? []) as any[];
    const designers: Record<string, string> = {};
    if (asAdmin) for (const r of ((await DB.prepare(`SELECT p.user_id, p.full_name, p.studio_name, a.slug FROM designer_profiles p LEFT JOIN designer_accounts a ON a.user_id = p.user_id WHERE p.status = 'approved'`).all()).results ?? []) as any[]) designers[r.slug ?? `studio-${r.user_id.slice(0, 8)}`] = r.studio_name || r.full_name;
    return j({ collections: await list(), designs: await Promise.all(designs.map(async (d) => ({ slug: "u-" + d.id, title: d.title, designerSlug: d.slug ?? `studio-${d.owner_id.slice(0, 8)}`, live: asAdmin || d.review_status === "approved", thumb: await designThumb(env, "u-" + d.id) }))), designers, mySlug: me?.slug ?? null });
  }
  if (p === "" && m === "POST") {
    const title = String(body.title ?? "").trim().slice(0, 80); const desc = String(body.description ?? "").trim().slice(0, 500);
    const slugs: string[] = (Array.isArray(body.designs) ? body.designs : []).map(String).slice(0, 48);
    if (!title) return bad("Give the collection a name.");
    if (slugs.length < 1) return bad("Pick at least one design.");
    let dslug = me?.slug ?? null;
    if (asAdmin && body.designerSlug) dslug = String(body.designerSlug);
    if (!dslug) return bad("Only designers can make collections.");
    // every design must belong to that designer
    for (const s of slugs) {
      if (!s.startsWith("u-")) return bad("Only uploaded designs can go in a collection.");
      const u: any = await DB.prepare(`SELECT u.owner_id, a.slug FROM artwork_uploads u LEFT JOIN designer_accounts a ON a.user_id = u.owner_id WHERE u.id = ?`).bind(s.slice(2)).first();
      if (!u || (u.slug ?? `studio-${u.owner_id.slice(0, 8)}`) !== dslug) return bad("A collection can only hold one designer's own designs.");
    }
    if (body.id) {
      const c: any = await DB.prepare(`SELECT designer_slug FROM designer_collections WHERE id = ?`).bind(body.id).first();
      if (!c) return bad("Collection not found", 404);
      if (!asAdmin && c.designer_slug !== me?.slug) return bad("That collection isn't yours.", 403);
      await DB.prepare(`UPDATE designer_collections SET title = ?, description = ?, design_slugs = ?, designer_slug = ?, updated_at = ? WHERE id = ?`).bind(title, desc, JSON.stringify(slugs), dslug, nowIso(), body.id).run();
    } else await DB.prepare(`INSERT INTO designer_collections (id, designer_slug, title, description, design_slugs, owner_id) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), dslug, title, desc, JSON.stringify(slugs), who.uid).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true, collections: await list() });
  }
  const mm = p.match(/^([0-9a-f-]{36})$/);
  if (mm && m === "DELETE") {
    const c: any = await DB.prepare(`SELECT designer_slug FROM designer_collections WHERE id = ?`).bind(mm[1]).first();
    if (!c) return bad("Collection not found", 404);
    if (!asAdmin && c.designer_slug !== me?.slug) return bad("That collection isn't yours.", 403);
    await DB.prepare(`DELETE FROM designer_collections WHERE id = ?`).bind(mm[1]).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true, collections: await list() });
  }
  return bad("not found", 404);
}
