import { useState } from "react";
import { CropTool } from "./crop";
import { ReadyToPrint } from "./ready-print";
import { NewOrder } from "./new-order";
import { OrderInvoiceButton, CreateEstimateButton } from "./billing";
import { MessageCustomer } from "@/components/messenger";
import { api, useApi, money, fmtDate, fmtDateTime, Pill, Msg, Field, Drawer, useSaver } from "./common";

export const STATUS_TONE: Record<string, any> = { awaiting_payment: "warn", paid: "info", waiting_on_designer: "warn", ready_to_print: "ok", processing: "info", printing: "info", shipped: "ok", delivered: "ok", cancelled: "bad", refunded: "bad" };
const FLOW = ["awaiting_payment", "paid", "waiting_on_designer", "ready_to_print", "processing", "printing", "shipped", "delivered"];
const LABEL: Record<string, string> = { awaiting_payment: "New (awaiting payment)", paid: "New (paid)", waiting_on_designer: "Waiting on designer", ready_to_print: "Ready to print", processing: "In production", printing: "Printing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
export const statusLabel = (s: string) => LABEL[s] ?? s;
const CARRIERS = ["", "UPS", "USPS", "FedEx", "DHL", "Other"];

export function Orders() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(() => (typeof window !== "undefined" && window.location.hash.startsWith("#orders:") ? window.location.hash.slice(8) : null));
  const [adding, setAdding] = useState(false);
  const qs = new URLSearchParams({ status, q, from, to }).toString();
  const { data, error, loading, reload } = useApi<any>("admin/orders?" + qs, []);
  const orders = data?.orders ?? [];
  async function exportCsv() {
    const r: Response = await api("admin/orders.csv?" + qs, { raw: true });
    const blob = await r.blob(); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }
  const total = orders.reduce((n: number, o: any) => n + (["cancelled", "refunded"].includes(o.status) ? 0 : Number(o.estimated_total)), 0);
  return <div>
    <div className="bo-top"><h1>Orders</h1><button className="bo-btn" onClick={exportCsv}>Export CSV</button><button className="bo-btn pri" onClick={() => setAdding(true)} data-testid="new-order">New order</button></div>
    <div className="bo-row" style={{ marginBottom: 12 }}>
      <select className="bo-sel" style={{ width: 190 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="all">All statuses</option><option value="open">Open (not shipped)</option>
        {[...FLOW, "cancelled", "refunded"].map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
      </select>
      <input className="bo-in" style={{ flex: "1 1 200px", width: "auto" }} placeholder="Search name, email, design, tracking…" value={q} onChange={(e) => setQ(e.target.value)} />
      <input className="bo-in" style={{ width: 150 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
      <input className="bo-in" style={{ width: 150 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
    </div>
    {error && <Msg m={{ text: error }} />}
    <div className="bo-sub" style={{ marginBottom: 8 }}>{loading ? "Loading…" : `${orders.length} orders · ${money(total)}`}</div>
    {orders.length === 0 && !loading ? <div className="bo-empty">No orders match.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Date</th><th>Customer</th><th>Design</th><th className="num">Sq ft</th><th className="num">Total</th><th>Status</th><th>Tracking</th></tr></thead>
        <tbody>{orders.map((o: any) => <tr key={o.id} className="click" onClick={() => setOpen(o.id)}>
          <td data-l="Date">{fmtDate(o.created_at)}</td>
          <td><b style={{ fontWeight: 500 }}>{o.customer_name}</b><div className="bo-sub">{o.customer_email}</div></td>
          <td data-l="Design"><div className="bo-row" style={{ flexWrap: "nowrap" }}>{o.thumb && <img className="bo-thumb bo-hide-m" src={o.thumb} alt="" style={{ width: 36, height: 36 }} />}<div>{o.design_title}<div className="bo-sub">{(() => { let sl: any = o.selection; try { if (typeof sl === "string") sl = JSON.parse(sl); } catch { sl = null; } return <>{sl?.wallName ? <>{sl.wallName} · </> : null}{sl?.colorName ? <>{sl.colorName} · </> : null}</>; })()}{o.finish}{o.source && o.source !== "website" ? ` · ${o.source}` : ""}</div></div></div></td>
          <td className="num" data-l="Sq ft">{Number(o.square_feet).toFixed(1)}</td>
          <td className="num" data-l="Total">{money(o.estimated_total)}</td>
          <td><Pill tone={STATUS_TONE[o.status]}>{LABEL[o.status] ?? o.status}</Pill>{o.status === "waiting_on_designer" && o.due_at && <div className="bo-sub">Due {fmtDate(o.due_at)}</div>}{o.project_id && <div className="bo-sub">Design request</div>}</td>
          <td data-l="Tracking" className="bo-sub">{o.tracking_number ? `${o.carrier ?? ""} ${o.tracking_number}` : ""}</td>
        </tr>)}</tbody></table>}
    <Drawer open={!!open} onClose={() => setOpen(null)}>{open && <OrderPanel id={open} onChanged={reload} onClose={() => setOpen(null)} />}</Drawer>
    <Drawer open={adding} onClose={() => setAdding(false)}>{adding && <NewOrder onDone={(nid) => { setAdding(false); reload(); setOpen(nid); }} />}</Drawer>
  </div>;
}

function OrderPanel({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { data, error, reload } = useApi<any>("admin/orders/" + id, [id]);
  const s = useSaver();
  const [carrier, setCarrier] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [cropping, setCropping] = useState(false);
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const o = data.order;
  const car = carrier ?? o.carrier ?? "";
  const trk = tracking ?? o.tracking_number ?? "";
  const sel = o.selection ?? {};
  const save = (patch: any, okText = "Saved.") => s.run(async () => { await api("admin/orders/" + id, { body: { ...patch, notify } }); await reload(); onChanged(); }, okText);
  return <div>
    <div className="bo-row" style={{ justifyContent: "space-between" }}><h2>Order {o.id.slice(0, 8).toUpperCase()}</h2><button className="bo-btn sm" onClick={onClose}>Close</button></div>
    <div className="bo-sub">{fmtDateTime(o.created_at)} · {o.source === "website" ? "Website" : o.source}</div>
    <div className="bo-row" style={{ marginTop: 8, gap: 6 }}><MessageCustomer orderId={o.id} name={o.customer_name || o.customer_email || "the customer"} /><OrderInvoiceButton orderId={o.id} /><CreateEstimateButton orderId={o.id} /></div>
    <Msg m={s.msg} />
    <div style={{ marginTop: 12 }}><label className="bo-lbl">Status</label>
      <div className="bo-steps">{FLOW.map((st) => { const i = FLOW.indexOf(o.status); const k = FLOW.indexOf(st); return <button key={st} disabled={s.busy} className={st === o.status ? "cur" : i >= 0 && k < i ? "done" : ""} onClick={() => save({ status: st }, `Status: ${LABEL[st]}`)}>{LABEL[st]}</button>; })}</div>
      <div className="bo-row"><button className="bo-btn sm danger" disabled={s.busy || o.status === "cancelled"} onClick={() => confirm("Cancel this order?") && save({ status: "cancelled" }, "Order cancelled")}>Cancel order</button><button className="bo-btn sm danger" disabled={s.busy || o.status === "refunded"} onClick={() => confirm("Mark this order refunded?") && save({ status: "refunded" }, "Marked refunded")}>Mark refunded</button>
        <label className="bo-switch" style={{ marginLeft: "auto" }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email customer (test mode)</label></div>
    </div>
    <div className="bo-card" style={{ marginTop: 14 }} id="print"><h2>Print this order</h2><ReadyToPrint order={o} art={data.art} /></div>
    {data.project && <div className="bo-card" style={{ marginTop: 14 }}><h2>{data.project.kind === "edit" ? "Change request" : "Custom design"}: {data.project.title}</h2>
      <div className="bo-dl"><span>Designer</span><b>{data.project.designer ?? "-"}</b><span>Design fee</span><b>{money(data.project.fee)}</b><span>Printing</span><b>{money(Number(o.estimated_total) - Number(data.project.fee || 0))}</b><span>Due</span><b>{fmtDate(data.project.dueAt)}{data.project.days ? ` (${data.project.days} days)` : ""}</b><span>Designer status</span><b>{data.project.deliveredAt ? `Delivered ${fmtDateTime(data.project.deliveredAt)}` : "Working on it"}</b></div>
      <div className="bo-sub" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{data.project.brief}</div>
      {data.project.finalNote && <div className="bo-msg" style={{ marginTop: 8 }}>Designer's note: {data.project.finalNote}</div>}
      <div className="bo-row" style={{ marginTop: 8 }}><a className="bo-btn sm" href={"/admin#jobs:" + data.project.id}>Open the request and chat</a></div>
    </div>}
    <div className="bo-card" style={{ marginTop: 14 }}><h2>Shipping</h2>
      <div className="bo-grid2"><Field label="Carrier"><select className="bo-sel" value={car} onChange={(e) => setCarrier(e.target.value)}>{CARRIERS.map((c) => <option key={c} value={c}>{c || "Choose…"}</option>)}</select></Field>
        <Field label="Tracking number"><input className="bo-in" value={trk} onChange={(e) => setTracking(e.target.value)} /></Field></div>
      <div className="bo-row"><button className="bo-btn pri" disabled={s.busy} onClick={() => save({ carrier: car, tracking: trk, ...(trk && !["shipped", "delivered"].includes(o.status) ? { status: "shipped" } : {}) }, "Tracking saved")}>Save tracking</button>
        {data.trackingUrl && <a className="bo-btn" href={data.trackingUrl} target="_blank" rel="noreferrer">Open tracking</a>}</div>
      <div className="bo-sub" style={{ marginTop: 6 }}>The customer sees the tracking link in their account.</div>
    </div>
    {data.art && (cropping ? <CropTool orderId={id} src={data.art.url} original={data.art.original} wallRatio={sel.width && sel.height ? sel.width / sel.height : null} onCancel={() => setCropping(false)} onSaved={async () => { setCropping(false); s.setMsg({ ok: true, text: "Cropped print file saved. Original kept." }); await reload(); }} /> :
      <div className="bo-card"><h2>{o.design_title}{data.art.name && data.art.name !== o.design_title ? ` · ${data.art.name}` : ""}</h2>
        <a href={data.art.url} target="_blank" rel="noreferrer"><img src={data.art.url} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#f5f5f4", borderRadius: 6, border: "1px solid #e7e5e4" }} /></a>
        <div className="bo-row" style={{ marginTop: 8 }}><a className="bo-btn" href={data.art.url} target="_blank" rel="noreferrer">Open preview</a>{data.art.original && <a className="bo-btn" href={data.art.original.url + "&download=" + encodeURIComponent(data.art.original.filename)} target="_blank" rel="noreferrer">Download print original ({data.art.original.size >= 1024 ** 3 ? (data.art.original.size / 1024 ** 3).toFixed(1) + " GB" : Math.round(data.art.original.size / 1024 ** 2) + " MB"})</a>}<button className="bo-btn" onClick={() => setCropping(true)} title="Only if you want a different crop than the customer chose">Re-crop by hand</button>{sel.width && sel.height ? <span className="bo-sub">Customer wall {sel.width} × {sel.height} {sel.unit}</span> : null}</div>
      </div>)}
    <div className="bo-card"><h2>All stored files</h2>
      {data.files.length ? data.files.map((f: any) => <div key={f.url} className="bo-row" style={{ justifyContent: "space-between", padding: "4px 0" }}><span>{f.label}</span><a className="bo-btn sm" href={f.url} target="_blank" rel="noreferrer">Download</a></div>) : <div className="bo-sub">No print file attached to this design yet. Built-in sample designs have no print file.</div>}
    </div>
    <div className="bo-card"><h2>Details</h2>
      <dl className="bo-dl">
        <dt>Customer</dt><dd>{o.customer_name}</dd><dt>Email</dt><dd>{o.customer_email || "—"}</dd><dt>Phone</dt><dd>{o.phone || "—"}</dd>
        <dt>Ship to</dt><dd style={{ whiteSpace: "pre-line" }}>{o.shipping_address}</dd>
        <dt>Design</dt><dd>{o.design_title}{(sel.colorName || sel.color) ? ` · color ${sel.colorName || (/^c\d+$/.test(sel.color) ? (data?.art?.name ?? sel.color) : sel.color)}` : ""}</dd><dt>Finish</dt><dd>{o.finish}</dd>
        <dt>Wall</dt><dd>{sel.wallName ? <b>{sel.wallName}: </b> : null}{sel.width && sel.height ? `${sel.width} × ${sel.height} ${sel.unit ?? ""}` : "—"}{sel.panels ? ` · ${sel.panels} panels` : ""}</dd>
        <dt>Area</dt><dd>{Number(o.square_feet).toFixed(2)} sq ft</dd><dt>Total</dt><dd>{money(o.estimated_total)}</dd>
        <dt>Payment</dt><dd><select className="bo-sel" style={{ width: 180, height: 28 }} value={o.payment_method ?? ""} onChange={(e) => save({ paymentMethod: e.target.value }, "Payment saved")}><option value="">Not recorded</option><option>Card (Sola)</option><option>PayPal</option><option>Bank transfer</option><option>Cash / check</option><option>Invoice</option><option>Other</option></select></dd>
        <dt>Customer note</dt><dd>{o.notes || "—"}</dd>
        {data.cartSiblings.length > 0 && <><dt>Same checkout</dt><dd>{data.cartSiblings.map((c: any) => <div key={c.id}>{c.design_slug} · {money(c.estimated_total)}</div>)}</dd></>}
      </dl>
    </div>
    <div className="bo-card"><h2>Notes and history</h2>
      <textarea className="bo-ta" placeholder="Add an internal note (only you see it)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="bo-row" style={{ margin: "8px 0 10px" }}><button className="bo-btn" disabled={!note.trim() || s.busy} onClick={async () => { if (await save({ note }, "Note added")) setNote(""); }}>Add note</button></div>
      <ul className="bo-tl">{data.events.map((e: any) => <li key={e.id}><span>{fmtDateTime(e.created_at)}</span>{e.kind === "note" ? <b style={{ fontWeight: 500 }}>Note: </b> : null}{e.message}</li>)}{!data.events.length && <li className="bo-sub">No history yet.</li>}</ul>
    </div>
  </div>;
}

function AddOrder({ onDone }: { onDone: () => void }) {
  const s = useSaver();
  const [f, setF] = useState<any>({ customer: "", email: "", phone: "", address: "", design: "", finish: "", sqft: "", total: "", notes: "" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return <div><h2>Add an order</h2><div className="bo-sub" style={{ marginBottom: 12 }}>For orders that came by phone, email or showroom.</div>
    <Msg m={s.msg} />
    <div className="bo-grid2"><Field label="Customer name"><input className="bo-in" value={f.customer} onChange={set("customer")} /></Field><Field label="Email"><input className="bo-in" value={f.email} onChange={set("email")} /></Field></div>
    <div className="bo-grid2"><Field label="Phone"><input className="bo-in" value={f.phone} onChange={set("phone")} /></Field><Field label="Design"><input className="bo-in" value={f.design} onChange={set("design")} placeholder="design name or slug" /></Field></div>
    <Field label="Shipping address"><textarea className="bo-ta" value={f.address} onChange={set("address")} /></Field>
    <div className="bo-grid3"><Field label="Finish"><input className="bo-in" value={f.finish} onChange={set("finish")} /></Field><Field label="Sq ft"><input className="bo-in" type="number" value={f.sqft} onChange={set("sqft")} /></Field><Field label="Total ($)"><input className="bo-in" type="number" value={f.total} onChange={set("total")} /></Field></div>
    <Field label="Notes"><textarea className="bo-ta" value={f.notes} onChange={set("notes")} /></Field>
    <button className="bo-btn pri" disabled={s.busy} onClick={async () => { if (await s.run(() => api("admin/orders", { body: f }), "Order added")) onDone(); }}>Save order</button>
  </div>;
}
