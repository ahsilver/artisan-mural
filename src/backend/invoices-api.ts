// Customers (CRM) + invoices for the owner back office. Mounted from app-api.ts adminRoutes: crm/*, invoices*.
import type { Who } from "./policies";
import { getSettings } from "./app-api";
type Env = any;
export const j = (body: any, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
export const bad = (msg: string, status = 400) => j({ error: msg }, status);
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const nowIso = () => new Date().toISOString();
export const parseJ = (v: any, d: any = null) => { if (v == null) return d; try { return JSON.parse(v); } catch { return d; } };
export const UUID = /^[0-9a-f-]{36}$/;
export const s = (v: any, n = 500) => (v == null ? null : String(v).trim().slice(0, n) || null);
export const isDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const METHODS = ["card", "check", "cash", "zelle", "other"];
export const SQL_UUID = `lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))`;

export const INVOICE_DEFAULTS = { businessName: "", address: "", phone: "", email: "", website: "", logoUrl: "", prefix: "INV-", startNumber: 1001, dueDays: 30, taxRate: 0, ratePerSqft: "", footer: "", notes: "Thank you for your business.", estPrefix: "EST-", estStartNumber: 1001, estValidDays: 30, estTerms: "This estimate is valid until the date shown. Final price is confirmed once wall measurements are checked.", estNotes: "" };

export function today(tz = "America/New_York") {
  try { return new Date().toLocaleDateString("en-CA", { timeZone: tz }); } catch { return new Date().toISOString().slice(0, 10); }
}
export const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Shown status: draft | sent | partial | paid | void, plus overdue flag.
export function shown(inv: any, td: string) {
  const balance = r2(Number(inv.total) - Number(inv.paid));
  let st = inv.status === "void" ? "void" : inv.status === "draft" ? "draft" : balance <= 0.004 && Number(inv.total) > 0 ? "paid" : Number(inv.paid) > 0 ? "partial" : balance <= 0.004 ? "paid" : "sent";
  const overdue = (st === "sent" || st === "partial") && !!inv.due_date && inv.due_date < td;
  return { ...inv, balance: st === "void" ? 0 : balance, shown: st, overdue };
}

/** Pull accounts and order customers into the customer list (one row per email; manual orders without email, per name). */
export async function syncCustomers(DB: any) {
  await DB.batch([
    DB.prepare(`UPDATE crm_customers SET user_id = (SELECT u.id FROM auth_users u WHERE lower(u.email) = lower(crm_customers.email) LIMIT 1) WHERE user_id IS NULL AND email IS NOT NULL AND email <> '' AND EXISTS (SELECT 1 FROM auth_users u WHERE lower(u.email) = lower(crm_customers.email))`),
    DB.prepare(`INSERT INTO crm_customers (id, name, email, user_id, source, created_at) SELECT ${SQL_UUID}, COALESCE(json_extract(u.user_metadata, '$.full_name'), ''), u.email, u.id, 'account', u.created_at FROM auth_users u WHERE u.email LIKE '%@%' AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AND NOT EXISTS (SELECT 1 FROM crm_customers c WHERE c.user_id = u.id OR lower(c.email) = lower(u.email))`),
    DB.prepare(`INSERT INTO crm_customers (id, name, email, phone, address, source, created_at) SELECT ${SQL_UUID}, MAX(o.customer_name), MAX(o.customer_email), MAX(o.phone), MAX(o.shipping_address), 'order', MIN(o.created_at) FROM order_requests o WHERE o.customer_email LIKE '%@%' AND NOT EXISTS (SELECT 1 FROM crm_customers c WHERE lower(c.email) = lower(o.customer_email)) GROUP BY lower(o.customer_email)`),
    DB.prepare(`INSERT INTO crm_customers (id, name, phone, address, source, created_at) SELECT ${SQL_UUID}, MAX(o.customer_name), MAX(o.phone), MAX(o.shipping_address), 'order', MIN(o.created_at) FROM order_requests o WHERE (o.customer_email IS NULL OR o.customer_email = '') AND o.customer_name <> '' AND NOT EXISTS (SELECT 1 FROM crm_customers c WHERE lower(c.name) = lower(o.customer_name)) GROUP BY lower(o.customer_name)`),
    DB.prepare(`UPDATE crm_customers SET phone = COALESCE(phone, (SELECT o.phone FROM order_requests o WHERE lower(o.customer_email) = lower(crm_customers.email) AND o.phone IS NOT NULL ORDER BY o.created_at DESC LIMIT 1)), ship_address = COALESCE(ship_address, (SELECT o.shipping_address FROM order_requests o WHERE (lower(o.customer_email) = lower(crm_customers.email) OR o.user_id = crm_customers.user_id) AND o.shipping_address <> '' ORDER BY o.created_at DESC LIMIT 1)) WHERE phone IS NULL OR ship_address IS NULL`),
  ]);
}
export const ORDER_MATCH = `(o.user_id = c.user_id OR (c.email IS NOT NULL AND c.email <> '' AND lower(o.customer_email) = lower(c.email)) OR ((c.email IS NULL OR c.email = '') AND (o.customer_email IS NULL OR o.customer_email = '') AND lower(o.customer_name) = lower(c.name)))`;

export async function nextNumber(DB: any, start: number) {
  const r: any = await DB.prepare(`SELECT MAX(number) n FROM invoices`).first();
  return Math.max(Number(r?.n || 0) + 1, Number(start) || 1001);
}
export function calc(lines: any[], dType: string, dValue: number, taxRate: number) {
  const ls = lines.map((l, i) => {
    const qty = Math.max(0, Number(l.qty) || 0), rate = Number(l.rate) || 0;
    return { kind: l.kind === "fixed" ? "fixed" : "sqft", description: s(l.description, 300) ?? "", design_slug: s(l.design_slug, 80), design_title: s(l.design_title, 120), qty: Math.round(qty * 100) / 100, rate: Math.round(rate * 10000) / 10000, amount: r2(qty * rate), pos: i };
  });
  const subtotal = r2(ls.reduce((n, l) => n + l.amount, 0));
  const dv = Math.max(0, Number(dValue) || 0);
  const discount = Math.min(subtotal, r2(dType === "percent" ? subtotal * Math.min(100, dv) / 100 : dv));
  const tr = Math.max(0, Math.min(30, Number(taxRate) || 0));
  const tax = r2((subtotal - discount) * tr / 100);
  return { lines: ls, subtotal, discount, tax, taxRate: tr, dType: dType === "percent" ? "percent" : "amount", dValue: dv, total: r2(subtotal - discount + tax) };
}
export async function refreshPaid(DB: any, id: string) {
  await DB.prepare(`UPDATE invoices SET paid = (SELECT COALESCE(SUM(amount),0) FROM invoice_payments WHERE invoice_id = ?), updated_at = ? WHERE id = ?`).bind(id, nowIso(), id).run();
}
export function billTo(c: any) { return JSON.stringify({ name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address || c.ship_address }); }

export async function loadInvoice(env: Env, id: string) {
  const DB = env.DB;
  const inv: any = await DB.prepare(`SELECT i.*, c.name customer_name, c.company customer_company, c.email customer_email FROM invoices i LEFT JOIN crm_customers c ON c.id = i.customer_id WHERE i.id = ?`).bind(id).first();
  if (!inv) return null;
  const st = await getSettings(env);
  const td = today(st.general?.timezone);
  const lines = (await DB.prepare(`SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY pos`).bind(id).all()).results ?? [];
  const payments = (await DB.prepare(`SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on, created_at`).bind(id).all()).results ?? [];
  const estimate = inv.estimate_id ? await DB.prepare(`SELECT id, number FROM estimates WHERE id = ?`).bind(inv.estimate_id).first() : null;
  const order = inv.order_id ? await DB.prepare(`SELECT id, created_at, status, design_slug FROM order_requests WHERE id = ?`).bind(inv.order_id).first() : null;
  return { invoice: { ...shown(inv, td), bill_to: parseJ(inv.bill_to, {}) }, lines, payments, order, estimate, business: business(st), today: td };
}
export function business(st: any) {
  const b = { ...INVOICE_DEFAULTS, ...(st.invoices ?? {}) };
  return { name: b.businessName || st.general?.siteName || "Artisan Mural", address: b.address, phone: b.phone || st.general?.contactPhone || "", email: b.email || st.general?.contactEmail || "", website: b.website, logoUrl: b.logoUrl, prefix: b.prefix ?? "INV-", footer: b.footer, notes: b.notes, dueDays: Number(b.dueDays) || 0, taxRate: Number(b.taxRate) || 0, ratePerSqft: Number(b.ratePerSqft) || Number(st.general?.pricePerSqft) || 0, startNumber: Number(b.startNumber) || 1001, estPrefix: b.estPrefix ?? "EST-", estStartNumber: Number(b.estStartNumber) || 1001, estValidDays: Number(b.estValidDays) || 0, estTerms: b.estTerms ?? "", estNotes: b.estNotes ?? "" };
}
export const csvCell = (v: any) => { const x = v == null ? "" : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };

export async function billingRoutes(env: Env, who: Who, p: string, m: string, body: any, sp: URLSearchParams): Promise<Response> {
  const DB = env.DB;
  // ---------- customers ----------
  if (p === "crm/customers" && m === "GET") {
    await syncCustomers(DB);
    const st = await getSettings(env); const td = today(st.general?.timezone);
    const rows = (await DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM order_requests o WHERE ${ORDER_MATCH}) orders, (SELECT COALESCE(SUM(o.estimated_total),0) FROM order_requests o WHERE ${ORDER_MATCH} AND o.status NOT IN ('cancelled','refunded')) order_total, (SELECT MAX(o.created_at) FROM order_requests o WHERE ${ORDER_MATCH}) last_order, (SELECT COALESCE(SUM(total),0) FROM invoices i WHERE i.customer_id = c.id AND i.status <> 'void' AND i.status <> 'draft') invoiced, (SELECT COALESCE(SUM(total - paid),0) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'sent') owed, (SELECT COALESCE(SUM(total - paid),0) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'sent' AND i.due_date < ? AND total - paid > 0.004) overdue, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) invoices, t.trade_status, t.company trade_company, (SELECT status FROM designer_profiles d WHERE d.user_id = c.user_id) designer FROM crm_customers c LEFT JOIN customer_terms t ON t.user_id = c.user_id ORDER BY lower(COALESCE(NULLIF(c.name, ''), c.email)) LIMIT 3000`).bind(td).all()).results ?? [];
    return j({ customers: rows.map((c: any) => ({ ...c, owed: r2(c.owed), overdue: r2(c.overdue), invoiced: r2(c.invoiced), order_total: r2(c.order_total), company: c.company || c.trade_company || null })) });
  }
  if (p === "crm/customers" && m === "POST") {
    const name = s(body.name, 120); const email = s(body.email, 200)?.toLowerCase() ?? null;
    if (!name && !email) return bad("Add a name or an email.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("That email doesn't look right.");
    if (email) { const ex: any = await DB.prepare(`SELECT id, name FROM crm_customers WHERE lower(email) = ?`).bind(email).first(); if (ex) return bad(`${ex.name || email} is already a customer.`); }
    const id = crypto.randomUUID();
    const u: any = email ? await DB.prepare(`SELECT id FROM auth_users WHERE lower(email) = ?`).bind(email).first() : null;
    await DB.prepare(`INSERT INTO crm_customers (id, name, company, email, phone, address, ship_address, notes, user_id, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`).bind(id, name ?? "", s(body.company, 120), email, s(body.phone, 40), s(body.address, 400), s(body.shipAddress, 400), s(body.notes, 4000), u?.id ?? null, nowIso()).run();
    return j({ id });
  }
  let mm = p.match(/^crm\/customers\/([0-9a-f-]{36})$/);
  if (mm && m === "GET") {
    const c: any = await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(mm[1]).first();
    if (!c) return bad("Customer not found.", 404);
    const st = await getSettings(env); const td = today(st.general?.timezone);
    const orders = (await DB.prepare(`SELECT o.id, o.created_at, o.status, o.design_slug, o.finish, o.square_feet, o.estimated_total, o.payment_method, COALESCE((SELECT a.title FROM artwork_uploads a WHERE 'u-' || a.id = o.design_slug), (SELECT d.title FROM design_overrides d WHERE d.slug = o.design_slug), json_extract(o.print_design_snapshot, '$.title')) design_title, (SELECT i.id FROM invoices i WHERE i.order_id = o.id AND i.status <> 'void' LIMIT 1) invoice_id FROM order_requests o, (SELECT ? AS user_id, ? AS email, ? AS name) c WHERE ${ORDER_MATCH} ORDER BY o.created_at DESC LIMIT 200`).bind(c.user_id, c.email, c.name).all()).results ?? [];
    const invoices = ((await DB.prepare(`SELECT * FROM invoices WHERE customer_id = ? ORDER BY number DESC`).bind(c.id).all()).results ?? []).map((i: any) => shown(i, td));
    const { estShown } = await import("./estimates-api");
    const estimates = ((await DB.prepare(`SELECT * FROM estimates WHERE customer_id = ? ORDER BY number DESC`).bind(c.id).all()).results ?? []).map((e: any) => estShown(e, td));
    let account: any = null;
    if (c.user_id) {
      account = await DB.prepare(`SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned, (SELECT status FROM designer_profiles p WHERE p.user_id = u.id) designer, (SELECT COALESCE(SUM(amount),0) FROM store_credit x WHERE x.user_id = u.id) credit, t.trade_status, t.company, t.discount_pct, t.net_terms, t.website, t.note trade_note FROM auth_users u LEFT JOIN customer_terms t ON t.user_id = u.id WHERE u.id = ?`).bind(c.user_id).first();
      if (account) account = { ...account, banned: !!account.banned, net_terms: !!account.net_terms, credit: r2(account.credit) };
    }
    const live = invoices.filter((i: any) => i.shown !== "void" && i.shown !== "draft");
    const sum = { invoiced: r2(live.reduce((n: number, i: any) => n + Number(i.total), 0)), paid: r2(live.reduce((n: number, i: any) => n + Number(i.paid), 0)), owed: r2(live.reduce((n: number, i: any) => n + i.balance, 0)), overdue: r2(live.filter((i: any) => i.overdue).reduce((n: number, i: any) => n + i.balance, 0)), orders: orders.length, orderTotal: r2(orders.filter((o: any) => !["cancelled", "refunded"].includes(o.status)).reduce((n: number, o: any) => n + Number(o.estimated_total), 0)) };
    return j({ customer: c, orders, invoices, estimates, account, summary: sum, prefix: business(st).prefix, estPrefix: business(st).estPrefix });
  }
  if (mm && m === "POST") {
    const c: any = await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(mm[1]).first();
    if (!c) return bad("Customer not found.", 404);
    if (body.delete) {
      const n: any = await DB.prepare(`SELECT COUNT(*) n FROM invoices WHERE customer_id = ?`).bind(c.id).first();
      if (n?.n) return bad("This customer has invoices. Void or delete them first.");
      const ne: any = await DB.prepare(`SELECT COUNT(*) n FROM estimates WHERE customer_id = ?`).bind(c.id).first();
      if (ne?.n) return bad("This customer has estimates. Delete them first.");
      if (c.user_id) return bad("This customer has a website account, so they stay in the list.");
      const o: any = await DB.prepare(`SELECT COUNT(*) n FROM order_requests o, (SELECT ? AS user_id, ? AS email, ? AS name) c WHERE ${ORDER_MATCH}`).bind(c.user_id, c.email, c.name).first();
      if (o?.n) return bad("This customer has orders, so they stay in the list.");
      await DB.prepare(`DELETE FROM crm_customers WHERE id = ?`).bind(c.id).run();
      return j({ ok: true, deleted: true });
    }
    const f: Record<string, any> = {};
    for (const [k, col, n] of [["name", "name", 120], ["company", "company", 120], ["email", "email", 200], ["phone", "phone", 40], ["address", "address", 400], ["shipAddress", "ship_address", 400], ["notes", "notes", 4000]] as [string, string, number][]) if (k in body) f[col] = s(body[k], n);
    if ("email" in f && f.email) {
      f.email = f.email.toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return bad("That email doesn't look right.");
      const ex: any = await DB.prepare(`SELECT id FROM crm_customers WHERE lower(email) = ? AND id <> ?`).bind(f.email, c.id).first(); if (ex) return bad("Another customer already has that email.");
    }
    if ("name" in f) f.name = f.name ?? "";
    const keys = Object.keys(f);
    if (keys.length) await DB.prepare(`UPDATE crm_customers SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => f[k]), nowIso(), c.id).run();
    return j({ ok: true });
  }

  // ---------- invoices ----------
  if (p === "invoices" && m === "GET") {
    const st = await getSettings(env); const td = today(st.general?.timezone);
    const where: string[] = []; const params: any[] = [];
    if (isDate(sp.get("from"))) { where.push("i.issue_date >= ?"); params.push(sp.get("from")); }
    if (isDate(sp.get("to"))) { where.push("i.issue_date <= ?"); params.push(sp.get("to")); }
    if (sp.get("customer") && UUID.test(sp.get("customer")!)) { where.push("i.customer_id = ?"); params.push(sp.get("customer")); }
    if (sp.get("order") && UUID.test(sp.get("order")!)) { where.push("i.order_id = ?"); params.push(sp.get("order")); }
    const q = (sp.get("q") || "").trim();
    if (q) { const qn = q.replace(/\D/g, ""); where.push("(c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR CAST(i.number AS TEXT) LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${qn || q}%`); }
    const rows = ((await DB.prepare(`SELECT i.id, i.number, i.customer_id, i.order_id, i.status, i.issue_date, i.due_date, i.subtotal, i.discount, i.tax, i.total, i.paid, i.sent_at, i.created_at, c.name customer_name, c.company customer_company, c.email customer_email FROM invoices i LEFT JOIN crm_customers c ON c.id = i.customer_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY i.number DESC LIMIT 2000`).bind(...params).all()).results ?? []).map((i: any) => shown(i, td));
    const stf = sp.get("status") || "";
    const list = rows.filter((i: any) => !stf || stf === "all" || (stf === "overdue" ? i.overdue : stf === "open" ? i.shown === "sent" || i.shown === "partial" : i.shown === stf));
    const live = list.filter((i: any) => i.shown !== "void" && i.shown !== "draft");
    const totals = { count: list.length, invoiced: r2(live.reduce((n: number, i: any) => n + Number(i.total), 0)), paid: r2(live.reduce((n: number, i: any) => n + Number(i.paid), 0)), open: r2(live.reduce((n: number, i: any) => n + i.balance, 0)), overdue: r2(live.filter((i: any) => i.overdue).reduce((n: number, i: any) => n + i.balance, 0)), drafts: list.filter((i: any) => i.shown === "draft").length };
    const prefix = business(st).prefix;
    if (sp.get("format") === "csv") {
      const head = ["Invoice", "Customer", "Company", "Email", "Date", "Due", "Status", "Overdue", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance"];
      const lab: any = { draft: "Draft", sent: "Sent", partial: "Partly paid", paid: "Paid", void: "Void" };
      const out = [head.join(","), ...list.map((i: any) => [prefix + i.number, i.customer_name, i.customer_company, i.customer_email, i.issue_date, i.due_date, lab[i.shown], i.overdue ? "yes" : "", i.subtotal, i.discount, i.tax, i.total, i.paid, i.balance].map(csvCell).join(","))].join("\n");
      return new Response(out, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="invoices-${td}.csv"` } });
    }
    return j({ invoices: list, totals, prefix, today: td });
  }
  if (p === "invoices/new" && m === "GET") {
    const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
    return j({ business: b, number: await nextNumber(DB, b.startNumber), issueDate: td, dueDate: b.dueDays ? addDays(td, b.dueDays) : td, methods: METHODS });
  }
  if (p === "invoices/from-order" && m === "POST") {
    if (!UUID.test(String(body.orderId || ""))) return bad("Order missing.");
    const ex: any = await DB.prepare(`SELECT id FROM invoices WHERE order_id = ? AND status <> 'void' LIMIT 1`).bind(body.orderId).first();
    if (ex) return j({ id: ex.id, existing: true });
    const dr = await orderDraft(DB, body.orderId);
    if (dr.error) return bad(dr.error, dr.status);
    const { o, c, k } = dr;
    const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
    const id = crypto.randomUUID(); const num = await nextNumber(DB, b.startNumber);
    const paidWithOrder = o.status !== "awaiting_payment" && o.status !== "cancelled" && !/invoice/i.test(o.payment_method || "") && k.total > 0;
    const stmts = [DB.prepare(`INSERT INTO invoices (id, number, customer_id, order_id, status, issue_date, due_date, discount_type, discount_value, tax_rate, subtotal, discount, tax, total, paid, notes, bill_to, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'amount', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).bind(id, num, c.id, o.id, paidWithOrder ? "sent" : "draft", td, b.dueDays ? addDays(td, b.dueDays) : td, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, b.notes || null, billTo({ ...c, address: c.address || o.shipping_address }), nowIso())];
    for (const l of k.lines) stmts.push(DB.prepare(`INSERT INTO invoice_lines (id, invoice_id, pos, kind, description, design_slug, design_title, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, l.pos, l.kind, l.description, l.design_slug, l.design_title, l.qty, l.rate, l.amount));
    // An order already marked paid gets its payment recorded too.
    if (paidWithOrder) stmts.push(DB.prepare(`INSERT INTO invoice_payments (id, invoice_id, paid_on, amount, method, note) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, String(o.created_at).slice(0, 10), k.total, /card/i.test(o.payment_method || "card") ? "card" : /check/i.test(o.payment_method) ? "check" : /cash/i.test(o.payment_method) ? "cash" : /zelle/i.test(o.payment_method) ? "zelle" : "other", `Paid with the order${o.payment_method ? ` (${o.payment_method})` : ""}`));
    await DB.batch(stmts); await refreshPaid(DB, id);
    return j({ id });
  }
  if (p === "invoices" && m === "POST") return saveInvoice(env, null, body);
  mm = p.match(/^invoices\/([0-9a-f-]{36})$/);
  if (mm && m === "GET") { const r = await loadInvoice(env, mm[1]); return r ? j(r) : bad("Invoice not found.", 404); }
  if (mm && m === "POST") {
    const inv: any = await DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(mm[1]).first();
    if (!inv) return bad("Invoice not found.", 404);
    const a = body.action;
    if (a === "send") { await DB.prepare(`UPDATE invoices SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ? AND status = 'draft'`).bind(nowIso(), nowIso(), inv.id).run(); return j({ ok: true }); }
    if (a === "draft") { if (Number(inv.paid) > 0) return bad("This invoice has payments, so it can't go back to draft."); await DB.prepare(`UPDATE invoices SET status = 'draft', updated_at = ? WHERE id = ? AND status = 'sent'`).bind(nowIso(), inv.id).run(); return j({ ok: true }); }
    if (a === "void") { await DB.prepare(`UPDATE invoices SET status = 'void', voided_at = ?, updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), inv.id).run(); return j({ ok: true }); }
    if (a === "unvoid") { await DB.prepare(`UPDATE invoices SET status = CASE WHEN sent_at IS NULL THEN 'draft' ELSE 'sent' END, voided_at = NULL, updated_at = ? WHERE id = ? AND status = 'void'`).bind(nowIso(), inv.id).run(); return j({ ok: true }); }
    if (a === "delete") {
      if (inv.status !== "draft" && inv.status !== "void") return bad("Only a draft or void invoice can be deleted. Void it first.");
      await DB.batch([DB.prepare(`DELETE FROM invoice_lines WHERE invoice_id = ?`).bind(inv.id), DB.prepare(`DELETE FROM invoice_payments WHERE invoice_id = ?`).bind(inv.id), DB.prepare(`DELETE FROM invoices WHERE id = ?`).bind(inv.id), DB.prepare(`UPDATE estimates SET invoice_id = NULL, updated_at = ? WHERE invoice_id = ?`).bind(nowIso(), inv.id)]);
      return j({ ok: true, deleted: true });
    }
    if (a === "payment") {
      if (inv.status === "void") return bad("This invoice is void.");
      const amt = r2(Number(body.amount));
      if (!(amt > 0)) return bad("Enter the amount paid.");
      const method = METHODS.includes(body.method) ? body.method : "other";
      const on = isDate(body.date) ? body.date : today((await getSettings(env)).general?.timezone);
      await DB.prepare(`INSERT INTO invoice_payments (id, invoice_id, paid_on, amount, method, note) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), inv.id, on, amt, method, s(body.note, 300)).run();
      if (inv.status === "draft") await DB.prepare(`UPDATE invoices SET status = 'sent', updated_at = ? WHERE id = ?`).bind(nowIso(), inv.id).run();
      await refreshPaid(DB, inv.id);
      return j({ ok: true });
    }
    if (a === "delete-payment") {
      if (!UUID.test(String(body.paymentId || ""))) return bad("Payment missing.");
      await DB.prepare(`DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ?`).bind(body.paymentId, inv.id).run();
      await refreshPaid(DB, inv.id); return j({ ok: true });
    }
    if (a === "email") {
      const full = await loadInvoice(env, inv.id);
      const to = s(body.to, 200) || full!.invoice.bill_to?.email || full!.invoice.customer_email;
      if (!to || !/@/.test(to)) return bad("This customer has no email. Add one on the customer page.");
      const b = full!.business; const iv = full!.invoice; const no = b.prefix + iv.number;
      const money = (n: number) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
      const text = `Hello ${iv.bill_to?.name || iv.customer_name || ""},\n\nHere is invoice ${no} from ${b.name}.\n\n${full!.lines.map((l: any) => `${l.description}: ${l.kind === "sqft" ? `${l.qty} sq ft x ${money(l.rate)} = ` : l.qty !== 1 ? `${l.qty} x ${money(l.rate)} = ` : ""}${money(l.amount)}`).join("\n")}\n\nTotal: ${money(iv.total)}${iv.paid > 0 ? `\nPaid: ${money(iv.paid)}` : ""}\nBalance due: ${money(iv.balance)}${iv.due_date ? `\nDue: ${iv.due_date}` : ""}${b.footer ? `\n\n${b.footer}` : ""}\n\nThank you,\n${b.name}`;
      await DB.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind) VALUES (?, ?, ?, ?, ?, 'invoice')`).bind(crypto.randomUUID(), to, `Invoice ${no} from ${b.name}`, `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`, text).run();
      await DB.prepare(`UPDATE invoices SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), inv.id).run();
      return j({ ok: true, to, testMode: true });
    }
    return saveInvoice(env, inv, body);
  }
  return bad("Not found", 404);
}

/** Lines, discount and tax for an invoice or estimate made from an order. */
export async function orderDraft(DB: any, orderId: string): Promise<any> {
    const o: any = await DB.prepare(`SELECT o.*, COALESCE((SELECT a.title FROM artwork_uploads a WHERE 'u-' || a.id = o.design_slug), (SELECT d.title FROM design_overrides d WHERE d.slug = o.design_slug), json_extract(o.print_design_snapshot, '$.title')) design_title, (SELECT name FROM material_settings WHERE id = o.finish) finish_name FROM order_requests o WHERE o.id = ?`).bind(orderId).first();
    if (!o) return { error: "Order not found.", status: 404 } as any;
    await syncCustomers(DB);
    const c: any = await DB.prepare(`SELECT c.* FROM crm_customers c, (SELECT ? AS user_id, ? AS customer_email, ? AS customer_name) o WHERE ${ORDER_MATCH} ORDER BY (c.user_id = o.user_id) DESC LIMIT 1`).bind(o.user_id, o.customer_email, o.customer_name).first();
    if (!c) return { error: "Couldn't find this order's customer.", status: 400 } as any;
    const sel = parseJ(o.selection, {}) ?? {};
    const sqft = Number(o.square_feet) || 0, tot = Number(o.estimated_total) || 0;
    const title = o.design_title || (String(o.design_slug).startsWith("project-") ? "Custom design" : o.design_slug === "outside-file" ? "Customer file" : String(o.design_slug).replace(/-/g, " "));
    const size = sel.width && sel.height ? `, wall ${sel.width} x ${sel.height} ${sel.unit || "ft"}` : "";
    const fin = o.finish && o.finish !== "outside order" ? `, ${o.finish_name || o.finish}` : "";
    const lines: any[] = [sqft > 0 ? { kind: "sqft", description: `${title}${fin}${size}`, design_slug: o.design_slug, design_title: o.design_title, qty: sqft, rate: tot / sqft } : { kind: "fixed", description: `${title}${fin}${size}`, design_slug: o.design_slug, design_title: o.design_title, qty: 1, rate: tot }];
    if (Number(o.design_fee) > 0) lines.push({ kind: "fixed", description: "Design / fit-to-wall service", qty: 1, rate: Number(o.design_fee) });
    const discount = Number(o.discount) || 0;
    const sub = lines.reduce((n, l) => n + l.qty * l.rate, 0);
    const taxRate = Number(o.tax) > 0 && sub - discount > 0 ? Math.round(Number(o.tax) / (sub - discount) * 100000) / 1000 : 0;
    const k = calc(lines, "amount", discount, taxRate);
    return { o, c, k };
}

async function saveInvoice(env: Env, inv: any, body: any) {
  const DB = env.DB;
  if (inv && inv.status === "void") return bad("This invoice is void. Restore it first.");
  const cid = String(body.customerId || inv?.customer_id || "");
  const c: any = UUID.test(cid) ? await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(cid).first() : null;
  if (!c) return bad("Pick a customer.");
  const lines = Array.isArray(body.lines) ? body.lines.filter((l: any) => l && (String(l.description || "").trim() || Number(l.qty) || Number(l.rate))).slice(0, 100) : [];
  if (!lines.length) return bad("Add at least one line.");
  const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
  const k = calc(lines, body.discountType, body.discountValue, body.taxRate);
  if (k.lines.some((l) => !l.description)) return bad("Every line needs a description.");
  const issue = isDate(body.issueDate) ? body.issueDate : inv?.issue_date ?? td;
  const due = isDate(body.dueDate) ? body.dueDate : null;
  if (due && due < issue) return bad("The due date is before the invoice date.");
  const id = inv?.id ?? crypto.randomUUID();
  let num = inv?.number;
  if (body.number !== undefined && body.number !== null && body.number !== "" && Number(body.number) !== Number(inv?.number)) {
    const n = Math.floor(Number(body.number));
    if (!(n > 0)) return bad("Invoice number must be a number.");
    const ex: any = await DB.prepare(`SELECT id FROM invoices WHERE number = ? AND id <> ?`).bind(n, id).first();
    if (ex) return bad(`Invoice number ${b.prefix}${n} is already used.`);
    num = n;
  }
  if (!num) num = await nextNumber(DB, b.startNumber);
  const orderId = UUID.test(String(body.orderId || "")) ? body.orderId : inv?.order_id ?? null;
  const stmts: any[] = [];
  if (inv) stmts.push(DB.prepare(`UPDATE invoices SET number = ?, customer_id = ?, order_id = ?, issue_date = ?, due_date = ?, discount_type = ?, discount_value = ?, tax_rate = ?, subtotal = ?, discount = ?, tax = ?, total = ?, notes = ?, bill_to = ?, updated_at = ? WHERE id = ?`).bind(num, c.id, orderId, issue, due, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, s(body.notes, 4000), billTo(c), nowIso(), id), DB.prepare(`DELETE FROM invoice_lines WHERE invoice_id = ?`).bind(id));
  else stmts.push(DB.prepare(`INSERT INTO invoices (id, number, customer_id, order_id, status, issue_date, due_date, discount_type, discount_value, tax_rate, subtotal, discount, tax, total, paid, notes, bill_to, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).bind(id, num, c.id, orderId, issue, due, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, s(body.notes, 4000), billTo(c), nowIso()));
  for (const l of k.lines) stmts.push(DB.prepare(`INSERT INTO invoice_lines (id, invoice_id, pos, kind, description, design_slug, design_title, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, l.pos, l.kind, l.description, l.design_slug, l.design_title, l.qty, l.rate, l.amount));
  await DB.batch(stmts);
  return j({ id, number: num });
}
