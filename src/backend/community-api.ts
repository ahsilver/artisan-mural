// Community: designer directory data, public profiles, contact, reviews (designs + designers), owner moderation.
// Emails are TEST mode (email_outbox only). Reviews are only accepted from verified buyers.
import type { Who } from "./policies";
import { getSettings } from "./app-api";
import { notify, testEmail } from "./projects-api";
import { findContactDetails, CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import { designers as sampleDesigners } from "@/lib/catalog";
type Env = any;
const j = (b: any, s = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const nowIso = () => new Date().toISOString();
const parseJ = (v: any, d: any = null) => { if (v == null) return d; if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return d; } };
const guard = (t: string) => { const w = findContactDetails(t || ""); return w ? `${CONTACT_BLOCKED_MESSAGE} (We found ${w}.)` : null; };
const all = async (env: Env, sql: string, ...a: any[]) => ((await env.DB.prepare(sql).bind(...a).all()).results ?? []) as any[];
const one = async (env: Env, sql: string, ...a: any[]) => (await env.DB.prepare(sql).bind(...a).first()) as any;
const RESPONSE = ["within an hour", "within a few hours", "within a day", "within 2-3 days"];
const imgUrl = (k: string) => `/backend/community/img/${k}`;
async function settings(env: Env) { const s = await getSettings(env); return s.community ?? {}; }
async function admins(env: Env) { return (await all(env, `SELECT user_id FROM user_roles WHERE role = 'admin'`)).map((r) => r.user_id as string); }
async function emailOf(env: Env, uid: string | null) { if (!uid) return null; const u = await one(env, `SELECT email FROM auth_users WHERE id = ?`, uid); return u?.email ?? null; }

async function slugOfUid(env: Env, uid: string) { const a = await one(env, `SELECT slug FROM designer_accounts WHERE user_id = ?`, uid); return a?.slug ?? `studio-${uid.slice(0, 8)}`; }
async function profileBySlug(env: Env, slug: string) {
  const acc = await one(env, `SELECT user_id FROM designer_accounts WHERE slug = ?`, slug);
  let uid = acc?.user_id as string | undefined;
  if (!uid && /^studio-[0-9a-f]{8}$/.test(slug)) uid = (await one(env, `SELECT user_id FROM designer_profiles WHERE substr(user_id,1,8) = ?`, slug.slice(7)))?.user_id;
  if (!uid) return null;
  const p = await one(env, `SELECT * FROM designer_profiles WHERE user_id = ?`, uid);
  return p ? { ...p, slug, name: p.studio_name || p.full_name || "Designer" } : null;
}
const isPublic = (p: any) => p && p.status === "approved" && !Number(p.public_hidden);

/** Average time from a request/message reaching the designer to their first answer (message or price). */
export async function measuredResponse(env: Env, uid: string) {
  const prs = await all(env, `SELECT id, created_at FROM projects WHERE designer_user_id = ? OR id IN (SELECT project_id FROM project_quotes WHERE designer_user_id = ?) OR id IN (SELECT project_id FROM project_messages WHERE designer_user_id = ?) ORDER BY created_at DESC LIMIT 40`, uid, uid, uid);
  if (!prs.length) return null;
  const first = new Map<string, string>();
  for (const r of await all(env, `SELECT project_id, MIN(created_at) at FROM project_messages WHERE designer_user_id = ? AND sender_role = 'designer' GROUP BY project_id`, uid)) first.set(r.project_id, r.at);
  for (const r of await all(env, `SELECT project_id, MIN(created_at) at FROM project_quotes WHERE designer_user_id = ? GROUP BY project_id`, uid)) { const c = first.get(r.project_id); if (!c || r.at < c) first.set(r.project_id, r.at); }
  const diffs: number[] = [];
  for (const p of prs) { const a = first.get(p.id); if (!a) continue; const h = (Date.parse(a) - Date.parse(p.created_at)) / 3600000; if (h >= 0) diffs.push(h); }
  if (!diffs.length) return null;
  const hours = diffs.reduce((s, x) => s + x, 0) / diffs.length;
  const label = hours < 1 ? "under an hour" : hours < 24 ? `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}` : `about ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"}`;
  return { hours: Math.round(hours * 10) / 10, n: diffs.length, label };
}

async function reviewStats(env: Env, kind: string, target: string) {
  const r = await one(env, `SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE kind = ? AND target = ? AND COALESCE(hidden,0) = 0`, kind, target);
  return { count: Number(r?.n ?? 0), avg: r?.n ? Math.round(Number(r.a) * 10) / 10 : 0 };
}
async function eligible(env: Env, who: Who, kind: string, target: string): Promise<{ ok: boolean; ref?: string; reason?: string }> {
  if (!who.uid) return { ok: false, reason: "signin" };
  if (kind === "design") {
    const em = (who.email || (await emailOf(env, who.uid)) || "-").toLowerCase();
    const o = await one(env, `SELECT id FROM order_requests WHERE design_slug = ? AND (user_id = ? OR lower(customer_email) = ?) AND status NOT IN ('cancelled','refunded') LIMIT 1`, target, who.uid, em);
    return o ? { ok: true, ref: o.id } : { ok: false, reason: "Only customers who ordered this design can review it." };
  }
  const p = await profileBySlug(env, target);
  if (!p) return { ok: false, reason: "Only customers who worked with this designer can review them." };
  if (p.user_id === who.uid) return { ok: false, reason: "You can't review yourself." };
  const pr = await one(env, `SELECT id FROM projects WHERE customer_id = ? AND (designer_user_id = ? OR quote_id IN (SELECT id FROM project_quotes WHERE designer_user_id = ?)) AND status IN ('approved','in_progress','delivered','completed') LIMIT 1`, who.uid, p.user_id, p.user_id);
  return pr ? { ok: true, ref: pr.id } : { ok: false, reason: "Only customers whose request this designer accepted can review them." };
}
async function targetName(env: Env, kind: string, target: string) {
  if (kind === "designer") { const p = await profileBySlug(env, target); return p?.name ?? sampleDesigners.find((d) => d.slug === target)?.name ?? target; }
  if (target.startsWith("u-")) { const u = await one(env, `SELECT title FROM artwork_uploads WHERE id = ?`, target.slice(2)); if (u) return u.title; }
  return target;
}
async function invalidate() { try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {} }

export async function communityRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  const cs = await settings(env);
  // ---------- public pictures (profile photos + portfolio) ----------
  if (p.startsWith("img/") && (m === "GET" || m === "HEAD")) {
    const key = p.slice(4).replace(/\.\.+/g, "");
    if (!key.startsWith("community/")) return new Response("not found", { status: 404 });
    const obj = await env.FILES.get(key);
    if (!obj) return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
    const h = new Headers(); obj.writeHttpMetadata(h); h.set("etag", obj.httpEtag); h.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(obj.body, { headers: h });
  }
  // ---------- public designer data ----------
  if (p === "designers" && m === "GET") {
    const rows = await all(env, `SELECT user_id, portfolio, response_label, turnaround_days FROM designer_profiles WHERE status = 'approved' AND COALESCE(public_hidden,0) = 0`);
    const out: Record<string, any> = {};
    for (const r of rows) out[await slugOfUid(env, r.user_id)] = { measured: await measuredResponse(env, r.user_id), portfolio: (parseJ(r.portfolio, []) as any[]).length };
    return j({ designers: out });
  }
  const dm = p.match(/^designer\/([a-z0-9-]{1,80})$/i);
  if (dm && m === "GET") {
    const pr = await profileBySlug(env, dm[1]);
    if (!pr || !isPublic(pr)) return j({ found: false, portfolio: [], measured: null });
    return j({ found: true, portfolio: (parseJ(pr.portfolio, []) as any[]).map((x) => ({ url: imgUrl(x.key), caption: x.caption || "" })), measured: await measuredResponse(env, pr.user_id), responseLabel: pr.response_label, turnaroundDays: pr.turnaround_days });
  }
  // ---------- contact a designer ----------
  if (p === "contact" && m === "POST") {
    if (cs.contactEnabled === false) return bad("Messages to designers are paused right now.");
    const text = String(body.body ?? "").trim();
    if (text.length < 10) return bad("Write a little more (at least a sentence).");
    const g = guard(text + " " + (body.name ?? "")); if (g) return bad(g, 422);
    let name = String(body.name ?? "").trim().slice(0, 80); let email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
    if (who.uid) { email = (who.email || (await emailOf(env, who.uid)) || email).toLowerCase(); name = name || email.split("@")[0]; }
    else { if (name.length < 2) return bad("Please enter your name."); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad("Please enter a valid email so the designer can reach you."); }
    const slug = String(body.designerSlug ?? "");
    const designSlug = body.designSlug ? String(body.designSlug).slice(0, 80) : null;
    const pr = await profileBySlug(env, slug);
    if (!pr || !isPublic(pr)) {
      // Sample designers without an account: the message goes to the store, which answers for them.
      const dn = sampleDesigners.find((d) => d.slug === slug)?.name; if (!dn) return bad("This designer isn't taking messages right now.");
      const tid = crypto.randomUUID(); const at = nowIso();
      await env.DB.prepare(`INSERT INTO store_threads (id, user_id, user_email, user_name, user_role, subject, created_by, last_at, last_body, last_from) VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?, 'user')`).bind(tid, who.uid, email, name, `For designer ${dn}`, who.uid ?? "guest", at, text.slice(0, 200)).run();
      await env.DB.prepare(`INSERT INTO store_messages (id, thread_id, sender_id, sender_role, body) VALUES (?, ?, ?, 'user', ?)`).bind(crypto.randomUUID(), tid, who.uid, text.slice(0, 3000)).run();
      for (const a of await admins(env)) await notify(env, a, "message", `Message for ${dn} from ${name}`, text.slice(0, 140), `/admin#messages:s.${tid}`);
      return j({ ok: true, key: `s.${tid}` });
    }
    if (pr.user_id === who.uid) return bad("That's your own profile.");
    const id = crypto.randomUUID(); const dt = designSlug ? await targetName(env, "design", designSlug) : null;
    const title = dt ? `Question about ${dt}` : `Message to ${pr.name}`;
    await env.DB.prepare(`INSERT INTO projects (id, kind, customer_id, customer_name, customer_email, designer_slug, designer_user_id, design_slug, title, brief, status) VALUES (?, 'message', ?, ?, ?, ?, ?, ?, ?, ?, 'message')`).bind(id, who.uid ?? "guest", name, email, pr.slug, pr.user_id, designSlug, title, text.slice(0, 3000)).run();
    await env.DB.prepare(`INSERT INTO project_messages (id, project_id, designer_user_id, sender_id, sender_role, body, attachments) VALUES (?, ?, ?, ?, 'customer', ?, '[]')`).bind(crypto.randomUUID(), id, pr.user_id, who.uid ?? "guest", text.slice(0, 3000)).run();
    const key = `p.${id}.${pr.user_id}`;
    await notify(env, pr.user_id, "message", `New message from ${name}`, text.slice(0, 140), `/dashboard?view=messages&c=${key}`);
    await testEmail(env, await emailOf(env, pr.user_id), `New message from ${name} on Artisan Mural`, `Hello ${pr.name},\n\n${name} wrote to you:\n\n"${text.slice(0, 600)}"\n\nReply from your designer portal, Messages tab.`, "designer_contact");
    for (const a of await admins(env)) await notify(env, a, "message", `${name} wrote to ${pr.name}`, text.slice(0, 140), `/admin#messages:${key}`);
    if (!who.uid) await testEmail(env, email, `Your message to ${pr.name}`, `Hello ${name},\n\nWe passed your message to ${pr.name}. When they reply we will email you. Sign in or create an account with this email to see the whole conversation under Account > Messages.`, "designer_contact_receipt");
    return j({ ok: true, key, signedIn: !!who.uid });
  }
  // ---------- reviews ----------
  if (p === "reviews" && m === "GET") {
    const kind = url.searchParams.get("kind") === "designer" ? "designer" : "design"; const target = String(url.searchParams.get("target") || "");
    const rows = await all(env, `SELECT id, user_id, reviewer_name, rating, body, reply, reply_at, created_at FROM reviews WHERE kind = ? AND target = ? AND COALESCE(hidden,0) = 0 ORDER BY created_at DESC LIMIT 100`, kind, target);
    const st = await reviewStats(env, kind, target);
    let me: any = null;
    if (who.uid) { const e = await eligible(env, who, kind, target); const mine = await one(env, `SELECT id, rating, body, reviewer_name, hidden FROM reviews WHERE kind = ? AND target = ? AND user_id = ?`, kind, target, who.uid); me = { eligible: e.ok, reason: e.reason, mine }; }
    return j({ enabled: cs.reviewsEnabled !== false, ...st, me, reviews: rows.map((r) => ({ id: r.id, name: r.reviewer_name, rating: r.rating, body: r.body, reply: r.reply, at: r.created_at, mine: r.user_id === who.uid })) });
  }
  if (p === "reviews" && m === "POST") {
    if (cs.reviewsEnabled === false) return bad("Reviews are paused right now.");
    if (!who.uid) return bad("Please sign in.", 401);
    const kind = body.kind === "designer" ? "designer" : "design"; const target = String(body.target ?? "").slice(0, 80);
    const rating = Math.round(Number(body.rating)); if (!(rating >= 1 && rating <= 5)) return bad("Choose 1 to 5 stars.");
    const text = String(body.body ?? "").trim().slice(0, 2000); const name = String(body.name ?? "").trim().slice(0, 60);
    if (name.length < 2) return bad("Add the name to show with your review.");
    const g = guard(text); if (g) return bad(g, 422);
    const e = await eligible(env, who, kind, target); if (!e.ok) return bad(e.reason || "Only verified buyers can review.", 403);
    const ex = await one(env, `SELECT id FROM reviews WHERE kind = ? AND target = ? AND user_id = ?`, kind, target, who.uid);
    if (ex) await env.DB.prepare(`UPDATE reviews SET rating = ?, body = ?, reviewer_name = ?, updated_at = ? WHERE id = ?`).bind(rating, text, name, nowIso(), ex.id).run();
    else await env.DB.prepare(`INSERT INTO reviews (id, kind, target, user_id, reviewer_name, rating, body, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), kind, target, who.uid, name, rating, text, e.ref ?? null).run();
    const tn = await targetName(env, kind, target);
    for (const a of await admins(env)) await notify(env, a, "review", `New ${rating}-star review for ${tn}`, text.slice(0, 140), `/admin#reviews`);
    if (kind === "designer") { const pr = await profileBySlug(env, target); if (pr) await notify(env, pr.user_id, "review", `New ${rating}-star review`, text.slice(0, 140), `/designers/${target}`); }
    await invalidate();
    return j({ ok: true });
  }
  if (p === "reviews/delete" && m === "POST") {
    if (!who.uid) return bad("Please sign in.", 401);
    await env.DB.prepare(`DELETE FROM reviews WHERE id = ? AND user_id = ?`).bind(String(body.id ?? ""), who.uid).run(); await invalidate();
    return j({ ok: true });
  }
  // ---------- designer: own public profile ----------
  if (p === "me" || p.startsWith("me/")) {
    if (!who.uid) return bad("Please sign in.", 401);
    const prof = await one(env, `SELECT * FROM designer_profiles WHERE user_id = ?`, who.uid);
    if (!prof) return bad("Set up your designer account first.", 403);
    const portfolio = parseJ(prof.portfolio, []) as any[];
    if (p === "me" && m === "GET") {
      return j({ slug: await slugOfUid(env, who.uid), status: prof.status, hidden: !!Number(prof.public_hidden), name: prof.studio_name || prof.full_name, fullName: prof.full_name, tagline: prof.tagline ?? "", bio: prof.bio ?? "", country: prof.country ?? "",
        specialties: (parseJ(prof.specialties, null) ?? parseJ(prof.styles, []) ?? []), photo: prof.photo_key ? imgUrl(prof.photo_key) : null, responseLabel: prof.response_label ?? "", turnaroundDays: prof.turnaround_days ?? null,
        portfolio: portfolio.map((x) => ({ key: x.key, url: imgUrl(x.key), caption: x.caption || "" })), measured: await measuredResponse(env, who.uid), options: RESPONSE });
    }
    if (p === "me" && m === "POST") {
      const name = String(body.name ?? "").trim().slice(0, 80); const tagline = String(body.tagline ?? "").trim().slice(0, 120); const bio = String(body.bio ?? "").trim().slice(0, 2000);
      const sp = (Array.isArray(body.specialties) ? body.specialties : String(body.specialties ?? "").split(",")).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 8).map((s: string) => s.slice(0, 30));
      const rl = RESPONSE.includes(body.responseLabel) ? body.responseLabel : null;
      const td = body.turnaroundDays === "" || body.turnaroundDays == null ? null : Math.round(Number(body.turnaroundDays));
      if (td != null && !(td >= 1 && td <= 120)) return bad("Typical turnaround: 1 to 120 days.");
      if (name.length < 2) return bad("Enter the name customers see.");
      const g = guard(`${name} ${tagline} ${bio} ${sp.join(" ")}`); if (g) return bad(g, 422);
      await env.DB.prepare(`UPDATE designer_profiles SET studio_name = ?, tagline = ?, bio = ?, specialties = ?, response_label = ?, turnaround_days = ? WHERE user_id = ?`).bind(name, tagline || null, bio || prof.bio || "", JSON.stringify(sp), rl, td, who.uid).run();
      await invalidate();
      return j({ ok: true });
    }
    if ((p === "me/photo" || p === "me/portfolio") && m === "POST") {
      const ct = req.headers.get("content-type") || ""; if (!/^image\/(jpeg|png|webp)$/.test(ct)) return bad("Upload a JPG, PNG or WebP picture.");
      if (p === "me/portfolio" && portfolio.length >= 24) return bad("You can show up to 24 pictures. Remove one first.");
      const buf = await req.arrayBuffer(); if (buf.byteLength > 6_000_000) return bad("That picture is too large (6 MB max).", 413);
      const key = `community/${p === "me/photo" ? "photos" : "portfolio"}/${who.uid}/${crypto.randomUUID().slice(0, 12)}.${ct.split("/")[1].replace("jpeg", "jpg")}`;
      await env.FILES.put(key, buf, { httpMetadata: { contentType: ct, cacheControl: "public, max-age=31536000, immutable" } });
      if (p === "me/photo") { if (prof.photo_key) await env.FILES.delete(prof.photo_key).catch(() => {}); await env.DB.prepare(`UPDATE designer_profiles SET photo_key = ? WHERE user_id = ?`).bind(key, who.uid).run(); }
      else { portfolio.push({ key, caption: String(url.searchParams.get("caption") || "").slice(0, 120), at: nowIso() }); await env.DB.prepare(`UPDATE designer_profiles SET portfolio = ? WHERE user_id = ?`).bind(JSON.stringify(portfolio), who.uid).run(); }
      await invalidate();
      return j({ ok: true, url: imgUrl(key), key });
    }
    if (p === "me/portfolio/remove" && m === "POST") {
      const k = String(body.key ?? ""); const next = portfolio.filter((x) => x.key !== k);
      if (next.length !== portfolio.length) { await env.FILES.delete(k).catch(() => {}); await env.DB.prepare(`UPDATE designer_profiles SET portfolio = ? WHERE user_id = ?`).bind(JSON.stringify(next), who.uid).run(); }
      return j({ ok: true });
    }
    if (p === "me/photo/remove" && m === "POST") { if (prof.photo_key) await env.FILES.delete(prof.photo_key).catch(() => {}); await env.DB.prepare(`UPDATE designer_profiles SET photo_key = NULL WHERE user_id = ?`).bind(who.uid).run(); await invalidate(); return j({ ok: true }); }
    return bad("not found", 404);
  }
  // ---------- owner ----------
  if (p.startsWith("admin/")) {
    if (!who.admin) return bad("Only the owner can open this.", 403);
    const q = p.slice(6);
    if (q === "reviews" && m === "GET") {
      const rows = await all(env, `SELECT r.*, u.email FROM reviews r LEFT JOIN auth_users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 500`);
      return j({ reviews: await Promise.all(rows.map(async (r) => ({ id: r.id, kind: r.kind, target: r.target, targetName: await targetName(env, r.kind, r.target), name: r.reviewer_name, email: r.email, rating: r.rating, body: r.body, reply: r.reply, hidden: !!Number(r.hidden), at: r.created_at }))) });
    }
    const rm = q.match(/^reviews\/([0-9a-f-]{36})$/);
    if (rm && m === "POST") {
      const a = String(body.action ?? "");
      if (a === "delete") await env.DB.prepare(`DELETE FROM reviews WHERE id = ?`).bind(rm[1]).run();
      else if (a === "hide" || a === "show") await env.DB.prepare(`UPDATE reviews SET hidden = ? WHERE id = ?`).bind(a === "hide" ? 1 : 0, rm[1]).run();
      else if (a === "reply") { const t = String(body.reply ?? "").trim().slice(0, 1500); await env.DB.prepare(`UPDATE reviews SET reply = ?, reply_at = ? WHERE id = ?`).bind(t || null, t ? nowIso() : null, rm[1]).run(); }
      else return bad("Unknown action");
      await invalidate(); return j({ ok: true });
    }
    if (q === "designers" && m === "GET") {
      const rows = await all(env, `SELECT p.user_id, p.full_name, p.studio_name, p.status, p.public_hidden, p.photo_key, p.tagline, p.portfolio, p.response_label, p.turnaround_days, u.email FROM designer_profiles p LEFT JOIN auth_users u ON u.id = p.user_id ORDER BY p.created_at DESC`);
      return j({ designers: await Promise.all(rows.map(async (r) => { const slug = await slugOfUid(env, r.user_id); const st = await reviewStats(env, "designer", slug); return { uid: r.user_id, slug, name: r.studio_name || r.full_name, email: r.email, status: r.status, hidden: !!Number(r.public_hidden), photo: r.photo_key ? imgUrl(r.photo_key) : null, tagline: r.tagline, portfolio: (parseJ(r.portfolio, []) as any[]).length, responseLabel: r.response_label, turnaroundDays: r.turnaround_days, measured: await measuredResponse(env, r.user_id), ...st }; })) });
    }
    const dmm = q.match(/^designers\/([0-9a-f-]{36})$/);
    if (dmm && m === "POST") { await env.DB.prepare(`UPDATE designer_profiles SET public_hidden = ? WHERE user_id = ?`).bind(body.hidden ? 1 : 0, dmm[1]).run(); await invalidate(); return j({ ok: true }); }
    const prm = q.match(/^requests\/([0-9a-f-]{36})$/);
    if (prm && m === "POST") {
      const a = String(body.action ?? "");
      if (a === "hide" || a === "show") await env.DB.prepare(`UPDATE projects SET hidden = ?, updated_at = ? WHERE id = ?`).bind(a === "hide" ? 1 : 0, nowIso(), prm[1]).run();
      else if (a === "close") await env.DB.prepare(`UPDATE projects SET status = 'closed', updated_at = ? WHERE id = ? AND status IN ('requested','quoted','message')`).bind(nowIso(), prm[1]).run();
      else if (a === "reopen") await env.DB.prepare(`UPDATE projects SET status = CASE WHEN kind = 'message' THEN 'message' WHEN EXISTS (SELECT 1 FROM project_quotes q WHERE q.project_id = projects.id AND q.status = 'sent') THEN 'quoted' ELSE 'requested' END, updated_at = ? WHERE id = ? AND status = 'closed'`).bind(nowIso(), prm[1]).run();
      else return bad("Unknown action");
      return j({ ok: true });
    }
    if (q === "messages" && m === "GET") {
      const rows = await all(env, `SELECT p.id, p.customer_name, p.customer_email, p.customer_id, p.designer_user_id, p.designer_slug, p.title, p.status, p.created_at, (SELECT COUNT(*) FROM project_messages x WHERE x.project_id = p.id) n FROM projects p WHERE p.kind = 'message' ORDER BY p.created_at DESC LIMIT 300`);
      return j({ messages: rows.map((r) => ({ ...r, key: `p.${r.id}.${r.designer_user_id}`, guest: r.customer_id === "guest" })) });
    }
    return bad("not found", 404);
  }
  return bad("not found", 404);
}
