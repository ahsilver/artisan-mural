import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar, RatingInline } from "@/components/community";
import { turnaroundText } from "@/lib/community";

import { designers as sampleDesigners, liveDesigns } from "@/lib/catalog";
import { Thumb, Chip, VersionSwitch } from "@/components/designer-tiles";
import { DesignersA } from "@/components/designers-a";
import { Star } from "lucide-react";
import { ensureShop } from "@/lib/shop";

export const Route = createFileRoute("/designers/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Our designers — Artisan Mural" },
      {
        name: "description",
        content:
          "Independent wallpaper artists from around the world. See their previous work, then message them or commission something new.",
      },
      { property: "og:title", content: "Our designers — Artisan Mural" },
      {
        property: "og:description",
        content: "See each artist's previous walls, then message them or commission a design.",
      },
    ],
  }),
  loader: ({ context }) => ensureShop(context.queryClient),
  component: DesignersRoute,
});

function DesignersRoute() {
  const v = (Route.useSearch() as any)?.v as string | undefined;
  const shop = Route.useLoaderData();
  return <>{v === "a" ? <DesignersA shop={shop} /> : <Designers />}<VersionSwitch v={v} /></>;
}

const PHONE_FIRST = 6;
const PAGE = 12;
type Sort = "featured" | "designs" | "rating" | "az";

function Designers() {
  const shop = Route.useLoaderData();
  const vq = (Route.useSearch() as any)?.v === "b" ? "b" : undefined;
  const rated = new Map((shop.ratings ?? []).map((r) => [r.slug, r]));
  const [stats, setStats] = useState<Record<string, any>>({});
  useEffect(() => { fetch("/backend/community/designers").then((r) => r.json()).then((j) => setStats(j.designers ?? {})).catch(() => {}); }, []);
  const live = liveDesigns(shop);
  const designsByDesigner = (slug: string) => live.filter((x) => x.designer === slug);
  const designers = [...sampleDesigners, ...shop.designers.filter((d) => !sampleDesigners.some((x) => x.slug === d.slug))]
    .filter((d) => !d.hidden)
    .map((d) => { const r = rated.get(d.slug); return { ...d, rating: r?.rating ?? 0, reviews: r?.reviews ?? 0, work: designsByDesigner(d.slug) }; });

  const [spec, setSpec] = useState("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [limit, setLimit] = useState(PAGE);
  const [allOnPhone, setAllOnPhone] = useState(false);
  const specs = useMemo(() => {
    const n = new Map<string, number>();
    designers.forEach((d) => d.specialties.forEach((s) => n.set(s.toLowerCase(), (n.get(s.toLowerCase()) ?? 0) + 1)));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
  }, [designers.length]);
  const list = designers
    .filter((d) => spec === "all" || d.specialties.some((s) => s.toLowerCase() === spec))
    .sort((a, b) => sort === "designs" ? b.work.length - a.work.length : sort === "rating" ? (b.rating - a.rating) || (b.reviews - a.reviews) : sort === "az" ? a.name.localeCompare(b.name) : 0);
  const shown = list.slice(0, limit);
  const totalWork = designers.reduce((n, d) => n + d.work.length, 0);
  const pick = (f: () => void) => { f(); setLimit(PAGE); setAllOnPhone(false); };

  return (
    <div className="pb-14" data-testid="designers-page">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/30 via-primary/10 to-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pt-8 pb-6 sm:px-8 sm:pt-12 sm:pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-eyebrow text-primary-foreground/70">The artists</p>
            <h1 className="mt-2 text-3xl leading-tight sm:text-5xl">Meet the designers</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              <span className="sm:hidden">Browse their work, then message the one you like.</span>
              <span className="hidden sm:inline">Every design on the site belongs to the person who drew it. Browse their work, message the one you like, or post a request and let them come to you.</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex -space-x-2.5">
              {designers.slice(0, 5).map((d) => <span key={d.slug} className="rounded-full ring-2 ring-background"><Avatar name={d.name} initials={d.initials} photo={d.photo} size="h-9 w-9 text-sm" /></span>)}
            </div>
            <span><b className="text-foreground">{designers.length}</b> designers · <b className="text-foreground">{totalWork}</b> designs</span>
          </div>
        </div>
      </section>

      <div className="sticky top-[72px] z-30 border-b border-border/60 bg-background/90 backdrop-blur-md" data-testid="designer-filters">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-2.5 sm:px-8">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <Chip on={spec === "all"} onClick={() => pick(() => setSpec("all"))}>All</Chip>
            {specs.map((s) => <Chip key={s} on={spec === s} onClick={() => pick(() => setSpec(spec === s ? "all" : s))}>{s}</Chip>)}
          </div>
          <label className="sr-only" htmlFor="designer-sort">Sort designers</label>
          <select id="designer-sort" value={sort} onChange={(e) => pick(() => setSort(e.target.value as Sort))} className="h-8 shrink-0 rounded-full border border-border bg-card px-3 text-xs text-foreground" data-testid="designer-sort">
            <option value="featured">Featured</option>
            <option value="designs">Most designs</option>
            <option value="rating">Top rated</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-5 sm:px-8 sm:pt-8">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" data-testid="designer-grid">
          {shown.map((d, i) => {
            const m = stats[d.slug]?.measured;
            const resp = d.responseLabel || (m ? (m.hours < 1 ? "within an hour" : m.label) : "");
            const w = d.work;
            return (
              <Link key={d.slug} to="/designers/$slug" params={{ slug: d.slug }} search={(vq ? { v: vq } : {}) as any}
                className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-paper transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-lift active:scale-[0.985] ${i >= PHONE_FIRST && !allOnPhone ? "max-sm:hidden" : ""}`}
                data-testid="designer-card">
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/40 to-secondary">
                  {w.length >= 3 ? (
                    <div className="grid h-full grid-cols-3 grid-rows-2 gap-0.5">
                      <div className="col-span-2 row-span-2 overflow-hidden"><Thumb d={w[0]} sizes="(min-width: 1024px) 220px, (min-width: 640px) 22vw, 31vw" /></div>
                      <div className="overflow-hidden"><Thumb d={w[1]} sizes="(min-width: 1024px) 110px, 16vw" /></div>
                      <div className="overflow-hidden"><Thumb d={w[2]} sizes="(min-width: 1024px) 110px, 16vw" /></div>
                    </div>
                  ) : w.length === 2 ? (
                    <div className="grid h-full grid-cols-2 gap-0.5">
                      {w.slice(0, 2).map((x) => <div key={x.slug} className="overflow-hidden"><Thumb d={x} sizes="(min-width: 1024px) 165px, 24vw" /></div>)}
                    </div>
                  ) : w.length === 1 ? (
                    <Thumb d={w[0]} sizes="(min-width: 1024px) 330px, (min-width: 640px) 32vw, 46vw" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] tracking-wide text-primary-foreground/70">New designs soon</div>
                  )}
                  {w.length > 3 && <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">+{w.length - 3}</span>}
                </div>
                <div className="relative flex min-w-0 flex-1 flex-col px-3 pt-0 pb-3 sm:px-4 sm:pb-4">
                  <span className="-mt-5 mb-1 inline-block w-fit rounded-full ring-[3px] ring-card"><Avatar name={d.name} initials={d.initials} photo={d.photo} size="h-10 w-10 text-base sm:h-12 sm:w-12 sm:text-lg" /></span>
                  <h2 className="truncate font-display text-base leading-tight sm:text-xl">{d.name}</h2>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                    {w.length} design{w.length === 1 ? "" : "s"}{d.location ? ` · ${d.location}` : ""}
                  </p>
                  {d.reviews ? <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Star className="h-3 w-3 fill-clay text-clay" />{d.rating.toFixed(1)} ({d.reviews})</p> : null}
                  <p className="mt-2 hidden text-sm leading-snug text-muted-foreground sm:line-clamp-2">{d.tagline}</p>
                  {resp && <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block">Usually responds <span className="text-foreground">{resp}</span>{d.turnaroundDays ? <> · {turnaroundText(d.turnaroundDays)}</> : null}</p>}
                </div>
              </Link>
            );
          })}
        </div>
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No designers with that specialty yet.</p>}
        {!allOnPhone && shown.length > PHONE_FIRST && (
          <button type="button" onClick={() => setAllOnPhone(true)} className="mt-5 w-full rounded-full border border-border bg-card py-3 text-xs font-medium tracking-widest uppercase sm:hidden" data-testid="designers-more-phone">
            Show all {shown.length} designers
          </button>
        )}
        {list.length > limit && (
          <button type="button" onClick={() => { setLimit(limit + PAGE); setAllOnPhone(true); }} className={`mt-5 w-full rounded-full border border-border bg-card py-3 text-xs font-medium tracking-widest uppercase sm:mx-auto sm:block sm:w-64 ${!allOnPhone && shown.length > PHONE_FIRST ? "max-sm:hidden" : ""}`} data-testid="designers-more">
            Show more designers
          </button>
        )}

        <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-primary/40 bg-primary/15 p-5 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg leading-tight sm:text-2xl">Rather let them come to you?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Post what you need and every designer can reply with an offer.</p>
          </div>
          <Link to="/custom-request" className="shrink-0 rounded-full bg-primary px-6 py-3 text-xs font-medium tracking-widest text-primary-foreground uppercase transition hover:brightness-95">
            Post a request
          </Link>
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">Are you a designer? <Link to="/designers/how-it-works" className="text-foreground underline underline-offset-4">See how selling here works</Link></p>
      </div>
    </div>
  );
}
