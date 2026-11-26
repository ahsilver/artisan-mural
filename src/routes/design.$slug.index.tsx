import { MatchFixed } from "@/components/designer/match-info";
import {
ensureShop } from "@/lib/shop";
import { getShopDesign } from "@/lib/shop.functions";
import { isHidden, liveDesigns, registerShop, swatchStyle, offeredFinishes, recommendedOf, unitPrice } from "@/lib/catalog";
import { StorefrontSprite, Ico } from "@/components/storefront/icons";
import { StoreCard } from "@/components/storefront/card";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, ArrowUpRight, Camera, Star, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fragment, useEffect, useState } from "react";
import { wallSearchSchema, repeatWords, repeatStyle } from "@/lib/wall-selection";

import { DesignCard } from "@/components/design-card";
import { pic, roomSources, BIG_W, GEN_ROOM } from "@/lib/pics";
import { ProductCarousel } from "@/components/product-carousel";
import { RequestChange } from "@/components/projects";
import { Reviews, DesignRating } from "@/components/community";
import { useCommunity } from "@/lib/community";
import { SampleOrder, useSampleLabel } from "@/components/storefront/sample-order";
import { AskDesignerButton, oversizePrefill, wallLabel, type RequestPrefill } from "@/components/oversize";
import { muralMaxLabel } from "@/components/size-notice";
import {
  designBySlug,
  designerBySlug,
  designs,
  withColorway,
  money, designRate,
  materials, resolvedMaterials,
  type Design,
  type Designer,
} from "@/lib/catalog";

export const Route = createFileRoute("/design/$slug/")({
  validateSearch: wallSearchSchema,
  loader: async ({ params, context }) => {
    // Uploaded designs are fetched individually; the full catalog is not needed here.
    const [uploaded, full] = await Promise.all([params.slug.startsWith("u-") ? getShopDesign({ data: { slug: params.slug } }) : Promise.resolve(undefined), ensureShop(context.queryClient)]);
    const shop = uploaded ?? full;
    const design = uploaded
      ? (uploaded.hidden.includes(params.slug) ? undefined : uploaded.designs.find(d => d.slug === params.slug))
      : (isHidden(params.slug) ? undefined : designBySlug(params.slug));
    const designer = design ? (uploaded?.designers.find(d => d.slug === design.designer) ?? designerBySlug(design.designer)) : undefined;
    if (!design || !designer) throw notFound();
    const collection = (shop.collections ?? []).find(c => c.designs.includes(params.slug)) ?? null;
    // related designs are picked here (not while drawing) so the server and the browser show the same cards
    const related = liveDesigns(full).filter((d) => d.slug !== params.slug).slice(0, 4);
    return { shop: full, design, designer, collection, related, finishes: offeredFinishes(design, resolvedMaterials(shop.materialSettings)) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Design not found — Artisan Mural" }, { name: "robots", content: "noindex" }],
      };
    }
    const { design, designer } = loaderData as { design: Design; designer: Designer };
    const description = `${design.title} by ${designer.name} — printed to the exact size of your wall.`;
    const canonical = `${typeof window !== "undefined" ? window.location.origin : "https://artisan-mural.pages.dev"}/design/${encodeURIComponent(design.slug)}`;
    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title: `${design.title} by ${designer.name} — Artisan Mural` },
        { name: "description", content: description },
        { property: "og:title", content: `${design.title} by ${designer.name}` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(design.image.startsWith("https://") ? [{ property: "og:image", content: design.image }, { name: "twitter:image", content: design.image }] : []),
      ],
    };
  },
  component: DesignDetail,
});

function DesignDetail() {
  const { shop, design: baseDesign, designer, collection, related, finishes } = Route.useLoaderData();
  registerShop(shop);
  const search = Route.useSearch();
  const [color, setColor] = useState(search.color ?? baseDesign.colorways?.[0]?.id);
  const design = withColorway(baseDesign, color);
  const colorway = baseDesign.colorways?.find((c) => c.id === color);
  const mockups = roomSources(design);
  const sources: { src: string; label: string }[] = [
    { src: design.image, label: "The wallpaper" },
    ...mockups.map((m) => ({ src: m, label: "In a room" })),
  ];
  const shown: { src: string; label: string; pic: ReturnType<typeof pic>; mat?: boolean }[] = sources.map((s) => ({ ...s, pic: pic(design, s.src, BIG_W) }));
  const [gi, setGi] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [finish, setFinish] = useState(search.finish ?? recommendedOf(baseDesign, finishes)[0] ?? finishes[0]?.id);
  const material = finishes.find((m) => m.id === finish) ?? finishes[0];
  // the material's weave over the design, at real size: a clean texture photo (2.24 in per tile) when the shop has one, else the material photo
  const grain = material && ["canvas", "linen", "grasscloth", "suede"].includes(material.id) ? { url: `/tex/${material.id}-grain.webp`, inches: 2.24 } : material?.texture ? { url: material.texture, inches: material.sampleIn ?? 2 } : null;
  if (material && grain) shown.push({ src: grain.url, label: `On ${material.name} · close-up`, pic: undefined, mat: true });
  const matIndex = grain ? shown.length - 1 : -1;
  const [chatOpen, setChatOpen] = useState(false);
  const [prefill, setPrefill] = useState<RequestPrefill>({});
  const [fav, setFav] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false); const sampleLabel = useSampleLabel();
  const recs = recommendedOf(baseDesign, finishes);
  const ballOf = (m: { id: string; ball?: string | undefined; texture?: string | undefined }) => m.ball || (["canvas", "linen", "grasscloth", "suede"].includes(m.id) ? `/tex/${m.id}-ball.webp` : m.texture);
  const collPics = collection ? collection.designs.slice(0, 3).map((slug: string) => liveDesigns(shop).find((d) => d.slug === slug)?.image).filter(Boolean) as string[] : [];
  const ask = () => { setPrefill({ wallSize: wallLabel(search) }); setChatOpen(true); };
  const rate = unitPrice(design, material);
  const mural = design.kind === "mural";
  const kindHint = mural ? "One big scene, printed once and sized to your wall. Nothing repeats." : "A pattern that repeats side to side and up and down, so it covers any wall size.";
  const repeat = repeatWords(design);
  useEffect(() => {
    if (viewer == null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setViewer(null); if (e.key === "ArrowLeft") setViewer((v) => ((v ?? 0) + shown.length - 1) % shown.length); if (e.key === "ArrowRight") setViewer((v) => ((v ?? 0) + 1) % shown.length); };
    document.body.style.overflow = "hidden"; addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", k); };
  }, [viewer, shown.length]);
  const specs: [string, React.ReactNode][] = [
    ["Item #", design.sku ?? "—"],
    ["Type", mural ? "Mural · one scene" : `Repeating pattern · ${repeat.label}`],
    ["Designer", <Link to="/designers/$slug" params={{ slug: designer.slug }}>{designer.name}</Link>],
    ["Printed", "To your exact wall size, in numbered panels"],
    ["Price", `${money(rate)} / sq ft${material ? ` · ${material.name}` : ""}`],
  ];

  return (
    <div className="am"><div className="pdx">
      <StorefrontSprite />
      <section className="pbanner pg" aria-label="Design">
        <div className="pb-in">
          {mural ? <img src={pic(design, design.image, BIG_W)?.src ?? design.image} alt="" /> : <span className="pb-tile" style={{ backgroundImage: `url("${pic(design, design.image, BIG_W)?.src ?? design.image}")` }} />}
          <div className="pb-copy"><h1>{baseDesign.title}</h1>{design.description && <p>{design.description}</p>}</div>
          {baseDesign.colorways && baseDesign.colorways.length > 1 && (
            <div className="pb-dots" role="group" aria-label="Colorways">
              {baseDesign.colorways.map((c) => <button key={c.id} type="button" aria-pressed={c.id === color} aria-label={c.name} title={c.name} style={swatchStyle(c)} onClick={() => setColor(c.id)} />)}
            </div>
          )}
        </div>
      </section>
      <div className="pg crumbs-row">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span>/</span><Link to="/browse" search={{ kind: design.kind }}>{mural ? "Murals" : "Repeating patterns"}</Link><span>/</span><b>{baseDesign.title}</b>
          {design.sku && <><span>/</span><span>Item # {design.sku}</span></>}<span>·</span><span>Ships in 5–7 days</span>
        </nav>
      </div>
      <section className="pd pg">
        <div className="gal">
          <div className="gal-main">
            {shown[gi]?.mat && material ? <div className="gal-matv" role="img" aria-label={`${baseDesign.title} printed on ${material.name}, about 12 inches of wall at real size`}>
              <span className="gal-mat-art" style={{ backgroundImage: `url("${pic(design, design.image, BIG_W)?.src ?? design.image}")` }} />
              <span className="gal-mat-tex" style={{ backgroundImage: `url("${grain?.url}")`, backgroundSize: `${((grain?.inches ?? 2) / 12) * 100}% auto` }} />
            </div> : shown[gi] && <img src={shown[gi]!.pic?.src ?? shown[gi]!.src} srcSet={shown[gi]!.pic?.srcSet} sizes="(min-width: 1000px) 58vw, 100vw" alt={`${baseDesign.title}: ${shown[gi]!.label}`} />}
            <span className="gal-tag">{shown[gi]?.label}</span>
            <Link className="gal-room" to="/design/$slug/preview" params={{ slug: design.slug }} search={{ ...search, color, finish, view: "room" }}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>See it in your room</Link>
            <button type="button" className="gal-full" aria-label="See all pictures full size" onClick={() => setViewer(gi)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg></button>
          </div>
          <div className="gal-thumbs" role="group" aria-label="Pictures">
            {shown.map((s, k) => <button key={k} type="button" aria-pressed={k === gi} aria-label={`${s.label} ${k + 1}`} onClick={() => setGi(k)}><img src={pic(design, s.src, [320])?.src ?? s.src} alt="" loading="lazy" /><small>{s.label}</small></button>)}
          </div>
        </div>
        <div className="buy">
          <h2 className="title">{baseDesign.title}</h2>
          <div className="by">by <Link to="/designers/$slug" params={{ slug: designer.slug }}>{designer.name}</Link>{designer.reviews > 0 && <> <span className="stars" aria-label={`${designer.rating} out of 5`}>★★★★★</span> <span className="muted">{designer.rating} · {designer.reviews} reviews</span></>}</div>
          {collection && <div className="coll-note"><Link className="cn-card" to="/collections/$id" params={{ id: collection.id }}><span className="cn-th">{collPics.map((u, k) => <img key={k} src={u} alt="" />)}</span><span className="cn-t"><small>Part of a collection</small><b>{collection.title}</b></span><span className="cn-go">See all {collection.designs.length}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></span></Link></div>}
          {baseDesign.colorways && baseDesign.colorways.length > 1 && (
            <div className="opt">
              <div className="lbl">Colorway <span className="mat-name">{colorway?.name}</span></div>
              <div className="cw" role="group" aria-label="Colorway">
                {baseDesign.colorways.map((c) => <button key={c.id} type="button" aria-pressed={c.id === color} aria-label={c.name} title={c.name} onClick={() => setColor(c.id)}><span className="sq" style={swatchStyle(c)} />{c.name}</button>)}
              </div>
            </div>
          )}
          <div className="opt">
            <div className="lbl">Type</div>
            <div className="kind-row"><span className="chip on">{mural ? "Mural · sized to your wall" : "Repeating · fits any wall"}</span><button type="button" className="qtip" aria-label="What does this mean?" title={kindHint}>?</button><span className="qbox" role="tooltip">{kindHint}</span></div>
          </div>
          {finishes.length > 0 && (
            <div className="opt">
              <div className="lbl">Material <span className="mat-name">{material?.name}</span></div>
              <div className="chips mat-grid" role="radiogroup" aria-label="Material">
                {finishes.map((m) => <button key={m.id} type="button" role="radio" aria-checked={m.id === material?.id} className="chip" onClick={() => { setFinish(m.id); if (matIndex >= 0) setGi(matIndex); }}><span className="mat-ball" style={{ backgroundImage: `url("${ballOf(m)}")` }} />{m.name}<small>{money(unitPrice(design, m))} / sq ft</small>{recs.includes(m.id) && <span className="pick-tag">Designer's pick</span>}</button>)}
              </div>
              {material?.blurb && <p className="mat-blurb">{material.blurb}</p>}
            </div>
          )}
          <div className="pcta">
            <div className="price-line"><b>{money(rate)}</b> / sq ft {material && <span className="pl-paper">· {material.name}</span>}</div>
            <Link className="btn btn-wine big" to="/design/$slug/preview" params={{ slug: design.slug }} search={{ ...search, color, finish }}>Customize size &amp; order</Link>
            <div className="row">
              {material && <button type="button" className="btn optline" aria-expanded={sampleOpen} onClick={() => setSampleOpen(!sampleOpen)}>Order a sample{sampleLabel ? ` · ${sampleLabel}` : ""}</button>}
              <Link className="btn optline" to="/design/$slug/preview" params={{ slug: design.slug }} search={{ ...search, color, finish, view: "room" }}>See it in my room</Link>
            </div>
            {material && sampleOpen && <SampleOrder design={design.slug} title={design.title} finish={material.id} finishName={material.name} color={color} colorName={design.colorways?.find((c: any) => c.id === color)?.name} open noTrigger onOpenChange={setSampleOpen} />}
          </div>
          <div className="change">
            <div className="ch-head">
              <span className="av">{designer.initials}</span>
              <div><b>Want something changed?</b><small>Free to ask · {designer.name} {designer.responseLabel ? lowerFirst(designer.responseLabel) : "replies within a day"}</small></div>
            </div>
            <button type="button" className="btn btn-wine" onClick={ask}>Chat with the designer</button>
            <RequestChange design={design} designer={designer} open={chatOpen} onOpenChange={setChatOpen} prefill={prefill} trigger={false} />
          </div>
        </div>
      </section>
      <section className="tabs-wrap pg">
        <div className="about-d">
          <div className="ad-main">
            <span className="k">About this design</span>
            {design.description && <p className="ad-lead">{design.description}</p>}
            {design.tags && design.tags.length > 0 && <div className="tagrow">{design.tags.slice(0, 10).map((t) => <Link key={t} to="/browse" search={{ q: t }}>{t}</Link>)}</div>}
            {design.story && <figure className="ad-story"><span className="ad-h">The story behind it</span><blockquote>{design.story}</blockquote><figcaption className="by-mini">— {designer.name}</figcaption></figure>}
          </div>
          <aside className="ad-specs"><span className="ad-h">Details</span><dl className="specs">{specs.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl></aside>
        </div>
      </section>
      {related.length > 0 && (
        <section className="sec pg">
          <div className="also-head"><h2>You may also like</h2></div>
          <div className="g-prod also">{related.map((d) => <StoreCard key={d.slug} d={d} />)}</div>
        </section>
      )}
      {viewer != null && shown[viewer] && (
        <div className="gv" role="dialog" aria-modal="true" aria-label={`${baseDesign.title} pictures`} onClick={(e) => { if (e.target === e.currentTarget) setViewer(null); }}>
          <div className="gv-top"><b>{baseDesign.title}</b><span>{shown[viewer]!.label} · {viewer + 1} / {shown.length}</span><button type="button" className="gv-x" aria-label="Close" onClick={() => setViewer(null)}>✕</button></div>
          <div className="gv-stage" onClick={(e) => { if (e.target === e.currentTarget) setViewer(null); }}>
            <button type="button" className="gv-a l" aria-label="Previous picture" onClick={() => setViewer((viewer + shown.length - 1) % shown.length)}>‹</button>
            {shown[viewer]!.mat && material ? <div className="gal-matv gv-matv" role="img" aria-label={`${baseDesign.title} printed on ${material.name}`}><span className="gal-mat-art" style={{ backgroundImage: `url("${design.image}")` }} /><span className="gal-mat-tex" style={{ backgroundImage: `url("${grain?.url}")`, backgroundSize: `${((grain?.inches ?? 2) / 12) * 100}% auto` }} /></div> : <img src={shown[viewer]!.src} alt={shown[viewer]!.label} />}
            <button type="button" className="gv-a r" aria-label="Next picture" onClick={() => setViewer((viewer + 1) % shown.length)}>›</button>
          </div>
          <div className="gv-thumbs">{shown.map((s, k) => <button key={k} type="button" aria-pressed={k === viewer} aria-label={`${s.label} ${k + 1}`} onClick={() => setViewer(k)}><img src={pic(design, s.src, [320])?.src ?? s.src} alt="" /></button>)}</div>
        </div>
      )}
    </div></div>
  );
}
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
