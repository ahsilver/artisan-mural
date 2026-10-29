import { RepeatIcon, repeatTypeOf, type RepeatType } from "@/components/designer/design-editor";
import { MatchLabel } from "../designer/match-info";
import { ThumbsBar } from "./thumbs";
import { designBySlug, materials, defaultMaterials } from "@/lib/catalog";
const finishName = (id: string) => (materials.find((m) => m.id === id) ?? defaultMaterials.find((m) => m.id === id))?.name ?? id;
/** The designer's recommended finish(es) + note, read-only, for the owner's review screens. */
function RecFinish({ r }: { r: any }) {
  if (!r || (!r.ids?.length && !r.note)) return null;
  return <div className="bo-sub" data-testid="review-rec-finish" style={{ marginTop: 4 }}><span style={{ display: "inline-block", background: "#8EC6E7", color: "#082635", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600, marginRight: 6 }}>Recommended finish</span>{r.ids?.length ? r.ids.map(finishName).join(", ") : "—"}{r.note ? <> · “{r.note}”</> : null}</div>;
}
import { useEffect, useState } from "react";
import { api, useApi, money, fmtDate, fmtDateTime, Pill, Msg, Field, Switch, Drawer, useSaver } from "./common";
import { STATUS_TONE, statusLabel } from "./orders";
import { loadSite } from "@/lib/site-settings";
import { getTaxonomy, setTaxonomy, canonicalCategories, canonicalRooms } from "@/lib/design-taxonomy";
import { defaultMockupRooms } from "@/lib/auto-mockup";
import { MockupRoomPicker, remakeRoomMockups } from "@/components/mockup-rooms";
function downloadCsv(name: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]); const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.click();
}

export function Overview({ go }: { go: (s: string) => void }) {
  const { data, error } = useApi<any>("admin/overview");
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const by = Object.fromEntries((data.counts ?? []).map((c: any) => [c.status, c]));
  const open = ["awaiting_payment", "paid", "processing", "printing"].reduce((n, s) => n + (by[s]?.n ?? 0), 0);
  return <div>
    <div className="bo-top"><h1>Overview</h1></div>
    <div className="bo-kpis">
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("orders")}><span>Open orders</span><b>{open}</b></button>
      <div className="bo-kpi"><span>Sales, last 30 days</span><b>{money(data.month?.t)}</b><span>{data.month?.n ?? 0} orders</span></div>
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("designs")}><span>Designs to review</span><b>{data.pendingDesigns}</b></button>
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("designers")}><span>Designer applications</span><b>{data.pendingDesigners}</b></button>
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("payouts")}><span>Owed to designers</span><b>{money(data.owed)}</b></button>
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("customers")}><span>Accounts</span><b>{data.customers}</b></button>
      <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => go("requests")}><span>New custom requests</span><b>{data.newRequests}</b></button>
    </div>
    <div className="bo-card"><h2>Latest orders</h2>
      {data.recent.length ? <table className="bo-tbl stack"><tbody>{data.recent.map((o: any) => <tr key={o.id} className="click" onClick={() => go("orders")}><td data-l="Date">{fmtDate(o.created_at)}</td><td>{o.customer_name}</td><td data-l="Design">{o.design_title || designBySlug(o.design_slug)?.title || o.design_slug.replace(/-/g, " ")}</td><td className="num">{money(o.estimated_total)}</td><td><Pill tone={STATUS_TONE[o.status]}>{statusLabel(o.status)}</Pill></td></tr>)}</tbody></table> : <div className="bo-sub">No orders yet.</div>}
    </div>
  </div>;
}

const REVIEW_TONE: any = { approved: "ok", pending: "warn", rejected: "bad" };
export function Designs() {
  const { data, error, reload } = useApi<any>("admin/designs");
  const [tab, setTab] = useState("pending");
  const [edit, setEdit] = useState<any>(null);
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const ups = data.uploads.filter((u: any) => tab === "builtin" ? false : tab === "all" ? true : tab === "pending" ? u.review === "pending" && u.submittedAt : tab === "drafts" ? !u.submittedAt && u.review === "pending" : u.review === tab);
  const review = (u: any, action: string) => { const note = action === "rejected" ? prompt("Reason for the designer (optional)") ?? "" : ""; s.run(async () => { await api(`admin/designs/${u.id}/review`, { body: { action, note } }); reload(); }, action === "approved" ? `Approved "${u.title}"` : `Updated "${u.title}"`); };
  const listing = (slug: string, hidden: boolean) => s.run(async () => { await api(`admin/designs/${slug}/listing`, { body: { hidden } }); reload(); }, hidden ? "Hidden from the shop" : "Shown in the shop");
  const count = (t: string) => data.uploads.filter((u: any) => t === "pending" ? u.review === "pending" && u.submittedAt : u.review === t).length;
  return <div>
    <div className="bo-top"><h1>Designs</h1></div>
    <ThumbsBar key={count("approved")} />
    <div className="bo-tabs">{[["pending", `To review (${count("pending")})`], ["approved", `Approved (${count("approved")})`], ["rejected", "Rejected"], ["drafts", "Drafts"], ["all", "All uploads"], ["builtin", `Sample designs (${data.builtIn.length})`], ["archived", "Deleted by designers"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
    <Msg m={s.msg} />
    {tab === "archived" ? <Archive /> : tab === "builtin" ? <table className="bo-tbl stack"><thead><tr><th></th><th>Design</th><th>Designer</th><th>Price / sq ft</th><th>Shop</th><th></th></tr></thead><tbody>
      {data.builtIn.map((d: any) => <tr key={d.slug}><td><img className="bo-thumb" src={d.image} alt="" /></td><td>{d.title}<div className="bo-sub">{d.slug}</div></td><td data-l="Designer">{d.designer}</td><td data-l="Price">{d.pricePerSqft ? money(d.pricePerSqft) : "Default"}</td>
        <td><Switch checked={!d.hidden} onChange={(v) => listing(d.slug, !v)} label={d.hidden ? "Hidden" : "Visible"} /></td><td><button className="bo-btn sm" onClick={() => setEdit(d)}>Edit</button></td></tr>)}
    </tbody></table> :
      ups.length === 0 ? <div className="bo-empty">Nothing here.</div> :
        <table className="bo-tbl stack"><thead><tr><th></th><th>Design</th><th>Designer</th><th>Type / size</th><th>Review</th><th>Shop</th><th></th></tr></thead><tbody>
          {ups.map((u: any) => <tr key={u.id}><td>{u.thumb ? <img className="bo-thumb" src={u.thumb} alt="" /> : <div className="bo-thumb" />}</td>
            <td>{u.title}<div className="bo-sub">{u.sku} · {u.colors.length} color{u.colors.length === 1 ? "" : "s"}{u.sales ? ` · ${u.sales.orders} sold` : ""}</div><OriginalToggle id={u.id} /><RecFinish r={u.recommendedFinish} />
              {u.mockups?.length ? <div data-testid="review-mockups" style={{ display: "flex", gap: 4, marginTop: 6 }}>{u.mockups.slice(0, 3).map((m: string, i: number) => <a key={i} href={m} target="_blank" rel="noreferrer" title="Room mockup (made automatically)"><img src={m} alt="Room mockup" loading="lazy" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 4, display: "block" }} /></a>)}</div> : <div className="bo-sub">No room mockups yet</div>}</td>
            <td data-l="Designer">{u.ownerName || u.owner}</td>
            <td data-l="Type">{u.kind === "repeating" ? `Repeat (${u.repeat})` : "Mural"}<div className="bo-sub">{u.widthCm ? `${(u.widthCm / 30.48).toFixed(1)} × ${(u.heightCm / 30.48).toFixed(1)} ft` : ""}</div></td>
            <td><Pill tone={REVIEW_TONE[u.review]}>{u.submittedAt || u.review !== "pending" ? u.review : "draft"}</Pill></td>
            <td>{u.review === "approved" ? <Switch checked={!u.hidden} onChange={(v) => listing(u.slug, !v)} /> : <span className="bo-sub">—</span>}</td>
            <td><div className="bo-row">{u.review !== "approved" && <button className="bo-btn sm pri" disabled={s.busy} onClick={() => review(u, "approved")}>Approve</button>}{u.review !== "rejected" && <button className="bo-btn sm" disabled={s.busy} onClick={() => review(u, "rejected")}>Reject</button>}<button className="bo-btn sm" onClick={() => setEdit(u)}>Edit</button>{u.review === "approved" && <a className="bo-btn sm" href={`/design/${u.slug}`} target="_blank" rel="noreferrer">View</a>}</div></td></tr>)}
        </tbody></table>}
    <Drawer open={!!edit} onClose={() => setEdit(null)}>{edit && <EditDesign d={edit} onDone={() => { setEdit(null); reload(); }} />}</Drawer>
  </div>;
}
function AdminRepeatType({ d }: { d: any }) {
  const s = useSaver();
  const [rt, setRt] = useState<RepeatType>(repeatTypeOf(d.kind, d.repeat));
  const [hd, setHd] = useState(d.repeat === "halfdrop");
  const save = (t: RepeatType, h0: boolean) => { const h = t === "full" && h0; setRt(t); setHd(h); void s.run(() => api(`designer/uploads/${d.id}`, { body: { kind: t === "mural" ? "mural" : "repeating", repeat: t === "mural" ? "none" : t === "sideways" ? "horizontal" : h ? "halfdrop" : "both" } }), "Repeat type saved. The shop updates within 2 minutes."); };
  return <Field label="Repeat type" hint="How the design repeats on the wall. The product page, size calculator and room previews follow it.">
    <div className="de-types" role="radiogroup" aria-label="Repeat type" data-testid="admin-repeat-type">{([["full", "Repeats all sides"], ["sideways", "Repeats sideways only"], ["mural", "Mural, no repeat"]] as [RepeatType, string][]).map(([t, l]) => <button key={t} type="button" role="radio" aria-checked={rt === t} className={"de-type" + (rt === t ? " on" : "")} onClick={() => save(t, hd)}><RepeatIcon t={t} size={36} /><b>{l}</b></button>)}</div>
    {rt !== "mural" && <div className="de-seg" data-testid="match-control"><MatchLabel />{[false, true].map((h) => { const on = rt === "full" ? hd === h : !h; return <button key={String(h)} type="button" className={on ? "on" : ""} disabled={h && rt !== "full"} title={h && rt !== "full" ? "Half-drop needs a tile that repeats on all sides and was drawn as half-drop" : undefined} onClick={() => { if (rt === "full") save("full", h); }}>{h ? "Half-drop" : "Straight"}</button>; })}</div>}
    {rt === "sideways" && <p className="bo-sub" style={{ margin: "6px 0 0" }}>Half-drop needs a tile that repeats on all sides and was drawn as half-drop.</p>}
    <Msg m={s.msg} />
  </Field>;
}
function EditDesign({ d, onDone }: { d: any; onDone: () => void }) {
  const s = useSaver();
  const [f, setF] = useState<any>({ title: d.title ?? "", story: d.story ?? "", description: d.description ?? "", pricePerSqft: d.pricePerSqft ?? "", categories: canonicalCategories(d.categories ?? []), rooms: canonicalRooms(d.madeFor ?? []) });
  const [tax, setTax] = useState(getTaxonomy());
  useEffect(() => { loadSite().then((site: any) => { if (site?.taxonomy) { setTaxonomy(site.taxonomy); setTax(getTaxonomy()); } }).catch(() => {}); }, []);
  const chips = (key: "categories" | "rooms", list: string[]) => <div className="bo-row" style={{ gap: 5 }}>{list.map((x) => { const on = f[key].includes(x); return <button key={x} type="button" aria-pressed={on} className={"bo-btn sm" + (on ? " pri" : "")} onClick={() => setF({ ...f, [key]: on ? f[key].filter((y: string) => y !== x) : [...f[key], x] })}>{x}</button>; })}</div>;
  const [colors, setColors] = useState<any[]>(d.colors ?? []);
  const colorEdit = async (c: any, body: any) => { const r = await s.run(() => api(`admin/colorways/${c.id}`, body === "DELETE" ? { method: "DELETE" } : { body }), "Color saved"); if (r !== undefined && r !== false) { const fresh = await api("admin/designs"); const u = fresh.uploads.find((x: any) => x.id === d.id); if (u) setColors(u.colors); } };
  return <div><h2>Edit {d.title}</h2><div className="bo-sub" style={{ marginBottom: 12 }}>Changes show in the shop. Leave price empty to use the site price.</div><Msg m={s.msg} />
    <Field label="Title"><input className="bo-in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
    {!d.builtIn && d.id && <AdminRepeatType d={d} />}
    <Field label="Price per sq ft ($)" hint={`Empty = the default price.${d.suggestedPrice ? ` Designer suggests $${Number(d.suggestedPrice).toFixed(2)}.` : ""}`}><div className="bo-row" style={{ flexWrap: "nowrap" }}><input className="bo-in" type="number" step="0.01" value={f.pricePerSqft} onChange={(e) => setF({ ...f, pricePerSqft: e.target.value })} />{d.suggestedPrice ? <button type="button" className="bo-btn sm" onClick={() => setF({ ...f, pricePerSqft: d.suggestedPrice })}>Use suggested</button> : null}</div></Field>
    <Field label="Style" hint="Shop filters and category links use these. Edit the lists in Settings > Categories.">{chips("categories", tax.styles)}</Field>
    <Field label="Theme / subject">{chips("categories", tax.themes)}</Field>
    <Field label="Rooms">{chips("rooms", tax.rooms)}</Field>
    <Field label="Short description"><textarea className="bo-ta" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
    <Field label="Story"><textarea className="bo-ta" value={f.story} onChange={(e) => setF({ ...f, story: e.target.value })} /></Field>
    {!d.builtIn && colors.length > 0 && <Field label={`Colors (${colors.length})`} hint="The first color is the main picture. Changes show in the shop within 2 minutes.">
      <div data-testid="admin-colors">{colors.map((c: any, i: number) => <div key={c.id} className="bo-row" style={{ gap: 6, padding: "5px 0", borderTop: i ? "1px solid #f0efed" : "none", flexWrap: "nowrap" }}>
        {c.thumb ? <img src={c.thumb} alt="" className="bo-thumb" style={{ width: 40, height: 40 }} /> : <div className="bo-thumb" style={{ width: 40, height: 40 }} />}
        <input type="color" className="bo-swatch" defaultValue={c.swatch || "#cccccc"} onBlur={(e) => e.target.value !== c.swatch && colorEdit(c, { swatch: e.target.value })} aria-label={`Color dot for ${c.name}`} />
        <input className="bo-in" defaultValue={c.name} maxLength={40} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && colorEdit(c, { name: e.target.value })} aria-label="Color name" style={{ flex: 1 }} />
        {i > 0 && <button type="button" className="bo-btn sm" onClick={() => colorEdit(c, { move: -1 })} aria-label="Move up">↑</button>}
        {colors.length > 1 && <button type="button" className="bo-btn sm" onClick={() => confirm(`Remove the color "${c.name}"? Its print file stays in storage.`) && colorEdit(c, "DELETE")}>Remove</button>}
      </div>)}</div>
      {d.designerDescription && !d.description && <div className="bo-sub">Designer's description: {d.designerDescription}</div>}
    </Field>}
    {d.recommendedFinish && (d.recommendedFinish.ids?.length || d.recommendedFinish.note) ? <Field label="Recommended finish (from the designer)"><RecFinish r={d.recommendedFinish} /></Field> : null}
    {(d.notes || d.tags?.length || d.palette) && <Field label="From the designer">
      <div className="bo-sub">{d.notes && <>Printing notes: {d.notes}<br /></>}{d.palette && <>Main colors: {d.palette}<br /></>}{d.tags?.length ? <>Keywords: {d.tags.join(", ")}</> : null}</div>
    </Field>}
    {!d.builtIn && d.colors?.length > 0 && <AdminRoomPictures d={d} />}
    {!d.builtIn && d.id && <OriginalLinks id={d.id} />}
    {d.printFile && <Field label="Print file"><a className="bo-btn sm" href={d.printFile} target="_blank" rel="noreferrer">Open print file</a></Field>}
    <button className="bo-btn pri" disabled={s.busy} onClick={async () => { if (await s.run(() => api(`admin/designs/${d.slug}/override`, { body: f }))) onDone(); }}>Save</button>
  </div>;
}
const fsz = (b: number) => (b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(1) + " GB" : Math.max(1, Math.round(b / 1024 ** 2)) + " MB");
/** Owner: the real storage link of every full-resolution original (not the preview pictures). */
function OriginalToggle({ id }: { id: string }) {
  const [open, setOpen] = useState(true);
  return <div style={{ marginTop: 6 }}><button type="button" className="bo-btn sm" data-testid="original-toggle" onClick={() => setOpen(!open)}>{open ? "Hide original file" : "Show original file (full size)"}</button>{open && <OriginalLinks id={id} />}</div>;
}
function OriginalLinks({ id }: { id: string }) {
  const { data, error } = useApi<any>(`admin/designs/u-${id}/originals`, [id]);
  const [copied, setCopied] = useState("");
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(""), 1500); } catch {} };
  return <Field label="Full-resolution original files (for printing)">
    {error ? <div className="bo-sub">{error}</div> : !data ? <div className="bo-sub">Loading…</div> : !data.originals.length ? <div className="bo-sub">No original uploaded yet.</div> :
      data.originals.map((o: any, i: number) => <div key={i} className="rp-box" style={{ margin: "6px 0" }} data-testid="original-link">
        <div style={{ fontWeight: 600 }}>{o.color}: {o.filename || "no original file"}</div>
        {o.filename && <div className="bo-sub">{o.width && o.height ? `${o.width.toLocaleString()} × ${o.height.toLocaleString()} px` : ""}{o.dpi ? ` · saved at ${o.dpi} DPI = ${(o.width / o.dpi / 12).toFixed(1)} × ${(o.height / o.dpi / 12).toFixed(1)} ft` : ""}{o.size ? ` · ${fsz(o.size)}` : ""}{o.mime ? ` · ${o.mime.replace("image/", "").replace("application/", "").toUpperCase()}` : ""}</div>}
        {o.storage && <div className="bo-sub" style={{ marginTop: 4 }}>Stored at: {o.storage}</div>}
        {o.url && <div className="lk-row"><span className="lk-url" title={o.url}>{o.url}</span><button type="button" className="bo-btn sm" onClick={() => copy(o.url)}>{copied === o.url ? "Copied" : "Copy link"}</button><a className="bo-btn sm pri" href={o.url} target="_blank" rel="noreferrer">Open / download</a></div>}
        {o.url && <div className="bo-sub">This link works for {o.urlDays} days; open this page again for a fresh one.</div>}
        {o.drive && <div className="lk-row"><span className="bo-sub">Imported from Google Drive:</span><span className="lk-url" title={o.drive}>{o.drive}</span><button type="button" className="bo-btn sm" onClick={() => copy(o.drive)}>{copied === o.drive ? "Copied" : "Copy"}</button><a className="bo-btn sm" href={o.drive} target="_blank" rel="noreferrer">Open in Drive</a></div>}
      </div>)}
  </Field>;
}
function AdminRoomPictures({ d }: { d: any }) {
  const s = useSaver();
  const saved: string[] | undefined = d.meta?.mockupRooms;
  const [rooms, setRooms] = useState<string[]>(saved?.length ? saved : defaultMockupRooms(d.madeFor ?? [], d.categories ?? []));
  const [step, setStep] = useState("");
  const [n, setN] = useState(0);
  const dims = { kind: d.kind, widthCm: d.kind === "mural" ? (d.meta?.originalWidthCm ?? d.widthCm) : d.widthCm, heightCm: d.kind === "mural" ? (d.meta?.originalHeightCm ?? d.heightCm) : d.heightCm, repeat: d.repeat };
  return <Field label="Room pictures (shown on the product page)">
    {d.mockups?.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }} key={n}>{d.mockups.map((m: string, i: number) => <img key={i} src={m} alt="Room picture" style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 6 }} />)}</div> : <div className="bo-sub" style={{ marginBottom: 8 }}>No room pictures yet.</div>}
    <MockupRoomPicker value={rooms} onChange={setRooms} />
    <div className="bo-row" style={{ marginTop: 8 }}>
      <button type="button" className="bo-btn" data-testid="admin-remake-rooms" disabled={s.busy || !rooms.length || !d.widthCm} onClick={() => s.run(async () => {
        await api(`designer/uploads/${d.id}`, { body: { mockupRooms: rooms } });
        await remakeRoomMockups(d.id, d.colors.map((c: any) => ({ id: c.id, src: c.thumb, has: (d.mockups?.length ?? 0) > 0 })), dims, rooms, d.sku || d.id, (a, b) => setStep(`${a} of ${b}`));
        setStep(""); setN(n + 1);
      }, "Room pictures re-made. Reload to see them.")}>{step ? `Making pictures… ${step}` : "Make room pictures in these rooms"}</button>
    </div>
  </Field>;
}

export function Designers() {
  const { data, error, reload } = useApi<any>("admin/designers");
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState<any>(null);
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const list = data.designers.filter((d: any) => tab === "all" || d.status === tab);
  const act = (d: any, body: any, txt: string) => s.run(async () => { await api(`admin/designers/${d.userId}`, { body }); await reload(); }, txt);
  return <div>
    <div className="bo-top"><h1>Designers</h1></div>
    <div className="bo-tabs">{["pending", "approved", "rejected", "paused", "all"].map((k) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)} ({k === "all" ? data.designers.length : data.designers.filter((d: any) => d.status === k).length})</button>)}</div>
    <Msg m={s.msg} />
    {list.length === 0 ? <div className="bo-empty">No designers here.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Designer</th><th>Country</th><th className="num">Designs</th><th className="num">Sold</th><th className="num">Owed</th><th>Status</th><th></th></tr></thead><tbody>
        {list.map((d: any) => <tr key={d.userId}><td><b style={{ fontWeight: 500 }}>{d.name}</b>{d.trusted && <> <Pill tone="info">Trusted</Pill></>}<div className="bo-sub">{d.studio ? d.studio + " · " : ""}{d.email}</div></td><td data-l="Country">{d.country}</td>
          <td className="num" data-l="Designs">{d.approvedDesigns}/{d.designs}</td><td className="num" data-l="Sold">{money(d.earnings?.sales ?? 0)}</td><td className="num" data-l="Owed">{money(d.earnings?.owed ?? 0)}</td>
          <td><Pill tone={REVIEW_TONE[d.status] ?? undefined}>{d.status}</Pill></td>
          <td><div className="bo-row">{d.status !== "approved" && <button className="bo-btn sm pri" disabled={s.busy} onClick={() => act(d, { status: "approved" }, `${d.name} approved`)}>Approve</button>}{d.status === "pending" && <button className="bo-btn sm" disabled={s.busy} onClick={() => act(d, { status: "rejected", note: prompt("Reason (optional)") ?? "" }, `${d.name} rejected`)}>Reject</button>}<button className="bo-btn sm" onClick={() => setOpen(d)}>Open</button></div></td></tr>)}
      </tbody></table>}
    <Drawer open={!!open} onClose={() => setOpen(null)}>{open && <div>
      <h2>{open.name}</h2><div className="bo-sub" style={{ marginBottom: 12 }}>{open.email} · applied {fmtDate(open.createdAt)}</div>
      <dl className="bo-dl"><dt>Studio</dt><dd>{open.studio || "—"}</dd><dt>Country</dt><dd>{open.country}</dd><dt>Styles</dt><dd>{open.styles.join(", ") || "—"}</dd><dt>Portfolio</dt><dd>{open.portfolio.map((l: string) => <div key={l}><a href={l} target="_blank" rel="noreferrer">{l}</a></div>)}</dd><dt>Bio</dt><dd>{open.bio}</dd><dt>Payout</dt><dd>{open.payoutMethod ? `${open.payoutMethod}: ${open.payoutDetails ?? ""}` : "Not set"}</dd><dt>Public page</dt><dd>{open.slug ? <a href={`/designers/${open.slug}`} target="_blank" rel="noreferrer">/designers/{open.slug}</a> : "After approval"}</dd>
        <dt>Earned</dt><dd>{money(open.earnings?.earned ?? 0)} (paid {money(open.earnings?.paid ?? 0)})</dd></dl>
      <div className="bo-row" style={{ marginTop: 14 }}><Switch checked={open.trusted} onChange={async (v) => { await act(open, { trusted: v }, v ? "Trusted: new designs go live without review" : "Trusted removed"); setOpen({ ...open, trusted: v }); }} label="Trusted (designs go live without review)" /></div>
      <div className="bo-row" style={{ marginTop: 14 }}>{open.status === "approved" ? <button className="bo-btn" onClick={() => { act(open, { status: "paused" }, "Paused"); setOpen(null); }}>Pause designer</button> : <button className="bo-btn pri" onClick={() => { act(open, { status: "approved" }, "Approved"); setOpen(null); }}>Approve</button>}</div>
    </div>}</Drawer>
  </div>;
}

export function Payouts() {
  const { data, error, reload } = useApi<any>("admin/payouts");
  const [pay, setPay] = useState<any>(null);
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const tot = data.rows.reduce((a: any, r: any) => ({ earned: a.earned + r.earned, paid: a.paid + r.paid, owed: a.owed + Math.max(0, r.owed) }), { earned: 0, paid: 0, owed: 0 });
  return <div>
    <div className="bo-top"><h1>Designer payouts</h1><Pill tone="warn">PayPal {data.mode === "live" ? "live" : "test mode"}</Pill><button className="bo-btn" onClick={() => downloadCsv("payouts.csv", data.rows.map((r: any) => ({ designer: r.name, email: r.email, sqft_sold: r.sqft, royalties: r.royalties, custom_jobs: r.jobs, earned: r.earned, paid: r.paid, owed: r.owed, cash_out_requested: r.requested ?? 0, store_credit: r.credit ?? 0, payout_method: r.method ?? "" })))}>Export CSV</button></div>
    <div className="bo-kpis"><div className="bo-kpi"><span>Earned (all time)</span><b>{money(tot.earned)}</b></div><div className="bo-kpi"><span>Paid</span><b>{money(tot.paid)}</b></div><div className="bo-kpi"><span>Owed now</span><b>{money(tot.owed)}</b></div><div className="bo-kpi"><span>Designers' store credit</span><b>{money(data.rows.reduce((n: number, r: any) => n + (r.credit ?? 0), 0))}</b></div></div>
    <Msg m={s.msg} />
    {data.rows.length === 0 ? <div className="bo-empty">No designers yet.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Designer</th><th className="num">Sq ft sold</th><th className="num">Royalties</th><th className="num">Custom jobs</th><th className="num">Earned</th><th className="num">Paid</th><th className="num">Owed</th><th className="num">Store credit</th><th></th></tr></thead><tbody>
        {data.rows.map((r: any) => <tr key={r.userId}><td>{r.name}<div className="bo-sub">{r.method ? `${r.method}: ${r.details ?? ""}` : "No payout details yet"}</div></td><td className="num" data-l="Sq ft">{r.sqft}</td><td className="num" data-l="Royalties">{money(r.royalties)}</td><td className="num" data-l="Custom jobs">{money(r.jobs)}</td><td className="num" data-l="Earned">{money(r.earned)}</td><td className="num" data-l="Paid">{money(r.paid)}</td><td className="num" data-l="Owed"><b style={{ fontWeight: 600 }}>{money(r.owed)}</b>{r.requested > 0 && <div><Pill tone="warn">Asked to cash out {money(r.requested)}</Pill></div>}</td><td className="num" data-l="Store credit">{money(r.credit ?? 0)}</td>
          <td><button className="bo-btn sm pri" onClick={() => setPay({ ...r, amount: (r.requested > 0 ? r.requested : Math.max(0, r.owed)).toFixed(2), method: "PayPal", note: "" })}>Mark paid</button></td></tr>)}
      </tbody></table>}
    <div className="bo-card" style={{ marginTop: 14 }}><h2>Payment history</h2>
      {data.history.length ? <table className="bo-tbl stack"><tbody>{data.history.map((h: any) => <tr key={h.id}><td data-l="Date">{fmtDate(h.paid_at)}</td><td>{h.name}</td><td className="num">{money(h.amount)}</td><td className="bo-sub">{h.status === "requested" ? "Requested by designer · " : ""}{h.note}</td></tr>)}</tbody></table> : <div className="bo-sub">No payments yet.</div>}
    </div>
    <Drawer open={!!pay} onClose={() => setPay(null)}>{pay && <div><h2>Pay {pay.name}</h2><div className="bo-sub" style={{ marginBottom: 12 }}>Owed {money(pay.owed)}. In test mode no money moves; the payment is recorded.</div>
      <Field label="Amount ($)"><input className="bo-in" type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
      <Field label="Method"><select className="bo-sel" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option>PayPal</option><option>Bank transfer</option><option>Check</option><option>Other</option></select></Field>
      <Field label="Note"><input className="bo-in" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
      <button className="bo-btn pri" disabled={s.busy} onClick={async () => { if (await s.run(() => api("admin/payouts", { body: { userId: pay.userId, amount: pay.amount, method: pay.method, note: pay.note } }), `Recorded ${money(pay.amount)} to ${pay.name}`)) { setPay(null); reload(); } }}>{pay.method === "PayPal" ? "Send with PayPal (test)" : "Record payment"}</button>
    </div>}</Drawer>
  </div>;
}

export function Customers() {
  const { data, error, reload } = useApi<any>("admin/customers");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const list = data.customers.filter((c: any) => !q || (c.email + " " + c.name + " " + (c.company ?? "")).toLowerCase().includes(q.toLowerCase()));
  const pendingTrade = data.customers.filter((c: any) => c.trade_status === "pending").length;
  return <div>
    <div className="bo-top"><h1>Customers and accounts</h1>{pendingTrade > 0 && <Pill tone="warn">{pendingTrade} Pro application{pendingTrade > 1 ? "s" : ""} waiting</Pill>}<button className="bo-btn" onClick={() => downloadCsv("customers.csv", list.map((c: any) => ({ email: c.email, name: c.name, joined: c.created_at, orders: c.orders, spent: c.spent, credit: c.credit, trade: c.trade_status ?? "", company: c.company ?? "", discount_pct: c.discount_pct ?? 0, net_terms: c.net_terms ? "yes" : "" })))}>Export CSV</button></div>
    <input className="bo-in" style={{ maxWidth: 360, marginBottom: 12 }} placeholder="Search email, name or company" value={q} onChange={(e) => setQ(e.target.value)} />
    <Msg m={s.msg} />
    <table className="bo-tbl stack"><thead><tr><th>Account</th><th>Joined</th><th className="num">Orders</th><th className="num">Spent</th><th className="num">Store credit</th><th>Type / pricing</th><th></th></tr></thead><tbody>
      {list.map((c: any) => <tr key={c.id}><td>{c.email}<div className="bo-sub">{c.name}{c.company ? ` · ${c.company}` : ""}</div></td><td data-l="Joined">{fmtDate(c.created_at)}</td><td className="num" data-l="Orders">{c.orders}</td><td className="num" data-l="Spent">{money(c.spent)}</td><td className="num" data-l="Credit">{c.credit ? money(c.credit) : "–"}</td>
        <td>{c.admin ? <Pill tone="info">Owner</Pill> : c.designer ? <Pill>Designer ({c.designer})</Pill> : <Pill>Customer</Pill>}{c.trade_status === "approved" && <> <Pill tone="ok">Pro</Pill></>}{c.trade_status === "pending" && <> <Pill tone="warn">Pro applied</Pill></>}{c.discount_pct > 0 && <> <Pill>{c.discount_pct}% off</Pill></>}{c.net_terms && <> <Pill>Net terms</Pill></>}{c.banned && <> <Pill tone="bad">Blocked</Pill></>}</td>
        <td>{!c.admin && <button className="bo-btn sm" onClick={() => setEdit({ ...c, discountPct: c.discount_pct ?? 0, tradeStatus: c.trade_status ?? "", netTerms: !!c.net_terms, creditAdjust: "" })}>Edit</button>}</td></tr>)}
    </tbody></table>
    <Drawer open={!!edit} onClose={() => setEdit(null)}>{edit && <div>
      <div className="bo-row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 16 }}>{edit.email}</h2><button className="bo-btn sm" onClick={() => setEdit(null)}>Close</button></div>
      <div className="bo-sub" style={{ marginBottom: 12 }}>{edit.name}{edit.company ? ` · ${edit.company}` : ""}{edit.website ? ` · ${edit.website}` : ""}{edit.trade_note ? ` · "${edit.trade_note}"` : ""}</div>
      <Msg m={s.msg} />
      <div className="bo-card"><h2>Pricing and terms</h2>
        <div className="bo-grid2"><Field label="Pro account"><select className="bo-sel" value={edit.tradeStatus} onChange={(e) => setEdit({ ...edit, tradeStatus: e.target.value })}><option value="">Not Pro</option><option value="pending">Applied (waiting)</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></Field>
          <Field label="Special discount (% off every order)"><input className="bo-in" type="number" min="0" max="80" value={edit.discountPct} onChange={(e) => setEdit({ ...edit, discountPct: e.target.value })} /></Field></div>
        <div className="bo-field"><Switch checked={edit.netTerms} onChange={(x) => setEdit({ ...edit, netTerms: x })} label="Net terms (can pay by invoice)" /></div>
        <button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(async () => { await api(`admin/customers/${edit.id}`, { body: { terms: { discountPct: edit.discountPct, tradeStatus: edit.tradeStatus, netTerms: edit.netTerms } } }); reload(); }, "Saved")}>Save pricing</button></div>
      <div className="bo-card"><h2>Store credit: {money(edit.credit)}</h2>
        <div className="bo-row" style={{ alignItems: "flex-end" }}><Field label="Add (+) or remove (−)"><input className="bo-in" style={{ width: 140 }} type="number" step="0.01" value={edit.creditAdjust} onChange={(e) => setEdit({ ...edit, creditAdjust: e.target.value })} /></Field>
          <button className="bo-btn" style={{ marginBottom: 12 }} disabled={s.busy || !Number(edit.creditAdjust)} onClick={() => s.run(async () => { await api(`admin/customers/${edit.id}`, { body: { creditAdjust: Number(edit.creditAdjust) } }); setEdit({ ...edit, credit: Number(edit.credit) + Number(edit.creditAdjust), creditAdjust: "" }); reload(); }, "Credit updated")}>Apply</button></div></div>
      <button className="bo-btn danger" disabled={s.busy} onClick={() => s.run(async () => { await api(`admin/customers/${edit.id}`, { body: { banned: !edit.banned } }); setEdit({ ...edit, banned: !edit.banned }); reload(); }, edit.banned ? "Unblocked" : "Blocked")}>{edit.banned ? "Unblock account" : "Block account"}</button>
    </div>}</Drawer>
  </div>;
}

export function Coupons() {
  const { data, error, reload } = useApi<any>("admin/coupons");
  const s = useSaver();
  const blank = { code: "", kind: "percent", value: "", minOrder: "", expiresAt: "", maxUses: "", perCustomer: "1", active: true, note: "" };
  const [f, setF] = useState<any>(blank);
  if (error) return <Msg m={{ text: error }} />;
  return <div>
    <div className="bo-top"><h1>Discount codes</h1></div>
    <Msg m={s.msg} />
    <div className="bo-card"><h2>{data?.coupons?.some((c: any) => c.code === f.code.toUpperCase()) ? `Edit ${f.code.toUpperCase()}` : "New code"}</h2>
      <div className="bo-grid3"><Field label="Code"><input className="bo-in" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></Field>
        <Field label="Type"><select className="bo-sel" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="percent">Percent off</option><option value="fixed">Dollars off</option></select></Field>
        <Field label={f.kind === "percent" ? "Percent" : "Dollars"}><input className="bo-in" type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field></div>
      <div className="bo-grid3"><Field label="Minimum order ($)"><input className="bo-in" type="number" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} /></Field>
        <Field label="Expires"><input className="bo-in" type="date" value={f.expiresAt?.slice(0, 10) ?? ""} onChange={(e) => setF({ ...f, expiresAt: e.target.value ? e.target.value + "T23:59:59Z" : "" })} /></Field>
        <Field label="Total uses (empty = no limit)"><input className="bo-in" type="number" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></Field></div>
      <div className="bo-grid3"><Field label="Uses per customer"><input className="bo-in" type="number" value={f.perCustomer} onChange={(e) => setF({ ...f, perCustomer: e.target.value })} /></Field><Field label="Note (only you see it)"><input className="bo-in" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field><div className="bo-field" style={{ display: "flex", alignItems: "center" }}><Switch checked={f.active} onChange={(x) => setF({ ...f, active: x })} label="Active" /></div></div>
      <div className="bo-row"><button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(async () => { await api("admin/coupons", { body: f }); setF(blank); reload(); }, "Code saved")}>Save code</button>{f.code && <button className="bo-btn" onClick={() => setF(blank)}>Clear</button>}</div></div>
    <table className="bo-tbl stack"><thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th className="num">Used</th><th className="num">Given</th><th>Status</th><th></th></tr></thead><tbody>
      {(data?.coupons ?? []).map((c: any) => <tr key={c.code}><td><b>{c.code}</b>{c.note && <div className="bo-sub">{c.note}</div>}</td><td data-l="Discount">{c.kind === "percent" ? `${c.value}% off` : `${money(c.value)} off`}</td><td data-l="Rules" className="bo-sub">{[c.min_order ? `min ${money(c.min_order)}` : "", c.expires_at ? `until ${fmtDate(c.expires_at)}` : "", c.max_uses ? `${c.max_uses} total` : "", c.per_customer ? `${c.per_customer} per customer` : ""].filter(Boolean).join(" · ") || "none"}</td><td className="num" data-l="Used">{c.uses}</td><td className="num" data-l="Given">{money(c.given)}</td><td>{c.active ? (c.expires_at && c.expires_at < new Date().toISOString() ? <Pill tone="warn">Expired</Pill> : <Pill tone="ok">Active</Pill>) : <Pill>Off</Pill>}</td>
        <td><button className="bo-btn sm" onClick={() => setF({ code: c.code, kind: c.kind, value: c.value, minOrder: c.min_order || "", expiresAt: c.expires_at || "", maxUses: c.max_uses || "", perCustomer: c.per_customer ?? "", active: !!c.active, note: c.note || "" })}>Edit</button> <button className="bo-btn sm" onClick={() => s.run(async () => { await api("admin/coupons", { body: { code: c.code, kind: c.kind, value: c.value, minOrder: c.min_order, expiresAt: c.expires_at, maxUses: c.max_uses, perCustomer: c.per_customer, note: c.note, active: !c.active } }); reload(); }, c.active ? "Turned off" : "Turned on")}>{c.active ? "Turn off" : "Turn on"}</button></td></tr>)}
    </tbody></table>
  </div>;
}

export function Requests() {
  const { data, error, reload } = useApi<any>("admin/requests");
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  return <div>
    <div className="bo-top"><h1>Custom requests</h1></div><Msg m={s.msg} />
    {data.requests.length === 0 ? <div className="bo-empty">No custom requests yet.</div> :
      <table className="bo-tbl stack"><thead><tr><th>Date</th><th>Customer</th><th>Room / wall</th><th>Brief</th><th>Designer</th><th>Status</th></tr></thead><tbody>
        {data.requests.map((r: any) => <tr key={r.id}><td data-l="Date">{fmtDate(r.created_at)}</td><td>{r.customer_name}<div className="bo-sub">{r.customer_email}</div></td><td data-l="Room">{r.room} · {r.wall_size}</td><td data-l="Brief" style={{ maxWidth: 320 }}>{r.brief}<div className="bo-sub">{r.budget ? `Budget ${r.budget} · ` : ""}{r.material}</div></td><td data-l="Designer">{r.designer_slug}</td>
          <td><select className="bo-sel" style={{ width: 140, height: 28 }} value={r.status} onChange={(e) => s.run(async () => { await api(`admin/requests/${r.id}`, { body: { status: e.target.value } }); reload(); })}>{["new", "in_progress", "quoted", "done", "closed"].map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select></td></tr>)}
      </tbody></table>}
  </div>;
}

export function Emails() {
  const { data, error } = useApi<any>("admin/outbox");
  const [open, setOpen] = useState<any>(null);
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  return <div>
    <div className="bo-top"><h1>Emails</h1><Pill tone="warn">Test mode: nothing is sent</Pill></div>
    <div className="bo-sub" style={{ marginBottom: 12 }}>Every email the site would send is kept here so you can check the wording.</div>
    {data.emails.length === 0 ? <div className="bo-empty">No emails yet.</div> :
      <table className="bo-tbl stack"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Type</th></tr></thead><tbody>
        {data.emails.map((e: any) => <tr key={e.id} className="click" onClick={() => setOpen(e)}><td data-l="When">{fmtDateTime(e.created_at)}</td><td>{e.to_addr}</td><td>{e.subject}</td><td className="bo-sub">{e.kind}</td></tr>)}
      </tbody></table>}
    <Drawer open={!!open} onClose={() => setOpen(null)}>{open && <div><h2>{open.subject}</h2><div className="bo-sub" style={{ margin: "4px 0 12px" }}>To {open.to_addr} · {fmtDateTime(open.created_at)} · {open.status}</div><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, margin: 0 }}>{open.text}</pre></div>}</Drawer>
  </div>;
}

function Archive() {
  const { data, error, reload } = useApi<any>("admin/archive");
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const restore = (kind: string, id: string) => s.run(async () => { await api("admin/archive/restore", { body: { kind, id } }); reload(); }, "Restored");
  const purge = (kind: string, id: string, label: string) => { const w = prompt(`Delete "${label}" for good? Its files are removed from storage too. Type DELETE to confirm.`); if (w !== "DELETE") return; s.run(async () => { const r = await api("admin/archive/purge", { body: { kind, id, confirm: "DELETE" } }); reload(); return r; }, "Deleted for good"); };
  const size = (n: number) => (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1024 ** 2)) + " MB");
  const files = (cs: any[]) => cs.map((c: any) => c.file ? <a key={c.id} className="bo-btn sm" href={c.file.url} target="_blank" rel="noreferrer">Download {c.name} ({size(c.file.size)})</a> : null);
  const empty = !data.designs.length && !data.colors.length && !data.pictures.length;
  return <div data-testid="archive">
    <div className="bo-sub" style={{ margin: "4px 0 10px" }}>When a designer deletes something, it is only hidden. It stays here with all its files until you restore it or delete it for good.</div>
    <Msg m={s.msg} />
    {empty && <div className="bo-empty">Nothing deleted by designers.</div>}
    {data.designs.length > 0 && <><div className="bo-lbl">Designs ({data.designs.length})</div><table className="bo-tbl stack"><thead><tr><th></th><th>Design</th><th>Designer</th><th>Deleted</th><th></th></tr></thead><tbody>
      {data.designs.map((d: any) => <tr key={d.id}><td>{d.colors[0]?.thumb ? <img className="bo-thumb" src={d.colors[0].thumb} alt="" /> : <div className="bo-thumb" />}</td>
        <td>{d.title}<div className="bo-sub">{d.sku} · {d.colors.length} color{d.colors.length === 1 ? "" : "s"}{d.wasLive ? " · was live" : ""}</div></td><td data-l="Designer">{d.designer}</td><td data-l="Deleted">{new Date(d.deletedAt).toLocaleString()}</td>
        <td><div className="bo-row"><button className="bo-btn sm pri" disabled={s.busy} onClick={() => restore("design", d.id)}>Restore</button>{files(d.colors)}<button className="bo-btn sm danger" disabled={s.busy} onClick={() => purge("design", d.id, d.title)}>Delete for good</button></div></td></tr>)}
    </tbody></table></>}
    {data.colors.length > 0 && <><div className="bo-lbl" style={{ marginTop: 14 }}>Colors removed from a design ({data.colors.length})</div><table className="bo-tbl stack"><thead><tr><th></th><th>Color</th><th>Design</th><th>Deleted</th><th></th></tr></thead><tbody>
      {data.colors.map((c: any) => <tr key={c.id}><td>{c.thumb ? <img className="bo-thumb" src={c.thumb} alt="" /> : <div className="bo-thumb" />}</td><td>{c.name}</td><td data-l="Design">{c.design}<div className="bo-sub">{c.designer}</div></td><td data-l="Deleted">{new Date(c.deletedAt).toLocaleString()}</td>
        <td><div className="bo-row"><button className="bo-btn sm pri" disabled={s.busy} onClick={() => restore("color", c.id)}>Restore</button>{files([c])}<button className="bo-btn sm danger" disabled={s.busy} onClick={() => purge("color", c.id, c.name)}>Delete for good</button></div></td></tr>)}
    </tbody></table></>}
    {data.pictures.length > 0 && <><div className="bo-lbl" style={{ marginTop: 14 }}>Pictures removed ({data.pictures.length})</div><table className="bo-tbl stack"><tbody>
      {data.pictures.map((x: any) => <tr key={x.id}><td>{x.url ? <img className="bo-thumb" src={x.url} alt="" /> : null}</td><td>{x.design}<div className="bo-sub">{x.color}</div></td><td data-l="Deleted">{new Date(x.deletedAt).toLocaleString()}</td>
        <td><div className="bo-row"><button className="bo-btn sm pri" disabled={s.busy} onClick={() => restore("picture", x.id)}>Restore</button>{x.url && <a className="bo-btn sm" href={x.url} target="_blank" rel="noreferrer">Download</a>}<button className="bo-btn sm danger" disabled={s.busy} onClick={() => purge("picture", x.id, "this picture")}>Delete for good</button></div></td></tr>)}
    </tbody></table></>}
  </div>;
}
