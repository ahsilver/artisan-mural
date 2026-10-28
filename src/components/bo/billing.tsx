import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { shopQuery } from "@/lib/shop";
import { liveDesigns, registerShop, unitPrice } from "@/lib/catalog";
import { api, useApi, money, fmtDate, Msg, Field, Pill, Drawer, Switch, useSaver } from "./common";

// ---------- small helpers ----------
function useSub(sec: string): [string | null, (v: string | null) => void] {
  const read = () => { if (typeof window === "undefined") return null; const h = decodeURIComponent(window.location.hash.slice(1)); return h.startsWith(sec + ":") ? h.slice(sec.length + 1) : null; };
  const [sub, setSub] = useState<string | null>(read);
  useEffect(() => { const on = () => setSub(read()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { if (typeof window !== "undefined") window.scrollTo(0, 0); }, [sub]);
  return [sub, (v) => { window.location.hash = v ? `${sec}:${v}` : sec; }];
}
const go = (h: string) => { window.location.hash = h; };
const n2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (v: any) => String(Math.round((Number(v) || 0) * 1000) / 1000);
const dShort = (d?: string | null) => (d ? fmtDate(d + "T12:00:00") : "");
const ST: Record<string, [string, any]> = { draft: ["Draft", undefined], sent: ["Sent", "info"], partial: ["Partly paid", "warn"], paid: ["Paid", "ok"], void: ["Void", undefined] };
export function InvStatus({ i }: { i: any }) { const [l, t] = ST[i.shown] ?? ["", undefined]; return <span className="bo-row" style={{ gap: 4, display: "inline-flex" }}><Pill tone={t}>{l}</Pill>{i.overdue && <Pill tone="bad">Overdue</Pill>}</span>; }
const EST_ST: Record<string, [string, any]> = { draft: ["Draft", undefined], sent: ["Sent", "info"], accepted: ["Accepted", "ok"], declined: ["Declined", "bad"], expired: ["Expired", "warn"] };
export function EstStatus({ e }: { e: any }) { const [l, t] = EST_ST[e.shown] ?? ["", undefined]; return <span className="bo-row" style={{ gap: 4, display: "inline-flex" }}><Pill tone={t}>{l}</Pill>{e.converted && <Pill tone="ok">Invoiced</Pill>}</span>; }
const METHOD_L: Record<string, string> = { card: "Card", check: "Check", cash: "Cash", zelle: "Zelle", other: "Other" };
async function downloadUrl(path: string, name: string) {
  const r: any = await api(path, { raw: true }); if (!r.ok) throw new Error("Export failed");
  const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function csvDownload(name: string, rows: Record<string, any>[]) {
  if (!rows.length) return; const head = Object.keys(rows[0]);
  const esc = (v: any) => { const x = v == null ? "" : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const b = new Blob([[head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click();
}
const custLabel = (c: any) => c?.name || c?.email || "(no name)";

// ================= CUSTOMERS =================
export function CustomersCRM() {
  const [sub, setSub] = useSub("customers");
  if (sub) return <CustomerPage id={sub} back={() => setSub(null)} />;
  return <CustomerList open={(id) => setSub(id)} />;
}

function CustomerList({ open }: { open: (id: string) => void }) {
  const { data, error, reload } = useApi<any>("admin/crm/customers");
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [adding, setAdding] = useState(false);
  if (error) return <Msg m={{ text: error }} />;
  const all: any[] = data?.customers ?? [];
  const ql = q.trim().toLowerCase();
  const list = all.filter((c) => (!ql || `${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(ql)) && (show === "all" || (show === "owes" ? c.owed > 0 : show === "overdue" ? c.overdue > 0 : show === "accounts" ? !!c.user_id : show === "trade" ? c.trade_status === "approved" : true)));
  const owed = all.reduce((n, c) => n + Number(c.owed || 0), 0), overdue = all.reduce((n, c) => n + Number(c.overdue || 0), 0);
  return <div data-testid="crm-list">
    <div className="bo-top"><h1>Customers</h1>
      <button className="bo-btn" onClick={() => csvDownload("customers.csv", list.map((c) => ({ name: c.name, company: c.company ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? c.ship_address ?? "", orders: c.orders, order_total: c.order_total, invoiced: c.invoiced, balance_owed: c.owed, overdue: c.overdue, website_account: c.user_id ? "yes" : "", trade: c.trade_status ?? "", since: (c.created_at ?? "").slice(0, 10) })))}>Export CSV</button>
      <button className="bo-btn pri" onClick={() => setAdding(true)} data-testid="crm-new">New customer</button></div>
    {!data ? <div className="bo-sub">Loading…</div> : <>
      <div className="bo-kpis">
        <div className="bo-kpi"><span>Customers</span><b>{all.length}</b></div>
        <div className="bo-kpi"><span>Balance owed</span><b>{money(owed)}</b></div>
        <div className="bo-kpi"><span>Overdue</span><b style={{ color: overdue > 0 ? "var(--bo-bad)" : undefined }}>{money(overdue)}</b></div>
      </div>
      <div className="bo-row" style={{ marginBottom: 12, flexWrap: "nowrap" }}>
        <input className="bo-in" style={{ maxWidth: 360 }} placeholder="Search name, company, email or phone" value={q} onChange={(e) => setQ(e.target.value)} data-testid="crm-q" aria-label="Search customers" />
        <select className="bo-sel" style={{ width: 150, flex: "none" }} value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show"><option value="all">All</option><option value="owes">Owes money</option><option value="overdue">Overdue</option><option value="accounts">Website accounts</option><option value="trade">Pro members</option></select>
      </div>
      {!list.length ? <div className="bo-empty">{all.length ? "No customer matches." : "No customers yet."}</div> :
        <table className="bo-tbl stack crm-tbl"><thead><tr><th>Customer</th><th>Phone</th><th className="num">Orders</th><th className="num">Invoiced</th><th className="num">Balance owed</th><th></th></tr></thead><tbody>
          {list.slice(0, 500).map((c) => <tr key={c.id} className="click" onClick={() => open(c.id)} data-testid="crm-row">
            <td><b style={{ fontWeight: 500 }}>{custLabel(c)}</b>{c.company && <span className="bo-sub"> · {c.company}</span>}<div className="bo-sub">{c.name ? c.email : ""}</div></td>
            <td data-l="Phone">{c.phone || <span className="bo-sub">–</span>}</td>
            <td className="num" data-l="Orders">{c.orders}</td>
            <td className="num" data-l="Invoiced">{c.invoiced ? money(c.invoiced) : "–"}</td>
            <td className="num" data-l="Owed">{c.owed > 0 ? <span style={{ color: c.overdue > 0 ? "var(--bo-bad)" : undefined, fontWeight: 500 }}>{money(c.owed)}</span> : "–"}</td>
            <td className="crm-tags">{c.overdue > 0 && <Pill tone="bad">Overdue</Pill>} {c.user_id && <Pill>Account</Pill>} {c.trade_status === "approved" && <Pill tone="ok">Pro</Pill>} {c.designer && <Pill>Designer</Pill>}</td>
          </tr>)}
        </tbody></table>}
      {list.length > 500 && <div className="bo-sub" style={{ marginTop: 8 }}>Showing 500 of {list.length}. Search to narrow it down.</div>}
    </>}
    <Drawer open={adding} onClose={() => setAdding(false)}>{adding && <CustomerForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); reload(); open(id); }} />}</Drawer>
  </div>;
}

function CustomerForm({ c, onClose, onSaved }: { c?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<any>({ name: c?.name ?? "", company: c?.company ?? "", email: c?.email ?? "", phone: c?.phone ?? "", address: c?.address ?? "", shipAddress: c?.ship_address ?? "", notes: c?.notes ?? "" });
  const s = useSaver();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return <form onSubmit={async (e) => { e.preventDefault(); let id = c?.id; const ok = await s.run(async () => { if (c) await api(`admin/crm/customers/${c.id}`, { body: f }); else id = (await api("admin/crm/customers", { body: f })).id; }); if (ok) onSaved(id); }} data-testid="crm-form">
    <div className="bo-row" style={{ justifyContent: "space-between", marginBottom: 12 }}><h2>{c ? "Edit customer" : "New customer"}</h2><button type="button" className="bo-btn sm" onClick={onClose}>Close</button></div>
    <Msg m={s.msg} />
    <div className="bo-grid2"><Field label="Name"><input className="bo-in" value={f.name} onChange={set("name")} name="name" autoFocus /></Field><Field label="Company (optional)"><input className="bo-in" value={f.company} onChange={set("company")} name="company" /></Field>
      <Field label="Email"><input className="bo-in" type="email" value={f.email} onChange={set("email")} name="email" /></Field><Field label="Phone"><input className="bo-in" type="tel" value={f.phone} onChange={set("phone")} name="phone" /></Field></div>
    <Field label="Billing address"><textarea className="bo-ta" rows={2} value={f.address} onChange={set("address")} name="address" /></Field>
    <Field label="Shipping / install address (if different)"><textarea className="bo-ta" rows={2} value={f.shipAddress} onChange={set("shipAddress")} name="shipAddress" /></Field>
    <Field label="Notes"><textarea className="bo-ta" rows={3} value={f.notes} onChange={set("notes")} name="notes" /></Field>
    <button className="bo-btn pri" disabled={s.busy}>{c ? "Save" : "Add customer"}</button>
  </form>;
}

function CustomerPage({ id, back }: { id: string; back: () => void }) {
  const { data, error, reload } = useApi<any>(`admin/crm/customers/${id}`, [id]);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const s = useSaver();
  if (error) return <div><button className="bo-btn sm" onClick={back}>Back to customers</button><Msg m={{ text: error }} /></div>;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const c = data.customer, sm = data.summary;
  const nt = notes ?? c.notes ?? "";
  const mkInvoice = async (orderId: string) => { const r = await api("admin/invoices/from-order", { body: { orderId } }); go("invoices:" + r.id); };
  return <div data-testid="crm-page">
    <div className="bo-row" style={{ marginBottom: 10 }}><button className="bo-btn sm" onClick={back}>Customers</button></div>
    <div className="bo-top"><h1>{custLabel(c)}{c.company && <span className="bo-sub" style={{ fontSize: 13.5, fontWeight: 400 }}> · {c.company}</span>}</h1>
      <button className="bo-btn" onClick={() => setEditing(true)} data-testid="crm-edit">Edit</button>
      <button className="bo-btn" onClick={() => go("estimates:new:" + c.id)} data-testid="crm-new-estimate">New estimate</button>
      <button className="bo-btn pri" onClick={() => go("invoices:new:" + c.id)} data-testid="crm-new-invoice">New invoice</button></div>
    <Msg m={s.msg} />
    <div className="bo-kpis">
      <div className="bo-kpi"><span>Balance owed</span><b style={{ color: sm.overdue > 0 ? "var(--bo-bad)" : undefined }} data-testid="crm-owed">{money(sm.owed)}</b>{sm.overdue > 0 && <span style={{ color: "var(--bo-bad)" }}>{money(sm.overdue)} overdue</span>}</div>
      <div className="bo-kpi"><span>Invoiced</span><b>{money(sm.invoiced)}</b></div>
      <div className="bo-kpi"><span>Paid</span><b>{money(sm.paid)}</b></div>
      <div className="bo-kpi"><span>Orders</span><b>{sm.orders}</b>{sm.orderTotal > 0 && <span>{money(sm.orderTotal)}</span>}</div>
    </div>
    <div className="crm-cols">
      <div className="bo-card"><h2>Contact</h2>
        <dl className="bo-dl">
          <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "–"}</dd>
          <dt>Phone</dt><dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "–"}</dd>
          <dt>Billing address</dt><dd style={{ whiteSpace: "pre-line" }}>{c.address || "–"}</dd>
          {c.ship_address && c.ship_address !== c.address && <><dt>Ship / install</dt><dd style={{ whiteSpace: "pre-line" }}>{c.ship_address}</dd></>}
          <dt>Customer since</dt><dd>{fmtDate(c.created_at)}</dd>
          <dt>Website account</dt><dd>{c.user_id ? "Yes" : "No"}</dd>
        </dl></div>
      <div className="bo-card"><h2>Notes</h2>
        <textarea className="bo-ta" rows={5} value={nt} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember: wall details, preferences, who to call." data-testid="crm-notes" />
        <div className="bo-row" style={{ marginTop: 8 }}><button className="bo-btn" disabled={s.busy || nt === (c.notes ?? "")} onClick={() => s.run(async () => { await api(`admin/crm/customers/${c.id}`, { body: { notes: nt } }); await reload(); setNotes(null); }, "Notes saved")}>Save notes</button></div></div>
    </div>
    <div className="bo-card" data-testid="crm-estimates"><div className="bo-row" style={{ justifyContent: "space-between", marginBottom: 8 }}><h2 style={{ margin: 0 }}>Estimates</h2><button className="bo-btn sm" onClick={() => go("estimates:new:" + c.id)}>New estimate</button></div>
      {!(data.estimates ?? []).length ? <div className="bo-sub">No estimates yet.</div> :
        <table className="bo-tbl stack"><thead><tr><th>Estimate</th><th>Date</th><th>Valid until</th><th className="num">Total</th><th>Status</th></tr></thead><tbody>
          {data.estimates.map((e: any) => <tr key={e.id} className="click" onClick={() => go("estimates:" + e.id)}><td><b style={{ fontWeight: 500 }}>{(data.estPrefix ?? "EST-") + e.number}</b></td><td data-l="Date">{dShort(e.issue_date)}</td><td data-l="Valid until">{dShort(e.valid_until)}</td><td className="num" data-l="Total">{money(e.total)}</td><td><EstStatus e={e} /></td></tr>)}
        </tbody></table>}
    </div>
    <div className="bo-card"><div className="bo-row" style={{ justifyContent: "space-between", marginBottom: 8 }}><h2 style={{ margin: 0 }}>Invoices</h2><button className="bo-btn sm" onClick={() => go("invoices:new:" + c.id)}>New invoice</button></div>
      {!data.invoices.length ? <div className="bo-sub">No invoices yet.</div> :
        <table className="bo-tbl stack"><thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead><tbody>
          {data.invoices.map((i: any) => <tr key={i.id} className="click" onClick={() => go("invoices:" + i.id)}><td><b style={{ fontWeight: 500 }}>{(data.prefix ?? "INV-") + i.number}</b></td><td data-l="Date">{dShort(i.issue_date)}</td><td data-l="Due">{dShort(i.due_date)}</td><td className="num" data-l="Total">{money(i.total)}</td><td className="num" data-l="Balance">{money(i.balance)}</td><td><InvStatus i={i} /></td></tr>)}
        </tbody></table>}</div>
    <div className="bo-card"><h2>Orders</h2>
      {!data.orders.length ? <div className="bo-sub">No orders yet.</div> :
        <table className="bo-tbl stack"><thead><tr><th>Order</th><th>Date</th><th>Design</th><th className="num">Sq ft</th><th className="num">Total</th><th></th></tr></thead><tbody>
          {data.orders.map((o: any) => <tr key={o.id}><td><a href={`#orders:${o.id}`}>{o.id.slice(0, 8).toUpperCase()}</a><div className="bo-sub">{o.status.replace(/_/g, " ")}</div></td><td data-l="Date">{fmtDate(o.created_at)}</td><td data-l="Design">{o.design_title || o.design_slug}</td><td className="num" data-l="Sq ft">{n2(o.square_feet)}</td><td className="num" data-l="Total">{money(o.estimated_total)}</td>
            <td>{o.invoice_id ? <button className="bo-btn sm" onClick={() => go("invoices:" + o.invoice_id)}>View invoice</button> : <button className="bo-btn sm" disabled={s.busy} onClick={() => s.run(() => mkInvoice(o.id), "Invoice created")}>Create invoice</button>}</td></tr>)}
        </tbody></table>}</div>
    {data.account && <AccountCard a={data.account} reload={reload} />}
    {!c.user_id && !data.orders.length && !data.invoices.length && !(data.estimates ?? []).length && <button className="bo-btn danger" disabled={s.busy} onClick={() => confirm(`Delete ${custLabel(c)}?`) && s.run(async () => { await api(`admin/crm/customers/${c.id}`, { body: { delete: true } }); back(); }, "Deleted")} data-testid="crm-delete">Delete customer</button>}
    <Drawer open={editing} onClose={() => setEditing(false)}>{editing && <CustomerForm c={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}</Drawer>
  </div>;
}

function AccountCard({ a, reload }: { a: any; reload: () => void }) {
  const [e, setE] = useState<any>({ discountPct: a.discount_pct ?? 0, tradeStatus: a.trade_status ?? "", netTerms: !!a.net_terms, creditAdjust: "" });
  const s = useSaver();
  return <div className="bo-card"><h2>Website account</h2>
    <div className="bo-sub" style={{ marginBottom: 10 }}>{a.email} · joined {fmtDate(a.created_at)}{a.last_sign_in_at ? ` · last sign-in ${fmtDate(a.last_sign_in_at)}` : ""}{a.designer ? ` · designer (${a.designer})` : ""}{a.trade_note ? ` · "${a.trade_note}"` : ""}</div>
    <Msg m={s.msg} />
    <div className="bo-grid3">
      <Field label="Pro account"><select className="bo-sel" value={e.tradeStatus} onChange={(x) => setE({ ...e, tradeStatus: x.target.value })}><option value="">Not Pro</option><option value="pending">Applied (waiting)</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></Field>
      <Field label="Special discount (% off every order)"><input className="bo-in" type="number" min="0" max="80" value={e.discountPct} onChange={(x) => setE({ ...e, discountPct: x.target.value })} /></Field>
      <div className="bo-field" style={{ display: "flex", alignItems: "flex-end", minHeight: 52 }}><Switch checked={e.netTerms} onChange={(x) => setE({ ...e, netTerms: x })} label="Net terms (pay by invoice)" /></div>
    </div>
    <div className="bo-row" style={{ marginBottom: 14 }}><button className="bo-btn" disabled={s.busy} onClick={() => s.run(async () => { await api(`admin/customers/${a.id}`, { body: { terms: { discountPct: e.discountPct, tradeStatus: e.tradeStatus, netTerms: e.netTerms } } }); reload(); }, "Saved")}>Save pricing</button></div>
    <div className="bo-row" style={{ alignItems: "flex-end" }}><Field label={`Store credit: ${money(a.credit)}. Add (+) or remove (−)`}><input className="bo-in" style={{ width: 140 }} type="number" step="0.01" value={e.creditAdjust} onChange={(x) => setE({ ...e, creditAdjust: x.target.value })} /></Field>
      <button className="bo-btn" style={{ marginBottom: 12 }} disabled={s.busy || !Number(e.creditAdjust)} onClick={() => s.run(async () => { await api(`admin/customers/${a.id}`, { body: { creditAdjust: Number(e.creditAdjust) } }); setE({ ...e, creditAdjust: "" }); reload(); }, "Credit updated")}>Apply</button>
      <button className="bo-btn danger" style={{ marginBottom: 12, marginLeft: "auto" }} disabled={s.busy} onClick={() => s.run(async () => { await api(`admin/customers/${a.id}`, { body: { banned: !a.banned } }); reload(); }, a.banned ? "Unblocked" : "Blocked")}>{a.banned ? "Unblock account" : "Block account"}</button></div>
  </div>;
}

// ================= INVOICES =================
export function Invoices() {
  const [sub, setSub] = useSub("invoices");
  if (sub && sub.startsWith("new")) return <InvoiceEditor key={sub} customerId={sub.split(":")[1] || null} back={() => setSub(null)} onSaved={(id) => setSub(id)} />;
  if (sub) return <InvoicePage key={sub} id={sub} back={() => setSub(null)} />;
  return <InvoiceList />;
}

function InvoiceList() {
  const [f, setF] = useState({ status: "", from: "", to: "", q: "" });
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q })), 300); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as any).toString();
  const { data, error } = useApi<any>("admin/invoices?" + qs, [qs]);
  const s = useSaver();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const t = data?.totals;
  return <div data-testid="inv-list">
    <div className="bo-top"><h1>Invoices</h1>
      <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => downloadUrl("admin/invoices?" + qs + (qs ? "&" : "") + "format=csv", "invoices.csv"), "CSV downloaded")} data-testid="inv-csv">Export CSV</button>
      <button className="bo-btn pri" onClick={() => go("invoices:new")} data-testid="inv-new">New invoice</button></div>
    <Msg m={s.msg} />
    {error && <Msg m={{ text: error }} />}
    <div className="bo-kpis" data-testid="inv-kpis">
      <div className="bo-kpi"><span>Invoiced</span><b>{t ? money(t.invoiced) : "–"}</b></div>
      <div className="bo-kpi"><span>Paid</span><b>{t ? money(t.paid) : "–"}</b></div>
      <div className="bo-kpi"><span>Open</span><b>{t ? money(t.open) : "–"}</b></div>
      <div className="bo-kpi"><span>Overdue</span><b style={{ color: t?.overdue > 0 ? "var(--bo-bad)" : undefined }}>{t ? money(t.overdue) : "–"}</b></div>
    </div>
    <div className="inv-filters">
      <input className="bo-in" placeholder="Customer or invoice number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search invoices" data-testid="inv-q" />
      <select className="bo-sel" value={f.status} onChange={set("status")} aria-label="Status" data-testid="inv-status"><option value="">All statuses</option><option value="draft">Draft</option><option value="open">Open (sent + partly paid)</option><option value="sent">Sent</option><option value="partial">Partly paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select>
      <label className="inv-date"><span>From</span><input className="bo-in" type="date" value={f.from} onChange={set("from")} aria-label="From date" /></label>
      <label className="inv-date"><span>To</span><input className="bo-in" type="date" value={f.to} onChange={set("to")} aria-label="To date" /></label>
    </div>
    {!data ? <div className="bo-sub">Loading…</div> : !data.invoices.length ? <div className="bo-empty">{qs ? "No invoices match." : "No invoices yet. Create one here, from a customer, or from an order."}</div> :
      <table className="bo-tbl stack"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead><tbody>
        {data.invoices.map((i: any) => <tr key={i.id} className="click" onClick={() => go("invoices:" + i.id)} data-testid="inv-row">
          <td><b style={{ fontWeight: 500 }}>{data.prefix + i.number}</b></td>
          <td data-l="Customer">{custLabel({ name: i.customer_name, email: i.customer_email })}{i.customer_company && <span className="bo-sub"> · {i.customer_company}</span>}</td>
          <td data-l="Date">{dShort(i.issue_date)}</td><td data-l="Due">{dShort(i.due_date)}</td>
          <td className="num" data-l="Total">{money(i.total)}</td><td className="num" data-l="Balance">{i.shown === "void" ? "–" : money(i.balance)}</td><td><InvStatus i={i} /></td></tr>)}
      </tbody></table>}
    {data?.invoices?.length > 0 && <div className="bo-sub" style={{ marginTop: 8 }}>{t.count} invoice{t.count === 1 ? "" : "s"}{t.drafts ? `, ${t.drafts} draft${t.drafts === 1 ? "" : "s"} (not counted in totals)` : ""}.</div>}
  </div>;
}

type Line = { kind: "sqft" | "fixed"; description: string; design_slug?: string | null; design_title?: string | null; qty: any; rate: any; w?: any; h?: any };
const QUICK: [string, Partial<Line>][] = [["Wallpaper (sq ft)", { kind: "sqft", description: "" }], ["Installation", { kind: "fixed", description: "Installation", qty: 1 }], ["Shipping", { kind: "fixed", description: "Shipping", qty: 1 }], ["Sample", { kind: "fixed", description: "Sample", qty: 1 }], ["Other", { kind: "fixed", description: "", qty: 1 }]];
function totalsOf(lines: Line[], dType: string, dValue: any, taxRate: any) {
  const subtotal = n2(lines.reduce((n, l) => n + n2((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0));
  const discount = Math.min(subtotal, n2(dType === "percent" ? subtotal * Math.min(100, Number(dValue) || 0) / 100 : Number(dValue) || 0));
  const tax = n2((subtotal - discount) * (Number(taxRate) || 0) / 100);
  return { subtotal, discount, tax, total: n2(subtotal - discount + tax) };
}
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function InvoiceEditor({ customerId, id, initial, back, onSaved, est }: { customerId?: string | null; id?: string; initial?: any; back: () => void; onSaved: (id: string) => void; est?: boolean }) {
  const base = est ? "admin/estimates" : "admin/invoices";
  const meta = useApi<any>(base + "/new");
  const { data: shop } = useQuery(shopQuery);
  if (shop) registerShop(shop);
  const designs = useMemo(() => liveDesigns(shop).map((d) => ({ slug: d.slug, title: d.title, rate: unitPrice(d) })).sort((a, b) => a.title.localeCompare(b.title)), [shop]);
  const [f, setF] = useState<any>(() => initial ?? { customerId: customerId ?? null, number: "", issueDate: "", dueDate: "", terms: "", lines: [] as Line[], discountType: "amount", discountValue: "", taxRate: "", notes: null, conditions: null });
  const [newCust, setNewCust] = useState(false);
  const s = useSaver();
  const b = meta.data?.business;
  useEffect(() => {
    if (!meta.data || initial) return;
    setF((x: any) => ({ ...x, issueDate: x.issueDate || meta.data.issueDate, dueDate: x.dueDate || meta.data.dueDate, terms: est ? (b.estValidDays ? String(b.estValidDays) : "none") : b.dueDays ? String(b.dueDays) : "0", taxRate: x.taxRate === "" ? (b.taxRate || "") : x.taxRate, notes: x.notes ?? (est ? b.estNotes : b.notes) ?? "", conditions: x.conditions ?? (est ? b.estTerms ?? "" : null), lines: x.lines.length ? x.lines : [{ kind: "sqft", description: "", qty: "", rate: b.ratePerSqft || "" }] }));
  }, [meta.data]);
  const custs = useApi<any>("admin/crm/customers");
  const setLine = (i: number, patch: Partial<Line>) => setF((x: any) => ({ ...x, lines: x.lines.map((l: Line, k: number) => (k === i ? { ...l, ...patch } : l)) }));
  const addLine = (p: Partial<Line>) => setF((x: any) => ({ ...x, lines: [...x.lines, { kind: "fixed", description: "", qty: 1, rate: "", ...p, ...(p.kind === "sqft" ? { qty: "", rate: b?.ratePerSqft || "" } : {}) }] }));
  const t = totalsOf(f.lines, f.discountType, f.discountValue, f.taxRate);
  const cur = (custs.data?.customers ?? []).find((c: any) => c.id === f.customerId);
  const save = async () => {
    let rid = id;
    const ok = await s.run(async () => { const body = { ...f, lines: f.lines.map((l: Line) => ({ kind: l.kind, description: l.description, design_slug: l.design_slug ?? null, design_title: l.design_title ?? null, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0 })) }; const r = await api(id ? `${base}/${id}` : base, { body }); rid = r.id; }, "Saved");
    if (ok && rid) onSaved(rid);
  };
  if (meta.error) return <Msg m={{ text: meta.error }} />;
  if (!meta.data) return <div className="bo-sub">Loading…</div>;
  const pfx = est ? b.estPrefix : b.prefix, word = est ? "Estimate" : "Invoice";
  return <div data-testid={est ? "est-editor" : "inv-editor"}>
    <div className="bo-row" style={{ marginBottom: 10 }}><button className="bo-btn sm" onClick={back}>{id ? "Cancel" : word + "s"}</button></div>
    <div className="bo-top"><h1>{id ? `Edit ${pfx}${f.number}` : "New " + word.toLowerCase()}</h1></div>
    <Msg m={s.msg} />
    <div className="crm-cols">
      <div className="bo-card"><h2>{est ? "Estimate for" : "Bill to"}</h2>
        {cur ? <div className="inv-cust"><div><b style={{ fontWeight: 500 }}>{custLabel(cur)}</b>{cur.company && <span className="bo-sub"> · {cur.company}</span>}<div className="bo-sub">{[cur.email, cur.phone].filter(Boolean).join(" · ")}</div>{(cur.address || cur.ship_address) && <div className="bo-sub" style={{ whiteSpace: "pre-line" }}>{cur.address || cur.ship_address}</div>}</div><button type="button" className="bo-btn sm" onClick={() => setF({ ...f, customerId: null })}>Change</button></div>
          : <CustSearch all={custs.data?.customers ?? null} pick={(c) => setF({ ...f, customerId: c.id })} onNew={() => setNewCust(true)} />}
      </div>
      <div className="bo-card"><h2>Details</h2>
        <div className="bo-grid2">
          <Field label={word + " number"}><div className="inv-num"><span>{pfx}</span><input className="bo-in" inputMode="numeric" value={f.number} placeholder={String(meta.data.number)} onChange={(e) => setF({ ...f, number: e.target.value.replace(/\D/g, "") })} aria-label={word + " number"} /></div></Field>
          <Field label={word + " date"}><input className="bo-in" type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value, dueDate: f.terms !== "" && f.terms !== "custom" && f.terms !== "none" ? addDays(e.target.value, Number(f.terms)) : f.dueDate })} data-testid="inv-date" /></Field>
          {est ? <Field label="Valid for"><select className="bo-sel" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value, dueDate: e.target.value === "custom" ? f.dueDate : e.target.value === "none" ? "" : addDays(f.issueDate, Number(e.target.value)) })} data-testid="est-valid-for"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="none">No end date</option><option value="custom">Custom date</option>{!["7", "14", "30", "60", "90", "none", "custom", ""].includes(f.terms) && <option value={f.terms}>{f.terms} days</option>}</select></Field> : <Field label="Terms"><select className="bo-sel" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value, dueDate: e.target.value === "custom" ? f.dueDate : addDays(f.issueDate, Number(e.target.value)) })} data-testid="inv-terms"><option value="0">Due on receipt</option><option value="7">Net 7</option><option value="15">Net 15</option><option value="30">Net 30</option><option value="60">Net 60</option><option value="custom">Custom date</option>{!["0", "7", "15", "30", "60", "custom", ""].includes(f.terms) && <option value={f.terms}>Net {f.terms}</option>}</select></Field>}
          <Field label={est ? "Valid until" : "Due date"}><input className="bo-in" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value, terms: "custom" })} data-testid="inv-due" /></Field>
        </div></div>
    </div>
    <div className="bo-card"><h2>Items</h2>
      <div className="inv-lines">
        <div className="inv-lh"><span>Item</span><span>Design</span><span className="num">Sq ft / Qty</span><span className="num">Price</span><span className="num">Amount</span><span /></div>
        {f.lines.map((l: Line, i: number) => <div className="inv-line" key={i} data-testid="inv-line">
          <div className="inv-l-desc"><select className="bo-sel inv-kind" value={l.kind} onChange={(e) => setLine(i, { kind: e.target.value as any })} aria-label="Line type"><option value="sqft">Per sq ft</option><option value="fixed">Fixed price</option></select>
            <input className="bo-in" placeholder={l.kind === "sqft" ? "Description, e.g. Tropical Canopy mural, linen" : "Description, e.g. Installation"} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} aria-label="Description" data-testid="inv-l-desc" /></div>
          <div className="inv-l-design">{l.kind === "sqft" ? <select className="bo-sel" value={l.design_slug ?? ""} aria-label="Design" data-testid="inv-l-design" onChange={(e) => { const d = designs.find((x) => x.slug === e.target.value); setLine(i, d ? { design_slug: d.slug, design_title: d.title, description: l.description || d.title, rate: d.rate || l.rate } : { design_slug: null, design_title: null }); }}><option value="">No design</option>{designs.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select> : <span className="bo-sub inv-hide-m">–</span>}</div>
          <div className="inv-l-qty"><label className="inv-ml">{l.kind === "sqft" ? "Sq ft" : "Qty"}</label><input className="bo-in num" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={l.kind === "sqft" ? "Square feet" : "Quantity"} data-testid="inv-l-qty" />
            {l.kind === "sqft" && <WallCalc onSqft={(v) => setLine(i, { qty: v })} />}</div>
          <div className="inv-l-rate"><label className="inv-ml">{l.kind === "sqft" ? "Price / sq ft" : "Price"}</label><input className="bo-in num" inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} aria-label={l.kind === "sqft" ? "Price per square foot" : "Price"} data-testid="inv-l-rate" /></div>
          <div className="inv-l-amt num"><label className="inv-ml">Amount</label><b>{money(n2((Number(l.qty) || 0) * (Number(l.rate) || 0)))}</b></div>
          <div className="inv-l-x"><button type="button" className="bo-btn sm" aria-label="Remove line" onClick={() => setF({ ...f, lines: f.lines.filter((_: any, k: number) => k !== i) })}>Remove</button></div>
        </div>)}
      </div>
      <div className="bo-row" style={{ marginTop: 10 }}><span className="bo-sub">Add:</span>{QUICK.map(([lab, p]) => <button type="button" key={lab} className="bo-btn sm" onClick={() => addLine(p)} data-testid={"inv-add-" + lab.split(" ")[0].toLowerCase()}>{lab}</button>)}</div>
      <div className="inv-tot-edit">
        <div><span>Subtotal</span><b>{money(t.subtotal)}</b></div>
        <div><span className="bo-row" style={{ flexWrap: "nowrap", gap: 6 }}>Discount<select className="bo-sel" style={{ width: 64 }} value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value })} aria-label="Discount type"><option value="amount">$</option><option value="percent">%</option></select><input className="bo-in num" style={{ width: 90 }} inputMode="decimal" value={f.discountValue} onChange={(e) => setF({ ...f, discountValue: e.target.value })} aria-label="Discount" data-testid="inv-discount" /></span><b>{t.discount ? "−" + money(t.discount) : money(0)}</b></div>
        <div><span className="bo-row" style={{ flexWrap: "nowrap", gap: 6 }}>Tax rate %<input className="bo-in num" style={{ width: 90 }} inputMode="decimal" value={f.taxRate} onChange={(e) => setF({ ...f, taxRate: e.target.value })} aria-label="Tax rate" data-testid="inv-tax" /></span><b>{money(t.tax)}</b></div>
        <div className="grand"><span>Total</span><b data-testid="inv-total">{money(t.total)}</b></div>
      </div>
    </div>
    <div className="bo-card"><Field label={est ? "Note on the estimate" : "Note on the invoice"}><textarea className="bo-ta" rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} data-testid="inv-notes" /></Field>{est && <Field label="Terms"><textarea className="bo-ta" rows={3} value={f.conditions ?? ""} onChange={(e) => setF({ ...f, conditions: e.target.value })} data-testid="est-terms" /></Field>}</div>
    <div className="bo-row"><button className="bo-btn pri" disabled={s.busy} onClick={save} data-testid="inv-save">{id ? "Save " + word.toLowerCase() : "Save as draft"}</button><button className="bo-btn" onClick={back}>Cancel</button></div>
    <Drawer open={newCust} onClose={() => setNewCust(false)}>{newCust && <CustomerForm onClose={() => setNewCust(false)} onSaved={async (cid) => { setNewCust(false); await custs.reload(); setF((x: any) => ({ ...x, customerId: cid })); }} />}</Drawer>
  </div>;
}

function CustSearch({ all, pick, onNew }: { all: any[] | null; pick: (c: any) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const list = all ? (ql ? all.filter((c) => `${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(ql)) : all).slice(0, 6) : [];
  return <div>
    <div className="bo-row" style={{ flexWrap: "nowrap" }}><input className="bo-in" placeholder={all ? "Search customers" : "Loading customers…"} value={q} onChange={(e) => setQ(e.target.value)} data-testid="inv-cust-q" aria-label="Customer" /><button type="button" className="bo-btn" onClick={onNew} data-testid="inv-cust-new">New customer</button></div>
    {list.length > 0 && <div className="inv-pick">{list.map((c) => <button type="button" key={c.id} onClick={() => pick(c)} data-testid="inv-cust-opt"><span><b style={{ fontWeight: 500 }}>{custLabel(c)}</b>{c.company ? ` · ${c.company}` : ""}</span><span className="bo-sub">{c.name ? c.email : ""}</span></button>)}</div>}
    {ql && all && !list.length && <div className="bo-sub" style={{ marginTop: 6 }}>No match. Tap New customer to add them.</div>}
  </div>;
}

function WallCalc({ onSqft }: { onSqft: (v: string) => void }) {
  const [open, setOpen] = useState(false); const [w, setW] = useState(""); const [h, setH] = useState("");
  if (!open) return <button type="button" className="inv-link" onClick={() => setOpen(true)}>Wall W x H</button>;
  const calc = (a: string, b2: string) => { const v = n2((Number(a) || 0) * (Number(b2) || 0)); if (v > 0) onSqft(String(v)); };
  return <div className="inv-wall"><input className="bo-in" inputMode="decimal" placeholder="W ft" value={w} onChange={(e) => { setW(e.target.value); calc(e.target.value, h); }} aria-label="Wall width in feet" /><span>x</span><input className="bo-in" inputMode="decimal" placeholder="H ft" value={h} onChange={(e) => { setH(e.target.value); calc(w, e.target.value); }} aria-label="Wall height in feet" /></div>;
}

function InvoicePage({ id, back }: { id: string; back: () => void }) {
  const { data, error, reload } = useApi<any>(`admin/invoices/${id}`, [id]);
  const [mode, setMode] = useState<"" | "edit" | "pay" | "email">("");
  const s = useSaver();
  const docRef = useRef<HTMLDivElement>(null);
  if (error) return <div><button className="bo-btn sm" onClick={back}>Invoices</button><Msg m={{ text: error }} /></div>;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const iv = data.invoice, b = data.business, no = b.prefix + iv.number;
  const act = (body: any, ok: string) => s.run(async () => { await api(`admin/invoices/${id}`, { body }); await reload(); }, ok);
  if (mode === "edit") return <InvoiceEditor id={id} initial={{ customerId: iv.customer_id, number: String(iv.number), issueDate: iv.issue_date, dueDate: iv.due_date ?? "", terms: "custom", lines: data.lines.map((l: any) => ({ kind: l.kind, description: l.description, design_slug: l.design_slug, design_title: l.design_title, qty: String(l.qty), rate: String(l.rate) })), discountType: iv.discount_type, discountValue: iv.discount_value ? String(iv.discount_value) : "", taxRate: iv.tax_rate ? String(iv.tax_rate) : "", notes: iv.notes ?? "", orderId: iv.order_id }} back={() => setMode("")} onSaved={() => { setMode(""); reload(); }} />;
  return <div data-testid="inv-page">
    <div className="bo-row" style={{ marginBottom: 10 }}><button className="bo-btn sm" onClick={back}>Invoices</button><a className="bo-btn sm" href={`#customers:${iv.customer_id}`}>Customer</a>{data.order && <a className="bo-btn sm" href={`#orders:${data.order.id}`}>Order {data.order.id.slice(0, 8).toUpperCase()}</a>}{data.estimate && <a className="bo-btn sm" href={`#estimates:${data.estimate.id}`} data-testid="inv-from-est">Estimate {b.estPrefix}{data.estimate.number}</a>}</div>
    <div className="bo-top"><h1>{no} <span className="bo-sub" style={{ fontSize: 13.5, fontWeight: 400 }}>{iv.bill_to?.name || iv.customer_name}</span></h1><InvStatus i={iv} /></div>
    <Msg m={s.msg} />
    <div className="inv-actions">
      {iv.shown !== "void" && <button className="bo-btn" onClick={() => setMode("edit")} data-testid="inv-edit">Edit</button>}
      {iv.shown !== "void" && iv.balance > 0 && <button className="bo-btn pri" onClick={() => setMode("pay")} data-testid="inv-pay">Record payment</button>}
      {iv.shown !== "void" && <button className="bo-btn" onClick={() => setMode("email")} data-testid="inv-email">Email to customer</button>}
      <button className="bo-btn" onClick={() => printDoc(docRef.current, no)} data-testid="inv-print">Print</button>
      <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => downloadPdf(data), "PDF downloaded")} data-testid="inv-pdf">Download PDF</button>
      {iv.shown === "draft" && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "send" }, "Marked as sent")} data-testid="inv-mark-sent">Mark as sent</button>}
      {iv.shown === "sent" && !iv.paid && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "draft" }, "Back to draft")}>Back to draft</button>}
      {iv.shown !== "void" ? <button className="bo-btn danger" disabled={s.busy} onClick={() => confirm(`Void ${no}? It stays on file, marked void.`) && act({ action: "void" }, "Invoice voided")} data-testid="inv-void">Void</button>
        : <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "unvoid" }, "Invoice restored")}>Restore</button>}
      {(iv.shown === "draft" || iv.shown === "void") && <button className="bo-btn danger" disabled={s.busy} onClick={() => confirm(`Delete ${no} for good?`) && s.run(async () => { await api(`admin/invoices/${id}`, { body: { action: "delete" } }); back(); }, "Deleted")} data-testid="inv-delete">Delete</button>}
    </div>
    <div className="inv-view">
      <div className="inv-paper" ref={docRef}><InvoiceDoc d={data} /></div>
      <div className="inv-side">
        <div className="bo-card"><h2>Balance</h2><dl className="bo-dl inv-dl"><dt>Total</dt><dd>{money(iv.total)}</dd><dt>Paid</dt><dd>{money(iv.paid)}</dd><dt>Balance due</dt><dd><b data-testid="inv-balance">{money(iv.balance)}</b></dd><dt>Due</dt><dd>{iv.due_date ? dShort(iv.due_date) : "–"}{iv.overdue && <span style={{ color: "var(--bo-bad)" }}> (overdue)</span>}</dd>{iv.sent_at && <><dt>Sent</dt><dd>{fmtDate(iv.sent_at)}</dd></>}</dl></div>
        <div className="bo-card"><h2>Payments</h2>
          {!data.payments.length ? <div className="bo-sub">No payments yet.</div> : <ul className="bo-tl">{data.payments.map((p: any) => <li key={p.id} className="inv-payrow" data-testid="inv-payment"><span>{dShort(p.paid_on)}</span><b style={{ fontWeight: 500 }}>{money(p.amount)}</b> {METHOD_L[p.method] ?? p.method}{p.note ? ` · ${p.note}` : ""}<button className="bo-btn sm" style={{ marginLeft: "auto" }} disabled={s.busy} onClick={() => confirm("Remove this payment?") && act({ action: "delete-payment", paymentId: p.id }, "Payment removed")}>Remove</button></li>)}</ul>}
        </div>
      </div>
    </div>
    <Drawer open={mode === "pay"} onClose={() => setMode("")}>{mode === "pay" && <PaymentForm iv={iv} today={data.today} onClose={() => setMode("")} onSaved={async () => { setMode(""); await reload(); }} />}</Drawer>
    <Drawer open={mode === "email"} onClose={() => setMode("")}>{mode === "email" && <EmailForm iv={iv} no={no} onClose={() => setMode("")} onSent={async (to) => { setMode(""); await reload(); s.setMsg({ ok: true, text: `Saved in test mode for ${to} (Back office > Emails). Nothing was sent.` }); }} />}</Drawer>
  </div>;
}

function PaymentForm({ iv, today, onClose, onSaved }: { iv: any; today: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ date: today, amount: String(iv.balance), method: "card", note: "" });
  const s = useSaver();
  return <form onSubmit={async (e) => { e.preventDefault(); const ok = await s.run(() => api(`admin/invoices/${iv.id}`, { body: { action: "payment", ...f } }), "Payment recorded"); if (ok) onSaved(); }} data-testid="inv-pay-form">
    <div className="bo-row" style={{ justifyContent: "space-between", marginBottom: 12 }}><h2>Record payment</h2><button type="button" className="bo-btn sm" onClick={onClose}>Close</button></div>
    <div className="bo-sub" style={{ marginBottom: 12 }}>Balance due {money(iv.balance)}. This records money you already received; nothing is charged.</div>
    <Msg m={s.msg} />
    <div className="bo-grid2"><Field label="Date"><input className="bo-in" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field label="Amount"><input className="bo-in" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} data-testid="inv-pay-amount" /></Field></div>
    <Field label="Method"><div className="bo-row" style={{ gap: 6 }}>{Object.entries(METHOD_L).map(([k, l]) => <button type="button" key={k} className={"bo-btn" + (f.method === k ? " pri" : "")} onClick={() => setF({ ...f, method: k })} data-testid={"inv-pay-" + k}>{l}</button>)}</div></Field>
    <Field label="Note (check number, reference)"><input className="bo-in" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    <button className="bo-btn pri" disabled={s.busy} data-testid="inv-pay-save">Save payment</button>
  </form>;
}

function EmailForm({ iv, no, onClose, onSent, path }: { iv: any; no: string; onClose: () => void; onSent: (to: string) => void; path?: string }) {
  const [to, setTo] = useState(iv.bill_to?.email || iv.customer_email || "");
  const s = useSaver();
  return <form onSubmit={async (e) => { e.preventDefault(); let r: any; const ok = await s.run(async () => { r = await api(path ?? `admin/invoices/${iv.id}`, { body: { action: "email", to } }); }); if (ok) onSent(r.to); }}>
    <div className="bo-row" style={{ justifyContent: "space-between", marginBottom: 12 }}><h2>Email {no}</h2><button type="button" className="bo-btn sm" onClick={onClose}>Close</button></div>
    <div className="bo-msg">Emails are in test mode: the email is saved on the Emails page and is not sent to anyone.</div>
    <Msg m={s.msg} />
    <Field label="To"><input className="bo-in" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
    <button className="bo-btn pri" disabled={s.busy || !to}>Save email (test mode)</button>
  </form>;
}


// ================= ESTIMATES (same editor, document and PDF as invoices) =================
export function Estimates() {
  const [sub, setSub] = useSub("estimates");
  if (sub && sub.startsWith("new")) return <InvoiceEditor est key={sub} customerId={sub.split(":")[1] || null} back={() => setSub(null)} onSaved={(id) => setSub(id)} />;
  if (sub) return <EstimatePage key={sub} id={sub} back={() => setSub(null)} />;
  return <EstimateList />;
}

function EstimateList() {
  const [f, setF] = useState({ status: "", from: "", to: "", q: "" });
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q })), 300); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as any).toString();
  const { data, error } = useApi<any>("admin/estimates?" + qs, [qs]);
  const s = useSaver();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const t = data?.totals;
  return <div data-testid="est-list">
    <div className="bo-top"><h1>Estimates</h1>
      <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => downloadUrl("admin/estimates?" + qs + (qs ? "&" : "") + "format=csv", "estimates.csv"), "CSV downloaded")} data-testid="est-csv">Export CSV</button>
      <button className="bo-btn pri" onClick={() => go("estimates:new")} data-testid="est-new">New estimate</button></div>
    <Msg m={s.msg} />
    {error && <Msg m={{ text: error }} />}
    <div className="bo-kpis" data-testid="est-kpis">
      <div className="bo-kpi"><span>Sent, waiting</span><b>{t ? money(t.open) : "–"}</b></div>
      <div className="bo-kpi"><span>Accepted</span><b>{t ? money(t.accepted) : "–"}</b></div>
      <div className="bo-kpi"><span>Declined</span><b>{t ? money(t.declined) : "–"}</b></div>
      <div className="bo-kpi"><span>Expired</span><b>{t ? money(t.expired) : "–"}</b></div>
    </div>
    <div className="inv-filters">
      <input className="bo-in" placeholder="Customer or estimate number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search estimates" data-testid="est-q" />
      <select className="bo-sel" value={f.status} onChange={set("status")} aria-label="Status" data-testid="est-status"><option value="">All statuses</option><option value="open">Open (draft + sent)</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option><option value="converted">Turned into invoice</option></select>
      <label className="inv-date"><span>From</span><input className="bo-in" type="date" value={f.from} onChange={set("from")} aria-label="From date" /></label>
      <label className="inv-date"><span>To</span><input className="bo-in" type="date" value={f.to} onChange={set("to")} aria-label="To date" /></label>
    </div>
    {!data ? <div className="bo-sub">Loading…</div> : !data.estimates.length ? <div className="bo-empty">{qs ? "No estimates match." : "No estimates yet. Create one here, from a customer, an order or a design request."}</div> :
      <table className="bo-tbl stack"><thead><tr><th>Estimate</th><th>Customer</th><th>Date</th><th>Valid until</th><th className="num">Total</th><th>Status</th></tr></thead><tbody>
        {data.estimates.map((e: any) => <tr key={e.id} className="click" onClick={() => go("estimates:" + e.id)} data-testid="est-row">
          <td><b style={{ fontWeight: 500 }}>{data.prefix + e.number}</b>{e.invoice_number && <div className="bo-sub">{data.invPrefix}{e.invoice_number}</div>}</td>
          <td data-l="Customer">{custLabel({ name: e.customer_name, email: e.customer_email })}{e.customer_company && <span className="bo-sub"> · {e.customer_company}</span>}</td>
          <td data-l="Date">{dShort(e.issue_date)}</td><td data-l="Valid until">{dShort(e.valid_until) || "–"}</td>
          <td className="num" data-l="Total">{money(e.total)}</td><td><EstStatus e={e} /></td></tr>)}
      </tbody></table>}
    {data?.estimates?.length > 0 && <div className="bo-sub" style={{ marginTop: 8 }}>{t.count} estimate{t.count === 1 ? "" : "s"}{t.drafts ? `, ${t.drafts} draft${t.drafts === 1 ? "" : "s"} (${money(t.draftTotal)}, not in the boxes above)` : ""}.</div>}
  </div>;
}

function EstimatePage({ id, back }: { id: string; back: () => void }) {
  const { data, error, reload } = useApi<any>(`admin/estimates/${id}`, [id]);
  const [mode, setMode] = useState<"" | "edit" | "email">("");
  const s = useSaver();
  const docRef = useRef<HTMLDivElement>(null);
  if (error) return <div><button className="bo-btn sm" onClick={back}>Estimates</button><Msg m={{ text: error }} /></div>;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const ev = data.estimate, b = data.business, no = b.estPrefix + ev.number;
  const act = (body: any, ok: string) => s.run(async () => { await api(`admin/estimates/${id}`, { body }); await reload(); }, ok);
  const convert = () => s.run(async () => { const r = await api(`admin/estimates/${id}`, { body: { action: "convert" } }); go("invoices:" + r.id); }, "Invoice created");
  if (mode === "edit") return <InvoiceEditor est id={id} initial={{ customerId: ev.customer_id, number: String(ev.number), issueDate: ev.issue_date, dueDate: ev.valid_until ?? "", terms: ev.valid_until ? "custom" : "none", lines: data.lines.map((l: any) => ({ kind: l.kind, description: l.description, design_slug: l.design_slug, design_title: l.design_title, qty: String(l.qty), rate: String(l.rate) })), discountType: ev.discount_type, discountValue: ev.discount_value ? String(ev.discount_value) : "", taxRate: ev.tax_rate ? String(ev.tax_rate) : "", notes: ev.notes ?? "", conditions: ev.terms ?? "", orderId: ev.order_id, projectId: ev.project_id }} back={() => setMode("")} onSaved={() => { setMode(""); reload(); }} />;
  const open = ev.shown === "draft" || ev.shown === "sent" || ev.shown === "expired";
  return <div data-testid="est-page">
    <div className="bo-row" style={{ marginBottom: 10 }}><button className="bo-btn sm" onClick={back}>Estimates</button><a className="bo-btn sm" href={`#customers:${ev.customer_id}`}>Customer</a>{data.order && <a className="bo-btn sm" href={`#orders:${data.order.id}`}>Order {data.order.id.slice(0, 8).toUpperCase()}</a>}{data.project && <a className="bo-btn sm" href={`#jobs:${data.project.id}`}>Design request</a>}{data.invoice && <a className="bo-btn sm" href={`#invoices:${data.invoice.id}`} data-testid="est-invoice-link">Invoice {b.prefix}{data.invoice.number}</a>}</div>
    <div className="bo-top"><h1>{no} <span className="bo-sub" style={{ fontSize: 13.5, fontWeight: 400 }}>{ev.bill_to?.name || ev.customer_name}</span></h1><EstStatus e={ev} /></div>
    <Msg m={s.msg} />
    <div className="inv-actions">
      {!data.invoice && <button className="bo-btn pri" disabled={s.busy} onClick={() => confirm(`Turn ${no} into an invoice? The estimate is marked Accepted.`) && convert()} data-testid="est-convert">Convert to invoice</button>}
      <button className="bo-btn" onClick={() => setMode("edit")} data-testid="est-edit">Edit</button>
      <button className="bo-btn" onClick={() => setMode("email")} data-testid="est-email">Email to customer</button>
      <button className="bo-btn" onClick={() => printDoc(docRef.current, no)} data-testid="est-print">Print</button>
      <button className="bo-btn" disabled={s.busy} onClick={() => s.run(() => downloadPdf(data), "PDF downloaded")} data-testid="est-pdf">Download PDF</button>
      {ev.shown === "draft" && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "send" }, "Marked as sent")} data-testid="est-mark-sent">Mark as sent</button>}
      {open && !data.invoice && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "accept" }, "Marked accepted")} data-testid="est-accept">Mark accepted</button>}
      {open && !data.invoice && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "decline" }, "Marked declined")} data-testid="est-decline">Mark declined</button>}
      {(ev.shown === "accepted" || ev.shown === "declined") && !data.invoice && <button className="bo-btn" disabled={s.busy} onClick={() => act({ action: "reopen" }, "Reopened")}>Reopen</button>}
      {!data.invoice && <button className="bo-btn danger" disabled={s.busy} onClick={() => confirm(`Delete ${no} for good?`) && s.run(async () => { await api(`admin/estimates/${id}`, { body: { action: "delete" } }); back(); }, "Deleted")} data-testid="est-delete">Delete</button>}
    </div>
    <div className="inv-view">
      <div className="inv-paper" ref={docRef}><InvoiceDoc d={data} /></div>
      <div className="inv-side">
        <div className="bo-card"><h2>Summary</h2><dl className="bo-dl inv-dl"><dt>Total</dt><dd><b data-testid="est-total">{money(ev.total)}</b></dd><dt>Valid until</dt><dd>{ev.valid_until ? dShort(ev.valid_until) : "No end date"}{ev.shown === "expired" && <span style={{ color: "var(--bo-bad)" }}> (expired)</span>}</dd>{ev.sent_at && <><dt>Sent</dt><dd>{fmtDate(ev.sent_at)}</dd></>}{ev.accepted_at && <><dt>Accepted</dt><dd>{fmtDate(ev.accepted_at)}</dd></>}{ev.declined_at && ev.shown === "declined" && <><dt>Declined</dt><dd>{fmtDate(ev.declined_at)}</dd></>}<dt>Invoice</dt><dd>{data.invoice ? <a href={`#invoices:${data.invoice.id}`}>{b.prefix}{data.invoice.number}{data.invoice.status === "void" ? " (void)" : ""}</a> : "Not yet"}</dd></dl></div>
        <div className="bo-sub">When the customer says yes, Convert to invoice copies every line, the discount and the tax into a new draft invoice and links the two.</div>
      </div>
    </div>
    <Drawer open={mode === "email"} onClose={() => setMode("")}>{mode === "email" && <EmailForm iv={ev} no={no} path={`admin/estimates/${id}`} onClose={() => setMode("")} onSent={async (to) => { setMode(""); await reload(); s.setMsg({ ok: true, text: `Saved in test mode for ${to} (Back office > Emails). Nothing was sent.` }); }} />}</Drawer>
  </div>;
}

/** "Create estimate" for an order panel or a design request panel. */
export function CreateEstimateButton({ orderId, projectId }: { orderId?: string; projectId?: string }) {
  const q = orderId ? `order=${orderId}` : `project=${projectId}`;
  const { data } = useApi<any>(`admin/estimates?${q}`, [q]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const est = (data?.estimates ?? []).find((e: any) => e.shown !== "declined");
  if (!data) return null;
  if (est) return <a className="bo-btn sm" href={`#estimates:${est.id}`} data-testid="create-estimate">Estimate {data.prefix}{est.number}</a>;
  return <><button className="bo-btn sm" disabled={busy} data-testid="create-estimate" onClick={async () => { setBusy(true); setErr(""); try { const r = await api(orderId ? "admin/estimates/from-order" : "admin/estimates/from-request", { body: orderId ? { orderId } : { projectId } }); window.location.hash = "estimates:" + r.id; } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}>Create estimate</button>{err && <span className="bo-sub" style={{ color: "var(--bo-bad)" }}>{err}</span>}</>;
}

// ---------- the invoice document (screen + print) ----------
const DOC_CSS = `.inv-doc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111827;font-size:13px;line-height:1.45;background:#fff;padding:36px 40px;position:relative}
.inv-doc *{box-sizing:border-box}
.inv-doc .h{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;flex-wrap:wrap}
.inv-doc .logo img{max-height:52px;max-width:200px;display:block}
.inv-doc .wm{font-family:Georgia,"Times New Roman",serif;font-size:24px;letter-spacing:-.01em}
.inv-doc .wm i{font-style:normal;color:#b45309}
.inv-doc .biz{color:#6b7280;font-size:12px;margin-top:8px;white-space:pre-line}
.inv-doc .t{text-align:right}
.inv-doc .t h2{font-size:22px;letter-spacing:.08em;font-weight:600;margin:0 0 6px}
.inv-doc .meta{display:grid;grid-template-columns:auto auto;gap:2px 14px;justify-content:end;font-size:12.5px}
.inv-doc .meta span{color:#6b7280}
.inv-doc .bill{margin:26px 0 18px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.inv-doc .lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px}
.inv-doc .due{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;text-align:right;min-width:170px}
.inv-doc .due b{display:block;font-size:20px;font-weight:600}
.inv-doc table{width:100%;border-collapse:collapse;margin-top:4px}
.inv-doc th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:500;text-align:left;padding:8px 6px;border-bottom:1px solid #111827}
.inv-doc td{padding:9px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
.inv-doc .r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.inv-doc .sub{color:#6b7280;font-size:11.5px}
.inv-doc .tot{margin-left:auto;width:min(300px,100%);margin-top:12px}
.inv-doc .tot div{display:flex;justify-content:space-between;padding:4px 6px;font-variant-numeric:tabular-nums}
.inv-doc .tot .g{border-top:1px solid #111827;margin-top:4px;padding-top:8px;font-weight:600;font-size:14.5px}
.inv-doc .tot .bd{background:#f9fafb;border-radius:6px;font-weight:600}
.inv-doc .notes{margin-top:26px;font-size:12.5px;white-space:pre-line}
.inv-doc .foot{margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;white-space:pre-line}
.inv-doc .stamp{position:absolute;top:120px;right:40px;transform:rotate(-12deg);border:2px solid currentColor;border-radius:6px;padding:2px 12px;font-weight:700;letter-spacing:.12em;font-size:20px;opacity:.75}
.inv-doc .show-s{display:none}
.inv-doc .stamp.paid,.inv-doc .stamp.accepted{color:#15803d}.inv-doc .stamp.void,.inv-doc .stamp.declined{color:#b91c1c}.inv-doc .stamp.expired{color:#6b7280}
.inv-doc .terms .lab{margin-bottom:2px}
@media (max-width:560px){.inv-doc{padding:20px 16px}.inv-doc .t{text-align:left}.inv-doc .meta{justify-content:start}.inv-doc .due{text-align:left;width:100%}.inv-doc .hide-s{display:none}.inv-doc .show-s{display:block}.inv-doc .stamp{position:static;display:inline-block;transform:none;margin:0 0 12px;font-size:13px;padding:1px 10px}}`;

function qtyText(l: any) { return l.kind === "sqft" ? `${n2(l.qty)} sq ft` : String(n2(l.qty)); }
function rateText(l: any) { return l.kind === "sqft" ? `${money(l.rate)} / sq ft` : money(l.rate); }
export function InvoiceDoc({ d }: { d: any }) {
  const isEst = d.kind === "estimate", iv = isEst ? d.estimate : d.invoice, b = d.business, bt = iv.bill_to ?? {}, pfx = isEst ? b.estPrefix : b.prefix;
  const bizLines = [b.address, [b.phone, b.email].filter(Boolean).join("  ·  "), b.website].filter(Boolean).join("\n");
  const stamp = isEst ? (["accepted", "declined", "expired"].includes(iv.shown) ? iv.shown : "") : iv.shown === "paid" || iv.shown === "void" ? iv.shown : "";
  return <div className="inv-doc" data-testid={isEst ? "est-doc" : "inv-doc"}><style>{DOC_CSS}</style>
    {stamp && <div className={"stamp " + stamp}>{stamp.toUpperCase()}</div>}
    <div className="h">
      <div className="logo">{b.logoUrl ? <><img src={b.logoUrl} alt={b.name} crossOrigin="anonymous" /><div className="biz"><b style={{ color: "#111827" }}>{b.name}</b>{bizLines ? "\n" + bizLines : ""}</div></> : <><div className="wm">{b.name}{b.name === "Artisan Mural" && <i>.</i>}</div>{bizLines && <div className="biz">{bizLines}</div>}</>}</div>
      <div className="t"><h2>{isEst ? "ESTIMATE" : "INVOICE"}</h2><div className="meta"><span>{isEst ? "Estimate" : "Invoice"}</span><b>{pfx}{iv.number}</b><span>Date</span><span style={{ color: "#111827" }}>{dShort(iv.issue_date)}</span>{isEst ? iv.valid_until && <><span>Valid until</span><span style={{ color: "#111827" }}>{dShort(iv.valid_until)}</span></> : iv.due_date && <><span>Due</span><span style={{ color: "#111827" }}>{dShort(iv.due_date)}</span></>}</div></div>
    </div>
    <div className="bill">
      <div><div className="lab">{isEst ? "Prepared for" : "Bill to"}</div><b style={{ fontWeight: 600 }}>{bt.name || iv.customer_name}</b>{bt.company && <div>{bt.company}</div>}{bt.address && <div style={{ whiteSpace: "pre-line" }}>{bt.address}</div>}{bt.email && <div className="sub">{bt.email}</div>}{bt.phone && <div className="sub">{bt.phone}</div>}</div>
      {isEst ? <div className="due"><div className="lab">Estimate total</div><b>{money(iv.total)}</b>{iv.valid_until && <div className="sub">valid until {dShort(iv.valid_until)}</div>}</div> : <div className="due"><div className="lab">{iv.shown === "void" ? "Void" : "Balance due"}</div><b>{money(iv.shown === "void" ? 0 : iv.balance)}</b>{iv.due_date && iv.shown !== "paid" && iv.shown !== "void" && <div className="sub">by {dShort(iv.due_date)}</div>}</div>}
    </div>
    <table><thead><tr><th>Description</th><th className="r hide-s">Qty</th><th className="r hide-s">Price</th><th className="r">Amount</th></tr></thead><tbody>
      {d.lines.map((l: any) => <tr key={l.id}><td>{l.description}{l.design_title && !String(l.description).includes(l.design_title) && <div className="sub">Design: {l.design_title}</div>}<div className="sub show-s">{qtyText(l)} x {rateText(l)}</div></td><td className="r hide-s">{qtyText(l)}</td><td className="r hide-s">{rateText(l)}</td><td className="r">{money(l.amount)}</td></tr>)}
    </tbody></table>
    <div className="tot">
      <div><span>Subtotal</span><span>{money(iv.subtotal)}</span></div>
      {iv.discount > 0 && <div><span>Discount{iv.discount_type === "percent" ? ` (${pct(iv.discount_value)}%)` : ""}</span><span>−{money(iv.discount)}</span></div>}
      {(iv.tax > 0 || iv.tax_rate > 0) && <div><span>Tax ({pct(iv.tax_rate)}%)</span><span>{money(iv.tax)}</span></div>}
      {isEst ? <div className="g bd"><span>Estimate total</span><span>{money(iv.total)}</span></div> : <><div className="g"><span>Total</span><span>{money(iv.total)}</span></div>
      {iv.paid > 0 && <div><span>Paid</span><span>−{money(iv.paid)}</span></div>}
      <div className="bd"><span>Balance due</span><span>{money(iv.shown === "void" ? 0 : iv.balance)}</span></div></>}
    </div>
    {iv.notes && <div className="notes">{iv.notes}</div>}
    {isEst && iv.terms && <div className="notes terms"><div className="lab">Terms</div>{iv.terms}</div>}
    {!isEst && b.footer && <div className="foot">{b.footer}</div>}
  </div>;
}

function printDoc(el: HTMLElement | null, title: string) {
  if (!el) return;
  const fr = document.createElement("iframe");
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(fr);
  const w = fr.contentWindow!; const doc = w.document;
  doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{margin:12mm}body{margin:0}.inv-doc{padding:0!important}</style></head><body>${el.innerHTML}</body></html>`); doc.close();
  const go2 = () => { w.focus(); w.print(); setTimeout(() => fr.remove(), 60000); };
  const imgs = Array.from(doc.images); if (!imgs.length) setTimeout(go2, 50); else Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(go2);
}

// ---------- PDF (pdf-lib, drawn in the browser) ----------
async function downloadPdf(d: any) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const isEst = d.kind === "estimate", iv = isEst ? d.estimate : d.invoice, b = d.business, bt = iv.bill_to ?? {}, pfx = isEst ? b.estPrefix : b.prefix, word = isEst ? "Estimate" : "Invoice";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${word} ${pfx}${iv.number}`); pdf.setAuthor(b.name);
  const F = await pdf.embedFont(StandardFonts.Helvetica), FB = await pdf.embedFont(StandardFonts.HelveticaBold), FS = await pdf.embedFont(StandardFonts.TimesRoman);
  const clean = (t: any) => String(t ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u00D7/g, "x").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
  const ink = rgb(0.067, 0.094, 0.153), grey = rgb(0.42, 0.45, 0.5), line = rgb(0.9, 0.91, 0.92);
  const W = 612, H = 792, M = 50;
  let page = pdf.addPage([W, H]); let y = H - M;
  const txt = (t: any, x: number, yy: number, o: { f?: any; s?: number; c?: any; right?: boolean } = {}) => { const f = o.f ?? F, sz = o.s ?? 10, s2 = clean(t); const w = f.widthOfTextAtSize(s2, sz); page.drawText(s2, { x: o.right ? x - w : x, y: yy, size: sz, font: f, color: o.c ?? ink }); return w; };
  const wrap = (t: string, f: any, sz: number, maxW: number) => { const out: string[] = []; for (const para of clean(t).split("\n")) { let cur = ""; for (const w of para.split(/\s+/)) { const nx = cur ? cur + " " + w : w; if (f.widthOfTextAtSize(nx, sz) > maxW && cur) { out.push(cur); cur = w; } else cur = nx; } out.push(cur); } return out; };
  // header: logo or wordmark
  let top = y;
  if (b.logoUrl) {
    try { const r = await fetch(b.logoUrl); const buf = new Uint8Array(await r.arrayBuffer()); const isPng = buf[0] === 0x89 && buf[1] === 0x50; const img = isPng ? await pdf.embedPng(buf) : await pdf.embedJpg(buf); const sc = Math.min(160 / img.width, 46 / img.height, 1); page.drawImage(img, { x: M, y: y - img.height * sc, width: img.width * sc, height: img.height * sc }); y -= img.height * sc + 14; txt(b.name, M, y, { f: FB, s: 10 }); y -= 13; }
    catch { txt(b.name, M, y - 18, { f: FS, s: 22 }); y -= 34; }
  } else { const w = txt(b.name, M, y - 18, { f: FS, s: 22 }); if (b.name === "Artisan Mural") txt(".", M + w, y - 18, { f: FS, s: 22, c: rgb(0.71, 0.33, 0.04) }); y -= 34; }
  for (const l of [b.address, [b.phone, b.email].filter(Boolean).join("  -  "), b.website].filter(Boolean).flatMap((x: string) => wrap(x, F, 9.5, 260))) { txt(l, M, y, { s: 9.5, c: grey }); y -= 12.5; }
  // title block (right)
  let ty = top - 18;
  txt(word.toUpperCase(), W - M, ty, { f: FB, s: 20, right: true }); ty -= 22;
  const meta: [string, string][] = [[word, pfx + iv.number], ["Date", dShort(iv.issue_date)], ...(isEst ? (iv.valid_until ? [["Valid until", dShort(iv.valid_until)] as [string, string]] : []) : iv.due_date ? [["Due", dShort(iv.due_date)] as [string, string]] : [])];
  for (const [k, v] of meta) { txt(v, W - M, ty, { f: k === word ? FB : F, s: 10, right: true }); txt(k, W - M - 110, ty, { s: 10, c: grey }); ty -= 14; }
  const stp = isEst ? (["accepted", "declined", "expired"].includes(iv.shown) ? iv.shown : "") : iv.shown === "paid" || iv.shown === "void" ? iv.shown : "";
  if (stp) { const c = stp === "paid" || stp === "accepted" ? rgb(0.08, 0.5, 0.24) : stp === "expired" ? rgb(0.42, 0.45, 0.5) : rgb(0.73, 0.11, 0.11); txt(stp.toUpperCase(), W - M, ty - 8, { f: FB, s: 16, c, right: true }); ty -= 24; }
  y = Math.min(y, ty) - 22;
  // bill to + balance box
  txt(isEst ? "PREPARED FOR" : "BILL TO", M, y, { s: 8.5, c: grey }); let by = y - 14;
  for (const [l, f, c] of [[bt.name || iv.customer_name, FB, ink], [bt.company, F, ink], ...(bt.address ? wrap(bt.address, F, 10, 260).map((x) => [x, F, ink]) : []), [bt.email, F, grey], [bt.phone, F, grey]] as any[]) { if (!l) continue; txt(l, M, by, { f, s: 10, c }); by -= 13; }
  const bx = W - M - 180; page.drawRectangle({ x: bx, y: y - 44, width: 180, height: 52, color: rgb(0.976, 0.98, 0.984), borderColor: line, borderWidth: 1 });
  txt(isEst ? "ESTIMATE TOTAL" : iv.shown === "void" ? "VOID" : "BALANCE DUE", W - M - 10, y - 8, { s: 8.5, c: grey, right: true }); txt(money(isEst ? iv.total : iv.shown === "void" ? 0 : iv.balance), W - M - 10, y - 30, { f: FB, s: 17, right: true });
  y = Math.min(by, y - 52) - 18;
  // table
  const cQ = W - M - 230, cR = W - M - 110, cA = W - M, dW = cQ - M - 90;
  const head = () => { txt("DESCRIPTION", M, y, { s: 8.5, c: grey }); txt("QTY", cQ, y, { s: 8.5, c: grey, right: true }); txt("PRICE", cR, y, { s: 8.5, c: grey, right: true }); txt("AMOUNT", cA, y, { s: 8.5, c: grey, right: true }); y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink }); y -= 15; };
  head();
  for (const l of d.lines) {
    const ds = wrap(l.description, F, 10, dW + 80); if (l.design_title && !String(l.description).includes(l.design_title)) ds.push("Design: " + l.design_title);
    if (y - ds.length * 13 < 140) { page = pdf.addPage([W, H]); y = H - M; head(); }
    txt(qtyText(l), cQ, y, { right: true }); txt(rateText(l), cR, y, { right: true }); txt(money(l.amount), cA, y, { right: true });
    ds.forEach((x, k) => { txt(x, M, y - k * 13, { s: k && x.startsWith("Design: ") ? 9 : 10, c: k && x.startsWith("Design: ") ? grey : ink }); });
    y -= ds.length * 13 + 4; page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: line }); y -= 8;
  }
  if (y < 170) { page = pdf.addPage([W, H]); y = H - M; }
  const tx = W - M - 220; y -= 4;
  const row = (k: string, v: string, f = F, sz = 10) => { txt(k, tx, y, { f, s: sz }); txt(v, W - M, y, { f, s: sz, right: true }); y -= sz + 6; };
  row("Subtotal", money(iv.subtotal));
  if (iv.discount > 0) row(`Discount${iv.discount_type === "percent" ? ` (${pct(iv.discount_value)}%)` : ""}`, "-" + money(iv.discount));
  if (iv.tax > 0 || iv.tax_rate > 0) row(`Tax (${pct(iv.tax_rate)}%)`, money(iv.tax));
  page.drawLine({ start: { x: tx, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 1, color: ink }); y -= 4;
  if (isEst) { page.drawRectangle({ x: tx - 6, y: y - 4, width: W - M - tx + 6, height: 18, color: rgb(0.976, 0.98, 0.984) }); row("Estimate total", money(iv.total), FB, 11.5); }
  else {
  row("Total", money(iv.total), FB, 11.5);
  if (iv.paid > 0) row("Paid", "-" + money(iv.paid));
  page.drawRectangle({ x: tx - 6, y: y - 4, width: W - M - tx + 6, height: 18, color: rgb(0.976, 0.98, 0.984) });
  row("Balance due", money(iv.shown === "void" ? 0 : iv.balance), FB, 11);
  }
  y -= 14;
  for (const blk of (isEst ? [iv.notes, iv.terms ? "Terms: " + iv.terms : ""] : [iv.notes, b.footer]).filter(Boolean)) { for (const l of wrap(blk, F, 9.5, W - 2 * M)) { if (y < M) { page = pdf.addPage([W, H]); y = H - M; } txt(l, M, y, { s: 9.5, c: blk === b.footer ? grey : ink }); y -= 12.5; } y -= 8; }
  const bytes = await pdf.save();
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); a.download = `${word}-${pfx}${iv.number}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- order panel button ----------
export function OrderInvoiceButton({ orderId }: { orderId: string }) {
  const { data } = useApi<any>(`admin/invoices?order=${orderId}`, [orderId]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const inv = (data?.invoices ?? []).find((i: any) => i.shown !== "void");
  if (!data) return null;
  if (inv) return <a className="bo-btn sm" href={`#invoices:${inv.id}`} data-testid="order-invoice">Invoice {data.prefix}{inv.number}</a>;
  return <><button className="bo-btn sm" disabled={busy} data-testid="order-create-invoice" onClick={async () => { setBusy(true); setErr(""); try { const r = await api("admin/invoices/from-order", { body: { orderId } }); go("invoices:" + r.id); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}>Create invoice</button>{err && <span className="bo-sub" style={{ color: "var(--bo-bad)" }}>{err}</span>}</>;
}
