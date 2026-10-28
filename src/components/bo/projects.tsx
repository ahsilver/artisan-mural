import { useEffect, useState } from "react";
import { api, useApi, money, fmtDate, fmtDateTime, Pill, Msg, Field, Drawer, useSaver } from "./common";
import { Chat, AttList, ContactNote } from "@/components/projects";
import { uploadFile, driveImport } from "@/lib/designer-files";
import { findContactDetails } from "@/lib/contact-guard";
import { CreateEstimateButton } from "./billing";

const TONE: Record<string, any> = { requested: "warn", quoted: "info", approved: "info", in_progress: "warn", delivered: "ok", cancelled: "bad", closed: "bad" };
const DLABEL: Record<string, string> = { requested: "Needs your price", quoted: "Price sent, waiting for customer", approved: "Approved, waiting for payment", in_progress: "Paid: make the final file", delivered: "Delivered", cancelled: "Closed" };
const ALABEL: Record<string, string> = { requested: "Waiting for a price", quoted: "Price sent", approved: "Approved, not paid yet", in_progress: "Waiting on designer", delivered: "Ready to print", cancelled: "Cancelled", closed: "Closed by the store" };
export const projectLabel = (s: string, admin?: boolean) => (admin ? ALABEL : DLABEL)[s] ?? s;
export const projectTone = (s: string) => TONE[s];
const daysLeft = (iso?: string | null) => { if (!iso) return ""; const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5); return d < 0 ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "due today" : `${d} day${d === 1 ? "" : "s"} left`; };
const sizeTxt = (n: number) => (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + " GB" : n >= 1024 ** 2 ? Math.round(n / 1024 ** 2) + " MB" : Math.round(n / 1024) + " KB");

function QuoteForm({ p, onDone }: { p: any; onDone: () => void }) {
  const mine = p.quotes.find((q: any) => q.status === "sent");
  const [f, setF] = useState({ fee: mine ? String(mine.fee) : "", days: mine ? String(mine.days) : "", note: mine?.note ?? "" });
  const s = useSaver();
  const warn = f.note ? findContactDetails(f.note) : null;
  const fee = Number(f.fee) || 0;
  return <div className="bo-card" style={{ borderColor: "var(--clay, #3b6d8c)" }}>
    <h2>{mine ? "Change your price" : "Send your price"}</h2>
    <div className="bo-sub" style={{ marginBottom: 10 }}>Your price for the design work and how many days you need after the customer pays. The customer pays this together with the printing.</div>
    <Msg m={s.msg} />
    <div className="bo-grid2"><Field label="Your price for the work ($)"><input className="bo-in" type="number" min="1" step="1" inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} aria-label="Your price" /></Field>
      <Field label="Days to finish"><input className="bo-in" type="number" min="1" max="365" inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} aria-label="Days to finish" /></Field></div>
    {fee > 0 && <div className="bo-sub" style={{ marginBottom: 8 }}>You earn {money(fee * (1 - (p.commission ?? 10) / 100))} after the studio's {p.commission ?? 10}% commission.</div>}
    <Field label="Note to the customer (optional)"><textarea className="bo-ta" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What's included, how many revisions…" /></Field>
    {warn && <div className="bo-msg bad">This looks like {warn}. Contact details can't be shared. Keep everything on the site.</div>}
    <button className="bo-btn pri" disabled={s.busy || !!warn || !(fee > 0) || !(Number(f.days) > 0)} onClick={() => s.run(async () => { await api(`projects/${p.id}/quote`, { body: { fee, days: Number(f.days), note: f.note } }); onDone(); }, "Price sent. The customer gets an email and a notification.")}>{mine ? "Send new price" : "Send price to customer"}</button>
  </div>;
}

function Deliver({ p, onDone }: { p: any; onDone: () => void }) {
  const s = useSaver();
  const [mode, setMode] = useState<"file" | "drive">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [prog, setProg] = useState("");
  const go = () => s.run(async () => {
    let r: any;
    if (mode === "file") { if (!file) throw new Error("Choose the final file."); r = await uploadFile(file, { uploadId: p.id, purpose: "original" }, (d, t) => setProg(`Uploading ${Math.round((d / t) * 100)}%`)); }
    else { if (!link.trim()) throw new Error("Paste the Google Drive link."); r = await driveImport(link.trim(), p.id, (d, t, n) => setProg(`Copying ${n} from Google Drive ${t ? Math.round((d / t) * 100) : 0}%`)); }
    setProg("Saving…");
    await api(`projects/${p.id}/deliver`, { body: { key: r.key, filename: r.filename, size: r.size, note } });
    setProg(""); onDone();
  }, "Delivered. The order moved to Ready to print.");
  return <div className="bo-card" style={{ borderColor: "var(--clay, #3b6d8c)" }}>
    <h2>{p.status === "delivered" ? "Replace the final file" : "Deliver the final file"}</h2>
    <div className="bo-sub" style={{ marginBottom: 10 }}>Wall: {p.order?.selection?.width} × {p.order?.selection?.height} {p.order?.selection?.unit} ({p.order?.sqft} sq ft). Due {fmtDate(p.dueAt)} ({daysLeft(p.dueAt)}). Print-ready, full size. Any size file is fine.</div>
    <Msg m={s.msg} />
    <div className="bo-tabs" style={{ marginBottom: 10 }}><button className={mode === "file" ? "on" : ""} onClick={() => setMode("file")}>Upload file</button><button className={mode === "drive" ? "on" : ""} onClick={() => setMode("drive")}>Google Drive link</button></div>
    {mode === "file" ? <Field label="Final print file (TIFF, JPG, PNG, PDF)"><input className="bo-in" type="file" accept=".tif,.tiff,.jpg,.jpeg,.png,.pdf,.psd" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Final file" />{file && <div className="bo-sub">{file.name} · {sizeTxt(file.size)}</div>}</Field>
      : <Field label="Google Drive link" hint="Set sharing to 'Anyone with the link'. We copy the file to the studio's storage."><input className="bo-in" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/…" aria-label="Google Drive link" /></Field>}
    <Field label="Note for the studio (optional)"><input className="bo-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Print at 100%, bleed included…" /></Field>
    {prog && <div className="bo-sub" style={{ marginBottom: 8 }}>{prog}</div>}
    <button className="bo-btn pri" disabled={s.busy} onClick={go}>{p.status === "delivered" ? "Replace file" : "Deliver final file"}</button>
  </div>;
}

/** One design request for the designer (price, chat, delivery) or the owner (everything, read-only chat). */
export function ProjectPanel({ id, admin, onChanged, onClose }: { id: string; admin?: boolean; onChanged?: () => void; onClose: () => void }) {
  const { data: p, error, reload } = useApi<any>("projects/" + id, [id]);
  const [tab, setTab] = useState<string | null>(null);
  const s = useSaver();
  const done = () => { reload(); onChanged?.(); };
  if (error) return <Msg m={{ text: error }} />;
  if (!p) return <div className="bo-sub">Loading…</div>;
  const thread = p.threads.find((t: any) => t.designer.uid === tab) ?? p.threads[0];
  const canQuote = !admin && p.myRole === "designer" && ["requested", "quoted"].includes(p.status);
  return <div>
    <div className="bo-row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><h2 style={{ margin: 0 }}>{p.title}</h2><button className="bo-btn sm" onClick={onClose}>Close</button></div>
    <div className="bo-row" style={{ margin: "6px 0 12px" }}><Pill tone={TONE[p.status]}>{projectLabel(p.status, admin)}</Pill><span className="bo-sub">{p.kind === "edit" ? "Change request" : "Custom design"}{p.open && !p.quoteId ? " · open to all designers" : ""} · from {p.customer?.name}{admin && p.customer?.email ? ` (${p.customer.email})` : ""} · {fmtDateTime(p.createdAt)}</span></div>
    {admin && <div className="bo-row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}><CreateEstimateButton projectId={p.id} />
      {(p.open || p.hidden) && <button className="bo-btn sm" data-testid="req-hide" onClick={async () => { await api(`community/admin/requests/${p.id}`, { body: { action: p.hidden ? "show" : "hide" } }); reload(); onChanged?.(); }}>{p.hidden ? "Show to designers again" : "Hide from designers"}</button>}
      {["requested", "quoted"].includes(p.status) && <button className="bo-btn sm" data-testid="req-close" onClick={async () => { if (!confirm("Close this request? Designers can no longer send offers.")) return; await api(`community/admin/requests/${p.id}`, { body: { action: "close" } }); reload(); onChanged?.(); }}>Close request</button>}
      {p.status === "closed" && <button className="bo-btn sm" onClick={async () => { await api(`community/admin/requests/${p.id}`, { body: { action: "reopen" } }); reload(); onChanged?.(); }}>Reopen</button>}
      {p.hidden && <Pill tone="warn">Hidden</Pill>}</div>}
    <Msg m={s.msg} />
    <div className="bo-card">
      {p.designSlug && <div className="bo-row" style={{ marginBottom: 8 }}>{p.designThumb && <img className="bo-thumb" src={p.designThumb} alt="" />}<a href={`/design/${p.designSlug}`} target="_blank" rel="noreferrer">{p.designTitle}</a></div>}
      <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{p.brief}</div>
      <div className="bo-sub" style={{ marginTop: 6 }}>{[p.room && `Room: ${p.room}`, p.wallSize && `Wall: ${p.wallSize}`, p.budget && `Budget: ${p.budget}`, p.deadline && `Needed by ${fmtDate(p.deadline)}`].filter(Boolean).join(" · ")}</div>
      {p.attachments.length > 0 && <div style={{ marginTop: 8 }}><AttList items={p.attachments} /></div>}
    </div>
    {(p.fee != null || p.quotes.length > 0) && <div className="bo-card"><h2>Price</h2>
      {p.fee != null ? <div className="bo-dl"><span>Design fee</span><b>{money(p.fee)}</b><span>Days</span><b>{p.days}</b>{p.designerEarns != null && <><span>{admin ? "Designer earns" : "You earn"}</span><b>{money(p.designerEarns)}</b></>}{admin && p.commissionPct != null && <><span>Studio commission</span><b>{money(p.fee - p.designerEarns)} ({p.commissionPct}%)</b></>}{p.paidAt && <><span>Paid</span><b>{fmtDateTime(p.paidAt)}</b></>}{p.dueAt && <><span>Due</span><b>{fmtDate(p.dueAt)} {p.status === "in_progress" ? `(${daysLeft(p.dueAt)})` : ""}</b></>}</div>
        : <table className="bo-tbl"><thead><tr><th>Designer</th><th className="num">Price</th><th className="num">Days</th><th>Status</th></tr></thead><tbody>{p.quotes.map((q: any) => <tr key={q.id}><td>{q.designer}</td><td className="num">{money(q.fee)}</td><td className="num">{q.days}</td><td>{q.status === "sent" ? "Waiting for customer" : q.status}</td></tr>)}</tbody></table>}
    </div>}
    {p.order && <div className="bo-card"><h2>Order</h2><div className="bo-dl"><span>Status</span><b>{p.order.status === "waiting_on_designer" ? "Waiting on designer" : p.order.status === "ready_to_print" ? "Ready to print" : p.order.status}</b><span>Wall</span><b>{p.order.selection?.width} × {p.order.selection?.height} {p.order.selection?.unit} ({p.order.sqft} sq ft)</b><span>Finish</span><b>{p.order.finish}</b>{admin && <><span>Customer paid</span><b>{money(p.order.due)}</b></>}</div>{admin && <a className="bo-btn sm" style={{ marginTop: 8 }} href="/admin#orders">Open in Orders</a>}</div>}
    {p.final && (p.final.url || p.final.link) && <div className="bo-card"><h2>Final file</h2><div className="bo-row">{p.final.url && <a className="bo-btn pri" href={p.final.url} target="_blank" rel="noreferrer">Download {p.final.name}{p.final.size ? ` (${sizeTxt(p.final.size)})` : ""}</a>}{p.final.link && <a className="bo-btn" href={p.final.link} target="_blank" rel="noreferrer">Open Google Drive file</a>}</div>{p.final.note && <div className="bo-sub" style={{ marginTop: 6 }}>Note: {p.final.note}</div>}<div className="bo-sub">Delivered {fmtDateTime(p.deliveredAt)}</div></div>}
    {canQuote && <QuoteForm p={{ ...p, commission: p.commissionPct ?? undefined }} onDone={done} />}
    {!admin && p.myRole === "designer" && p.status === "approved" && <div className="bo-msg">The customer approved your price. Work starts when they pay; you'll get a notification.</div>}
    {!admin && p.myRole === "designer" && (p.status === "in_progress" || p.status === "delivered") && <Deliver p={p} onDone={done} />}
    <div className="bo-card"><h2>Messages with the customer</h2>
      {p.threads.length > 1 && <div className="bo-tabs" style={{ marginBottom: 8 }}>{p.threads.map((t: any) => <button key={t.designer.uid} className={thread?.designer.uid === t.designer.uid ? "on" : ""} onClick={() => setTab(t.designer.uid)}>{t.designer.name}</button>)}</div>}
      {admin ? (thread ? <Chat projectId={p.id} thread={thread} canWrite={false} onSent={reload} compact /> : <div className="bo-sub">No messages yet.</div>)
        : <Chat projectId={p.id} thread={thread} onSent={reload} compact canWrite={p.status !== "cancelled"} />}
      {admin && <ContactNote className="mt-2" />}
    </div>
    {admin && !["cancelled"].includes(p.status) && <button className="bo-btn sm danger" disabled={s.busy} onClick={() => confirm("Cancel this request? (A paid order must also be refunded in Orders.)") && s.run(async () => { await api(`projects/${p.id}/cancel`, { body: {} }); done(); }, "Cancelled")}>Cancel request</button>}
  </div>;
}

const FILTERS: [string, string][] = [["todo", "To do"], ["requested", "Needs your price"], ["quoted", "Waiting for customer"], ["in_progress", "To deliver"], ["delivered", "Delivered"], ["all", "All"]];
/** Designer: every request and job in one list. */
export function DesignerRequests({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const { data, error, reload } = useApi<any>("projects/designer", []);
  const [f, setF] = useState("todo");
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const all = data.projects as any[];
  const list = all.filter((p) => f === "all" ? true : f === "todo" ? ["requested", "in_progress"].includes(p.status) && !p.lost : p.status === f);
  const n = (k: string) => all.filter((p) => (k === "todo" ? ["requested", "in_progress"].includes(p.status) && !p.lost : k === "all" ? true : p.status === k)).length;
  return <div>
    <div className="bo-tabs" style={{ flexWrap: "wrap" }}>{FILTERS.map(([k, l]) => <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l} ({n(k)})</button>)}</div>
    {list.length === 0 ? <div className="bo-empty">{f === "todo" ? "Nothing to do right now." : "Nothing here."}</div> :
      <table className="bo-tbl stack"><thead><tr><th>Request</th><th>Customer</th><th>Status</th><th className="num">Price</th><th>Due</th><th className="num">You earn</th><th></th></tr></thead><tbody>
        {list.map((p) => <tr key={p.id} className="click" onClick={() => onOpen(p.id)}>
          <td><div className="bo-row" style={{ flexWrap: "nowrap" }}>{p.designThumb ? <img className="bo-thumb" src={p.designThumb} alt="" /> : <div className="bo-thumb" style={{ display: "grid", placeItems: "center", fontSize: 10 }}>Custom</div>}<div>{p.title}<div className="bo-sub">{p.kind === "edit" ? "Change request" : "Custom design"} · {fmtDate(p.createdAt)}</div></div></div></td>
          <td data-l="Customer">{p.customer}</td>
          <td><Pill tone={TONE[p.status]}>{p.lost ? "Customer chose another designer" : DLABEL[p.status]}</Pill></td>
          <td className="num" data-l="Price">{p.fee != null ? money(p.fee) : p.myQuote ? money(p.myQuote.fee) : "-"}</td>
          <td data-l="Due">{p.status === "in_progress" ? <b style={{ fontWeight: 500 }}>{fmtDate(p.dueAt)} <span className="bo-sub">({daysLeft(p.dueAt)})</span></b> : p.status === "delivered" ? <span className="bo-sub">Done {fmtDate(p.deliveredAt)}</span> : p.myQuote ? <span className="bo-sub">{p.myQuote.days} days</span> : ""}</td>
          <td className="num" data-l="You earn">{p.earns != null ? money(p.earns) : ""}</td>
          <td><button className="bo-btn sm">Open</button></td></tr>)}
      </tbody></table>}
    {data.open.length > 0 && <div style={{ marginTop: 18 }}><h2 style={{ fontSize: 16 }}>Open custom requests (any designer can send a price)</h2>
      <table className="bo-tbl stack"><thead><tr><th>Request</th><th>Customer</th><th>Sent</th><th></th></tr></thead><tbody>{data.open.map((p: any) => <tr key={p.id} className="click" onClick={() => onOpen(p.id)}><td>{p.title}<div className="bo-sub" style={{ maxWidth: 520 }}>{p.brief}</div></td><td data-l="Customer">{p.customer}</td><td data-l="Sent">{fmtDate(p.createdAt)}</td><td><button className="bo-btn sm">Send a price</button></td></tr>)}</tbody></table></div>}
    <Drawer open={!!openId} onClose={() => { onOpen(null); reload(); }}>{openId && <ProjectPanel id={openId} onChanged={reload} onClose={() => { onOpen(null); reload(); }} />}</Drawer>
  </div>;
}

/** Owner: all design requests with their state, money and files. */
export function DesignJobs() {
  const [st, setSt] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const h = window.location.hash; if (h.startsWith("#jobs:")) setOpen(h.slice(6)); }, []);
  const { data, error, reload } = useApi<any>("projects/admin?status=" + st, [st]);
  const c = data?.counts ?? {};
  return <div>
    <div className="bo-top"><h1>Design requests</h1></div>
    <div className="bo-sub" style={{ marginTop: -6, marginBottom: 12 }}>Change requests and custom designs between customers and designers. Studio commission on designer fees: {data?.commission ?? "-"}% (Settings &gt; General).</div>
    <div className="bo-kpis">{[["requested", "Waiting for a price"], ["quoted", "Price sent"], ["approved", "Approved, not paid"], ["in_progress", "Waiting on designer"], ["delivered", "Ready to print"]].map(([k, l]) => <button key={k} className="bo-kpi" style={{ textAlign: "left", cursor: "pointer", border: st === k ? "1px solid var(--foreground, #222)" : undefined }} onClick={() => setSt(st === k ? "all" : k)}><span>{l}</span><b>{c[k] ?? 0}</b></button>)}</div>
    {error && <Msg m={{ text: error }} />}
    {!data ? <div className="bo-sub">Loading…</div> : data.projects.length === 0 ? <div className="bo-empty">No design requests{st !== "all" ? " with this status" : ""} yet.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Request</th><th>Customer</th><th>Designer</th><th>Status</th><th className="num">Design fee</th><th className="num">Commission</th><th>Due</th></tr></thead><tbody>
        {data.projects.map((p: any) => <tr key={p.id} className="click" onClick={() => setOpen(p.id)}>
          <td>{p.title}<div className="bo-sub">{p.kind === "edit" ? "Change request" : "Custom design"} · {fmtDate(p.createdAt)}{p.quotes > 1 ? ` · ${p.quotes} prices` : ""}</div></td>
          <td data-l="Customer">{p.customer}</td><td data-l="Designer">{p.designer}</td>
          <td><Pill tone={TONE[p.status]}>{ALABEL[p.status]}</Pill></td>
          <td className="num" data-l="Design fee">{p.fee != null ? money(p.fee) : "-"}</td><td className="num" data-l="Commission">{p.commission != null ? money(p.commission) : "-"}</td>
          <td data-l="Due">{p.status === "in_progress" ? `${fmtDate(p.dueAt)} (${daysLeft(p.dueAt)})` : p.status === "delivered" ? `Delivered ${fmtDate(p.deliveredAt)}` : ""}</td></tr>)}
      </tbody></table>}
    <Drawer open={!!open} onClose={() => { setOpen(null); reload(); }}>{open && <ProjectPanel id={open} admin onChanged={reload} onClose={() => { setOpen(null); reload(); }} />}</Drawer>
  </div>;
}

/** Collections: a designer groups designs of one idea; the owner sees and edits all of them. */
export function CollectionsEditor({ admin }: { admin?: boolean }) {
  const { data, error, reload } = useApi<any>("collections", []);
  const [edit, setEdit] = useState<any | null>(null);
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const titleOf = (slug: string) => data.designs.find((d: any) => d.slug === slug)?.title ?? slug;
  const pool = edit ? data.designs.filter((d: any) => admin ? (!edit.designerSlug || d.designerSlug === edit.designerSlug) : true) : [];
  return <div>
    <div className="bo-top">{admin ? <h1>Collections</h1> : <h2 style={{ margin: 0 }}>Your collections</h2>}<button className="bo-btn pri" onClick={() => setEdit({ title: "", description: "", designs: [], designerSlug: admin ? "" : data.mySlug })}>New collection</button></div>
    <div className="bo-sub" style={{ marginBottom: 12 }}>A collection groups designs of the same idea (for example different leaves). Each design in it shows "Part of the … collection, see the full collection".</div>
    <Msg m={s.msg} />
    {data.collections.length === 0 ? <div className="bo-empty">No collections yet.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Collection</th>{admin && <th>Designer</th>}<th>Designs</th><th></th></tr></thead><tbody>{data.collections.map((c: any) => <tr key={c.id}>
        <td><b style={{ fontWeight: 500 }}>{c.title}</b><div className="bo-sub">{c.description}</div></td>{admin && <td data-l="Designer">{data.designers[c.designerSlug] ?? c.designerSlug}</td>}
        <td data-l="Designs">{c.designs.map(titleOf).join(", ")}</td>
        <td><div className="bo-row" style={{ flexWrap: "nowrap" }}><a className="bo-btn sm" href={`/collections/${c.id}`} target="_blank" rel="noreferrer">View</a><button className="bo-btn sm" onClick={() => setEdit({ ...c })}>Edit</button><button className="bo-btn sm danger" onClick={() => confirm(`Delete "${c.title}"? The designs stay.`) && s.run(async () => { await api("collections/" + c.id, { method: "DELETE" }); reload(); }, "Deleted")}>Delete</button></div></td></tr>)}</tbody></table>}
    <Drawer open={!!edit} onClose={() => setEdit(null)}>{edit && <div>
      <div className="bo-row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{edit.id ? "Edit collection" : "New collection"}</h2><button className="bo-btn sm" onClick={() => setEdit(null)}>Close</button></div>
      <Msg m={s.msg} />
      {admin && <Field label="Designer"><select className="bo-sel" value={edit.designerSlug} onChange={(e) => setEdit({ ...edit, designerSlug: e.target.value, designs: [] })}><option value="">Choose…</option>{Object.entries(data.designers).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}</select></Field>}
      <Field label="Name"><input className="bo-in" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Leaves" maxLength={80} /></Field>
      <Field label="Short description (optional)"><textarea className="bo-ta" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={500} /></Field>
      <label className="bo-lbl">Designs in this collection ({edit.designs.length})</label>
      {(admin && !edit.designerSlug) ? <div className="bo-sub">Choose a designer first.</div> : pool.length === 0 ? <div className="bo-sub">No designs yet.</div> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>{pool.map((d: any) => { const on = edit.designs.includes(d.slug); return <button key={d.slug} type="button" aria-pressed={on} onClick={() => setEdit({ ...edit, designs: on ? edit.designs.filter((x: string) => x !== d.slug) : [...edit.designs, d.slug] })} style={{ textAlign: "left", border: on ? "2px solid var(--clay, #3b6d8c)" : "1px solid #ddd", borderRadius: 6, padding: 6, background: on ? "#eef4f8" : "#fff" }}>
          {d.thumb ? <img src={d.thumb} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4 }} /> : <div style={{ width: "100%", aspectRatio: "1", background: "#eee", borderRadius: 4 }} />}
          <div style={{ fontSize: 12, marginTop: 4 }}>{on ? "✓ " : ""}{d.title}</div>{!d.live && <div className="bo-sub" style={{ fontSize: 11 }}>Not live yet</div>}</button>; })}</div>}
      <button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(async () => { await api("collections", { body: edit }); setEdit(null); reload(); }, "Collection saved")}>Save collection</button>
    </div>}</Drawer>
  </div>;
}
