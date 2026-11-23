import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureShop } from "@/lib/shop";
import { allDesigners, designsByDesigner, registerShop, type Design, type Designer } from "@/lib/catalog";
import { pic } from "@/lib/pics";

export const Route = createFileRoute("/designers/")({
  head: () => ({ meta: [{ title: "Meet the designers — Artisan Murals" }, { name: "description", content: "Independent wallpaper and mural artists. Browse their work, message the one you like, or post a request and let them come to you." }, { property: "og:title", content: "Meet the designers — Artisan Murals" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => ensureShop(context.queryClient),
  component: Designers,
});

/** The approved preview's designer directory: heading, filter bar (Specialty, Location, Reply time, Sort), cards with three pictures. */
const AV = ["#5E7A55", "#3F4F63", "#9C7A45", "#5B2130", "#D2654F", "#2B1A1F", "#71508C"];
export const avColor = (s: string) => AV[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % AV.length];
const country = (x: Designer) => (x.location || "").split(",").pop()!.trim() || "—";
const reply = (x: Designer) => String(x.responseLabel || x.responseTime || "").replace(/^replies\s+/i, "");
const SORTS: Record<string, string> = { featured: "Featured", most: "Most designs", rated: "Top rated", az: "A–Z" };
type G = "spec" | "place" | "reply";
const GROUPS: [G, string, (x: Designer) => string[]][] = [["spec", "Specialty", (x) => x.specialties ?? []], ["place", "Location", (x) => [country(x)]], ["reply", "Reply time", (x) => (reply(x) ? [reply(x)] : [])]];
const big = (d: Design, src: string) => { const p = pic(d, src); return { src: p?.src ?? src, srcSet: p?.srcSet }; };

function Designers() {
  const shop = Route.useLoaderData();
  registerShop(shop);
  const list0 = useMemo(() => allDesigners().filter((x) => !x.hidden).map((x) => ({ x, ds: designsByDesigner(x.slug) })).filter((r) => r.ds.length), [shop]);
  const [f, setF] = useState<Record<G, Set<string>>>({ spec: new Set(), place: new Set(), reply: new Set() });
  const [sort, setSort] = useState("featured");
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null); }; document.addEventListener("click", c); return () => document.removeEventListener("click", c); }, []);
  const pass = (r: { x: Designer }, skip?: G) => GROUPS.every(([k, , vals]) => k === skip || !f[k].size || vals(r.x).some((v) => f[k].has(v)));
  let list = list0.filter((r) => pass(r));
  if (sort === "most") list = [...list].sort((a, b) => b.ds.length - a.ds.length);
  if (sort === "rated") list = [...list].sort((a, b) => b.x.rating - a.x.rating);
  if (sort === "az") list = [...list].sort((a, b) => a.x.name.localeCompare(b.x.name));
  const flip = (k: G, v: string) => setF((cur) => { const n = { ...cur, [k]: new Set(cur[k]) }; n[k].has(v) ? n[k].delete(v) : n[k].add(v); return n; });
  const pills = GROUPS.flatMap(([k]) => [...f[k]].map((v) => [k, v] as const));
  return (
    <div className="am"><div id="view-designers">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Designers</b></nav></div>
      <section className="pg">
        <div className="dir-head">
          <div><span className="k">The artists</span><h1>Meet the designers</h1><p>Every design on the site belongs to the person who drew it. Browse their work, message the one you like, or post a request and let them come to you.</p></div>
          <Link className="btn btn-wine" to="/custom-request">Post a request</Link>
        </div>
        <div className="fbar" ref={bar} style={{ position: "relative" }}>
          <div className="fb-list">
            {GROUPS.map(([k, label, vals]) => {
              const opts = [...new Set(list0.filter((r) => pass(r, k)).flatMap((r) => vals(r.x)))].sort();
              return <span key={k} style={{ position: "relative" }}>
                <button type="button" className={"fb" + (f[k].size ? " has" : "")} aria-expanded={open === k} onClick={(e) => { e.stopPropagation(); setOpen(open === k ? null : k); }}>{label}{f[k].size ? <span className="n">{f[k].size}</span> : null}<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
                {open === k && <div className="fpop" role="dialog" aria-label={`${label} options`} style={{ left: 0, top: "calc(100% + 6px)" }} onClick={(e) => e.stopPropagation()}>
                  {opts.length ? opts.map((v) => <label key={v} className="fopt"><input type="checkbox" checked={f[k].has(v)} onChange={() => flip(k, v)} />{v}<em>{list0.filter((r) => pass(r, k) && vals(r.x).includes(v)).length}</em></label>) : <p className="hint">Nothing to choose yet.</p>}
                  <div className="fpop-foot"><button type="button" onClick={() => setF((c) => ({ ...c, [k]: new Set() }))}>Clear {label.toLowerCase()}</button><button type="button" onClick={() => setOpen(null)}>Done</button></div>
                </div>}
              </span>;
            })}
            <span style={{ position: "relative" }}>
              <button type="button" className="fb" aria-expanded={open === "sort"} onClick={(e) => { e.stopPropagation(); setOpen(open === "sort" ? null : "sort"); }}>Sort: {SORTS[sort]}<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
              {open === "sort" && <div className="fpop" role="dialog" aria-label="Sort" style={{ left: 0, top: "calc(100% + 6px)" }} onClick={(e) => e.stopPropagation()}>{Object.entries(SORTS).map(([k, v]) => <label key={k} className="fopt"><input type="radio" name="dsort" checked={sort === k} onChange={() => { setSort(k); setOpen(null); }} />{v}</label>)}</div>}
            </span>
          </div>
          <span className="fbar-count">{list.length} designer{list.length === 1 ? "" : "s"}</span>
        </div>
        {pills.length > 0 && <div className="active-f">{pills.map(([k, v]) => <button key={k + v} type="button" className="af" onClick={() => flip(k, v)}>{v}<span aria-label="Remove">×</span></button>)}<button type="button" className="af-clear" onClick={() => setF({ spec: new Set(), place: new Set(), reply: new Set() })}>Clear all filters</button></div>}
        <div className="dir-grid">
          {list.length === 0 ? <p className="empty">No designers match these filters.</p> : list.map(({ x, ds }) => {
            const a = ds[0]!, b = ds[1] ?? ds[0]!;
            const imgs = [big(a, a.mockups?.[0] ?? a.image), big(b, b.image), big(a, a.image)];
            return (
              <Link key={x.slug} className="dcard" to="/designers/$slug" params={{ slug: x.slug }}>
                <span className="strip">{imgs.map((im, i) => <img key={i} src={im.src} srcSet={im.srcSet} sizes="(max-width: 640px) 33vw, 15vw" alt="" loading="lazy" />)}</span>
                <span className="body">
                  <span className="who"><span className="av" style={{ background: avColor(x.slug) }}>{x.initials}</span><span><h3>{x.name}</h3><span className="place">{x.location}</span></span></span>
                  <p>{x.tagline}</p>
                  <span className="foot"><span><b>{ds.length}</b> design{ds.length > 1 ? "s" : ""}{x.reviews ? <> · ★ <b>{x.rating.toFixed(1)}</b> ({x.reviews})</> : null}</span>{reply(x) && <span>Replies {reply(x)}</span>}</span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="dir-cta"><div><b>Rather let them come to you?</b><span>Post what you need and every designer can reply with a price.</span></div><Link className="btn btn-wine" to="/custom-request">Post a request</Link></div>
      </section>
    </div></div>
  );
}
