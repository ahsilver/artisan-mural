import { MatchFixed } from "@/components/designer/match-info";
import {
ensureShop } from "@/lib/shop";
import { getShopDesign } from "@/lib/shop.functions";
import { isHidden, liveDesigns, swatchStyle, offeredFinishes, recommendedOf } from "@/lib/catalog";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, ArrowUpRight, Camera, Star, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { wallSearchSchema, repeatWords, repeatStyle } from "@/lib/wall-selection";

import { DesignCard } from "@/components/design-card";
import { pic, roomSources, BIG_W, GEN_ROOM } from "@/lib/pics";
import { ProductCarousel } from "@/components/product-carousel";
import { RequestChange } from "@/components/projects";
import { Reviews, DesignRating } from "@/components/community";
import { useCommunity } from "@/lib/community";
import { WallCalculator } from "@/components/wall-calculator";
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
    const related = liveDesigns(full).filter((d) => d.slug !== params.slug).slice(0, 3);
    return { design, designer, collection, related, finishes: offeredFinishes(design, resolvedMaterials(shop.materialSettings)) };
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
  const { design: baseDesign, designer, collection, related, finishes } = Route.useLoaderData();
  const search = Route.useSearch();
  const [color, setColor] = useState(search.color ?? baseDesign.colorways?.[0]?.id);
  const design = withColorway(baseDesign, color);
  const colorway = baseDesign.colorways?.find((c) => c.id === color);
  const [galleryIndex, setGalleryIndex] = useState(0);
  // Room photos lead (like premium mural shops); the full artwork follows.
  const mockups = roomSources(design);
  const [firstRoom, ...otherRooms] = mockups;
  const sources: string[] = firstRoom ? [firstRoom, design.image, ...otherRooms] : [design.image];
  const pics = sources.map((s) => pic(design, s, BIG_W));
  // the card's small picture (already loaded on the shop page) shows at once while the sharp one loads
  const previews = sources.map((s, i) => (i === 0 ? pic(design, s, [480])?.src : undefined));
  // full-size originals open only on zoom; a made room picture has no original, so its biggest version is used
  const gallery: string[] = sources.map((s, i) => (s === GEN_ROOM ? (pics[i]?.srcSet?.split(", ").pop()?.split(" ")[0] ?? pics[i]?.src ?? design.image) : s));
  const artIndex = firstRoom ? 1 : 0;
  // the designer's first recommended finish is preselected when the customer hasn't picked one
  const [finish, setFinish] = useState(search.finish ?? recommendedOf(baseDesign, finishes)[0] ?? finishes[0]?.id);
  const material = finishes.find(m => m.id === finish) ?? finishes[0];
  const [selection, setSelection] = useState(search);
  const [chatOpen, setChatOpen] = useState(false);
  const community = useCommunity();
  const [prefill, setPrefill] = useState<RequestPrefill>({});
  const ask = (fit?: boolean) => { setPrefill(fit ? oversizePrefill(design.title, selection, muralMaxLabel(design, selection)) : { wallSize: wallLabel(selection) }); setChatOpen(true); };
  useEffect(() => { setSelection(search); }, [design.slug, search.width, search.height, search.unit, search.zoom, search.x, search.y, search.artRatio]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8 sm:py-6 lg:px-12">
      <nav className="text-xs text-muted-foreground">
        <Link to="/browse" className="hover:text-foreground">
          All designs
        </Link>{" "}
        / <span className="text-foreground">{design.title}</span>
      </nav>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 sm:mt-6 sm:gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
        {/* Artwork */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="-mx-4 min-w-0 overflow-hidden sm:-mx-8 lg:mx-0">
            <ProductCarousel slides={gallery} pics={pics} previews={previews} artIndex={artIndex} title={design.title} repeating={design.kind === 'repeating'} overlay={
              <Button asChild variant="outline" className="h-9 text-[13px]"><Link to="/design/$slug/preview" params={{ slug: design.slug }} search={{ ...selection, color, finish, view: "room" }}><Camera />See it in your room</Link></Button>
            } />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span data-testid="repeat-type-short">{repeatWords(design).label}</span><Link to="/designers/$slug" params={{ slug: designer.slug }} className="flex items-center gap-1">By {designer.name}<ArrowUpRight className="h-3 w-3" /></Link></div>
          <section aria-label="About this design" className="mt-4 hidden border-t border-border pt-4 sm:mt-5 sm:pt-5 lg:block">
            <p className="text-eyebrow text-muted-foreground">{design.categories.join(" / ")}</p>
            <p className="mt-3 text-sm font-medium">{design.kind === "mural" ? "Made-to-measure wallpaper mural" : "Made-to-measure repeating wallpaper"}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{design.description}</p>{design.tags && design.tags.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{design.tags.slice(0, 10).map((tg) => <Link key={tg} to="/browse" search={{ q: tg } as any} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{tg}</Link>)}</p>}
          </section>
        </div>

        {/* Details & fit */}
        <div className="lg:self-start">
          <p className="text-eyebrow text-muted-foreground">{design.kind === "mural" ? "Mural · one-of-a-kind scene" : repeatStyle(design) === "horizontal" ? "Pattern · repeats sideways only" : "Pattern · repeats in every direction"}</p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-5xl">{design.title}</h1>{design.sku && <p className="mt-2 text-xs text-muted-foreground">SKU {design.sku}</p>}
          <p className="mt-2 text-sm" data-testid="repeat-type"><span className="font-medium">{repeatWords(design).label}.</span> <span className="text-muted-foreground">{repeatWords(design).detail}</span></p>
          <MatchFixed design={design as any} className="mt-2" />
          <p className="mt-2 text-sm text-muted-foreground">An original by <Link to="/designers/$slug" params={{ slug: designer.slug }} className="font-medium text-foreground underline-offset-4 hover:underline">{designer.name}</Link></p>
          {collection && <p className="mt-1 text-xs text-muted-foreground" data-testid="collection-line">Part of the <Link to="/collections/$id" params={{ id: collection.id }} className="font-medium text-foreground underline-offset-4 hover:underline">{collection.title}</Link> collection · <Link to="/collections/$id" params={{ id: collection.id }} className="text-primary underline underline-offset-4">See the full collection</Link></p>}
          <div className="mt-3 flex flex-wrap items-baseline gap-2"><p className="text-xl font-semibold">{money(designRate(design))} / sq ft</p><DesignRating slug={baseDesign.slug} fetchIfMissing link /><span className="text-xs text-muted-foreground">{money(designRate(design) * 10.7639)} / m²</span></div>
          {baseDesign.colorways && baseDesign.colorways.length > 1 && (
            <div className="mt-4" data-testid="color-picker">
              <p className="text-sm"><span className="text-muted-foreground">Color:</span> <span className="font-medium">{colorway?.name}</span> <span className="text-xs text-muted-foreground">· {baseDesign.colorways.length} colors</span></p>
              <div className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label="Colors">
                {baseDesign.colorways.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={c.id === color} aria-label={c.name} title={c.name} onClick={() => { setColor(c.id); setGalleryIndex(0); }} className="flex w-16 flex-col items-center gap-1 text-[11px] leading-tight">
                    <span className={`block h-12 w-12 rounded-full p-[3px] transition ${c.id === color ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "ring-1 ring-border hover:ring-foreground/50"}`}><span className="block h-full w-full rounded-full border border-black/10" style={swatchStyle(c)} /></span>
                    <span className={`max-w-16 truncate ${c.id === color ? "font-medium text-foreground" : "text-muted-foreground"}`}>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4"><AskDesignerButton onClick={() => ask()} /><RequestChange design={design} designer={designer} open={chatOpen} onOpenChange={setChatOpen} prefill={prefill} trigger={false} />
            {community.productLineEnabled && <p className="mt-2.5 max-w-md text-xs leading-relaxed text-muted-foreground" data-testid="designer-line">Want this design changed a little — colors, scale, a tree moved? <button type="button" onClick={() => ask()} className="text-foreground underline underline-offset-4">Work with a designer</button></p>}</div>

<div className="mt-4" />
          {collection && <div className="mb-5 flex gap-4 rounded-lg bg-accent/60 p-4 sm:p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background text-primary"><Layers className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium">More from this artist · {collection.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">This design is part of a collection, grouped by the designer by theme, scale or color.</p>
              <Button asChild size="sm" variant="outline" className="mt-3"><Link to="/collections/$id" params={{ id: collection.id }}>View collection</Link></Button>
            </div>
          </div>}
          {material && <WallCalculator design={design} color={color} designer={designer} selection={selection} onSelectionChange={setSelection} material={material} materialOptions={finishes} onMaterialChange={setFinish} onContact={ask} />}

          <section aria-label="About this design" className="mt-6 border-t border-border pt-5 lg:hidden">
            <p className="text-eyebrow text-muted-foreground">{design.categories.join(" / ")}</p>
            <p className="mt-3 text-sm font-medium">{design.kind === "mural" ? "Made-to-measure wallpaper mural" : "Made-to-measure repeating wallpaper"}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{design.description}</p>{design.tags && design.tags.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{design.tags.slice(0, 10).map((tg) => <Link key={tg} to="/browse" search={{ q: tg } as any} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{tg}</Link>)}</p>}
          </section>
          <div className="my-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{["Printed to your size", "Choice of textured finishes", "Free design chat"].map(text => <span key={text} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{text}</span>)}</div>

          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 text-primary" />Built for you — every order is printed fresh, to your wall.</div>
        </div>
      </div>

      {design.story && <section aria-label="The story behind the design" className="mt-12 border-t border-border pt-8 sm:mt-14 sm:pt-10">
        <div className="mx-auto max-w-2xl"><p className="text-eyebrow text-clay">The story behind the design</p><h2 className="mt-2 text-2xl sm:text-3xl">How {design.title} came to be</h2><p className="mt-4 text-base leading-relaxed text-muted-foreground">{design.story}</p><p className="mt-4 text-sm">— {designer.name}</p></div>
      </section>}

      <div className="mx-auto max-w-3xl"><Reviews kind="design" target={baseDesign.slug} title={design.title} /></div>

      <section className="mt-14 border-t border-border pt-8 sm:mt-16 sm:pt-10">
        <h2 className="text-2xl">You may also like</h2>
        <div className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((d) => (
            <DesignCard key={d.slug} design={d} />
          ))}
        </div>
      </section>
    </div>
  );
}
