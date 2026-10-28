import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { shopQuery } from "@/lib/shop";
import { liveDesigns, registerShop, resolvedMaterials, unitPrice, withColorway, type Design } from "@/lib/catalog";
import { designerScaleSelection, frameGeometry, measurementInches, orderSqft, type WallSelection } from "@/lib/wall-selection";
import { MuralFramer } from "@/components/mural-framer";
import { api, useApi, money, Msg, Field } from "./common";

type Unit = "ft" | "in" | "cm";
const PAY = [["paid", "Paid"], ["unpaid", "Unpaid"], ["invoice", "Invoice"]] as const;
const seg = (on: boolean) => "bo-btn" + (on ? " pri" : "");

async function putFile(orderId: string, blob: Blob, ext: "jpg" | "png", label: string, width?: number, height?: number) {
  const t = await api(`admin/orders/${orderId}/crop-url`, { body: { ext } });
  const fd = new FormData(); fd.append("", new File([blob], `file.${ext}`, { type: ext === "png" ? "image/png" : "image/jpeg" }));
  const up = await fetch(t.uploadUrl, { method: "PUT", body: fd });
  if (!up.ok) throw new Error("The file upload failed.");
  await api(`admin/orders/${orderId}/files`, { body: { path: t.path, label, width, height } });
}
async function loadImg(src: string) { const im = new Image(); im.crossOrigin = "anonymous"; im.src = src; await im.decode(); return im; }
/** Crop the wall area out of the artwork (same rectangle as the preview) and save it as the order's print file. */
async function saveCrop(orderId: string, src: string, sel: WallSelection, label: string) {
  const im = await loadImg(src);
  const g = frameGeometry(sel);
  const sx = (g.x - g.w / 2) * im.naturalWidth, sy = (g.y - g.h / 2) * im.naturalHeight, sw = g.w * im.naturalWidth, sh = g.h * im.naturalHeight;
  const k = Math.min(1, 16000 / Math.max(sw, sh), Math.sqrt(200e6 / (sw * sh)));
  const c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext("2d")!.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image too large for the browser to crop."))), "image/jpeg", 0.95));
  await putFile(orderId, blob, "jpg", label, c.width, c.height);
}

export function NewOrder({ onDone }: { onDone: (id: string) => void }) {
  const { data: shop } = useQuery(shopQuery);
  if (shop) registerShop(shop);
  const designs = useMemo(() => liveDesigns(shop), [shop]);
  const finishes = useMemo(() => resolvedMaterials(shop?.materialSettings), [shop]);
  const [src, setSrc] = useState<"pick" | "upload">("pick");
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState<string | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [upKind, setUpKind] = useState<"mural" | "repeating">("mural");
  const [repeatIn, setRepeatIn] = useState("24");
  const [w, setW] = useState("12"); const [h, setH] = useState("9"); const [unit, setUnit] = useState<Unit>("ft");
  const [finish, setFinish] = useState("");
  const [cust, setCust] = useState<"existing" | "new">("existing");
  const [cq, setCq] = useState(""); const [picked, setPicked] = useState<any>(null);
  const [nc, setNc] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState(""); const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"paid" | "unpaid" | "invoice">("unpaid"); const [paidBy, setPaidBy] = useState("Cash / check");
  const [total, setTotal] = useState(""); const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<any>(null); const [busy, setBusy] = useState("");
  const customers = useApi<any>(cust === "existing" ? "admin/crm/customers" : null, [cust]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const base: Design | null = useMemo(() => {
    if (src === "pick") { const d = designs.find((x) => x.slug === slug); return d ? withColorway(d, color) : null; }
    if (!fileUrl) return null;
    return { slug: "outside-file", title: file?.name ?? "Customer file", image: fileUrl, kind: upKind, ...(upKind === "repeating" ? { repeat: "both", repeatCm: (Number(repeatIn) || 24) * 2.54 } : {}) } as any;
  }, [src, designs, slug, color, fileUrl, file, upKind, repeatIn]);
  const dims = { width: Number(w) || 0, height: Number(h) || 0, unit };
  const [sel, setSel] = useState<WallSelection | null>(null);
  // new design or new wall size -> start from the design's own scale, centred
  const key = `${base?.slug}|${base?.image}|${base?.kind}|${repeatIn}|${w}|${h}|${unit}`;
  const lastKey = useRef("");
  useEffect(() => {
    if (!base || !dims.width || !dims.height) { setSel(null); return; }
    if (lastKey.current === key) return;
    const keepArt = sel?.artRatio ?? 1.5;
    const start: WallSelection = { ...dims, zoom: 1, x: 0.5, y: 0.5, artRatio: keepArt, waste: 0 } as any;
    setSel(base.kind === "mural" ? { ...start, zoom: 1 } : designerScaleSelection(base as any, start));
    lastKey.current = key;
  }, [key]);
  useEffect(() => { if (base?.image) loadImg(base.image).then((im) => setSel((s) => (s ? { ...s, artRatio: im.naturalWidth / im.naturalHeight } : s))).catch(() => {}); }, [base?.image]);
  useEffect(() => { if (!finish && finishes[0]) setFinish(finishes[0].id); }, [finishes]);
  const material = finishes.find((m) => m.id === finish) ?? finishes[0];
  const sqft = dims.width && dims.height ? orderSqft(dims as any) : 0;
  const auto = Math.round(sqft * unitPrice(src === "pick" ? base ?? undefined : undefined, material) * 100) / 100;
  useEffect(() => { if (!touched) setTotal(auto ? String(auto) : ""); }, [auto, touched]);

  const list = designs.filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const people = (customers.data?.customers ?? []).filter((c: any) => !cq || `${c.email ?? ""} ${c.name ?? ""} ${c.company ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(cq.toLowerCase())).slice(0, 6);
  const custName = cust === "existing" ? picked?.name || picked?.email || "" : nc.name;

  async function save() {
    setMsg(null);
    if (!base || !sel) return setMsg({ ok: false, text: "Pick a design or upload a file, and enter the wall size." });
    if (!custName.trim()) return setMsg({ ok: false, text: "Choose a customer or type the new customer's name." });
    if (file && file.size > 95 * 1024 * 1024) return setMsg({ ok: false, text: "That file is over 95 MB. Send it to the order after saving, or use a smaller copy." });
    try {
      setBusy("Saving the order…");
      const selection = { ...sel, color: src === "pick" ? color : undefined, colorName: src === "pick" ? base.colorways?.find((c) => c.id === color)?.name : undefined, outside: { kind: base.kind, repeatIn: base.kind === "repeating" && src === "upload" ? Number(repeatIn) : undefined, file: file?.name } };
      const r = await api("admin/orders", { body: { design: src === "pick" ? base.slug : "outside-file", finish: material?.name ?? finish, selection, sqft: Math.round(sqft * 10) / 10, total: Number(total) || 0,
        customer: custName.trim(), email: cust === "existing" ? picked?.email ?? "" : nc.email, phone: cust === "existing" ? picked?.phone || null : nc.phone || null, userId: cust === "existing" ? picked?.user_id || undefined : undefined,
        address, notes, paymentStatus: pay, paidBy } });
      const wall = `${w} x ${h} ${unit}`;
      if (file) { setBusy("Uploading the customer's file…"); await putFile(r.id, file, file.type === "image/png" ? "png" : "jpg", base.kind === "repeating" ? `Customer file (repeat tile, ${repeatIn} in wide)` : "Customer file (original)"); }
      if (base.kind === "mural") {
        setBusy("Saving the crop as the print file…");
        let src2 = base.image, full = !!file;
        if (!file) { const o = await api(`admin/orders/${r.id}`); const og = o.art?.original; if (og && og.size < 150 * 1024 * 1024 && /image\/(jpeg|png|webp)/.test(og.mime)) { src2 = og.url; full = true; } }
        await saveCrop(r.id, src2, sel, full ? `Print file (cropped to the wall, ${wall})` : `Crop preview (${wall}); for full size use Crop on the print original`);
      }
      setBusy(""); onDone(r.id);
    } catch (e: any) { setBusy(""); setMsg({ ok: false, text: e.message || "Could not save the order." }); }
  }

  return <div className="bo-new-order">
    <h2>New order</h2><div className="bo-sub" style={{ marginBottom: 12 }}>For orders that came by phone, email or the showroom.</div>
    <Msg m={msg} />
    <h3 className="bo-h3">1. Design</h3>
    <div className="bo-row" style={{ marginBottom: 8 }}><button type="button" className={seg(src === "pick")} onClick={() => setSrc("pick")}>Pick a design</button><button type="button" className={seg(src === "upload")} onClick={() => setSrc("upload")} data-testid="no-upload-tab">Upload a file</button></div>
    {src === "pick" ? <div>
      <input className="bo-in" placeholder="Search designs" value={q} onChange={(e) => setQ(e.target.value)} data-testid="no-design-q" />
      <div className="bo-pick">{list.map((d) => <button type="button" key={d.slug} className={"bo-pick-item" + (d.slug === slug ? " on" : "")} onClick={() => { setSlug(d.slug); setColor(d.colorways?.[0]?.id); }}><img src={d.image} alt="" loading="lazy" /><span>{d.title}<small>{d.kind === "repeating" ? "Repeat" : "Mural"}</small></span></button>)}</div>
      {base?.colorways && base.colorways.length > 1 && <Field label="Color"><select className="bo-sel" value={color} onChange={(e) => setColor(e.target.value)}>{base.colorways.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    </div> : <div>
      <Field label="Customer's file (JPG or PNG)"><input type="file" accept="image/jpeg,image/png,image/webp" data-testid="no-file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileUrl(f ? URL.createObjectURL(f) : ""); }} /></Field>
      <div className="bo-row"><button type="button" className={seg(upKind === "mural")} onClick={() => setUpKind("mural")}>Mural</button><button type="button" className={seg(upKind === "repeating")} onClick={() => setUpKind("repeating")} data-testid="no-kind-repeat">Repeat</button>
        {upKind === "repeating" && <label className="bo-inline">Repeat width <input className="bo-in" style={{ width: 70 }} type="number" value={repeatIn} onChange={(e) => setRepeatIn(e.target.value)} /> in</label>}</div>
    </div>}
    <h3 className="bo-h3">2. Wall and finish</h3>
    <div className="bo-grid3 bo-wall"><Field label="Wall width"><input className="bo-in" type="number" value={w} onChange={(e) => setW(e.target.value)} data-testid="no-w" /></Field><Field label="Wall height"><input className="bo-in" type="number" value={h} onChange={(e) => setH(e.target.value)} data-testid="no-h" /></Field><Field label="Unit"><select className="bo-sel" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}><option value="ft">feet</option><option value="in">inches</option><option value="cm">cm</option></select></Field></div>
    {base && sel && <div className="bo-preview" data-testid="no-preview"><MuralFramer design={base} selection={sel} onChange={setSel} maxHeight="300px" />
      <div className="bo-sub" style={{ marginTop: 6 }}>{base.kind === "mural" ? "Drag the picture to choose the part that goes on the wall. This crop is saved as the print file." : "The pattern repeats across the wall in panels. Use the size slider to change the scale."}</div></div>}
    <Field label="Finish"><select className="bo-sel" value={finish} onChange={(e) => setFinish(e.target.value)}>{finishes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
    <h3 className="bo-h3">3. Customer</h3>
    <div className="bo-row" style={{ marginBottom: 8 }}><button type="button" className={seg(cust === "existing")} onClick={() => setCust("existing")}>Existing customer</button><button type="button" className={seg(cust === "new")} onClick={() => setCust("new")} data-testid="no-cust-new">New customer</button></div>
    {cust === "existing" ? <div>{picked ? <div className="bo-row"><span><b style={{ fontWeight: 500 }}>{picked.name || picked.email}</b> <span className="bo-sub">{[picked.company, picked.email, picked.phone].filter(Boolean).join(" · ")}</span></span><button type="button" className="bo-btn" onClick={() => setPicked(null)}>Change</button></div>
      : <><input className="bo-in" placeholder={customers.data ? "Search customers by name, email, phone" : "Loading customers…"} value={cq} onChange={(e) => setCq(e.target.value)} data-testid="no-cust-q" />
        <div className="bo-people">{people.map((c: any) => <button type="button" key={c.id} onClick={() => { setPicked(c); if (!address.trim() && (c.ship_address || c.address)) setAddress(c.ship_address || c.address); }} data-testid="no-cust-opt">{c.name || c.email || "(no name)"}{c.company ? ` · ${c.company}` : ""}<small>{[c.email, c.phone].filter(Boolean).join(" · ")}</small></button>)}</div></>}</div>
      : <div className="bo-grid3"><Field label="Name"><input className="bo-in" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} data-testid="no-cust-name" /></Field><Field label="Email"><input className="bo-in" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field><Field label="Phone"><input className="bo-in" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field></div>}
    <Field label="Shipping address (optional)"><textarea className="bo-ta" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
    <h3 className="bo-h3">4. Price and payment</h3>
    <div className="bo-grid2"><Field label="Total ($)" hint={auto ? `Website price: ${money(auto)} (${sqft.toFixed(1)} sq ft)` : undefined}><input className="bo-in" type="number" value={total} onChange={(e) => { setTouched(true); setTotal(e.target.value); }} data-testid="no-total" /></Field>
      <Field label="Payment"><div className="bo-row">{PAY.map(([k, l]) => <button type="button" key={k} className={seg(pay === k)} onClick={() => setPay(k)} data-testid={"no-pay-" + k}>{l}</button>)}</div></Field></div>
    {pay === "paid" && <Field label="Paid by"><select className="bo-sel" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}><option>Cash / check</option><option>Card (Sola)</option><option>PayPal</option><option>Bank transfer</option><option>Other</option></select></Field>}
    <Field label="Notes"><textarea className="bo-ta" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    <div className="bo-row" style={{ marginTop: 6 }}><button className="bo-btn pri" disabled={!!busy} onClick={save} data-testid="no-save">{busy || "Save order"}</button></div>
  </div>;
}
