import { ensureShop } from "@/lib/shop";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { ContactDesigner, Reviews } from "@/components/community";
import { StoreCard } from "@/components/storefront/card";
import { pic } from "@/lib/pics";
import { avColor } from "./designers.index";
import { turnaroundText } from "@/lib/community";
import {
  designerBySlug,
  designsByDesigner,
  money,
  registerShop,
  type Design,
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
          { title: "Designer not found — Artisan Murals" },
          { name: "description", content: "This Artisan Mural designer profile is unavailable." },
          { property: "og:title", content: "Designer not found — Artisan Murals" },
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
        { title: `${designer.name} — wallpaper designer on Artisan Murals` },
        { name: "description", content: `${designer.tagline}. ${designer.bio}` },
        { property: "og:title", content: `${designer.name} — Artisan Murals` },
        { property: "og:description", content: designer.tagline },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProfileRoute,
});

function ProfileRoute() {
  return <DesignerProfile />;
}

/** The approved preview's designer page: banner, name and facts, Request / Message, about + "Work with …" prices,
 *  collections, and every design as a shop card. */
function DesignerProfile() {
  const { shop, designer: x, work, collections } = Route.useLoaderData();
  registerShop(shop);
  const [extra, setExtra] = useState<any>(null);
  useEffect(() => { fetch(`/backend/community/designer/${x.slug}`).then((r) => r.json()).then(setExtra).catch(() => {}); }, [x.slug]);
  const first = x.name.split(" ")[0];
  const top = work[0];
  const banner = top ? top.image : undefined;
  const responds = String(x.responseLabel || extra?.responseLabel || x.responseTime || "").replace(/^replies\s+/i, "");
  const days = x.turnaroundDays || extra?.turnaroundDays;
  return (
    <div className="am"><div id="view-designer">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/designers">Designers</Link><span>/</span><b>{x.name}</b></nav></div>
      <section className="pg">
        {banner && <div className="dp-banner"><img src={banner} alt={top ? `${top.title} by ${x.name}` : ""} /></div>}
        <div className="dp-top">
          <div className="dp-id">
            <span className="av-lg" style={{ background: avColor(x.slug) }}>{x.photo ? <img src={x.photo} alt="" /> : x.initials}</span>
            <div className="dp-idt"><h1>{x.name}</h1><p className="dp-line">{x.tagline}</p>
              <div className="dp-meta">{x.location && <span>{x.location}</span>}{x.reviews > 0 && <span>★ <b>{x.rating.toFixed(1)}</b> · {x.reviews} review{x.reviews === 1 ? "" : "s"}</span>}{x.since && <span>On Artisan Murals since {x.since}</span>}{responds && <span>Replies {responds}</span>}{days ? <span>Typical turnaround <b>{turnaroundText(days)}</b></span> : null}</div>
            </div>
          </div>
          <div className="dp-act"><Link className="btn btn-wine" to="/custom-request" search={{ designer: x.slug }}>Request a design</Link><ContactDesigner slug={x.slug} name={x.name} className="btn optline" label="Message" /></div>
        </div>
        <div className="dp-body">
          <div className="dp-about"><p>{x.bio}</p>{(x.specialties ?? []).length > 0 && <div className="frow">{x.specialties.map((t) => <Link key={t} className="fchip" to="/browse" search={{ q: t } as any}>{t}</Link>)}</div>}</div>
          <div className="dp-offer"><b>Work with {first}</b>
            <div className="dp-o"><span>New design, made for you</span><b>{x.customFrom ? `from ${money(x.customFrom)}` : "Ask for a price"}</b></div>
            <div className="dp-o"><span>Adapt a design to your wall</span><b>{x.adaptFee ? money(x.adaptFee) : "Ask for a price"}</b></div>
            <small>Agree the price in the chat first. Paid safely through Artisan Murals.</small>
          </div>
        </div>
        {collections.length > 0 && <div><h2 className="dp-h">Collections <span>({collections.length})</span></h2><div className="coll-grid">{collections.map((c) => { const ds = c.designs.map((s) => work.find((w) => w.slug === s)).filter(Boolean).slice(0, 3) as Design[]; return (
          <Link key={c.id} className="ccard" to="/collections/$id" params={{ id: c.id }}><span className="mos" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, ds.length))},1fr)` }}>{ds.map((d) => <img key={d.slug} src={pic(d, d.image)?.src ?? d.image} srcSet={pic(d, d.image)?.srcSet} sizes="20vw" alt="" loading="lazy" />)}</span><span className="cc"><b>{c.title}</b><small>{c.designs.length} designs · by {x.name}</small></span></Link>); })}</div></div>}
        <h2 className="dp-h">All designs <span>({work.length})</span></h2>
        {work.length ? <div className="g-prod shopgrid">{work.map((d) => <StoreCard key={d.slug} d={d} />)}</div> : <p className="hint">New designs are coming soon.</p>}
        {extra?.portfolio?.length > 0 && <><h2 className="dp-h">Earlier work</h2><div className="coll-grid">{extra.portfolio.map((p: any, i: number) => <figure key={i} className="ccard"><span className="mos"><img src={p.url} alt={p.caption || ""} loading="lazy" /></span>{p.caption && <span className="cc"><small>{p.caption}</small></span>}</figure>)}</div></>}
        <div className="dp-reviews"><Reviews kind="designer" target={x.slug} title={x.name} /></div>
      </section>
    </div></div>
  );
}
