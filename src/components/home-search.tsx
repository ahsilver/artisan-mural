import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { designerBySlug, type Design } from "@/lib/catalog";
import { pic } from "@/lib/pics";

/** Home page: one clean search box. Type and the matching designs show right under it; Enter opens the full results. */
export function HomeSearch({ designs, tone = "light" }: { designs: Design[]; tone?: "light" | "blue" }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const navigate = useNavigate();
  const box = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(); if (t.length < 1) return [];
    const words = t.split(/\s+/);
    return designs.filter((d) => {
      const hay = [d.title, designerBySlug(d.designer)?.name, ...(d.categories ?? []), (d as any).sku, d.kind].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 6);
  }, [q, designs]);
  const go = () => { const t = q.trim(); void navigate({ to: "/browse", search: (t ? { q: t } : {}) as any }); };
  const show = focus && q.trim().length > 0;
  return <section aria-label="Search designs" className={`home-search ${tone === "blue" ? "home-search-blue" : ""}`} data-testid="home-search">
    <form role="search" onSubmit={(e) => { e.preventDefault(); go(); }} className="home-search-form">
      <Search className="home-search-icon" aria-hidden="true" />
      <input ref={box} type="search" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 180)}
        placeholder="Search wallpapers" aria-label="Search wallpapers" autoComplete="off" enterKeyHint="search" data-testid="home-search-input" />
      {q && <button type="button" className="home-search-clear" aria-label="Clear search" onClick={() => { setQ(""); box.current?.focus(); }}><X className="size-4" /></button>}
      {show && <div className="home-search-pop" data-testid="home-search-results">
        {hits.length === 0 ? <p className="home-search-none">No designs match “{q.trim()}”.</p> : <>
          {hits.map((d) => { const p = pic(d, d.image, [160]); const who = designerBySlug(d.designer)?.name; return <Link key={d.slug} to="/design/$slug" params={{ slug: d.slug }} className="home-search-hit" data-testid="home-search-hit">
            <img src={p?.src ?? d.image} alt="" loading="lazy" /><span><b>{d.title}</b>{who && <span>by {who}</span>}</span></Link>; })}
          <button type="submit" className="home-search-all">See all results</button>
        </>}
      </div>}
    </form>
  </section>;
}
