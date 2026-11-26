import { useState } from "react";
import { PicturePicker } from "@/components/bo/storefront-editor";
import { DEFAULT_HEADINGS, LINK_KINDS, coverKey, homeLayout, type HomeTile, type LinkKind, type TileLink } from "@/lib/home-layout";
import type { Taxonomy } from "@/lib/design-taxonomy";

type Pic = { slug: string; title: string; image: string };
type Props = { v: any; set: (path: (string | number)[], x: any) => void; designs: Pic[]; tax: Taxonomy };

/** The choices for "opens" next to a tile: murals, repeats, or one room / style / theme / color from the shop's lists. */
function LinkPicker({ value, onChange, tax }: { value: TileLink; onChange: (l: TileLink) => void; tax: Taxonomy }) {
  const opts: string[][] = value.kind === "room" ? tax.rooms.map((r) => [r, r]) : value.kind === "style" ? tax.styles.map((r) => [r, r]) : value.kind === "theme" ? tax.themes.map((r) => [r, r]) : value.kind === "color" ? tax.colors.map((c) => [c.id, c.label]) : [];
  return <div className="hl-link">
    <label className="rqf"><span>Opens</span><select value={value.kind} onChange={(e) => onChange({ kind: e.target.value as LinkKind })}>{LINK_KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
    {opts.length > 0 && <label className="rqf"><span>Which one</span><select value={value.value ?? ""} onChange={(e) => onChange({ kind: value.kind, value: e.target.value || undefined })}><option value="">Choose…</option>{opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>}
  </div>;
}

/** A list of tiles: name, small line, where it opens, picture; move, remove, add. */
function TileList({ title, hint, path, list, props, withSub = true }: { title: string; hint: string; path: string; list: HomeTile[]; props: Props; withSub?: boolean }) {
  const put = (next: HomeTile[]) => props.set([path], next);
  const upd = (i: number, patch: Partial<HomeTile>) => put(list.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: number) => { const n = list.slice(); const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; put(n); };
  return <section className="st-card"><b>{title}</b><p className="hint">{hint}</p>
    <div className="bo-tiles">{list.map((t, i) => <div key={i} className="bo-tile hl-tile">
      <div className="hl-tile-h"><b>{i + 1}.</b><span className="hl-acts"><button type="button" className="up-link" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">↑</button><button type="button" className="up-link" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move later">↓</button><button type="button" className="up-link" onClick={() => put(list.filter((_, k) => k !== i))}>Remove</button></span></div>
      <label className="rqf"><span>Name</span><input value={t.title} onChange={(e) => upd(i, { title: e.target.value })} /></label>
      {withSub && <label className="rqf"><span>Small line (optional)</span><input value={t.sub ?? ""} onChange={(e) => upd(i, { sub: e.target.value || undefined })} /></label>}
      <LinkPicker value={t.link} tax={props.tax} onChange={(l) => upd(i, { link: l })} />
      <span className="bo-l">Picture <small className="hint">empty = the category's cover picture, or a matching design that changes every day</small></span>
      <PicturePicker designs={props.designs} value={t.image ?? ""} onChange={(x) => upd(i, { image: x || undefined })} />
    </div>)}</div>
    <button type="button" className="btn btn-sm optline" onClick={() => put([...list, { title: "New tile", link: { kind: "all" } }])}>+ Add a tile</button>
  </section>;
}

export function HomeLayoutSections(props: Props) {
  const { v, set, designs, tax } = props;
  const L = homeLayout(v);
  const [q, setQ] = useState("");
  const chosen = L.featured;
  const toggle = (slug: string) => set(["featuredSlugs"], chosen.includes(slug) ? chosen.filter((s) => s !== slug) : [...chosen, slug]);
  const shownDesigns = designs.filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase()));
  const strip = L.roomStrip;
  const cats: [string, TileLink][] = [["Murals", { kind: "mural" }], ["Repeating patterns", { kind: "repeat" }], ...tax.rooms.map((r): [string, TileLink] => [`Room · ${r}`, { kind: "room", value: r }]), ...tax.styles.map((r): [string, TileLink] => [`Style · ${r}`, { kind: "style", value: r }]), ...tax.themes.map((r): [string, TileLink] => [`Theme · ${r}`, { kind: "theme", value: r }])];
  return <>
    <section className="st-card"><b>Featured designs</b>
      <p className="hint">{chosen.length ? `The homepage shows one of these ${chosen.length} designs, a different one each day.` : "None chosen: the homepage picks a different design with room pictures each day, automatically."} Tap designs to add or remove them.</p>
      <input type="search" placeholder="Find a design" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="hl-feat">{shownDesigns.map((d) => <button key={d.slug} type="button" aria-pressed={chosen.includes(d.slug)} onClick={() => toggle(d.slug)}><img src={d.image} alt="" loading="lazy" /><span>{d.title}</span></button>)}</div>
      {chosen.length > 0 && <button type="button" className="up-link" onClick={() => set(["featuredSlugs"], [])}>Back to automatic</button>}
    </section>
    <TileList title="Tiles · Shop by look" hint="The six pictures under the banners. Add your own categories, change the words, the picture, or where each one opens." path="lookTiles" list={L.looks} props={props} />
    <TileList title="Tiles · Shop by room" hint="The big room pictures. Any room from your room list." path="roomTileList" list={L.rooms} props={props} withSub={false} />
    <section className="st-card"><b>Room links under the room pictures</b>
      <div className="hl-strip">{strip.map((r, i) => <div key={i} className="hl-strip-row">
        <input aria-label="Words shown" value={r.title} onChange={(e) => set(["roomStrip"], strip.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
        <select aria-label="Room it opens" value={r.room} onChange={(e) => set(["roomStrip"], strip.map((x, k) => (k === i ? { ...x, room: e.target.value } : x)))}>{[...new Set([...tax.rooms, r.room])].map((x) => <option key={x}>{x}</option>)}</select>
        <button type="button" className="up-link" onClick={() => set(["roomStrip"], strip.filter((_, k) => k !== i))}>Remove</button></div>)}</div>
      <button type="button" className="btn btn-sm optline" onClick={() => set(["roomStrip"], [...strip, { title: tax.rooms[0] ?? "Room", room: tax.rooms[0] ?? "" }])}>+ Add a room link</button>
    </section>
    <TileList title="Tiles · Moods (under “Transform your walls”)" hint="The four smaller pictures in the middle of the page." path="moodTiles" list={L.moods} props={props} withSub={false} />
    <section className="st-card"><b>Section titles and words</b><div className="af-grid">
      {(Object.keys(DEFAULT_HEADINGS) as (keyof typeof DEFAULT_HEADINGS)[]).map((k) => <label key={k} className={"rqf" + (k.endsWith("Text") ? " af-wide" : "")}><span>{HEAD_LABELS[k]}</span>{k.endsWith("Text") ? <textarea rows={2} value={v.headings?.[k] ?? ""} placeholder={DEFAULT_HEADINGS[k]} onChange={(e) => set(["headings", k], e.target.value)} /> : <input value={v.headings?.[k] ?? ""} placeholder={DEFAULT_HEADINGS[k]} onChange={(e) => set(["headings", k], e.target.value)} />}</label>)}
    </div></section>
    <section className="st-card"><b>Category cover pictures</b>
      <p className="hint">One picture for each category, used on the homepage wherever a tile opens that category (unless the tile has its own picture). New rooms, styles and themes you add under Categories show up here. Empty = a matching design, changing daily.</p>
      <div className="bo-tiles">{cats.map(([name, l]) => <div key={coverKey(l)} className="bo-tile"><span className="bo-l"><b>{name}</b></span><PicturePicker designs={designs} value={L.covers[coverKey(l)] ?? ""} onChange={(x) => set(["covers", coverKey(l)], x)} /></div>)}</div>
    </section>
  </>;
}
const HEAD_LABELS: Record<keyof typeof DEFAULT_HEADINGS, string> = {
  rooms: "Rooms title", transformTitle: "“Transform” title", transformText: "“Transform” text", transformButton: "“Transform” button",
  trends: "Trending title", new: "New arrivals title", designers: "Designers title", changesKicker: "Changes band · small line", changesTitle: "Changes band · title", changesText: "Changes band · text",
};
