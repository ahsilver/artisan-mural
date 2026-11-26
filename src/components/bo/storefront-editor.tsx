import { useEffect, useState } from "react";
import { api, useApi } from "@/components/bo/common";
import { MENU_PIC_LABELS, defaultMenuPic } from "@/components/site-header";
import { HomeLayoutSections } from "@/components/bo/home-layout-editor";
import { parseTaxonomy } from "@/lib/design-taxonomy";

/** Owner editors for the new storefront: homepage banners and tiles, menu pictures. Saved in the "homepage" settings
 *  group, which the homepage and the menu read; an empty field keeps the standard wording or picture. */
const COVERS = ["living-room", "bedroom", "bathroom", "kitchen", "dining-room", "hallway", "hotel", "restaurant", "commercial", "kids", "nursery", "office"].map((n) => `/p/img/cover-${n}.webp`);
const ROOMS = ["living-1", "living-2", "living-3", "bedroom-1", "bedroom-2", "bedroom-3", "kids-1", "kids-2", "nursery-1", "dining-1", "dining-2", "kitchen-1", "kitchen-2", "bathroom-1", "bathroom-2", "entry-1", "entry-2", "office-1", "office-2", "lobby-1", "meeting-1"].map((n) => `/s/rooms/${n}-t-v1.jpg`);

async function uploadPicture(file: File): Promise<string> {
  const small = await shrink(file, 2000);
  const t = await api("admin/upload-url", { body: { filename: file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg" } });
  const fd = new FormData(); fd.append("", small, "picture.jpg");
  const r = await fetch(t.uploadUrl, { method: "PUT", body: fd });
  if (!r.ok) throw new Error("Upload failed");
  return t.publicUrl as string;
}
async function shrink(file: File, max: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.86));
  } finally { URL.revokeObjectURL(url); }
}

/** Pick a picture: from the site's pictures and designs, a link, or an upload. */
export function PicturePicker({ value, fallback, onChange, designs }: { value: string; fallback?: string | undefined; onChange: (v: string) => void; designs: { title: string; image: string }[] }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const shown = value || fallback || "";
  return (
    <div className="pp">
      {shown ? <img className="pp-img" src={shown} alt="" /> : <span className="pp-img pp-none">No picture</span>}
      <div className="pp-ctl">
        <select aria-label="Choose a picture" value={[...COVERS, ...ROOMS, ...designs.map((d) => d.image)].includes(value) ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">{value ? "Your own picture" : fallback ? "Standard picture (automatic)" : "Choose from the site's pictures…"}</option>
          <optgroup label="Room covers">{COVERS.map((u) => <option key={u} value={u}>{u.split("cover-")[1]!.replace(".webp", "").replace(/-/g, " ")}</option>)}</optgroup>
          <optgroup label="Room photos">{ROOMS.map((u) => <option key={u} value={u}>{u.split("/rooms/")[1]!.replace("-t-v1.jpg", "").replace(/-/g, " ")}</option>)}</optgroup>
          {designs.length > 0 && <optgroup label="Designs">{designs.map((d) => <option key={d.image} value={d.image}>{d.title}</option>)}</optgroup>}
        </select>
        <input type="url" placeholder="…or paste a picture link (https://…)" value={/^https?:/.test(value) ? value : ""} onChange={(e) => onChange(e.target.value.trim())} />
        <div className="up-row">
          <label className="btn btn-sm optline pp-up">{busy ? "Uploading…" : "Upload a picture"}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setBusy(true); setErr(""); try { onChange(await uploadPicture(f)); } catch (x: any) { setErr(x.message); } setBusy(false); }} /></label>
          {value && <button type="button" className="up-link" onClick={() => onChange("")}>Use the standard picture</button>}
        </div>
        {err && <small className="err">{err}</small>}
      </div>
    </div>
  );
}

function useHomepage() {
  const { data, error, reload } = useApi<any>("admin/settings");
  const designs = useApi<any>("admin/designs");
  const [v, setV] = useState<any>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(JSON.parse(JSON.stringify(data.settings.homepage ?? {}))); }, [data]);
  const set = (path: (string | number)[], x: any) => setV((cur: any) => { const n = JSON.parse(JSON.stringify(cur)); let o = n; for (let i = 0; i < path.length - 1; i++) { const p = path[i]!; if (o[p] == null || typeof o[p] !== "object") o[p] = typeof path[i + 1] === "number" ? [] : {}; o = o[p]; } o[path[path.length - 1]!] = x; return n; });
  const save = async (label: string) => { setBusy(true); setMsg(""); try { await api("admin/settings/homepage", { body: { value: v } }); setMsg(`${label} saved ✓ It shows on the site within a minute.`); reload(); } catch (e: any) { setMsg(e.message || "Could not save."); } setBusy(false); };
  const list = [...(designs.data?.uploads ?? []).filter((u: any) => u.review === "approved"), ...(designs.data?.builtIn ?? [])].filter((d: any) => !d.hidden).map((d: any) => ({ slug: d.slug ?? `u-${d.id}`, title: d.title, image: d.image || d.thumb || d.mockups?.[0] || d.colors?.[0]?.thumb || d.preview || d.colors?.[0]?.preview || "" })).filter((d) => d.image && !/^blob:/.test(d.image)).slice(0, 80);
  return { v, set, save, msg, busy, error, designs: list, tax: parseTaxonomy(data?.settings?.taxonomy) };
}

const SLIDES = [
  { n: "Banner 1 · fabric samples on the table", k: "Original designs by independent artists", t: "Every wall. Your story.", p: "Murals and wallpaper drawn by independent artists, printed to the exact size of your wall.", pic: false },
  { n: "Banner 2 · featured room", k: "Today's featured design", t: "One scene, wall to wall.", p: "Printed to the exact size of your wall and split into numbered panels, ready to hang.", pic: "image" },
  { n: "Banner 3 · before and after", k: "Don't love a detail?", t: "Our designers will change it.", p: "Remove an animal, change a color, make it bigger. Chat with the designer before you order, free on every mural.", pic: "ba" },
] as const;
const TILES = ["Murals", "Botanical", "Floral", "Animals", "Geometric", "Minimal", "Black & white", "Moody", "Tropical", "Kids & nursery"];
const ROOM_TILES: [string, string][] = [["Living room", "/p/img/cover-living-room.webp"], ["Bedroom", "/p/img/cover-bedroom.webp"], ["Kitchen & bath", "/p/img/cover-bathroom.webp"], ["Hotels & restaurants", "/p/img/cover-restaurant.webp"]];
const SECTIONS: [string, string][] = [["hero", "Banners at the top"], ["duo", "Artisan Pro and Sell boxes"], ["look", "Shop by look"], ["rooms", "Shop by room"], ["transform", "Transform your space"], ["trends", "Trending now"], ["new", "New arrivals"], ["designers", "Meet the designers"], ["changes", "Changes band"], ["signup", "Email signup"]];

export function HomepageEditor() {
  const h = useHomepage();
  if (h.error) return <p className="rq-ok err">{h.error}</p>;
  if (!h.v) return <p className="hint">Loading…</p>;
  const v = h.v; const sl: any[] = v.hero?.slides ?? [];
  const txt = (path: (string | number)[], label: string, ph: string, area = false) => { let cur: any = v; for (const p of path) cur = cur?.[p]; return <label className="rqf"><span>{label}</span>{area ? <textarea rows={2} value={cur ?? ""} placeholder={ph} onChange={(e) => h.set(path, e.target.value)} /> : <input value={cur ?? ""} placeholder={ph} onChange={(e) => h.set(path, e.target.value)} />}</label>; };
  return <div className="bo-ed">
    <div className="st-h"><h2>Homepage &amp; banners</h2><a className="btn btn-sm optline" href="/" target="_blank" rel="noreferrer">View homepage ↗</a></div>
    <p className="hint">Empty fields keep the standard wording and pictures. Changes show on the site within a minute after you save.</p>
    <section className="st-card"><b>Sections</b><div className="bo-switches">{SECTIONS.map(([k, l]) => <label key={k} className="sa-check"><input type="checkbox" checked={v.sections?.[k] !== false} onChange={(e) => h.set(["sections", k], e.target.checked)} /><span>{l}</span></label>)}</div></section>
    {SLIDES.map((s, i) => <section key={i} className="st-card"><b>{s.n}</b>
      <div className="af-grid">{txt(["hero", "slides", i, "kicker"], "Small line above", s.k)}{txt(["hero", "slides", i, "title"], "Title", s.t)}</div>
      {txt(["hero", "slides", i, "text"], "Text", s.p, true)}
      {s.pic === "image" && <><span className="bo-l">Picture (empty = today's featured design in a room)</span><PicturePicker designs={h.designs} value={sl[i]?.image ?? ""} onChange={(x) => h.set(["hero", "slides", i, "image"], x)} />{txt(["hero", "slides", i, "link"], "Link when tapped", "/browse")}</>}
      {s.pic === "ba" && <div className="af-grid"><div><span className="bo-l">Before</span><PicturePicker designs={h.designs} value={sl[i]?.before ?? ""} fallback="/p/img/forest-before.webp" onChange={(x) => h.set(["hero", "slides", i, "before"], x)} /></div><div><span className="bo-l">After</span><PicturePicker designs={h.designs} value={sl[i]?.after ?? ""} fallback="/p/img/forest-after.webp" onChange={(x) => h.set(["hero", "slides", i, "after"], x)} /></div></div>}
      {i === 0 && <p className="hint">The samples on the table are your live designs; they change every day.</p>}
    </section>)}
    <section className="st-card"><b>Artisan Pro and Sell boxes</b><div className="af-grid">{(["pro", "sell"] as const).map((k) => <div key={k} className="bo-ed-col"><span className="bo-l">{k === "pro" ? "Artisan Pro box" : "Sell your art box"}</span>
      {txt(["duo", k, "kicker"], "Small line", k === "pro" ? "For design professionals" : "For artists")}{txt(["duo", k, "title"], "Title", k === "pro" ? "Artisan Pro" : "Sell your designs")}{txt(["duo", k, "text"], "Text", k === "pro" ? "Trade pricing, free samples and one specialist for every project." : "We print and ship to order. You earn on every sale.", true)}{txt(["duo", k, "cta"], "Button", "Apply")}
      <PicturePicker designs={h.designs} value={v.duo?.[k]?.image ?? ""} fallback={k === "pro" ? "/p/img/cover-hotel.webp" : undefined} onChange={(x) => h.set(["duo", k, "image"], x)} /></div>)}</div></section>
    <HomeLayoutSections v={v} set={h.set} designs={h.designs} tax={h.tax} />
    <div className="bo-save"><button type="button" className="btn btn-wine" disabled={h.busy} onClick={() => void h.save("Homepage")}>{h.busy ? "Saving…" : "Save homepage"}</button>{h.msg && <span className="rq-ok">{h.msg}</span>}</div>
  </div>;
}

export function MenuPicturesEditor() {
  const h = useHomepage();
  if (h.error) return <p className="rq-ok err">{h.error}</p>;
  if (!h.v) return <p className="hint">Loading…</p>;
  return <div className="bo-ed">
    <div className="st-h"><h2>Menu pictures</h2></div>
    <p className="hint">The pictures in the "All designs" menu (Type and Rooms). Empty = the standard room photo.</p>
    <div className="bo-tiles">{MENU_PIC_LABELS.map((l) => <div key={l} className="bo-tile"><span className="bo-l"><b>{l}</b></span><PicturePicker designs={h.designs} value={h.v.menuPictures?.[l] ?? ""} fallback={defaultMenuPic(l)} onChange={(x) => h.set(["menuPictures", l], x)} /></div>)}</div>
    <div className="bo-save"><button type="button" className="btn btn-wine" disabled={h.busy} onClick={() => void h.save("Menu pictures")}>{h.busy ? "Saving…" : "Save menu pictures"}</button>{h.msg && <span className="rq-ok">{h.msg}</span>}</div>
  </div>;
}

/** Every email the site sends, ready-written: read, edit, switch off, preview in the brand style, or send yourself a test. */
export function EmailTemplatesEditor() {
  const { data, error, reload } = useApi<any>("admin/email-templates");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; off: boolean }>({ subject: "", body: "", off: false });
  const [prev, setPrev] = useState<{ subject: string; html: string } | null>(null);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  if (error) return <p className="rq-ok err">{error}</p>;
  if (!data) return <p className="hint">Loading…</p>;
  const list: any[] = data.templates;
  const groups = [...new Set(list.map((t) => t.group))];
  const pick = async (t: any) => {
    setOpen(t.key); setMsg("");
    const d = { subject: t.edit?.subject || t.subject, body: t.edit?.body || t.body, off: !!t.edit?.off }; setDraft(d);
    setPrev(await api("admin/email-templates/preview", { body: { key: t.key, ...d } }).catch(() => null));
  };
  const cur = list.find((t) => t.key === open);
  const save = async (reset = false) => {
    if (!cur) return; setBusy(true); setMsg("");
    try {
      const all = { ...(Object.fromEntries(list.filter((t) => t.edit).map((t) => [t.key, t.edit]))) };
      all[cur.key] = reset ? { subject: "", body: "", off: false } : { subject: draft.subject === cur.subject ? "" : draft.subject, body: draft.body === cur.body ? "" : draft.body, off: draft.off };
      await api("admin/settings/emailTemplates", { body: { value: all } });
      setMsg(reset ? "Back to the original text ✓" : "Saved ✓ The next email uses this text."); await reload();
      if (reset) setDraft({ subject: cur.subject, body: cur.body, off: false });
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  return <div className="bo-ed">
    <div className="st-h"><h2>Email templates</h2></div>
    <p className="hint">Every email the website sends by itself, already written. Open one to read or change it. Words in double braces, like {"{{name}}"} or {"{{tracking}}"}, are filled in for each customer. The first link becomes the button; write a few words before it, like "Track your package:", and those become the button text.</p>
    <div className="et-grid">
      <div className="et-list">{groups.map((g) => <div key={g}><span className="bo-l"><b>{g}</b></span>{list.filter((t) => t.group === g).map((t) => <button key={t.key} type="button" className={"et-item" + (open === t.key ? " on" : "")} onClick={() => void pick(t)}><b>{t.label}{t.edit?.off ? " · off" : t.edit?.subject || t.edit?.body ? " · edited" : ""}</b><small>{t.when}</small></button>)}</div>)}</div>
      <div className="et-edit">{!cur ? <p className="hint">Choose an email on the left.</p> : <>
        <h3>{cur.label}</h3><p className="hint">Sent when: {cur.when}. You can use: {cur.vars.map((v: string) => `{{${v}}}`).join(", ")}</p>
        <label className="rqf"><span>Subject</span><input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
        <label className="rqf"><span>Text</span><textarea rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
        <label className="sa-check"><input type="checkbox" checked={draft.off} onChange={(e) => setDraft({ ...draft, off: e.target.checked })} /><span>Don't send this email (the in-site notification still shows)</span></label>
        <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={() => void save()}>Save</button><button type="button" className="btn optline btn-sm" onClick={async () => setPrev(await api("admin/email-templates/preview", { body: { key: cur.key, ...draft } }))}>Preview</button><button type="button" className="btn optline btn-sm" onClick={async () => { try { const r = await api("admin/email-templates/test", { body: { key: cur.key } }); setMsg(`Test sent to ${r.to} ✓ (saved text)`); } catch (e: any) { setMsg(e.message); } }}>Send me a test</button><button type="button" className="up-link" onClick={() => void save(true)}>Back to the original text</button></div>
        {msg && <p className="rq-ok">{msg}</p>}
        {prev && <div className="et-prev"><span className="bo-l">Preview · {prev.subject}</span><iframe title="Email preview" srcDoc={prev.html} /></div>}
      </>}</div>
    </div>
  </div>;
}
