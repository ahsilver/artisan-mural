import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "@/components/bo/common";
import { PicturePicker } from "@/components/bo/storefront-editor";
import { BLOCK_TYPES, DEFAULT_PAGES, RESERVED, newBlock, siteFooter, sitePages, slugify, type Block, type Footer, type Link2, type SitePage } from "@/lib/site-pages";
import { PAGE_TEXTS } from "@/lib/page-texts";
import { parseColors, colorsToText, parseTaxonomy, type ColorFamily } from "@/lib/design-taxonomy";

/** Back office editors for the whole site: pages (made of blocks), the footer, the categories (rooms, styles,
 *  themes, colors) and the words on the site's own pages. Each saves one settings group; the site reads them. */

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function useSettingsGroup(name: string) {
  const { data, error, reload } = useApi<any>("admin/settings");
  const designs = useApi<any>("admin/designs");
  const pics = useMemo(() => [...(designs.data?.builtIn ?? []), ...(designs.data?.uploads ?? []).filter((u: any) => u.review === "approved")].map((d: any) => ({ title: d.title, image: d.image || d.preview || d.colors?.[0]?.preview || "" })).filter((d) => d.image && !/^blob:/.test(d.image)).slice(0, 80), [designs.data]);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const save = async (value: any, ok = "Saved ✓ It shows on the site within a minute.") => {
    setBusy(true); setMsg("");
    try { await api(`admin/settings/${name}`, { body: { value } }); setMsg(ok); await reload(); return true; } catch (e: any) { setMsg(e.message || "Could not save."); return false; } finally { setBusy(false); }
  };
  return { saved: data?.settings?.[name], general: data?.settings?.general, error, loaded: !!data, save, msg, setMsg, busy, pics };
}
const In = ({ label, value, onChange, ph, area, rows }: { label: string; value: string | undefined; onChange: (v: string) => void; ph?: string; area?: boolean; rows?: number }) =>
  <label className="rqf"><span>{label}</span>{area ? <textarea rows={rows ?? 4} value={value ?? ""} placeholder={ph} onChange={(e) => onChange(e.target.value)} /> : <input value={value ?? ""} placeholder={ph} onChange={(e) => onChange(e.target.value)} />}</label>;
const LinkIn = ({ label, v, set }: { label: string; v: Link2 | undefined; set: (l: Link2) => void }) =>
  <div className="se-2"><In label={`${label}: words`} value={v?.label} onChange={(x) => set({ label: x, to: v?.to ?? "" })} ph="Shop all designs" /><In label={`${label}: goes to`} value={v?.to} onChange={(x) => set({ label: v?.label ?? "", to: x.trim() })} ph="/browse or https://…" /></div>;
const Mover = ({ i, n, move, del }: { i: number; n: number; move: (d: number) => void; del: () => void }) =>
  <span className="se-mv"><button type="button" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up">↑</button><button type="button" disabled={i === n - 1} onClick={() => move(1)} aria-label="Move down">↓</button><button type="button" onClick={del} aria-label="Remove">✕</button></span>;
function moved<T>(list: T[], i: number, d: number): T[] { const l = [...list]; const j = i + d; if (j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j]!, l[i]!]; return l; }

/* ---------------- Pages ---------------- */
function BlockEditor({ b, set, pics }: { b: Block; set: (b: Block) => void; pics: { title: string; image: string }[] }) {
  const up = (patch: any) => set({ ...(b as any), ...patch });
  const pic = (v: string | undefined, on: (x: string) => void) => <PicturePicker designs={pics} value={v ?? ""} onChange={on} />;
  const items = <K,>(list: K[], blank: K, row: (it: K, put: (x: K) => void) => React.ReactNode, word: string) => <div className="se-items">
    {list.map((it, k) => <div key={k} className="se-item"><div className="se-ih"><b>{word} {k + 1}</b><Mover i={k} n={list.length} move={(d) => up({ items: moved(list, k, d) })} del={() => up({ items: list.filter((_, j) => j !== k) })} /></div>{row(it, (x) => up({ items: list.map((y, j) => (j === k ? x : y)) }))}</div>)}
    <button type="button" className="btn optline btn-sm" onClick={() => up({ items: [...list, blank] })}>+ Add {word.toLowerCase()}</button></div>;
  switch (b.type) {
    case "hero": return <>{pic(b.image, (x) => up({ image: x }))}<In label="Small line above the title" value={b.kicker} onChange={(x) => up({ kicker: x })} /><In label="Title" value={b.title} onChange={(x) => up({ title: x })} /><In label="Text" value={b.text} onChange={(x) => up({ text: x })} area rows={2} /><LinkIn label="Button" v={b.button} set={(l) => up({ button: l })} /></>;
    case "text": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} /><In label="Text" value={b.text} onChange={(x) => up({ text: x })} area rows={8} ph={"A paragraph.\n\n- a list item\n- another item\n\n**bold words** and [a link](/browse)"} /></>;
    case "imageText": return <>{pic(b.image, (x) => up({ image: x }))}<label className="rqf"><span>Picture on the</span><select value={b.side ?? "left"} onChange={(e) => up({ side: e.target.value })}><option value="left">Left</option><option value="right">Right</option></select></label><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} /><In label="Text" value={b.text} onChange={(x) => up({ text: x })} area /><LinkIn label="Button" v={b.button} set={(l) => up({ button: l })} /></>;
    case "steps": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} />{items(b.items, { title: "", text: "" }, (it, put) => <><In label="Step" value={it.title} onChange={(x) => put({ ...it, title: x })} /><In label="Text" value={it.text} onChange={(x) => put({ ...it, text: x })} area rows={2} /></>, "Step")}</>;
    case "faq": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} />{items(b.items, { q: "", a: "" }, (it, put) => <><In label="Question" value={it.q} onChange={(x) => put({ ...it, q: x })} /><In label="Answer" value={it.a} onChange={(x) => put({ ...it, a: x })} area rows={3} /></>, "Question")}</>;
    case "pictures": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} />{items(b.items, { image: "", caption: "", to: "" }, (it, put) => <>{pic(it.image, (x) => put({ ...it, image: x }))}<div className="se-2"><In label="Caption" value={it.caption} onChange={(x) => put({ ...it, caption: x })} /><In label="Goes to (optional)" value={it.to} onChange={(x) => put({ ...it, to: x.trim() })} ph="/browse" /></div></>, "Picture")}</>;
    case "button": return <><LinkIn label="Button" v={b.button} set={(l) => up({ button: l })} /><LinkIn label="Second button (optional)" v={b.second} set={(l) => up({ second: l })} /></>;
    case "trackOrder": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} /><In label="Text above the boxes" value={b.text} onChange={(x) => up({ text: x })} area rows={2} /><p className="hint">Customers type their order number and email and see where their order is. Nothing else to set up.</p></>;
    case "contact": return <><In label="Heading" value={b.title} onChange={(x) => up({ title: x })} /><In label="Text" value={b.text} onChange={(x) => up({ text: x })} area rows={2} /><div className="se-2"><In label="Email (empty = the one in Settings)" value={b.email} onChange={(x) => up({ email: x })} /><In label="Phone (empty = the one in Settings)" value={b.phone} onChange={(x) => up({ phone: x })} /></div><In label="Hours" value={b.hours} onChange={(x) => up({ hours: x })} ph="Monday to Friday, 9am to 5pm" /></>;
  }
}

export function PagesEditor() {
  const g = useSettingsGroup("pages");
  const [pages, setPages] = useState<SitePage[] | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [add, setAdd] = useState<string>("");
  useEffect(() => { if (g.loaded) { setPages(clone(sitePages(g.saved))); setRemoved(Array.isArray(g.saved?.removed) ? g.saved.removed : []); } }, [g.loaded, g.saved]);
  if (g.error) return <p className="rq-ok err">{g.error}</p>;
  if (!pages) return <p className="hint">Loading…</p>;
  const cur = pages.find((p) => p.slug === open) ?? null;
  const put = (p: SitePage) => setPages(pages.map((x) => (x.slug === open ? p : x)));
  const persist = async (list: SitePage[], rem: string[], ok?: string) => {
    // only pages that differ from the ready-written ones are stored, so improvements to those keep arriving
    const def = new Map(DEFAULT_PAGES.map((p) => [p.slug, JSON.stringify(p)]));
    const items = list.filter((p) => def.get(p.slug) !== JSON.stringify(p));
    return g.save({ items, removed: rem }, ok);
  };
  const slugErr = (s: string, self?: string) => !s ? "Give the page an address." : RESERVED.includes(s) ? "That address is used by the site. Choose another." : pages.some((p) => p.slug === s && p.slug !== self) ? "Another page already has this address." : "";
  return <div className="bo-ed se">
    <div className="st-h"><h2>Pages</h2></div>
    <p className="hint">Build and change the site's pages: Help, Track my order, How to hang, Shipping, Returns, About us, Contact, Privacy, and any new page. A page is made of blocks: a big title with a picture, text, steps, questions, pictures, buttons, the order tracker and your contact details. Link to a page from the footer (Back office → Footer) or from any button.</p>
    <div className="et-grid">
      <div className="et-list">
        <button type="button" className="btn btn-wine btn-sm" onClick={() => { let s = "new-page", n = 2; while (pages.some((p) => p.slug === s)) s = `new-page-${n++}`; const p: SitePage = { slug: s, title: "New page", published: false, blocks: [newBlock("hero")] }; setPages([...pages, p]); setOpen(s); }}>+ New page</button>
        {pages.map((p) => <button key={p.slug} type="button" className={"et-item" + (open === p.slug ? " on" : "")} onClick={() => { setOpen(p.slug); g.setMsg(""); }}><b>{p.title}{!p.published ? " · hidden" : ""}</b><small>/{p.slug}{p.builtIn ? " · ready-written" : ""}</small></button>)}
        {removed.length > 0 && <div><span className="bo-l">Removed ready-written pages</span>{removed.map((s) => <button key={s} type="button" className="up-link" onClick={async () => { const r = removed.filter((x) => x !== s); const d = DEFAULT_PAGES.find((x) => x.slug === s); const list = d ? [...pages, clone(d)] : pages; setRemoved(r); setPages(list); await persist(list, r, `/${s} is back ✓`); }}>Bring back /{s}</button>)}</div>}
      </div>
      <div className="et-edit">{!cur ? <p className="hint">Choose a page on the left, or make a new one.</p> : <>
        <div className="se-row"><h3>{cur.title}</h3>{cur.published && <a className="btn optline btn-sm" href={`/${cur.slug}`} target="_blank" rel="noreferrer">View page ↗</a>}</div>
        <div className="se-2"><In label="Page title" value={cur.title} onChange={(x) => put({ ...cur, title: x })} />
          <label className="rqf"><span>Address</span><div className="se-slug"><em>/</em><input value={cur.slug} onChange={(e) => { const s = slugify(e.target.value); setPages(pages.map((x) => (x.slug === open ? { ...cur, slug: s } : x))); setOpen(s); }} /></div>{slugErr(cur.slug, cur.slug) && <small className="err">{slugErr(cur.slug, cur.slug)}</small>}</label></div>
        <In label="Description for Google (one sentence)" value={cur.description} onChange={(x) => put({ ...cur, description: x })} />
        <label className="sa-check"><input type="checkbox" checked={cur.published} onChange={(e) => put({ ...cur, published: e.target.checked })} /><span>Show this page on the site</span></label>
        <div className="se-blocks">{cur.blocks.map((b, i) => <div key={i} className="se-block"><div className="se-ih"><b>{BLOCK_TYPES.find((t) => t.type === b.type)?.label}</b><Mover i={i} n={cur.blocks.length} move={(d) => put({ ...cur, blocks: moved(cur.blocks, i, d) })} del={() => put({ ...cur, blocks: cur.blocks.filter((_, j) => j !== i) })} /></div>
          <BlockEditor b={b} pics={g.pics} set={(nb) => put({ ...cur, blocks: cur.blocks.map((x, j) => (j === i ? nb : x)) })} /></div>)}</div>
        <div className="se-add"><select value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Block to add"><option value="">Add a block…</option>{BLOCK_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label} — {t.hint}</option>)}</select><button type="button" className="btn optline btn-sm" disabled={!add} onClick={() => { put({ ...cur, blocks: [...cur.blocks, newBlock(add as any)] }); setAdd(""); }}>Add</button></div>
        <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={g.busy || !!slugErr(cur.slug, cur.slug)} onClick={() => void persist(pages, removed)}>{g.busy ? "Saving…" : "Save page"}</button>
          {cur.builtIn && DEFAULT_PAGES.some((d) => d.slug === cur.slug) && <button type="button" className="up-link" onClick={() => { const d = clone(DEFAULT_PAGES.find((x) => x.slug === cur.slug)!); setPages(pages.map((x) => (x.slug === cur.slug ? d : x))); }}>Back to the ready-written text</button>}
          <button type="button" className="up-link danger" onClick={async () => { if (!confirm(`Remove the page "${cur.title}"? Links to /${cur.slug} will show "page not found".`)) return; const list = pages.filter((x) => x.slug !== cur.slug); const r = DEFAULT_PAGES.some((d) => d.slug === cur.slug) ? [...new Set([...removed, cur.slug])] : removed; setPages(list); setRemoved(r); setOpen(null); await persist(list, r, "Page removed ✓"); }}>Remove page</button></div>
        {g.msg && <p className="rq-ok">{g.msg}</p>}
        <p className="hint">Text tips: a blank line starts a new paragraph, lines starting with "- " become a list, **two stars** make words bold, and [words](/address) makes a link.</p>
      </>}</div>
    </div>
  </div>;
}

/* ---------------- Footer ---------------- */
export function FooterEditor() {
  const g = useSettingsGroup("footer");
  const [f, setF] = useState<Footer | null>(null);
  useEffect(() => { if (g.loaded) setF(clone(siteFooter(g.saved))); }, [g.loaded, g.saved]);
  if (g.error) return <p className="rq-ok err">{g.error}</p>;
  if (!f) return <p className="hint">Loading…</p>;
  const pages = sitePages(null).map((p) => p.slug);
  const links = (list: Link2[], set: (l: Link2[]) => void) => <div className="se-items">{list.map((l, k) => <div key={k} className="se-link"><input aria-label="Words" value={l.label} placeholder="Words" onChange={(e) => set(list.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} /><input aria-label="Goes to" value={l.to} placeholder="/address" list="se-pages" onChange={(e) => set(list.map((x, j) => (j === k ? { ...x, to: e.target.value.trim() } : x)))} /><Mover i={k} n={list.length} move={(d) => set(moved(list, k, d))} del={() => set(list.filter((_, j) => j !== k))} /></div>)}<button type="button" className="up-link" onClick={() => set([...list, { label: "", to: "" }])}>+ Add a link</button></div>;
  return <div className="bo-ed se">
    <div className="st-h"><h2>Footer</h2></div>
    <p className="hint">The links at the bottom of every page. Type an address like /help, /track-order or /browse, or a full web link.</p>
    <datalist id="se-pages">{["/browse", "/designers", "/materials", "/pro", "/sell", "/account", "/custom-request", "/changes", "/own", ...pages.map((s) => "/" + s)].map((x) => <option key={x} value={x} />)}</datalist>
    <div className="se-cols">{f.cols.map((c, i) => <div key={i} className="se-block"><div className="se-ih"><input className="se-title" aria-label="Column title" value={c.title} onChange={(e) => setF({ ...f, cols: f.cols.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /><Mover i={i} n={f.cols.length} move={(d) => setF({ ...f, cols: moved(f.cols, i, d) })} del={() => setF({ ...f, cols: f.cols.filter((_, j) => j !== i) })} /></div>{links(c.links, (l) => setF({ ...f, cols: f.cols.map((x, j) => (j === i ? { ...x, links: l } : x)) }))}</div>)}</div>
    {f.cols.length < 5 && <button type="button" className="btn optline btn-sm" onClick={() => setF({ ...f, cols: [...f.cols, { title: "New column", links: [] }] })}>+ Add a column</button>}
    <div className="se-block"><div className="se-ih"><b>Sign-up box</b></div><label className="sa-check"><input type="checkbox" checked={f.subscribe.on} onChange={(e) => setF({ ...f, subscribe: { ...f.subscribe, on: e.target.checked } })} /><span>Show the email sign-up box</span></label><div className="se-2"><In label="Title" value={f.subscribe.title} onChange={(x) => setF({ ...f, subscribe: { ...f.subscribe, title: x } })} /><In label="Text" value={f.subscribe.text} onChange={(x) => setF({ ...f, subscribe: { ...f.subscribe, text: x } })} /></div></div>
    <div className="se-block"><div className="se-ih"><b>Social links</b><span className="bo-sub">An icon shows for each one you fill in</span></div><div className="se-2">{(["instagram", "pinterest", "facebook", "tiktok"] as const).map((k) => <In key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={f.social[k]} onChange={(x) => setF({ ...f, social: { ...f.social, [k]: x.trim() } })} ph="https://…" />)}</div></div>
    <div className="se-block"><div className="se-ih"><b>Bottom row</b></div>{links(f.base, (l) => setF({ ...f, base: l }))}</div>
    <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={g.busy} onClick={() => void g.save({ ...f, cols: f.cols.map((c) => ({ ...c, links: c.links.filter((l) => l.label && l.to) })), base: f.base.filter((l) => l.label && l.to) })}>{g.busy ? "Saving…" : "Save footer"}</button><button type="button" className="up-link" onClick={() => setF(clone(siteFooter(null)))}>Back to the ready-written footer</button></div>
    {g.msg && <p className="rq-ok">{g.msg}</p>}
  </div>;
}

/* ---------------- Categories ---------------- */
export function CategoriesEditor() {
  const g = useSettingsGroup("taxonomy");
  const counts = useApi<any>("admin/taxonomy/counts");
  const [t, setT] = useState<{ rooms: string[]; styles: string[]; themes: string[]; colors: ColorFamily[] } | null>(null);
  const [newV, setNewV] = useState<Record<string, string>>({});
  useEffect(() => { if (g.loaded) setT(clone(parseTaxonomy(g.saved))); }, [g.loaded, g.saved]);
  if (g.error) return <p className="rq-ok err">{g.error}</p>;
  if (!t) return <p className="hint">Loading…</p>;
  const n = (kind: string, v: string) => counts.data?.[kind]?.[v.toLowerCase()] ?? 0;
  const rename = async (kind: "rooms" | "styles" | "themes" | "colors", from: string, to: string) => {
    to = to.replace(/[,|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); if (!to || to === from) return;
    const next = clone(t);
    if (kind === "colors") next.colors = next.colors.map((c) => (c.label === from ? { ...c, label: to, words: [...new Set([...to.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 1), ...c.words])] } : c));
    else next[kind] = next[kind].map((x) => (x === from ? to : x));
    setT(next);
    // designs tagged with the old name are re-tagged, so nothing drops out of the shop filters
    try { const r = await api("admin/taxonomy/rename", { body: { kind, from, to } }); g.setMsg(`Renamed. ${r.updated} design${r.updated === 1 ? "" : "s"} re-tagged. Press Save to keep the new list.`); counts.reload(); } catch (e: any) { g.setMsg(e.message); }
  };
  const list = (kind: "rooms" | "styles" | "themes", title: string, note: string) => <div className="se-block"><div className="se-ih"><b>{title}</b><span className="bo-sub">{note}</span></div>
    <div className="se-cats">{t[kind].map((v, i) => <div key={v + i} className="se-cat"><input defaultValue={v} aria-label={`${title}: ${v}`} onBlur={(e) => void rename(kind, v, e.target.value)} /><em title="Designs with this">{n(kind, v)}</em><Mover i={i} n={t[kind].length} move={(d) => setT({ ...t, [kind]: moved(t[kind], i, d) })} del={() => { if (n(kind, v) && !confirm(`${n(kind, v)} designs use "${v}". Remove it from the list? (The designs keep the word for search.)`)) return; setT({ ...t, [kind]: t[kind].filter((_, j) => j !== i) }); }} /></div>)}</div>
    <div className="se-addc"><input placeholder={`New ${title.toLowerCase().replace(/s$/, "")}`} value={newV[kind] ?? ""} onChange={(e) => setNewV({ ...newV, [kind]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget.nextSibling as HTMLButtonElement)?.click(); } }} /><button type="button" className="btn optline btn-sm" onClick={() => { const v = (newV[kind] ?? "").replace(/[,|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); if (!v || t[kind].some((x) => x.toLowerCase() === v.toLowerCase())) return; setT({ ...t, [kind]: [...t[kind], v] }); setNewV({ ...newV, [kind]: "" }); }}>Add</button></div></div>;
  return <div className="bo-ed se">
    <div className="st-h"><h2>Categories</h2></div>
    <p className="hint">One list for the whole site. Designers pick from these when they upload, the shop's filters and menu show them, and search finds designs by them. The number is how many designs use each one. Renaming re-tags those designs; the order here is the order in the shop.</p>
    {list("rooms", "Rooms", "Shop menu → Rooms, and the Room filter")}
    {list("styles", "Styles", "The Style filter and the shop menu")}
    {list("themes", "Themes", "The Theme filter and the shop menu")}
    <div className="se-block"><div className="se-ih"><b>Colors</b><span className="bo-sub">The Color filter. When a designer uploads, the main colors are found from the picture and matched to this list.</span></div>
      <div className="se-cats">{t.colors.map((c, i) => <div key={c.id + i} className="se-cat se-color"><input type="color" value={c.swatch} aria-label={`${c.label} color`} onChange={(e) => setT({ ...t, colors: t.colors.map((x, j) => (j === i ? { ...x, swatch: e.target.value } : x)) })} /><input defaultValue={c.label} aria-label="Color name" onBlur={(e) => void rename("colors", c.label, e.target.value)} /><input className="se-words" value={c.words.join(", ")} aria-label={`Other words for ${c.label}`} title="Other words that mean this color (searched in names and keywords)" onChange={(e) => setT({ ...t, colors: t.colors.map((x, j) => (j === i ? { ...x, words: e.target.value.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean) } : x)) })} /><em title="Designs with this">{n("colors", c.label)}</em><Mover i={i} n={t.colors.length} move={(d) => setT({ ...t, colors: moved(t.colors, i, d) })} del={() => setT({ ...t, colors: t.colors.filter((_, j) => j !== i) })} /></div>)}</div>
      <div className="se-addc"><input placeholder="New color, e.g. Lilac" value={newV.colors ?? ""} onChange={(e) => setNewV({ ...newV, colors: e.target.value })} /><button type="button" className="btn optline btn-sm" onClick={() => { const v = (newV.colors ?? "").trim(); if (!v || t.colors.some((x) => x.label.toLowerCase() === v.toLowerCase())) return; setT({ ...t, colors: parseColors(colorsToText([...t.colors, { id: "", label: v, swatch: "#999999", words: [] }])) }); setNewV({ ...newV, colors: "" }); }}>Add</button></div>
      <FindAllColors colors={t.colors} onDone={() => counts.reload()} />
    </div>
    <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={g.busy} onClick={() => void g.save({ rooms: t.rooms.join("\n"), styles: t.styles.join("\n"), themes: t.themes.join("\n"), colors: colorsToText(t.colors) }, "Saved ✓ Designers, the shop filters, the menu and search use the new lists.")}>{g.busy ? "Saving…" : "Save categories"}</button></div>
    {g.msg && <p className="rq-ok">{g.msg}</p>}
  </div>;
}

/** Older designs uploaded before the color finder: find their colors from their pictures in one go. */
function FindAllColors({ colors, onDone }: { colors: ColorFamily[]; onDone: () => void }) {
  const [st, setSt] = useState("");
  return <div className="up-row"><button type="button" className="btn optline btn-sm" disabled={!!st && !st.startsWith("Done")} onClick={async () => {
    const { findColors } = await import("@/lib/color-families");
    const d = await api("admin/designs"); const list = (d.uploads ?? []).filter((u: any) => !String(u.palette ?? "").trim() && (u.colors?.[0]?.preview || u.preview));
    let k = 0, done = 0;
    for (const u of list) { k++; setSt(`Looking at ${k} of ${list.length}…`); try { const found = await findColors(u.colors?.[0]?.preview || u.preview, colors); if (found.length) { await api(`admin/designs/${u.id}/palette`, { body: { palette: found.join(", ") } }); done++; } } catch {} }
    setSt(`Done: colors added to ${done} design${done === 1 ? "" : "s"}${list.length ? "" : " (every design already has colors)"}.`); onDone();
  }}>Find colors for designs that have none</button>{st && <span className="bo-sub">{st}</span>}</div>;
}

/* ---------------- Page texts ---------------- */
export function PageTextsEditor() {
  const g = useSettingsGroup("texts");
  const [v, setV] = useState<Record<string, Record<string, string>> | null>(null);
  const [page, setPage] = useState(Object.keys(PAGE_TEXTS)[0]!);
  useEffect(() => { if (g.loaded) setV(clone(g.saved ?? {})); }, [g.loaded, g.saved]);
  if (g.error) return <p className="rq-ok err">{g.error}</p>;
  if (!v) return <p className="hint">Loading…</p>;
  const P = PAGE_TEXTS[page]!;
  const val = (k: string, def: string) => v[page]?.[k] || def;
  const set = (k: string, x: string, def: string) => setV({ ...v, [page]: { ...(v[page] ?? {}), [k]: x === def ? "" : x } });
  return <div className="bo-ed se">
    <div className="st-h"><h2>Page texts</h2></div>
    <p className="hint">The words on the site's own pages. Change any of them; "Back to the ready-written text" brings the original back.</p>
    <div className="up-row">{Object.entries(PAGE_TEXTS).map(([k, p]) => <button key={k} type="button" className={"btn btn-sm " + (k === page ? "btn-wine" : "optline")} onClick={() => setPage(k)}>{p.label}</button>)}<a className="up-link" href={P.path} target="_blank" rel="noreferrer">View {P.label} ↗</a></div>
    {P.note && <p className="hint">{P.note}</p>}
    {P.fields.map((f) => f.kind === "image" ? <div key={f.k}><span className="bo-l">{f.label}</span><PicturePicker designs={g.pics} value={v[page]?.[f.k] ?? ""} fallback={f.def} onChange={(x) => setV({ ...v, [page]: { ...(v[page] ?? {}), [f.k]: x } })} /></div>
      : <In key={f.k} label={f.label + (f.hint ? ` · ${f.hint}` : "")} value={val(f.k, f.def)} onChange={(x) => set(f.k, x, f.def)} area={f.kind === "area" || f.kind === "list"} rows={f.kind === "list" ? Math.min(12, f.def.split("\n").length + 2) : 3} />)}
    <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={g.busy} onClick={() => void g.save(v)}>{g.busy ? "Saving…" : "Save texts"}</button><button type="button" className="up-link" onClick={() => setV({ ...v, [page]: {} })}>Back to the ready-written text</button></div>
    {g.msg && <p className="rq-ok">{g.msg}</p>}
  </div>;
}
