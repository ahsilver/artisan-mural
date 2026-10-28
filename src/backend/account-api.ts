// Customer account: store credit, coupons, tax, trade pricing, saved addresses, reorder.
import type { Who } from "./policies";
import { getSettings } from "./app-api";
import { firstOrderCode } from "./pro-api";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function creditBalance(env: Env, uid: string) { const r: any = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) t FROM store_credit WHERE user_id = ?`).bind(uid).first(); return r2(r?.t ?? 0); }
async function terms(env: Env, uid: string) { return (await env.DB.prepare(`SELECT * FROM customer_terms WHERE user_id = ?`).bind(uid).first()) as any; }

/** Prices one checkout: trade/special discount, coupon, shipping, tax, store credit. */
export async function quote(env: Env, uid: string, subtotal: number, opt: { coupon?: string; state?: string; useCredit?: boolean; cartId?: string | null }) {
  const s = await getSettings(env);
  const t = await terms(env, uid);
  const out: any = { subtotal: r2(subtotal), special: 0, coupon: null, couponDiscount: 0, couponError: null, shipping: 0, tax: 0, credit: 0, due: 0, netTerms: !!t?.net_terms };
  const pct = t && (t.trade_status === "approved" || !t.trade) ? Number(t.discount_pct) || 0 : 0;
  if (pct > 0) out.special = r2(subtotal * pct / 100);
  const proName = (s.pro?.name as string) || "Artisan Pro";
  if (t?.trade_status === "approved") { out.proName = proName; out.proPct = pct; }
  let base = subtotal - out.special;
  const code = String(opt.coupon || "").trim().toUpperCase();
  const fo = code ? await firstOrderCode(env, uid, code, opt.cartId) : null;
  if (fo) {
    if (fo.error) out.couponError = fo.error;
    else {
      const d = r2(subtotal * Number(fo.row.pct) / 100);
      if (d > out.special) { out.special = 0; base = subtotal - d; out.coupon = code; out.couponDiscount = d; out.firstOrder = true; out.couponLabel = `First order ${Number(fo.row.pct)}% off`; }
      else out.couponError = `Your ${proName} discount is already better than this code, so we kept it.`;
    }
  } else if (code) {
    const c: any = await env.DB.prepare(`SELECT * FROM coupons WHERE code = ?`).bind(code).first();
    const used: any = c ? await env.DB.prepare(`SELECT COUNT(*) n FROM coupon_uses WHERE code = ? AND user_id = ?`).bind(code, uid).first() : null;
    if (!c || !c.active) out.couponError = "That code isn't valid.";
    else if (c.expires_at && c.expires_at < new Date().toISOString()) out.couponError = "That code has expired.";
    else if (c.max_uses && c.uses >= c.max_uses) out.couponError = "That code has been used up.";
    else if (c.per_customer && Number(used?.n ?? 0) >= c.per_customer) out.couponError = "You've already used that code.";
    else if (base < Number(c.min_order || 0)) out.couponError = `That code needs an order of $${Number(c.min_order).toFixed(2)} or more.`;
    else { out.coupon = code; out.couponDiscount = r2(Math.min(base, c.kind === "fixed" ? Number(c.value) : base * Number(c.value) / 100)); base -= out.couponDiscount; }
  }
  const sh = s.shipping ?? {};
  out.shipping = r2(Number(sh.freeOver) > 0 && subtotal >= Number(sh.freeOver) ? 0 : Number(sh.flatRate) || 0);
  const tax = s.tax ?? {};
  const states = String(tax.states || "").split(",").map((x: string) => x.trim().toUpperCase()).filter(Boolean);
  const st = String(opt.state || "").trim().toUpperCase();
  if (tax.enabled && Number(tax.rate) > 0 && (!states.length || states.includes(st)) && !(t?.trade_status === "approved" && tax.tradeExempt)) out.tax = r2((base + (tax.shippingTaxable ? out.shipping : 0)) * Number(tax.rate) / 100);
  out.taxLabel = tax.label || "Sales tax";
  let total = base + out.shipping + out.tax;
  if (opt.useCredit) { const bal = await creditBalance(env, uid); out.credit = r2(Math.min(bal, total)); total -= out.credit; out.creditBalance = bal; }
  out.due = r2(total);
  return out;
}

export async function accountRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any): Promise<Response> {
  if (!who.uid) return bad("Please sign in.", 401);
  const DB = env.DB; const uid = who.uid;
  if (p === "me") {
    const t = await terms(env, uid);
    const prof: any = await DB.prepare(`SELECT status FROM designer_profiles WHERE user_id = ?`).bind(uid).first();
    const ledger = (await DB.prepare(`SELECT amount, kind, note, created_at FROM store_credit WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`).bind(uid).all()).results ?? [];
    const addresses = (await DB.prepare(`SELECT * FROM saved_addresses WHERE user_id = ? ORDER BY created_at DESC`).bind(uid).all()).results ?? [];
    return j({ credit: await creditBalance(env, uid), ledger, addresses, designer: prof ? prof.status : null, trade: t ? { status: t.trade_status ?? (t.trade ? "approved" : null), company: t.company, discountPct: t.discount_pct, netTerms: !!t.net_terms } : null });
  }
  if (p === "quote" && m === "POST") return j(await quote(env, uid, Number(body.subtotal) || 0, body));
  if (p === "finalize" && m === "POST") {
    const rows = ((await DB.prepare(`SELECT id, estimated_total FROM order_requests WHERE cart_id = ? AND user_id = ?`).bind(body.cartId, uid).all()).results ?? []) as any[];
    if (!rows.length) return bad("Order not found", 404);
    const sub = rows.reduce((n, r) => n + Number(r.estimated_total), 0);
    const q = await quote(env, uid, sub, { ...body, cartId: body.cartId });
    // spread discounts, tax, credit over the cart's lines
    for (const r of rows) {
      const share = sub ? Number(r.estimated_total) / sub : 1 / rows.length;
      const disc = r2((q.special + q.couponDiscount) * share), tax = r2(q.tax * share), cr = r2(q.credit * share), shp = r2(q.shipping * share);
      await DB.prepare(`UPDATE order_requests SET discount = ?, coupon = ?, tax = ?, credit_applied = ?, amount_due = ?, payment_method = COALESCE(payment_method, ?) WHERE id = ?`).bind(disc, q.coupon, tax, cr, r2(Number(r.estimated_total) - disc + tax + shp - cr), q.netTerms ? "Net terms" : null, r.id).run();
    }
    if (q.coupon && q.firstOrder) await DB.prepare(`UPDATE first_order_codes SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), used_by = ?, cart_id = ? WHERE code = ?`).bind(uid, body.cartId, q.coupon).run();
    else if (q.coupon) { await DB.prepare(`INSERT INTO coupon_uses (id, code, user_id, cart_id, amount) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), q.coupon, uid, body.cartId, q.couponDiscount).run(); await DB.prepare(`UPDATE coupons SET uses = uses + 1 WHERE code = ?`).bind(q.coupon).run(); }
    if (q.credit > 0) await DB.prepare(`INSERT INTO store_credit (id, user_id, amount, kind, ref, note) VALUES (?, ?, ?, 'spend', ?, ?)`).bind(crypto.randomUUID(), uid, -q.credit, body.cartId, "Used at checkout").run();
    return j(q);
  }
  if (p === "addresses" && m === "POST") {
    const b = body; if (!b.address) return bad("Address needed");
    const id = b.id || crypto.randomUUID();
    await DB.prepare(`INSERT INTO saved_addresses (id, user_id, label, name, phone, address, city, state, postal, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, name = excluded.name, phone = excluded.phone, address = excluded.address, city = excluded.city, state = excluded.state, postal = excluded.postal, country = excluded.country`).bind(id, uid, b.label || "Home", b.name || "", b.phone || "", b.address, b.city || "", b.state || "", b.postal || "", b.country || "").run();
    return j({ ok: true, id });
  }
  let mm = p.match(/^addresses\/([0-9a-f-]{36})$/);
  if (mm && m === "DELETE") { await DB.prepare(`DELETE FROM saved_addresses WHERE id = ? AND user_id = ?`).bind(mm[1], uid).run(); return j({ ok: true }); }
  mm = p.match(/^reorder\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") {
    const o: any = await DB.prepare(`SELECT cart_id FROM order_requests WHERE id = ? AND user_id = ?`).bind(mm[1], uid).first();
    if (!o) return bad("Order not found", 404);
    const rows = ((o.cart_id ? await DB.prepare(`SELECT design_slug, finish, selection FROM order_requests WHERE cart_id = ? AND user_id = ?`).bind(o.cart_id, uid).all() : await DB.prepare(`SELECT design_slug, finish, selection FROM order_requests WHERE id = ?`).bind(mm[1]).all()).results ?? []) as any[];
    return j({ items: rows.map((r) => ({ design: r.design_slug, finish: r.finish, selection: JSON.parse(r.selection || "{}") })) });
  }
  if (p === "trade" && m === "POST") {
    if (!body.company) return bad("Company name needed");
    await DB.prepare(`INSERT INTO customer_terms (user_id, trade, trade_status, company, website, note) VALUES (?, 1, 'pending', ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET trade = 1, trade_status = CASE WHEN trade_status = 'approved' THEN 'approved' ELSE 'pending' END, company = excluded.company, website = excluded.website, note = excluded.note`).bind(uid, String(body.company).slice(0, 120), body.website || null, body.note || null).run();
    return j({ ok: true });
  }
  return bad("not found", 404);
}
