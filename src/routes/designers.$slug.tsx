import { ensureShop } from "@/lib/shop";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Star } from "lucide-react";

import { useEffect, useState } from "react";
import { WorkTile, Thumb, Chip, VersionSwitch } from "@/components/designer-tiles";
import { DesignerProfileA } from "@/components/designers-a";
import { Avatar, ContactDesigner, Reviews } from "@/components/community";
import { turnaroundText } from "@/lib/community";
import {
  COMMISSION_RATE,
  designerBySlug,
  designsByDesigner,
  money,
  registerShop,
  type Designer,
} from "@/lib/catalog";

export const Route = createFileRoute("/designers/$slug")({
  loader: async ({ params, context }) => {
    const shop = await ensureShop(context.queryClient);
    const designer = designerBySlug(params.slug);
    if (!designer || designer.hidden) throw notFound();
    return { shop, designer, work: designsByDesigner(designer.slug), collections: (shop?.collections ?? []).filter(c => c.designerSlug === designer.slug) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Designer not found — Artisan Mural" },
          { name: "description", content: "This Artisan Mural designer profile is unavailable." },
          { property: "og:title", content: "Designer not found — Artisan Mural" },
          { property: "og:description", content: "This wallpaper designer profile is unavailable." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { designer } = loaderData as { designer: Designer };
    return {
      meta: [
        { title: `${designer.name} — wallpaper designer on Artisan Mural` },
        { name: "description", content: `${designer.tagline}. ${designer.bio}` },
        { property: "og:title", content: `${designer.name} — Artisan Mural` },
        { property: "og:description", content: designer.tagline },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProfileRoute,
});

function ProfileRoute() {
  const v = (Route.useSearch() as any)?.v as string | undefined;
  const data = Route.useLoaderData();
  return <>{v === "a" ? <DesignerProfileA {...(data as any)} /> : <DesignerProfile />}<VersionSwitch v={v} raised={v !== "a"} /></>;
}

const WORK_PAGE = 12;

function DesignerProfile() {
  const { shop, designer, work, collections } = Route.useLoaderData();
  registerShop(shop);
  const rating = (shop.ratings ?? []).find((r) => r.slug === designer.slug);
  const [extra, setExtra] = useState<any>(null);
  const vq = (Route.useSearch() as any)?.v === "b" ? "b" : undefined;
  const [bioOpen, setBioOpen] = useState(false);
  const [kind, setKind] = useState<"all" | "repeating" | "mural">("all");
  const [limit, setLimit] = useState(WORK_PAGE);
  useEffect(() => { setExtra(null); setLimit(WORK_PAGE); setKind("all"); fetch(`/backend/community/designer/${designer.slug}`).then((r) => r.json()).then(setExtra).catch(() => {}); }, [designer.slug]);
  const first = designer.name.split(" ")[0];
  const kinds = new Set(work.map((w) => w.kind));
  const list = kind === "all" ? work : work.filter((w) => w.kind === kind);
  const longBio = (designer.bio ?? "").length > 150;
  const banner = work.slice(0, 4);
  const pill = "inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1";

  return (
    <div className="pb-24 lg:pb-14" data-testid="designer-profile">
      <section className="relative">
        <div className="relative h-24 overflow-hidden bg-gradient-to-br from-primary/60 via-primary/30 to-secondary sm:h-36 lg:h-44" aria-hidden="true">
          {banner.length > 0 && (
            <div className={`grid h-full gap-0.5 ${banner.length >= 4 ? "grid-cols-4" : banner.length === 3 ? "grid-cols-3" : banner.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {banner.map((w) => <div key={w.slug} className="overflow-hidden"><Thumb d={w} room={false} sizes="(min-width: 1024px) 360px, 25vw" /></div>)}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        </div>
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="relative z-10 -mt-10 flex items-end gap-4 sm:-mt-14">
            <span className="rounded-full bg-background p-1 shadow-paper"><Avatar name={designer.name} initials={designer.initials} photo={designer.photo} size="h-16 w-16 text-2xl sm:h-24 sm:w-24 sm:text-4xl" /></span>
            <div className="min-w-0 pb-1">
              <nav className="text-[11px] text-muted-foreground">
                <Link to="/designers" search={(vq ? { v: vq } : {}) as any} className="hover:text-foreground">Designers</Link> / <span className="text-foreground">{designer.name}</span>
              </nav>
              <h1 className="truncate text-2xl leading-tight sm:text-4xl">{designer.name}</h1>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 grid max-w-7xl gap-8 px-5 sm:px-8 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <p className="text-sm text-foreground/80">{designer.tagline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {designer.location && <span className={pill}><MapPin className="h-3 w-3" /> {designer.location}</span>}
            <a href="#reviews" className={`${pill} hover:text-foreground`}>
              <Star className="h-3 w-3 fill-clay text-clay" /> {rating?.reviews ? `${rating.rating.toFixed(1)} · ${rating.reviews} review${rating.reviews === 1 ? "" : "s"}` : "No reviews yet"}
            </a>
            {(designer.responseLabel || extra?.measured) && <span className={pill} data-testid="designer-response">
              <Clock className="h-3 w-3" /> {designer.responseLabel ? `Usually responds ${designer.responseLabel}${extra?.measured ? ` · measured ${extra.measured.label}` : ""}` : `Replies in ${extra.measured.label}`}
            </span>}
            {designer.turnaroundDays ? <span className={pill}><CalendarDays className="h-3 w-3" /> Turnaround {turnaroundText(designer.turnaroundDays)}</span> : null}
            {designer.since && <span className={pill}>Since {designer.since}</span>}
          </div>

          {designer.bio && <div className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <p className={bioOpen ? "" : "line-clamp-2 sm:line-clamp-3"} data-testid="designer-bio">{designer.bio}</p>
            {longBio && <button type="button" onClick={() => setBioOpen(!bioOpen)} className="mt-0.5 text-xs font-medium text-foreground underline underline-offset-4" data-testid="bio-more">{bioOpen ? "less" : "more"}</button>}
          </div>}

          {designer.specialties.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">
            {designer.specialties.map((s) => <span key={s} className="rounded-full border border-primary/50 bg-primary/15 px-2.5 py-0.5 text-[11px] capitalize text-foreground">{s}</span>)}
          </div>}

          <div className="mt-4 rounded-xl border border-border/70 bg-card px-4 py-3 text-xs lg:hidden" data-testid="price-strip">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">New design, made for you</span><span className="shrink-0">from {money(designer.customFrom)}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-muted-foreground">Adapt one of their designs</span><span className="shrink-0">{money(designer.adaptFee)}</span></div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl">{work.length > 0 || !extra?.portfolio?.length ? "Designs" : "Work"} {work.length > 0 && <span className="text-sm text-muted-foreground">({work.length})</span>}</h2>
            {kinds.size > 1 && <div className="flex gap-1.5">
              <Chip on={kind === "all"} onClick={() => { setKind("all"); setLimit(WORK_PAGE); }}>All</Chip>
              <Chip on={kind === "repeating"} onClick={() => { setKind("repeating"); setLimit(WORK_PAGE); }}>Repeats</Chip>
              <Chip on={kind === "mural"} onClick={() => { setKind("mural"); setLimit(WORK_PAGE); }}>Murals</Chip>
            </div>}
          </div>
          {list.length > 0 && <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 xl:grid-cols-4" data-testid="designer-work">
            {list.slice(0, limit).map((d) => <WorkTile key={d.slug} d={d} />)}
          </div>}
          {list.length > limit && <button type="button" onClick={() => setLimit(limit + WORK_PAGE)} className="mt-5 w-full rounded-full border border-border bg-card py-3 text-xs font-medium tracking-widest uppercase sm:mx-auto sm:block sm:w-64" data-testid="work-more">Show more ({list.length - limit} left)</button>}
          {work.length === 0 && !extra?.portfolio?.length && <p className="mt-3 text-sm text-muted-foreground">New designs from {designer.name} are coming soon.</p>}

          {collections.length > 0 && <>
            <h2 className="mt-10 text-xl sm:text-2xl">Collections</h2>
            <div className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3" style={{ scrollbarWidth: "none" }}>
              {collections.map((c) => { const imgs = c.designs.flatMap((s) => work.filter((w) => w.slug === s)).slice(0, 3); return (
                <Link key={c.id} to="/collections/$id" params={{ id: c.id }} className="group w-[68%] shrink-0 snap-start overflow-hidden rounded-xl border border-border/70 bg-card transition-shadow hover:shadow-lift sm:w-auto">
                  <div className="grid aspect-[3/1] gap-0.5 bg-muted" style={{ gridTemplateColumns: `repeat(${Math.max(1, imgs.length)}, minmax(0, 1fr))` }}>{imgs.map((w) => <div key={w.slug} className="overflow-hidden"><Thumb d={w} room={false} sizes="120px" /></div>)}</div>
                  <div className="px-3 py-2"><p className="truncate font-display text-base">{c.title}</p><p className="text-[11px] text-muted-foreground">{c.designs.length} designs</p></div>
                </Link>); })}
            </div>
          </>}

          {extra?.portfolio?.length > 0 && <><h2 className="mt-10 text-xl sm:text-2xl">Portfolio</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="designer-portfolio">{extra.portfolio.map((x: any) => <figure key={x.url} className="min-w-0"><img src={x.url} alt={x.caption || `${designer.name} portfolio`} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover shadow-paper" />{x.caption && <figcaption className="mt-1 truncate text-[11px] text-muted-foreground">{x.caption}</figcaption>}</figure>)}</div></>}
          <Reviews kind="designer" target={designer.slug} title={designer.name} />
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-paper">
            <div className="bg-primary/25 px-6 py-4"><p className="text-eyebrow text-primary-foreground/80">Work with {first}</p></div>
            <div className="p-6">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">New design, made for you</dt><dd className="shrink-0">from {money(designer.customFrom)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Adapt one of their designs to your wall</dt><dd className="shrink-0">{money(designer.adaptFee)}</dd></div>
              </dl>
              <ContactDesigner slug={designer.slug} name={designer.name} className="mt-6 h-auto w-full rounded-full py-3.5 text-xs font-medium tracking-widest uppercase" />
              <Link to="/custom-request" search={{ designer: designer.slug }} className="mt-2 block rounded-full border border-border py-3 text-center text-xs font-medium tracking-widest uppercase hover:bg-muted/60" data-testid="request-designer">
                Request a custom design
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                You agree the price and the brief in the chat before any work starts. Artisan Mural
                handles payment and keeps {Math.round(COMMISSION_RATE * 100)}%; the rest goes to the
                designer.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden" data-testid="profile-actionbar">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <ContactDesigner slug={designer.slug} name={designer.name} className="h-auto rounded-full py-3 text-[11px] font-medium tracking-widest uppercase" />
          <Link to="/custom-request" search={{ designer: designer.slug }} className="rounded-full border border-border bg-card py-3 text-center text-[11px] font-medium tracking-widest uppercase">Custom request</Link>
        </div>
      </div>
    </div>
  );
}
