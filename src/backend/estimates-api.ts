// Estimates (quotes) for the owner back office. Same lines, totals, customers and business info as invoices (invoices-api.ts).
import type { Who } from "./policies";
import { getSettings } from "./app-api";
import { j, bad, r2, nowIso, parseJ, UUID, s, isDate, today, addDays, calc, syncCustomers, billTo, business, nextNumber, csvCell, orderDraft, ORDER_MATCH, refreshPaid } from "./invoices-api";
type Env = any;

export const EST_STATUSES = ["draft", "sent", "accepted", "declined"];
/** Shown status: draft | sent | accepted | declined | expired (a draft or sent estimate past its valid-until date). */
export function estShown(e: any, td: string) {
  let st = EST_STATUSES.includes(e.status) ? e.status : "draft";
  if ((st === "draft" || st === "sent") && e.valid_until && e.valid_until < td) st = "expired";
  return { ...e, shown: st, converted: !!e.invoice_id };
}
async function nextEst(DB: any, start: number) {
  const r: any = await DB.prepare(`SELECT MAX(number) n FROM estimates`).first();
  return Math.max(Number(r?.n || 0) + 1, Number(start) || 1001);
}
const lineStmt = (DB: any, id: string, l: any) => DB.prepare(`INSERT INTO estimate_lines (id, estimate_id, pos, kind, description, design_slug, design_title, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, l.pos, l.kind, l.description, l.design_slug, l.design_title, l.qty, l.rate, l.amount);

async function insertEstimate(env: Env, c: any, k: any, extra: { orderId?: string | null; projectId?: string | null; notes?: string | null }) {
  const DB = env.DB; const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
  const id = crypto.randomUUID(); const num = await nextEst(DB, b.estStartNumber);
  const stmts = [DB.prepare(`INSERT INTO estimates (id, number, customer_id, order_id, project_id, status, issue_date, valid_until, discount_type, discount_value, tax_rate, subtotal, discount, tax, total, notes, terms, bill_to, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, num, c.id, extra.orderId ?? null, extra.projectId ?? null, td, b.estValidDays ? addDays(td, b.estValidDays) : null, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, extra.notes ?? (b.estNotes || null), b.estTerms || null, billTo(c), nowIso())];
  for (const l of k.lines) stmts.push(lineStmt(DB, id, l));
  await DB.batch(stmts);
  return id;
}

async function loadEstimate(env: Env, id: string) {
  const DB = env.DB;
  const e: any = await DB.prepare(`SELECT e.*, c.name customer_name, c.company customer_company, c.email customer_email FROM estimates e LEFT JOIN crm_customers c ON c.id = e.customer_id WHERE e.id = ?`).bind(id).first();
  if (!e) return null;
  const st = await getSettings(env); const td = today(st.general?.timezone);
  const lines = (await DB.prepare(`SELECT * FROM estimate_lines WHERE estimate_id = ? ORDER BY pos`).bind(id).all()).results ?? [];
  const order = e.order_id ? await DB.prepare(`SELECT id, created_at, status FROM order_requests WHERE id = ?`).bind(e.order_id).first() : null;
  const project = e.project_id ? await DB.prepare(`SELECT id, title, status FROM projects WHERE id = ?`).bind(e.project_id).first() : null;
  const invoice = e.invoice_id ? await DB.prepare(`SELECT id, number, status FROM invoices WHERE id = ?`).bind(e.invoice_id).first() : null;
  return { kind: "estimate", estimate: { ...estShown(e, td), bill_to: parseJ(e.bill_to, {}) }, lines, order, project, invoice, business: business(st), today: td };
}

/** Find or add the customer-list row for a design request's customer. */
async function customerForProject(DB: any, pr: any) {
  await syncCustomers(DB);
  let c: any = await DB.prepare(`SELECT c.* FROM crm_customers c, (SELECT ? AS user_id, ? AS customer_email, ? AS customer_name) o WHERE ${ORDER_MATCH} ORDER BY (c.user_id = o.user_id) DESC LIMIT 1`).bind(pr.customer_id, pr.customer_email, pr.customer_name).first();
  if (c) return c;
  const id = crypto.randomUUID();
  await DB.prepare(`INSERT INTO crm_customers (id, name, email, user_id, source, updated_at) VALUES (?, ?, ?, ?, 'manual', ?)`).bind(id, pr.customer_name || "", pr.customer_email ? String(pr.customer_email).toLowerCase() : null, pr.customer_id ?? null, nowIso()).run();
  return await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(id).first();
}
function wallSqft(t: any) {
  const m = String(t || "").replace(/,/g, ".").match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*(?:x|×|by|\*)\s*(\d+(?:\.\d+)?)\s*(in|inch|inches|")?/i);
  if (!m) return 0;
  let v = Number(m[1]) * Number(m[2]); if (m[3]) v = v / 144;
  return v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 0;
}

export async function estimateRoutes(env: Env, who: Who, p: string, m: string, body: any, sp: URLSearchParams): Promise<Response> {
  const DB = env.DB;
  if (p === "estimates" && m === "GET") {
    const st = await getSettings(env); const td = today(st.general?.timezone); const b = business(st);
    const where: string[] = []; const params: any[] = [];
    if (isDate(sp.get("from"))) { where.push("e.issue_date >= ?"); params.push(sp.get("from")); }
    if (isDate(sp.get("to"))) { where.push("e.issue_date <= ?"); params.push(sp.get("to")); }
    for (const [k, col] of [["customer", "customer_id"], ["order", "order_id"], ["project", "project_id"]]) if (sp.get(k) && UUID.test(sp.get(k)!)) { where.push(`e.${col} = ?`); params.push(sp.get(k)); }
    const q = (sp.get("q") || "").trim();
    if (q) { const qn = q.replace(/\D/g, ""); where.push("(c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR CAST(e.number AS TEXT) LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${qn || q}%`); }
    const rows = ((await DB.prepare(`SELECT e.id, e.number, e.customer_id, e.order_id, e.project_id, e.invoice_id, e.status, e.issue_date, e.valid_until, e.subtotal, e.discount, e.tax, e.total, e.sent_at, e.created_at, c.name customer_name, c.company customer_company, c.email customer_email, i.number invoice_number FROM estimates e LEFT JOIN crm_customers c ON c.id = e.customer_id LEFT JOIN invoices i ON i.id = e.invoice_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.number DESC LIMIT 2000`).bind(...params).all()).results ?? []).map((e: any) => estShown(e, td));
    const stf = sp.get("status") || "";
    const list = rows.filter((e: any) => !stf || stf === "all" || (stf === "open" ? e.shown === "draft" || e.shown === "sent" : stf === "converted" ? e.converted : e.shown === stf));
    const sum = (f: (e: any) => boolean) => r2(list.filter(f).reduce((n: number, e: any) => n + Number(e.total), 0));
    const totals = { count: list.length, open: sum((e) => e.shown === "sent"), drafts: list.filter((e: any) => e.shown === "draft").length, draftTotal: sum((e) => e.shown === "draft"), accepted: sum((e) => e.shown === "accepted"), declined: sum((e) => e.shown === "declined"), expired: sum((e) => e.shown === "expired"), converted: list.filter((e: any) => e.converted).length };
    if (sp.get("format") === "csv") {
      const lab: any = { draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined", expired: "Expired" };
      const head = ["Estimate", "Customer", "Company", "Email", "Date", "Valid until", "Status", "Invoice", "Subtotal", "Discount", "Tax", "Total"];
      const out = [head.join(","), ...list.map((e: any) => [b.estPrefix + e.number, e.customer_name, e.customer_company, e.customer_email, e.issue_date, e.valid_until, lab[e.shown], e.invoice_number ? b.prefix + e.invoice_number : "", e.subtotal, e.discount, e.tax, e.total].map(csvCell).join(","))].join("\n");
      return new Response(out, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="estimates-${td}.csv"` } });
    }
    return j({ estimates: list, totals, prefix: b.estPrefix, invPrefix: b.prefix, today: td });
  }
  if (p === "estimates/new" && m === "GET") {
    const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
    return j({ business: b, number: await nextEst(DB, b.estStartNumber), issueDate: td, dueDate: b.estValidDays ? addDays(td, b.estValidDays) : "" });
  }
  if (p === "estimates/from-order" && m === "POST") {
    if (!UUID.test(String(body.orderId || ""))) return bad("Order missing.");
    const ex: any = await DB.prepare(`SELECT id FROM estimates WHERE order_id = ? AND status <> 'declined' ORDER BY number DESC LIMIT 1`).bind(body.orderId).first();
    if (ex && !body.fresh) return j({ id: ex.id, existing: true });
    const dr = await orderDraft(DB, body.orderId);
    if (dr.error) return bad(dr.error, dr.status);
    return j({ id: await insertEstimate(env, dr.c, dr.k, { orderId: dr.o.id }) });
  }
  if (p === "estimates/from-request" && m === "POST") {
    if (!UUID.test(String(body.projectId || ""))) return bad("Design request missing.");
    const ex: any = await DB.prepare(`SELECT id FROM estimates WHERE project_id = ? AND status <> 'declined' ORDER BY number DESC LIMIT 1`).bind(body.projectId).first();
    if (ex && !body.fresh) return j({ id: ex.id, existing: true });
    const pr: any = await DB.prepare(`SELECT p.*, COALESCE((SELECT a.title FROM artwork_uploads a WHERE 'u-' || a.id = p.design_slug), (SELECT d.title FROM design_overrides d WHERE d.slug = p.design_slug)) design_title FROM projects p WHERE p.id = ?`).bind(body.projectId).first();
    if (!pr) return bad("Design request not found.", 404);
    const c = await customerForProject(DB, pr);
    const b = business(await getSettings(env));
    const title = pr.design_title || pr.title || "Custom design";
    const lines: any[] = [];
    const sq = wallSqft(pr.wall_size);
    lines.push({ kind: "sqft", description: `${title}${pr.wall_size ? `, wall ${pr.wall_size}` : ""}`, design_slug: pr.design_slug && !String(pr.design_slug).startsWith("project-") ? pr.design_slug : null, design_title: pr.design_title ?? null, qty: sq, rate: b.ratePerSqft });
    if (pr.fee != null && Number(pr.fee) > 0) lines.push({ kind: "fixed", description: pr.kind === "edit" ? "Design change by the designer" : "Custom design by the designer", qty: 1, rate: Number(pr.fee) });
    const k = calc(lines, "amount", 0, b.taxRate);
    return j({ id: await insertEstimate(env, c, k, { projectId: pr.id, notes: `For your request: ${pr.title || title}` }) });
  }
  if (p === "estimates" && m === "POST") return saveEstimate(env, null, body);
  const mm = p.match(/^estimates\/([0-9a-f-]{36})$/);
  if (mm && m === "GET") { const r = await loadEstimate(env, mm[1]); return r ? j(r) : bad("Estimate not found.", 404); }
  if (mm && m === "POST") {
    const e: any = await DB.prepare(`SELECT * FROM estimates WHERE id = ?`).bind(mm[1]).first();
    if (!e) return bad("Estimate not found.", 404);
    const a = body.action; const now = nowIso();
    const setSt = async (stt: string, extra = "") => { await DB.prepare(`UPDATE estimates SET status = ?${extra}, updated_at = ? WHERE id = ?`).bind(stt, now, e.id).run(); return j({ ok: true }); };
    if (a === "send") return setSt("sent", `, sent_at = COALESCE(sent_at, '${now}')`);
    if (a === "draft") return setSt("draft");
    if (a === "accept") return setSt("accepted", `, accepted_at = '${now}', declined_at = NULL`);
    if (a === "decline") { if (e.invoice_id) return bad("This estimate is already an invoice."); return setSt("declined", `, declined_at = '${now}'`); }
    if (a === "reopen") { if (e.invoice_id) return bad("This estimate is already an invoice."); return setSt(e.sent_at ? "sent" : "draft", `, accepted_at = NULL, declined_at = NULL`); }
    if (a === "delete") {
      if (e.invoice_id) { const iv: any = await DB.prepare(`SELECT number FROM invoices WHERE id = ?`).bind(e.invoice_id).first(); if (iv) return bad(`This estimate became invoice ${business(await getSettings(env)).prefix}${iv.number}. Delete that invoice first.`); }
      await DB.batch([DB.prepare(`DELETE FROM estimate_lines WHERE estimate_id = ?`).bind(e.id), DB.prepare(`DELETE FROM estimates WHERE id = ?`).bind(e.id), DB.prepare(`UPDATE invoices SET estimate_id = NULL WHERE estimate_id = ?`).bind(e.id)]);
      return j({ ok: true, deleted: true });
    }
    if (a === "convert") {
      if (e.invoice_id) { const iv: any = await DB.prepare(`SELECT id, status FROM invoices WHERE id = ?`).bind(e.invoice_id).first(); if (iv && iv.status !== "void") return j({ id: iv.id, existing: true }); }
      const c: any = await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(e.customer_id).first();
      if (!c) return bad("This estimate's customer is gone. Pick a customer first (Edit).");
      const lines = (await DB.prepare(`SELECT * FROM estimate_lines WHERE estimate_id = ? ORDER BY pos`).bind(e.id).all()).results ?? [];
      if (!lines.length) return bad("This estimate has no lines.");
      const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
      const k = calc(lines, e.discount_type, e.discount_value, e.tax_rate);
      const id = crypto.randomUUID(); const num = await nextNumber(DB, b.startNumber);
      const notes = [b.notes, `From estimate ${b.estPrefix}${e.number}.`].filter(Boolean).join("\n");
      const stmts = [DB.prepare(`INSERT INTO invoices (id, number, customer_id, order_id, estimate_id, status, issue_date, due_date, discount_type, discount_value, tax_rate, subtotal, discount, tax, total, paid, notes, bill_to, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).bind(id, num, c.id, e.order_id ?? null, e.id, td, b.dueDays ? addDays(td, b.dueDays) : td, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, notes || null, billTo(c), now)];
      for (const l of k.lines) stmts.push(DB.prepare(`INSERT INTO invoice_lines (id, invoice_id, pos, kind, description, design_slug, design_title, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), id, l.pos, l.kind, l.description, l.design_slug, l.design_title, l.qty, l.rate, l.amount));
      stmts.push(DB.prepare(`UPDATE estimates SET status = 'accepted', accepted_at = COALESCE(accepted_at, ?), declined_at = NULL, invoice_id = ?, converted_at = ?, updated_at = ? WHERE id = ?`).bind(now, id, now, now, e.id));
      await DB.batch(stmts); await refreshPaid(DB, id);
      return j({ id, number: num });
    }
    if (a === "email") {
      const full = await loadEstimate(env, e.id);
      const to = s(body.to, 200) || full!.estimate.bill_to?.email || full!.estimate.customer_email;
      if (!to || !/@/.test(to)) return bad("This customer has no email. Add one on the customer page.");
      const b = full!.business; const ev = full!.estimate; const no = b.estPrefix + ev.number;
      const money = (n: number) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
      const text = `Hello ${ev.bill_to?.name || ev.customer_name || ""},\n\nHere is estimate ${no} from ${b.name}.\n\n${full!.lines.map((l: any) => `${l.description}: ${l.kind === "sqft" ? `${l.qty} sq ft x ${money(l.rate)} = ` : l.qty !== 1 ? `${l.qty} x ${money(l.rate)} = ` : ""}${money(l.amount)}`).join("\n")}\n\nEstimate total: ${money(ev.total)}${ev.valid_until ? `\nValid until: ${ev.valid_until}` : ""}${ev.terms ? `\n\n${ev.terms}` : ""}\n\n${b.name}${b.phone ? `\n${b.phone}` : ""}${b.email ? `\n${b.email}` : ""}`;
      await DB.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind) VALUES (?, ?, ?, ?, ?, 'estimate')`).bind(crypto.randomUUID(), to, `Estimate ${no} from ${b.name}`, `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`, text).run();
      await DB.prepare(`UPDATE estimates SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ?`).bind(now, now, e.id).run();
      return j({ ok: true, to, testMode: true });
    }
    return saveEstimate(env, e, body);
  }
  return bad("Not found", 404);
}

async function saveEstimate(env: Env, e: any, body: any) {
  const DB = env.DB;
  const cid = String(body.customerId || e?.customer_id || "");
  const c: any = UUID.test(cid) ? await DB.prepare(`SELECT * FROM crm_customers WHERE id = ?`).bind(cid).first() : null;
  if (!c) return bad("Pick a customer.");
  const lines = Array.isArray(body.lines) ? body.lines.filter((l: any) => l && (String(l.description || "").trim() || Number(l.qty) || Number(l.rate))).slice(0, 100) : [];
  if (!lines.length) return bad("Add at least one line.");
  const st = await getSettings(env); const b = business(st); const td = today(st.general?.timezone);
  const k = calc(lines, body.discountType, body.discountValue, body.taxRate);
  if (k.lines.some((l: any) => !l.description)) return bad("Every line needs a description.");
  const issue = isDate(body.issueDate) ? body.issueDate : e?.issue_date ?? td;
  const valid = isDate(body.dueDate) ? body.dueDate : null;
  if (valid && valid < issue) return bad("The valid-until date is before the estimate date.");
  const id = e?.id ?? crypto.randomUUID();
  let num = e?.number;
  if (body.number !== undefined && body.number !== null && body.number !== "" && Number(body.number) !== Number(e?.number)) {
    const n = Math.floor(Number(body.number));
    if (!(n > 0)) return bad("Estimate number must be a number.");
    const ex: any = await DB.prepare(`SELECT id FROM estimates WHERE number = ? AND id <> ?`).bind(n, id).first();
    if (ex) return bad(`Estimate number ${b.estPrefix}${n} is already used.`);
    num = n;
  }
  if (!num) num = await nextEst(DB, b.estStartNumber);
  const orderId = UUID.test(String(body.orderId || "")) ? body.orderId : e?.order_id ?? null;
  const projectId = UUID.test(String(body.projectId || "")) ? body.projectId : e?.project_id ?? null;
  const stmts: any[] = [];
  if (e) stmts.push(DB.prepare(`UPDATE estimates SET number = ?, customer_id = ?, order_id = ?, project_id = ?, issue_date = ?, valid_until = ?, discount_type = ?, discount_value = ?, tax_rate = ?, subtotal = ?, discount = ?, tax = ?, total = ?, notes = ?, terms = ?, bill_to = ?, updated_at = ? WHERE id = ?`).bind(num, c.id, orderId, projectId, issue, valid, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, s(body.notes, 4000), s(body.conditions, 4000), billTo(c), nowIso(), id), DB.prepare(`DELETE FROM estimate_lines WHERE estimate_id = ?`).bind(id));
  else stmts.push(DB.prepare(`INSERT INTO estimates (id, number, customer_id, order_id, project_id, status, issue_date, valid_until, discount_type, discount_value, tax_rate, subtotal, discount, tax, total, notes, terms, bill_to, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, num, c.id, orderId, projectId, issue, valid, k.dType, k.dValue, k.taxRate, k.subtotal, k.discount, k.tax, k.total, s(body.notes, 4000), s(body.conditions, 4000), billTo(c), nowIso()));
  for (const l of k.lines) stmts.push(lineStmt(DB, id, l));
  await DB.batch(stmts);
  return j({ id, number: num });
}
