// Artisan Pro (professional program) + first-order signup codes.
import type { Who } from "./policies";
import { getSettings, queueEmail } from "./app-api";
import { signUrl } from "./storage";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const str = (v: any, n = 300) => String(v ?? "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const parse = (v: any, d: any) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
const ROLES = ["Interior designer", "Architect", "Contractor / installer", "Home stager", "Hospitality buyer", "Healthcare buyer", "Developer / property manager", "Other"];

function makeCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint8Array(6));
  return "WELCOME-" + Array.from(r, (x) => a[x % a.length]).join("");
}
async function userEmail(env: Env, uid: string) { const u: any = await env.DB.prepare(`SELECT email, user_metadata FROM auth_users WHERE id = ?`).bind(uid).first(); return u; }
export async function orderCount(env: Env, uid: string, exceptCart?: string | null) {
  const r: any = await env.DB.prepare(`SELECT COUNT(*) n FROM order_requests WHERE user_id = ? AND (? IS NULL OR cart_id IS NULL OR cart_id != ?) AND COALESCE(status,'') NOT IN ('cancelled')`).bind(uid, exceptCart ?? null, exceptCart ?? null).first();
  return Number(r?.n ?? 0);
}
/** A first-order code check for quote(): returns the code row or an error message. */
export async function firstOrderCode(env: Env, uid: string, code: string, cartId?: string | null): Promise<{ row?: any; error?: string } | null> {
  if (!/^WELCOME-[A-Z0-9]{6}$/.test(code)) return null;
  const row: any = await env.DB.prepare(`SELECT * FROM first_order_codes WHERE code = ?`).bind(code).first();
  if (!row) return { error: "That code isn't valid." };
  if (row.used_at && row.cart_id !== cartId) return { error: "That code has already been used." };
  const u = await userEmail(env, uid);
  if (!u || String(u.email).toLowerCase() !== String(row.email).toLowerCase()) return { error: "This code works with the email it was sent to. Sign in with that email to use it." };
  if ((await orderCount(env, uid, cartId)) > 0) return { error: "This code is for a first order only." };
  return { row };
}

export async function proRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  const DB = env.DB; const s = await getSettings(env); const pro = s.pro ?? {}; const pop = s.popup ?? {};
  const name = pro.name || "Artisan Pro";
  // ---- public: first-order signup
  if (p === "first-order" && m === "POST") {
    if (!pop.enabled) return bad("This offer isn't available right now.");
    const email = str(body.email, 200).toLowerCase();
    if (!EMAIL.test(email)) return bad("Please enter a valid email.");
    const ex: any = await DB.prepare(`SELECT * FROM first_order_codes WHERE email = ?`).bind(email).first();
    if (ex) return ex.used_at ? bad("This email has already used its welcome code.") : j({ code: ex.code, pct: ex.pct, existing: true });
    const u: any = await DB.prepare(`SELECT id FROM auth_users WHERE lower(email) = ?`).bind(email).first();
    if (u && (await orderCount(env, u.id)) > 0) return bad("Welcome back. This offer is for first orders only.");
    const code = makeCode(); const pct = Number(pop.pct) || 10;
    await DB.prepare(`INSERT INTO first_order_codes (email, code, pct, source, page) VALUES (?, ?, ?, ?, ?)`).bind(email, code, pct, str(body.source, 40) || "popup", str(body.page, 200)).run();
    await queueEmail(env, email, `Your ${pct}% welcome code`, `Thanks for joining Artisan Mural.\n\nYour code: ${code}\n${pct}% off your first order. Enter it at checkout, signed in with this email (${email}). One use.`, "first_order_code");
    return j({ code, pct });
  }
  // ---- signed-in customer
  if (p === "me") {
    if (!who.uid) return j({ application: null, signedIn: false });
    const a: any = await DB.prepare(`SELECT id, status, business, role, decision_note, created_at, decided_at FROM pro_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).bind(who.uid).first();
    const t: any = await DB.prepare(`SELECT trade_status, discount_pct, company FROM customer_terms WHERE user_id = ?`).bind(who.uid).first();
    return j({ signedIn: true, application: a ?? null, status: t?.trade_status ?? a?.status ?? null, discountPct: t?.trade_status === "approved" ? Number(t.discount_pct) || 0 : null, company: t?.company ?? null, orders: await orderCount(env, who.uid) });
  }
  if (p === "apply" && m === "POST") {
    if (!who.uid) return bad("Please sign in.", 401);
    if (!pro.enabled) return bad("Applications are closed right now.");
    const a = body.answers ?? {};
    const business = str(a.business, 160), role = str(a.role, 80);
    if (!business) return bad("Business name needed.");
    if (!role) return bad("Please choose your role.");
    if (!str(a.phone, 40)) return bad("Phone number needed.");
    const cur: any = await DB.prepare(`SELECT trade_status FROM customer_terms WHERE user_id = ?`).bind(who.uid).first();
    if (cur?.trade_status === "approved") return bad(`You're already an ${name} member.`);
    const id = crypto.randomUUID();
    let filePath: string | null = null, fileName: string | null = null;
    if (body.file?.data) {
      const fn = str(body.file.name, 120).replace(/[^\w.\- ]+/g, "_") || "document";
      const bin = Uint8Array.from(atob(String(body.file.data)), (c) => c.charCodeAt(0));
      if (bin.length > 6 * 1024 * 1024) return bad("That file is too large (6 MB max).");
      filePath = `${id}/${fn}`; fileName = fn;
      await env.FILES.put(`pro-docs/${filePath}`, bin, { httpMetadata: { contentType: str(body.file.type, 80) || "application/octet-stream" } });
    }
    const clean: Record<string, any> = {};
    for (const k of ["business", "role", "roleOther", "website", "instagram", "portfolio", "address", "city", "state", "postal", "country", "phone", "years", "volume", "heard", "taxId", "notes", "contactName"]) if (a[k] != null) clean[k] = str(a[k], k === "notes" ? 1000 : 300);
    clean.projects = Array.isArray(a.projects) ? a.projects.slice(0, 8).map((x: any) => str(x, 40)) : [];
    const u = await userEmail(env, who.uid);
    await DB.prepare(`INSERT INTO pro_applications (id, user_id, email, status, business, role, answers, file_path, file_name) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`).bind(id, who.uid, u?.email ?? who.email ?? null, business, role, JSON.stringify(clean), filePath, fileName).run();
    await DB.prepare(`INSERT INTO customer_terms (user_id, trade, trade_status, company, website, note) VALUES (?, 1, 'pending', ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET trade = 1, trade_status = 'pending', company = excluded.company, website = excluded.website, note = excluded.note, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(who.uid, business, clean.website || clean.instagram || clean.portfolio || null, `${name} application: ${role}`).run();
    if (u?.email) await queueEmail(env, u.email, `We received your ${name} application`, `Thanks for applying to ${name}, ${business}.\n\nWe review every application within ${pro.approvalDays || "1–2 business days"} and will email you as soon as you're approved.`, "pro_received");
    const owner = pro.notifyEmail || s.general?.contactEmail;
    if (owner) await queueEmail(env, owner, `New ${name} application: ${business}`, `${business} (${role}) applied. Review it in the back office under ${name}.`, "pro_owner_notice");
    return j({ ok: true, id });
  }
  // ---- owner
  if (!p.startsWith("admin/")) return bad("not found", 404);
  if (!who.admin) return bad("Owner only.", 403);
  const q = p.slice(6);
  if (q === "apps" && m === "GET") {
    const rows = ((await DB.prepare(`SELECT * FROM pro_applications ORDER BY created_at DESC LIMIT 500`).all()).results ?? []) as any[];
    const apps = [];
    for (const r of rows) apps.push({ ...r, answers: parse(r.answers, {}), fileUrl: r.file_path ? env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "pro-docs", r.file_path, 3600)) + "&download=" + encodeURIComponent(r.file_name || "") : null });
    const members = ((await DB.prepare(`SELECT t.user_id, t.discount_pct, t.company, t.website, t.updated_at, u.email, u.user_metadata, (SELECT COUNT(*) FROM order_requests o WHERE o.user_id = t.user_id) orders, (SELECT COALESCE(SUM(o.estimated_total),0) FROM order_requests o WHERE o.user_id = t.user_id) spent FROM customer_terms t LEFT JOIN auth_users u ON u.id = t.user_id WHERE t.trade_status = 'approved' ORDER BY t.updated_at DESC`).all()).results ?? []) as any[];
    return j({ apps, members: members.map((x) => ({ ...x, name: parse(x.user_metadata, {})?.full_name ?? "", user_metadata: undefined })), roles: ROLES, settings: pro });
  }
  let mm = q.match(/^apps\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") {
    const a: any = await DB.prepare(`SELECT * FROM pro_applications WHERE id = ?`).bind(mm[1]).first();
    if (!a) return bad("Application not found", 404);
    const note = str(body.note, 1000); const now = new Date().toISOString();
    if (body.action === "approve") {
      const pct = Math.max(0, Math.min(80, Number(body.discountPct ?? pro.discountPct) || 0));
      await DB.prepare(`UPDATE pro_applications SET status = 'approved', decision_note = ?, decided_at = ?, decided_by = ? WHERE id = ?`).bind(note || null, now, who.email ?? who.uid, a.id).run();
      await DB.prepare(`INSERT INTO customer_terms (user_id, trade, trade_status, discount_pct, company) VALUES (?, 1, 'approved', ?, ?) ON CONFLICT(user_id) DO UPDATE SET trade = 1, trade_status = 'approved', discount_pct = excluded.discount_pct, company = COALESCE(customer_terms.company, excluded.company), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(a.user_id, pct, a.business).run();
      if (a.email) await queueEmail(env, a.email, `Welcome to ${name}`, `Good news, ${a.business}: you're approved for ${name}.\n\nYour ${pct}% professional discount is applied automatically in your cart and at checkout when you're signed in${pro.freeSamples ? ", and samples are free" : ""}.${note ? `\n\n${note}` : ""}`, "pro_approved");
      return j({ ok: true });
    }
    if (body.action === "decline") {
      await DB.prepare(`UPDATE pro_applications SET status = 'declined', decision_note = ?, decided_at = ?, decided_by = ? WHERE id = ?`).bind(note || null, now, who.email ?? who.uid, a.id).run();
      await DB.prepare(`UPDATE customer_terms SET trade_status = 'rejected', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND trade_status != 'approved'`).bind(a.user_id).run();
      if (a.email) await queueEmail(env, a.email, `Your ${name} application`, `Thank you for applying to ${name}, ${a.business}. We weren't able to approve the application at this time.${note ? `\n\n${note}` : ""}\n\nYou're welcome to reply with more details about your business.`, "pro_declined");
      return j({ ok: true });
    }
    return bad("Unknown action");
  }
  mm = q.match(/^members\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") {
    if (body.remove) { await DB.prepare(`UPDATE customer_terms SET trade_status = NULL, trade = 0, discount_pct = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`).bind(mm[1]).run(); return j({ ok: true }); }
    const pct = Math.max(0, Math.min(80, Number(body.discountPct) || 0));
    await DB.prepare(`UPDATE customer_terms SET discount_pct = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`).bind(pct, mm[1]).run();
    return j({ ok: true });
  }
  if (q === "signups" && m === "GET") {
    const rows = ((await DB.prepare(`SELECT email, code, pct, source, page, used_at, cart_id, created_at FROM first_order_codes ORDER BY created_at DESC LIMIT 5000`).all()).results ?? []) as any[];
    return j({ signups: rows, settings: pop });
  }
  return bad("not found", 404);
}
