import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { allDesigners, designerBySlug, liveDesigns, registerShop, type Design } from "@/lib/catalog";
import { matchRoom, searchableDesignText, getTaxonomy, roomLabels } from "@/lib/design-taxonomy";
import { ensureShop } from "@/lib/shop";
import { pic } from "@/lib/pics";
import { StorefrontSprite } from "@/components/storefront/icons";
import { StoreCard } from "@/components/storefront/card";

const searchSchema = z.object({
  q: z.string().optional(),
  kind: z.string().optional(),
  category: z.string().optional(),
  theme: z.string().optional(),
  room: z.string().optional(),
  color: z.string().optional(),
  designer: z.string().optional(),
  sort: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  loader: async ({ context }) => ({ shop: await ensureShop(context.queryClient) }),
  head: () => ({
    meta: [
      { title: "All designs | Artisan Murals" },
      { name: "description", content: "Murals and repeating wallpaper by independent artists. Filter by room, style, color or designer. Every design prints to your exact wall size." },
      { property: "og:title", content: "All designs | Artisan Murals" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Shop,
});

const COLORS: { id: string; label: string; swatch: string; words: string[] }[] = [
  { id: "white", label: "White & cream", swatch: "#F4F2EC", words: ["white", "cream", "ivory", "chalk", "bone"] },
  { id: "beige", label: "Beige & neutral", swatch: "#D9CDB8", words: ["beige", "sand", "linen", "oat", "neutral", "taupe", "stone"] },
  { id: "grey", label: "Grey", swatch: "#9A9A98", words: ["grey", "gray", "silver", "charcoal", "slate", "smok"] },
  { id: "black", label: "Black", swatch: "#2A2A2A", words: ["black", "ink", "midnight", "charcoal"] },
  { id: "blue", label: "Blue", swatch: "#6F8FB4", words: ["blue", "navy", "indigo", "sky", "teal"] },
  { id: "green", label: "Green", swatch: "#7D9A6A", words: ["green", "olive", "sage", "moss", "fern", "emerald", "jungle", "palm"] },
  { id: "pink", label: "Pink", swatch: "#E8B4B8", words: ["pink", "blush", "rose"] },
  { id: "red", label: "Red & terracotta", swatch: "#B5523B", words: ["red", "terracotta", "rust", "clay", "coral"] },
  { id: "gold", label: "Yellow & gold", swatch: "#C9A24D", words: ["yellow", "gold", "ochre", "mustard"] },
  { id: "brown", label: "Brown", swatch: "#7A5236", words: ["brown", "walnut", "umber", "tan"] },
];
const lc = (x: string) => x.toLowerCase();
const split = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const join = (l: string[]) => (l.length ? l.join(",") : undefined);
const colorOf = (d: Design, id: string) => { const o = COLORS.find((c) => c.id === id); const p = lc([d.palette, ...(d.tags ?? []), ...(d.colorways ?? []).map((c) => c.name)].join(" ")); return o ? o.words.some((w) => p.includes(w)) : p.includes(id); };

type Key = "room" | "category" | "theme" | "color" | "designer";
type Group = { key: Key; label: string; opts: { v: string; label: string; swatch?: string }[] };

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const { shop } = Route.useLoaderData();
  registerShop(shop);
  const designs = liveDesigns(shop);
  const tax = getTaxonomy();
  const q = (search.q ?? "").slice(0, 80).trim();
  const kind = search.kind === "mural" || search.kind === "repeating" ? search.kind : "";
  const sel: Record<Key, string[]> = { room: split(search.room), category: split(search.category), theme: split(search.theme), color: split(search.color), designer: split(search.designer) };
  const sort = search.sort ?? "featured";
  const set = (patch: Record<string, string | undefined>) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const designersInShop = allDesigners().filter((x) => designs.some((d) => d.designer === x.slug));
  const groups: Group[] = [
    { key: "room", label: "Room", opts: roomLabels.map((r) => ({ v: r, label: r })) },
    { key: "category", label: "Style", opts: tax.styles.map((s) => ({ v: s, label: s })) },
    { key: "theme", label: "Theme", opts: tax.themes.map((s) => ({ v: s, label: s })) },
    { key: "color", label: "Color", opts: COLORS.map((c) => ({ v: c.id, label: c.label, swatch: c.swatch })) },
    { key: "designer", label: "Designer", opts: designersInShop.map((x) => ({ v: x.slug, label: x.name })) },
  ];
  const test = (d: Design, key: Key, v: string) =>
    key === "room" ? matchRoom(d, v) : key === "color" ? colorOf(d, v) : key === "designer" ? d.designer === v : d.categories.some((c) => lc(c) === lc(v));
  const passes = (d: Design, skip?: Key) => {
    const hay = q ? lc([d.title, d.sku ?? "", d.palette, d.description, designerBySlug(d.designer)?.name ?? "", ...d.room, ...d.categories, ...(d.tags ?? []), searchableDesignText(d)].join(" ")) : "";
    return (!kind || d.kind === kind) && (!q || hay.includes(lc(q))) && groups.every((g) => g.key === skip || !sel[g.key].length || sel[g.key].some((v) => test(d, g.key, v)));
  };
  const countFor = (key: Key, v: string) => designs.filter((d) => passes(d, key) && test(d, key, v)).length;
  const filtered = designs.filter((d) => passes(d));
  const list = sort === "az" ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : sort === "new" ? [...filtered].reverse() : sort === "popular" ? [...filtered].sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0)) : filtered;

  const selLabels = groups.flatMap((g) => sel[g.key].map((v) => g.opts.find((o) => o.v === v)?.label ?? v));
  const kindName = kind === "mural" ? "Murals" : kind === "repeating" ? "Repeating patterns" : "";
  const title = q ? `Results for "${q}"` : selLabels.length === 1 ? `${selLabels[0]} ${kindName ? lc(kindName) : "wallpaper"}` : kindName || "All designs";

  const [pop, setPop] = useState<Key | null>(null);
  const [popX, setPopX] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState<Record<Key, string[]> & { kind: string }>({ ...sel, kind });
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".fpop,.fb")) setPop(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setPop(null); setDrawer(false); } };
    addEventListener("click", close); addEventListener("keydown", esc);
    return () => { removeEventListener("click", close); removeEventListener("keydown", esc); };
  }, []);
  useEffect(() => { document.body.style.overflow = drawer ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawer]);
  const toggle = (key: Key, v: string) => set({ [key]: join(sel[key].includes(v) ? sel[key].filter((x) => x !== v) : [...sel[key], v]) });
  const clearAll = () => set({ kind: undefined, q: undefined, room: undefined, category: undefined, theme: undefined, color: undefined, designer: undefined });

  const kindPic = (k: string) => { const d = designs.find((x) => (!k || x.kind === k) && (x.mockups?.length || x.image)); return d ? pic(d, k === "repeating" ? d.image : d.mockups?.[0] ?? d.image)?.src ?? d.image : undefined; };
  const Opt = ({ g, o, on, onChange, n }: { g: Group; o: Group["opts"][number]; on: boolean; onChange: () => void; n: number }) => (
    <label className={"fopt" + (n ? "" : " zero")}><input type="checkbox" checked={on} onChange={onChange} />{o.swatch && <i style={{ background: o.swatch }} />}{o.label}<em>{n}</em></label>
  );
  const pills: [string, string, string][] = [];
  if (kind) pills.push(["kind", "", kindName]);
  groups.forEach((g) => sel[g.key].forEach((v) => pills.push([g.key, v, g.opts.find((o) => o.v === v)?.label ?? v])));
  if (q) pills.push(["q", "", `"${q}"`]);

  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Shop</b></nav></div>
      <section className="pg shop">
        <div className="shop-head"><h1>{title}</h1></div>
        <nav className="kinds" aria-label="Choose murals or repeating patterns">
          {([["", "All designs", "Murals and repeating patterns together"], ["mural", "Murals", "One big scene, printed once and sized to your wall"], ["repeating", "Repeating patterns", "A pattern that repeats to cover any wall size"]] as const).map(([k, b, s]) => (
            <Link key={k || "all"} to="/browse" search={(prev: any) => ({ ...prev, kind: k || undefined })} aria-current={kind === k}>
              {kindPic(k) && <img src={kindPic(k)} alt="" />}<span><b>{b}</b><small>{s}</small></span>
            </Link>
          ))}
        </nav>
        <div className="fbar" ref={barRef}>
          <button type="button" className="fb fb-all" onClick={(e) => { e.stopPropagation(); setPop(null); setDraft({ ...sel, kind }); setDrawer(true); }}>
            <svg className="ico" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>All filters
          </button>
          <div className="fb-list">
            {groups.filter((g) => g.opts.length).map((g) => (
              <button key={g.key} type="button" className={"fb" + (sel[g.key].length ? " has" : "")} aria-expanded={pop === g.key}
                onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), b = barRef.current!.getBoundingClientRect(); setPopX(Math.max(0, Math.min(r.left - b.left, b.width - 260))); setPop(pop === g.key ? null : g.key); }}>
                {g.label}{sel[g.key].length > 0 && <span className="n">{sel[g.key].length}</span>}
                <svg className="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </button>
            ))}
          </div>
          <label className="fsort"><span className="sr">Sort</span>
            <select value={sort} onChange={(e) => set({ sort: e.target.value === "featured" ? undefined : e.target.value })}>
              <option value="featured">Featured</option><option value="new">Newest</option><option value="popular">Most loved</option><option value="az">A to Z</option>
            </select>
          </label>
          <span className="fbar-count">{list.length} design{list.length === 1 ? "" : "s"}</span>
          {pop && (() => { const g = groups.find((x) => x.key === pop)!; return (
            <div className="fpop" role="dialog" aria-label={`${g.label} options`} style={{ left: popX, top: "calc(100% + 6px)" }} onClick={(e) => e.stopPropagation()}>
              {g.opts.map((o) => <Opt key={o.v} g={g} o={o} on={sel[g.key].includes(o.v)} onChange={() => toggle(g.key, o.v)} n={countFor(g.key, o.v)} />)}
              <div className="fpop-foot"><button type="button" onClick={() => { set({ [g.key]: undefined }); setPop(null); }}>Clear {lc(g.label)}</button><button type="button" onClick={() => setPop(null)}>Done</button></div>
            </div>
          ); })()}
        </div>
        {pills.length > 0 && (
          <div className="active-f">
            {pills.map(([k, v, n]) => <button key={k + v} type="button" className="af" onClick={() => k === "kind" ? set({ kind: undefined }) : k === "q" ? set({ q: undefined }) : toggle(k as Key, v)}>{n}<span aria-label="Remove">×</span></button>)}
            <button type="button" className="af-clear" onClick={clearAll}>Clear all filters</button>
          </div>
        )}
        <div className="g-prod shopgrid">{list.map((d) => <StoreCard key={d.slug} d={d} />)}</div>
        {!list.length && <p className="empty">No designs match yet. <Link to="/browse">See all designs</Link> or <Link to="/custom-request">chat with a designer to make one</Link>.</p>}
        {drawer && <div className="fdrawer-bg" onClick={() => setDrawer(false)} />}
        {drawer && (
          <aside className="fdrawer" role="dialog" aria-label="All filters">
            <header><b>Filters</b><button type="button" aria-label="Close filters" onClick={() => setDrawer(false)}>×</button></header>
            <div className="fd-body">
              <Section label="Type" open>
                {([["mural", "Murals"], ["repeating", "Repeating patterns"], ["", "Both"]] as const).map(([v, l]) => <label key={v || "both"} className="fopt"><input type="radio" name="fdkind" checked={draft.kind === v} onChange={() => setDraft({ ...draft, kind: v })} />{l}</label>)}
              </Section>
              {groups.filter((g) => g.opts.length).map((g, i) => (
                <Section key={g.key} label={g.label} open={i < 1} n={draft[g.key].length}>
                  {g.opts.map((o) => <Opt key={o.v} g={g} o={o} on={draft[g.key].includes(o.v)} onChange={() => setDraft({ ...draft, [g.key]: draft[g.key].includes(o.v) ? draft[g.key].filter((x) => x !== o.v) : [...draft[g.key], o.v] })} n={countFor(g.key, o.v)} />)}
                </Section>
              ))}
            </div>
            <footer>
              <button type="button" className="btn optline" onClick={() => setDraft({ room: [], category: [], theme: [], color: [], designer: [], kind: "" })}>Clear all</button>
              <button type="button" className="btn btn-wine" onClick={() => { set({ kind: draft.kind || undefined, room: join(draft.room), category: join(draft.category), theme: join(draft.theme), color: join(draft.color), designer: join(draft.designer) }); setDrawer(false); }}>Apply</button>
            </footer>
          </aside>
        )}
      </section>
    </div>
  );
}

function Section({ label, open: start, n, children }: { label: string; open?: boolean; n?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!start);
  return (
    <div className="fd-sec">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{label}{n ? <b className="n">{n} selected</b> : null}<span>{open ? "−" : "+"}</span></button>
      <div className="opts" hidden={!open}>{children}</div>
    </div>
  );
}
