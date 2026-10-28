// Option A = the designers pages exactly as they were before the compact redesign (kept so the owner can choose A or B).
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Star } from "lucide-react";
import { DesignCard } from "@/components/design-card";
import { Avatar, ContactDesigner, RatingInline, Reviews } from "@/components/community";
import { turnaroundText } from "@/lib/community";
import { designers as sampleDesigners, liveDesigns, COMMISSION_RATE, money, registerShop, type Designer } from "@/lib/catalog";
import { pic } from "@/lib/pics";

export function DesignersA({ shop }: { shop: any }) {
  const rated = new Map((shop.ratings ?? []).map((r) => [r.slug, r]));
  const [stats, setStats] = useState<Record<string, any>>({});
  useEffect(() => { fetch("/backend/community/designers").then((r) => r.json()).then((j) => setStats(j.designers ?? {})).catch(() => {}); }, []);
  const designers = [...sampleDesigners, ...shop.designers.filter((d) => !sampleDesigners.some((x) => x.slug === d.slug))]
    .filter((d) => !d.hidden)
    .map((d) => { const r = rated.get(d.slug); return { ...d, rating: r?.rating ?? 0, reviews: r?.reviews ?? 0 }; });
  const live = liveDesigns(shop);
  const designsByDesigner = (slug: string) => live.filter((x) => x.designer === slug);
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="text-eyebrow text-clay">The artists</p>
      <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">
        Look through their work, then talk to them directly.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every design on the site belongs to the person who drew it. Browse what they have made
        before, message the one you like, or post an open request and let them come to you.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="designer-grid">
        {designers.map((d) => {
          const work = designsByDesigner(d.slug);
          const m = stats[d.slug]?.measured;
          const resp = d.responseLabel || (m ? (m.hours < 1 ? "within an hour" : m.label) : "");
          return (
            <Link key={d.slug} to="/designers/$slug" params={{ slug: d.slug }} search={{ v: "a" } as any} className="group flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 shadow-paper transition-shadow hover:shadow-lift sm:p-5" data-testid="designer-card">
              <div className="flex items-center gap-3">
                <Avatar name={d.name} initials={d.initials} photo={d.photo} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl leading-tight">{d.name}</h2>
                  <p className="text-xs text-muted-foreground">{d.reviews ? <RatingInline rating={d.rating} count={d.reviews} /> : "No reviews yet"}{d.location ? ` · ${d.location}` : ""}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{d.tagline}</p>
              {d.specialties.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{d.specialties.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] capitalize">{s}</span>)}</div>}
              {work.length > 0 && <div className="mt-4 grid grid-cols-3 gap-1.5">
                {work.slice(0, 3).map((w) => <img key={w.slug} src={pic(w, w.image, [320])?.src ?? w.image} alt={w.title} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />)}
              </div>}
              <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground" style={{ marginTop: work.length ? 16 : undefined }}>
                <div><dt>Usually responds</dt><dd className="mt-0.5 text-xs text-foreground">{resp || "—"}</dd>{d.responseLabel && m && <dd className="text-[10px]">measured {m.label}</dd>}</div>
                <div><dt>Typical turnaround</dt><dd className="mt-0.5 text-xs text-foreground">{d.turnaroundDays ? turnaroundText(d.turnaroundDays) : "—"}</dd></div>
              </dl>
            </Link>
          );
        })}
      </div>

      <div className="mt-14 rounded-sm bg-secondary/60 p-8 text-center">
        <h2 className="text-2xl">Rather let them come to you?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Post what you need and every designer on Artisan Mural can see it and reply with an offer.
        </p>
        <Link to="/custom-request" className="mt-6 inline-block rounded-sm bg-primary px-6 py-3.5 text-xs font-medium tracking-widest text-primary-foreground uppercase">
          Post a request
        </Link>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">Are you a designer? <Link to="/designers/how-it-works" className="text-foreground underline underline-offset-4">See how selling on Artisan Mural works</Link></p>
    </div>
  );
}


export function DesignerProfileA({ shop, designer, work, collections }: { shop: any; designer: Designer; work: any[]; collections: any[] }) {
  registerShop(shop);
  const rating = (shop.ratings ?? []).find((r) => r.slug === designer.slug);
  const [extra, setExtra] = useState<any>(null);
  useEffect(() => { setExtra(null); fetch(`/backend/community/designer/${designer.slug}`).then((r) => r.json()).then(setExtra).catch(() => {}); }, [designer.slug]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <nav className="text-xs text-muted-foreground">
        <Link to="/designers" search={{ v: "a" } as any} className="hover:text-foreground">
          Designers
        </Link>{" "}
        / <span className="text-foreground">{designer.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-start gap-5">
            <Avatar name={designer.name} initials={designer.initials} photo={designer.photo} size="h-16 w-16 text-2xl" />
            <div>
              <h1 className="text-4xl leading-tight">{designer.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{designer.tagline}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {designer.location}
            </span>
            <a href="#reviews" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Star className="h-3.5 w-3.5 fill-clay text-clay" /> {rating?.reviews ? `${rating.rating.toFixed(1)} · ${rating.reviews} review${rating.reviews === 1 ? "" : "s"}` : "No reviews yet"}
            </a>
            {(designer.responseLabel || extra?.measured) && <span className="inline-flex items-center gap-1.5" data-testid="designer-response">
              <Clock className="h-3.5 w-3.5" /> {designer.responseLabel ? `Usually responds ${designer.responseLabel}` : ""}{extra?.measured ? `${designer.responseLabel ? " · " : "Replies in "}measured ${extra.measured.label}` : ""}
            </span>}
            {designer.turnaroundDays ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Typical turnaround {turnaroundText(designer.turnaroundDays)}</span> : null}
            <span>Designing here since {designer.since}</span>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {designer.bio}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {designer.specialties.map((s) => (
              <span key={s} className="rounded-full bg-accent px-3 py-1 text-xs">
                {s}
              </span>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 lg:hidden">
            <ContactDesigner slug={designer.slug} name={designer.name} className="h-auto rounded-sm py-3 text-[11px] font-medium tracking-widest uppercase" />
            <Link to="/custom-request" search={{ designer: designer.slug }} className="rounded-sm border border-border py-3 text-center text-[11px] font-medium tracking-widest uppercase">Custom request</Link>
          </div>
          {collections.length > 0 && <><h2 className="mt-12 text-2xl">Collections</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{collections.map((c: any) => { const imgs = c.designs.flatMap((s: string) => work.filter((w: any) => w.slug === s)).slice(0, 3); return <Link key={c.id} to="/collections/$id" params={{ id: c.id }} className="rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-lift"><div className="grid grid-cols-3 gap-1">{imgs.map((w: any) => <img key={w.slug} src={w.image} alt="" loading="lazy" className="aspect-square w-full rounded-sm object-cover" />)}</div><p className="mt-3 font-display text-lg">{c.title}</p><p className="text-xs text-muted-foreground">{c.designs.length} designs</p></Link>; })}</div></>}
          {(work.length > 0 || !extra?.portfolio?.length) && <h2 className="mt-12 text-2xl">Previous work</h2>}
          <div className="mt-6 grid gap-7 sm:grid-cols-2">
            {work.map((d) => (
              <DesignCard key={d.slug} design={d} />
            ))}
          </div>
          {work.length === 0 && !extra?.portfolio?.length && <p className="mt-4 text-sm text-muted-foreground">New designs from {designer.name} are coming soon.</p>}
          {extra?.portfolio?.length > 0 && <><h2 className="mt-12 text-2xl">Portfolio</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="designer-portfolio">{extra.portfolio.map((x: any) => <figure key={x.url} className="min-w-0"><img src={x.url} alt={x.caption || `${designer.name} portfolio`} loading="lazy" className="aspect-square w-full rounded-sm object-cover shadow-paper" />{x.caption && <figcaption className="mt-1.5 truncate text-xs text-muted-foreground">{x.caption}</figcaption>}</figure>)}</div></>}
          <Reviews kind="designer" target={designer.slug} title={designer.name} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-sm border border-border bg-card p-6 shadow-paper">
            <p className="text-eyebrow text-muted-foreground">Work with {designer.name.split(" ")[0]}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">New design, made for you</dt>
                <dd>from {money(designer.customFrom)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Adapt one of their designs to your wall</dt>
                <dd>{money(designer.adaptFee)}</dd>
              </div>
            </dl>
            <ContactDesigner slug={designer.slug} name={designer.name} className="mt-6 h-auto w-full rounded-sm py-3.5 text-xs font-medium tracking-widest uppercase" />
            <Link to="/custom-request" search={{ designer: designer.slug }} className="mt-2 block rounded-sm border border-border py-3 text-center text-xs font-medium tracking-widest uppercase hover:bg-muted/60" data-testid="request-designer">
              Request a custom design
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              You agree the price and the brief in the chat before any work starts. Artisan Mural
              handles payment and keeps {Math.round(COMMISSION_RATE * 100)}%; the rest goes to the
              designer.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
