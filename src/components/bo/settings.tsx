import { useEffect, useState } from "react";
import { api, useApi, Msg, Field, Switch, useSaver, Pill } from "./common";

type F = { k: string; label: string; type?: "text" | "number" | "bool" | "select" | "secret" | "textarea" | "image"; options?: string[]; hint?: string };
const GROUPS: Record<string, { title: string; note?: string; fields: F[] }> = {
  general: { title: "General", fields: [
    { k: "siteName", label: "Site name" }, { k: "contactEmail", label: "Contact email" }, { k: "contactPhone", label: "Contact phone" },
    { k: "currency", label: "Currency", type: "select", options: ["USD", "CAD", "EUR", "GBP"] }, { k: "units", label: "Default units", type: "select", options: ["ft", "in", "cm"] },
    { k: "pricePerSqft", label: "Default price per sq ft ($)", type: "number" }, { k: "fitServiceFee", label: "Fit-to-wall service fee ($)", type: "number" }, { k: "commissionRate", label: "Studio commission on designer fees (%)", type: "number" },
  ] },
  shipping: { title: "Shipping", fields: [
    { k: "flatRate", label: "Flat shipping ($, 0 = free)", type: "number" }, { k: "freeOver", label: "Free shipping over ($, 0 = off)", type: "number" }, { k: "processingDays", label: "Production days before shipping", type: "number" }, { k: "countries", label: "Ship to countries" },
  ] },
  designerRules: { title: "Designer rules", fields: [
    { k: "targetDpi", label: "Print quality target (DPI)", type: "number", hint: "Recommended print DPI (200 or more). Max sharp wall size = image pixels ÷ this DPI." },
    { k: "minDpi", label: "Lowest DPI allowed for bigger walls", type: "number", hint: "The print file export uses the same minimum. 150 is the wallpaper standard." }, { k: "maxUploadGb", label: "Max upload size (GB)", type: "number" },
    { k: "autoApproveTrusted", label: "Trusted designers skip review", type: "bool" }, { k: "requireMockups", label: "Room mockups required per design", type: "number" },
    { k: "royaltyStarter", label: "Royalty, starter (%)", type: "number" }, { k: "royaltyStudio", label: "Royalty from 2,500 sq ft/month (%)", type: "number" }, { k: "royaltyAtelier", label: "Royalty from 5,000 sq ft/month (%)", type: "number" },
  ] },
  payments: { title: "Payments (Sola)", note: "Test mode only in this preview. No card is charged.", fields: [
    { k: "mode", label: "Mode", type: "select", options: ["test"] }, { k: "solaKey", label: "Sola API key", type: "secret" }, { k: "solaPin", label: "Sola iFields key / PIN", type: "secret" },
    { k: "acceptCards", label: "Accept cards", type: "bool" }, { k: "acceptPayPal", label: "Accept PayPal at checkout", type: "bool" }, { k: "manualPayments", label: "Allow pay later / bank transfer", type: "bool" },
  ] },
  payouts: { title: "Designer payouts (PayPal)", note: "Test mode only. Marking a payout paid records it; no money moves.", fields: [
    { k: "mode", label: "Mode", type: "select", options: ["test"] }, { k: "clientId", label: "PayPal client ID" }, { k: "clientSecret", label: "PayPal secret", type: "secret" },
    { k: "minimumPayout", label: "Minimum payout ($)", type: "number" }, { k: "schedule", label: "Payout schedule", type: "select", options: ["monthly", "twice a month", "weekly", "manual"] },
  ] },
  emails: { title: "Emails", note: "Test mode: emails are kept in the Emails page, nothing is sent.", fields: [
    { k: "mode", label: "Mode", type: "select", options: ["test"] }, { k: "fromName", label: "From name" }, { k: "fromEmail", label: "From email" }, { k: "replyTo", label: "Reply-to" },
    { k: "orderConfirmation", label: "Order confirmation", type: "bool" }, { k: "shippingUpdate", label: "Shipping updates", type: "bool" }, { k: "designerApproved", label: "Designer and design decisions", type: "bool" },
  ] },
  pro: { title: "Pro program", note: "Your professional program for designers, architects and contractors. Approve applications in the Artisan Pro section. The default discount is used for new approvals; change a single member's discount in Artisan Pro → Members.", fields: [
    { k: "enabled", label: "Accept applications", type: "bool" }, { k: "name", label: "Program name", hint: "Shown on the site, the account page and emails, e.g. Artisan Pro or Design Professionals." },
    { k: "discountPct", label: "Default member discount (%)", type: "number" }, { k: "freeSamples", label: "Free samples for members", type: "bool" },
    { k: "approvalDays", label: "Approval time shown on the site" }, { k: "notifyEmail", label: "Email for new applications", hint: "Empty uses the contact email." },
  ] },
  popup: { title: "First-order popup", note: "A small window that offers new visitors a discount on their first order for their email. Each email gets its own one-time code. Never shown at checkout, to signed-in customers who already ordered, or again for the days below after it's closed. It doesn't stack with the Pro discount: the better one is used.", fields: [
    { k: "enabled", label: "Show the popup", type: "bool" }, { k: "pct", label: "Discount (%)", type: "number" }, { k: "headline", label: "Headline" }, { k: "text", label: "Text", type: "textarea" },
    { k: "delaySec", label: "Show after (seconds)", type: "number" }, { k: "exitIntent", label: "Also show when leaving the page (computer)", type: "bool" }, { k: "hideDays", label: "Don't show again for (days) after closing", type: "number" },
  ] },
  community: { title: "Designers & reviews", note: "The small \"Get it custom\" card in the shop grid, the line on product pages, open requests to all designers, messages to designers and customer reviews. Only verified buyers can review.", fields: [
    { k: "promoEnabled", label: "Show the custom card in the shop grid", type: "bool" }, { k: "promoEvery", label: "Show it after every N designs", type: "number" }, { k: "promoTitle", label: "Card title" }, { k: "promoText", label: "Card text", type: "textarea" }, { k: "promoCta", label: "Card link text" },
    { k: "productLineEnabled", label: "Show \"Work with a designer\" line on product pages", type: "bool" }, { k: "requestsEnabled", label: "Allow open requests to all designers", type: "bool" }, { k: "contactEnabled", label: "Allow customers to message designers", type: "bool" }, { k: "reviewsEnabled", label: "Reviews on (designs and designers)", type: "bool" },
  ] },
  tax: { title: "Sales tax", note: "Tax is added at checkout. Leave states empty to tax every order, or list state codes (e.g. NY, NJ). Trade accounts can be tax-exempt.", fields: [
    { k: "enabled", label: "Charge sales tax", type: "bool" }, { k: "rate", label: "Tax rate (%)", type: "number" }, { k: "states", label: "Only in these states (codes, comma separated)" }, { k: "label", label: "Name on the receipt" }, { k: "shippingTaxable", label: "Tax shipping too", type: "bool" }, { k: "tradeExempt", label: "Trade accounts don't pay tax", type: "bool" },
  ] },
  invoices: { title: "Invoices", note: "Shown on every invoice and estimate and their PDFs. Empty fields use the General settings (site name, contact email and phone).", fields: [
    { k: "businessName", label: "Business name on invoices" }, { k: "logoUrl", label: "Logo (PNG or JPG)", type: "image", hint: "Without a logo, the business name is shown in the site's lettering." },
    { k: "address", label: "Business address", type: "textarea" }, { k: "phone", label: "Phone" }, { k: "email", label: "Email" }, { k: "website", label: "Website" },
    { k: "prefix", label: "Invoice number prefix", hint: "e.g. INV- gives INV-1001" }, { k: "startNumber", label: "First invoice number", type: "number" },
    { k: "dueDays", label: "Default days to pay (0 = due on receipt)", type: "number" }, { k: "taxRate", label: "Default tax rate on invoices (%)", type: "number" },
    { k: "ratePerSqft", label: "Default price per sq ft on invoices ($)", type: "number", hint: "Empty uses the General default price per sq ft." },
    { k: "notes", label: "Default note on invoices", type: "textarea" }, { k: "footer", label: "Payment instructions (bottom of every invoice)", type: "textarea", hint: "e.g. Checks to Artisan Mural. Zelle: ..." },
    { k: "estPrefix", label: "Estimate number prefix", hint: "e.g. EST- gives EST-1001" }, { k: "estStartNumber", label: "First estimate number", type: "number" },
    { k: "estValidDays", label: "Estimates valid for (days, 0 = no end date)", type: "number" },
    { k: "estNotes", label: "Default note on estimates", type: "textarea" }, { k: "estTerms", label: "Default terms on estimates", type: "textarea" },
  ] },
  taxonomy: { title: "Categories", note: "The shop filters and the designers' pickers use these lists. One per line. A design keeps its old label if you rename one, so re-tag it in Designs. Empty list = the standard list.", fields: [
    { k: "styles", label: "Styles", type: "textarea", hint: "e.g. Modern, Botanical, Damask, Art deco" },
    { k: "themes", label: "Themes / subjects", type: "textarea", hint: "e.g. Tropical, Animals & birds, Kids & nursery" },
    { k: "rooms", label: "Rooms", type: "textarea", hint: "e.g. Bedroom, Kids & nursery, Bathroom" },
  ] },
  designerFaq: { title: "Designer FAQ", note: "The designers' page at /designers/how-it-works. Each question starts with Q: and its answer with A:, a blank line between questions, and ## starts a new group heading. Words in {curly brackets} fill in from your other settings: {royalty_starter} {royalty_studio} {royalty_atelier} {designer_share} {studio_commission} {minimum_payout} {payout_schedule} {target_dpi} {min_dpi} {max_upload_gb} {production_days} {review_time} {review_time_sentence} {example_px} {example_royalty}. Empty box = the standard questions.", fields: [
    { k: "intro", label: "Intro under the page title (optional)", type: "textarea", hint: "Empty = the standard intro." },
    { k: "reviewTime", label: "Typical review time (optional)", hint: "e.g. 3 business days. Shown in the review question. Empty = no time promised." },
    { k: "faq", label: "Questions and answers", type: "textarea" },
  ] },
  ai: { title: "Room preview and AI", note: "AI pictures use Google Gemini (recommended, about $0.04 per picture) or OpenAI, billed to your own key. Get a Gemini key free at aistudio.google.com > Get API key. Without a key, customers still get the free 4-corner overlay and designers get automatic room pictures.", fields: [
    { k: "freeOverlayEnabled", label: "Free room photo overlay (4 corners)", type: "bool" },
    { k: "roomRenderEnabled", label: "AI 'see it in my room' for customers", type: "bool" },
    { k: "mockupsEnabled", label: "AI room pictures for designers", type: "bool" },
    { k: "wallDetectEnabled", label: "Find walls automatically in customer photos (Google key)", type: "bool" },
    { k: "autoTagEnabled", label: "Auto-tag new designs: type, rooms, category (Google key)", type: "bool" },
    { k: "provider", label: "AI provider", type: "select", options: ["google", "openai"] }, { k: "apiKey", label: "Your AI API key", type: "secret", hint: "Stored hidden. Never shown again after saving." }, { k: "model", label: "Model", hint: "Google: gemini-3.1-flash-image. OpenAI: gpt-image-1." }, { k: "dailyLimit", label: "AI pictures per person per day", type: "number" }, { k: "visionModel", label: "Wall finding + tagging model", hint: "Google: gemini-flash-latest (fast, about a cent or less a photo)." },
  ] },
};

export function Settings() {
  const { data, error, reload } = useApi<any>("admin/settings");
  const [tab, setTab] = useState("general");
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  return <div>
    <div className="bo-top"><h1>Settings</h1></div>
    <div className="bo-tabs">{[...Object.entries(GROUPS).map(([k, g]) => [k, g.title]), ["finishes", "Finishes"]].map(([k, t]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>)}</div>
    {tab === "finishes" ? <Finishes /> : <Group key={tab} name={tab} value={data.settings[tab]} onSaved={reload} />}
  </div>;
}
function Group({ name, value, onSaved }: { name: string; value: any; onSaved: () => void }) {
  const g = GROUPS[name];
  const [v, setV] = useState<any>(value ?? {});
  const s = useSaver();
  useEffect(() => setV(value ?? {}), [value]);
  const set = (k: string, x: any) => setV({ ...v, [k]: x });
  return <div className="bo-card" style={{ maxWidth: 720 }}>
    {g.note && (g.note.length > 80 ? <div className="bo-msg" style={{ marginBottom: 12 }}>{g.note}</div> : <div className="bo-row" style={{ marginBottom: 12 }}><Pill tone="warn">{g.note}</Pill></div>)}
    <Msg m={s.msg} />
    <div className={name === "designerFaq" ? "" : "bo-grid2"}>{g.fields.map((f) => f.type === "bool" ? <div key={f.k} className="bo-field" style={{ display: "flex", alignItems: "center", minHeight: 52 }}><Switch checked={!!v[f.k]} onChange={(x) => set(f.k, x)} label={f.label} /></div> :
      <Field key={f.k} label={f.label} hint={f.hint}>{f.type === "select" ? <select className="bo-sel" value={v[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
        : f.type === "textarea" ? <textarea className="bo-ta" rows={name === "taxonomy" ? 10 : name === "designerFaq" && f.k === "faq" ? 28 : 3} value={v[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} />
        : f.type === "image" ? <div className="bo-row" style={{ flexWrap: "nowrap" }}>{v[f.k] ? <img src={v[f.k]} alt="" className="bo-thumb" style={{ objectFit: "contain", width: 64 }} /> : null}<label className="bo-btn" style={{ flex: "none" }}>Upload<input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) s.run(async () => { const t = await api("admin/upload-url", { body: { filename: file.name } }); const fd = new FormData(); fd.append("", file); const r = await fetch(t.uploadUrl, { method: "PUT", body: fd }); if (!r.ok) throw new Error("Upload failed"); set(f.k, t.publicUrl); }, "Uploaded. Save to keep it."); }} /></label>{v[f.k] ? <button type="button" className="bo-btn" onClick={() => set(f.k, "")}>Remove</button> : null}</div>
        : <input className="bo-in" type={f.type === "number" ? "number" : f.type === "secret" ? "password" : "text"} step="any" value={v[f.k] ?? ""} placeholder={f.type === "secret" ? "Not set" : ""} onChange={(e) => set(f.k, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />}</Field>)}</div>
    <button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(async () => { await api(`admin/settings/${name}`, { body: { value: v } }); onSaved(); })}>Save {g.title.toLowerCase()}</button>
  </div>;
}
function Finishes() {
  const { data, error, reload } = useApi<any>("admin/materials");
  const s = useSaver();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (data) setRows(data.materials); }, [data]);
  if (error) return <Msg m={{ text: error }} />;
  const set = (i: number, k: string, v: any) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  async function uploadTexture(i: number, file: File) {
    const t = await api("admin/upload-url", { body: { filename: file.name } });
    const fd = new FormData(); fd.append("", file);
    const r = await fetch(t.uploadUrl, { method: "PUT", body: fd }); if (!r.ok) throw new Error("Upload failed");
    set(i, "texture", t.publicUrl);
  }
  return <div className="bo-card"><Msg m={s.msg} />
    <div className="bo-sub" style={{ marginBottom: 10 }}>One finish is the standard (list price). Every other finish adds or takes off a fixed amount per sq ft, e.g. +1.00 or −0.50. "Photo covers" is how many inches of material the texture photo shows, so the shop shows the texture at real size.</div>
    <table className="bo-tbl stack"><thead><tr><th>Finish</th><th>Texture photo</th><th>Price per sq ft</th><th>Photo covers (in)</th><th>On sale</th><th></th></tr></thead><tbody>
      {rows.map((m, i) => <tr key={m.id}>
        <td data-l="Name"><input className="bo-in" value={m.name} onChange={(e) => set(i, "name", e.target.value)} /><input className="bo-in" style={{ marginTop: 4 }} value={m.blurb} onChange={(e) => set(i, "blurb", e.target.value)} placeholder="Short description" /></td>
        <td data-l="Photo"><div className="bo-row" style={{ flexWrap: "nowrap" }}>{m.texture ? <img src={m.texture} alt="" className="bo-thumb" /> : <div className="bo-thumb" />}<label className="bo-btn sm" style={{ cursor: "pointer" }}>Upload<input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && s.run(() => uploadTexture(i, e.target.files![0]), "Photo uploaded. Press Save.")} /></label></div></td>
        <td data-l="Price" style={{ width: 170 }}>{m.standard ? <span className="bo-pill ok">Standard (list price)</span> : <input className="bo-in" type="number" step="0.25" value={m.priceAdj ?? 0} onChange={(e) => set(i, "priceAdj", e.target.value)} />}
          {!m.standard && <button className="bo-btn sm" style={{ marginTop: 4, border: 0, padding: 0, height: "auto" }} onClick={() => setRows(rows.map((r, j) => ({ ...r, standard: j === i, priceAdj: j === i ? 0 : r.priceAdj })))}>Make standard</button>}</td>
        <td data-l="Covers" style={{ width: 100 }}><input className="bo-in" type="number" step="0.5" min="0.5" value={m.sampleIn ?? 2} onChange={(e) => set(i, "sampleIn", e.target.value)} /></td>
        <td><input type="checkbox" checked={m.active} onChange={(e) => set(i, "active", e.target.checked)} /></td>
        <td><button className="bo-btn sm" disabled={s.busy} onClick={() => s.run(async () => { await api("admin/materials", { body: rows[i] }); reload(); }, `Saved ${m.name}`)}>Save</button></td></tr>)}
    </tbody></table>
    <UndoPrices onDone={reload} />
  </div>;
}

function UndoPrices({ onDone }: { onDone: () => void }) {
  const h = useApi<any>("admin/price-history");
  const s = useSaver();
  const list = (h.data?.items ?? []).filter((x: any) => !x.undone).slice(0, 5);
  if (!list.length) return null;
  return <div style={{ marginTop: 12 }}><div className="bo-lbl">Recent price changes</div><Msg m={s.msg} />
    {list.map((x: any) => <div key={x.id} className="bo-row" style={{ padding: "4px 0", borderTop: "1px solid #f0efed" }}><span style={{ flex: 1 }}>{x.label}</span><span className="bo-sub">{new Date(x.created_at).toLocaleString()}</span><button className="bo-btn sm" onClick={() => s.run(async () => { await api(`admin/price-history/${x.id}/undo`, { body: {} }); h.reload(); onDone(); }, "Undone")}>Undo</button></div>)}
  </div>;
}

export function Homepage() {
  const { data, error, reload } = useApi<any>("admin/settings");
  const designs = useApi<any>("admin/designs");
  const [v, setV] = useState<any>(null);
  const s = useSaver();
  useEffect(() => { if (data) setV(data.settings.homepage); }, [data]);
  if (error) return <Msg m={{ text: error }} />;
  if (!v) return <div className="bo-sub">Loading…</div>;
  const set = (path: string[], x: any) => { const n = JSON.parse(JSON.stringify(v)); let o = n; for (const p of path.slice(0, -1)) o = o[p] ??= {}; o[path[path.length - 1]] = x; setV(n); };
  const all = [...(designs.data?.builtIn ?? []).map((d: any) => ({ slug: d.slug, title: d.title })), ...(designs.data?.uploads ?? []).filter((u: any) => u.review === "approved").map((u: any) => ({ slug: u.slug, title: u.title }))];
  async function upload(file: File) {
    const t = await api("admin/upload-url", { body: { filename: file.name } });
    const fd = new FormData(); fd.append("", file);
    const r = await fetch(t.uploadUrl, { method: "PUT", body: fd });
    if (!r.ok) throw new Error("Upload failed");
    set(["hero", "image"], t.publicUrl);
  }
  const SECTIONS: [string, string][] = [["featured", "Featured designs"], ["rooms", "See it in your room"], ["showcase", "Shop by style"], ["designers", "Meet the artist"], ["howItWorks", "How it works"], ["sell", "Custom design banner"]];
  return <div>
    <div className="bo-top"><h1>Homepage</h1><a className="bo-btn" href="/" target="_blank" rel="noreferrer">View homepage</a><button className="bo-btn pri" disabled={s.busy} onClick={() => s.run(async () => { await api("admin/settings/homepage", { body: { value: v } }); reload(); }, "Homepage saved. Refresh the homepage to see it.")}>Save</button></div>
    <Msg m={s.msg} />
    <div className="bo-card" style={{ maxWidth: 760 }}><h2>Top banner</h2>
      <div className="bo-field"><Switch checked={v.banner?.enabled} onChange={(x) => set(["banner", "enabled"], x)} label="Show a banner at the top of every page" /></div>
      <div className="bo-grid2"><Field label="Banner text"><input className="bo-in" value={v.banner?.text ?? ""} onChange={(e) => set(["banner", "text"], e.target.value)} placeholder="Free samples this week" /></Field><Field label="Banner link (optional)"><input className="bo-in" value={v.banner?.link ?? ""} onChange={(e) => set(["banner", "link"], e.target.value)} placeholder="/browse" /></Field></div>
    </div>
    <div className="bo-card" style={{ maxWidth: 760 }}><h2>Hero</h2><div className="bo-sub" style={{ marginBottom: 10 }}>Leave a field empty to keep the current wording.</div>
      <Field label="Title"><input className="bo-in" value={v.hero?.title ?? ""} onChange={(e) => set(["hero", "title"], e.target.value)} /></Field>
      <Field label="Subtitle"><textarea className="bo-ta" value={v.hero?.subtitle ?? ""} onChange={(e) => set(["hero", "subtitle"], e.target.value)} /></Field>
      <div className="bo-grid2"><Field label="Button text"><input className="bo-in" value={v.hero?.ctaText ?? ""} onChange={(e) => set(["hero", "ctaText"], e.target.value)} /></Field><Field label="Button link"><input className="bo-in" value={v.hero?.ctaLink ?? ""} onChange={(e) => set(["hero", "ctaLink"], e.target.value)} /></Field></div>
      <Field label="Hero image"><div className="bo-row">{v.hero?.image && <img src={v.hero.image} alt="" className="bo-thumb" style={{ width: 80 }} />}<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && s.run(() => upload(e.target.files![0]), "Image uploaded. Press Save.")} />{v.hero?.image && <button className="bo-btn sm" onClick={() => set(["hero", "image"], "")}>Use default</button>}</div></Field>
    </div>
    <div className="bo-card" style={{ maxWidth: 760 }}><h2>Sections</h2>
      {SECTIONS.map(([k, l]) => <div key={k} className="bo-field"><Switch checked={v.sections?.[k] !== false} onChange={(x) => set(["sections", k], x)} label={l} /></div>)}
    </div>
    <div className="bo-card" style={{ maxWidth: 760 }}><h2>Featured designs</h2><div className="bo-sub" style={{ marginBottom: 10 }}>Pick the designs shown first. Empty = newest designs.</div>
      <div className="bo-row" style={{ gap: 6 }}>{all.map((d) => { const on = (v.featuredSlugs ?? []).includes(d.slug); return <button key={d.slug} className={"bo-btn sm" + (on ? " pri" : "")} onClick={() => set(["featuredSlugs"], on ? v.featuredSlugs.filter((x: string) => x !== d.slug) : [...(v.featuredSlugs ?? []), d.slug])}>{d.title}</button>; })}</div>
    </div>
  </div>;
}
