import { MatchFixed } from "@/components/designer/match-info";
import { orderSqft } from "@/lib/wall-selection";
import { cart, useCart } from "@/lib/cart";
import { ensureShop } from "@/lib/shop";
import { getShopDesign } from "@/lib/shop.functions";
import { isHidden } from "@/lib/catalog";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Image, Pencil, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuralFramer } from "@/components/mural-framer";
import { MyRoom } from "@/components/my-room";
import { WallMeasurements } from "@/components/wall-measurements";
import { MaterialSelector } from "@/components/material-selector";
import { SizeNotice, muralMaxLabel } from "@/components/size-notice";
import { AskDesignerButton, OversizePopup, oversizePrefill, useOversizePrompt, wallLabel, type RequestPrefill } from "@/components/oversize";
import { RequestChange } from "@/components/projects";
import { unitPrice, withColorway, designBySlug, designerBySlug, materials as allMaterials, offeredFinishes, recommendedOf, money, designRate } from "@/lib/catalog";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  designerScaleSelection,
  pickSelection,
  repeatStyle,
  sizeIssue,
  previewSearchSchema,
  type WallSelection,
} from "@/lib/wall-selection";

export const Route = createFileRoute("/design/$slug/preview")({
  validateSearch: previewSearchSchema,
  loader: async ({ params, context }) => {
    const uploaded = params.slug.startsWith("u-") ? await getShopDesign({ data: { slug: params.slug } }) : undefined;
    if (!uploaded) await ensureShop(context.queryClient);
    const design = uploaded
      ? (uploaded.hidden.includes(params.slug) ? undefined : uploaded.designs.find(d => d.slug === params.slug))
      : (isHidden(params.slug) ? undefined : designBySlug(params.slug));
    const designer = design ? (uploaded?.designers.find(d => d.slug === design.designer) ?? designerBySlug(design.designer)) : undefined;
    if (!design || !designer) throw notFound();
    return { design, designer };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `Preview ${loaderData.design.title} on your wall — Artisan Mural`
      : "Preview unavailable — Artisan Mural";
    const description = "Choose your printed artwork area, select a finish, or preview the wallpaper in your own room.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: DesignPreview,
});

function DesignPreview() {
  const { design: baseDesign, designer } = Route.useLoaderData();
  const search = Route.useSearch();
  const design = withColorway(baseDesign, search.color);
  const colorway = baseDesign.colorways?.find((c) => c.id === search.color);
  const selection = pickSelection(search);
  const navigate = useNavigate();
  const cartItems = useCart();
  const editLine = search.line ? cartItems.find((i) => i.id === search.line) ?? null : null;
  const sameInCart = cartItems.filter((i) => i.design === design.slug);
  const [askWall, setAskWall] = useState(false);
  const tab = search.view ?? "artwork";
  // the finishes list comes from the live shop settings in the browser; render it after load so server and browser agree
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const materials = offeredFinishes(design, allMaterials);
  const material = materials.find((m) => m.id === search.finish) ?? materials.find((m) => m.id === recommendedOf(design, materials)[0]) ?? materials[0];
  const update = (patch: Partial<typeof search>) => {
    void navigate({
      to: "/design/$slug/preview",
      params: { slug: design.slug },
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
      resetScroll: false,
    });
  };
  const change = (next: WallSelection) => update(next);
  const sqft = orderSqft(selection);
  const [chatOpen, setChatOpen] = useState(false);
  const tooBig = repeatStyle(design) === "none" && !!sizeIssue(design, selection);
  const [popup, setPopup] = useOversizePrompt(tooBig, `${selection.width}x${selection.height}${selection.unit}`);
  const [prefill, setPrefill] = useState<RequestPrefill>({});
  const ask = (fit?: boolean) => { setPrefill(fit ? oversizePrefill(design.title, selection, muralMaxLabel(design, selection)) : { wallSize: wallLabel(selection) }); setChatOpen(true); };
  const tabClass = (on: boolean) =>
    on ? "rounded-none border-b-2 border-primary" : "rounded-none text-muted-foreground";
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-5 sm:px-8 lg:px-10">
      <Link
        to="/design/$slug"
        params={{ slug: design.slug }}
        search={{ ...selection, color: search.color }}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {design.title}
      </Link>
      <div className="mb-5 mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-eyebrow text-clay">Made for your wall</p>
          <h1 className="mt-2 text-3xl">
            {design.title}
            {colorway ? ` — ${colorway.name}` : ""} · Your preview
          </h1>
        </div>
        <div className="flex border-b border-border" role="tablist" aria-label="Preview view">
          <Button
            role="tab"
            aria-selected={tab === "artwork"}
            variant="ghost"
            className={tabClass(tab === "artwork")}
            onClick={() => update({ view: "artwork" })}
          >
            <Image />
            Artwork
          </Button>
          <Button
            role="tab"
            aria-selected={tab === "room"}
            variant="ghost"
            className={tabClass(tab === "room")}
            onClick={() => update({ view: "room" })}
          >
            <Camera />
            In my room
          </Button>
        </div>
      </div>
       <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
         <div role="tabpanel" className="min-w-0 w-full lg:sticky lg:top-24">
          {tab === "artwork" ? (
            <>
               <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                 <h2 className="text-lg">Your wall</h2>
                <Button
                   variant="outline"
                   className="min-h-11 border-primary px-4"
                  onClick={() => change(designerScaleSelection(design, selection))}
                >
                  <RotateCcw />
                   Reset to original size
                </Button>
              </div>
               <MuralFramer design={design} selection={selection} onChange={change} maxHeight="min(560px, 60svh)" />
               {design.kind === "mural" && (
                 <p className="mt-3 text-xs text-muted-foreground">Original size keeps your wall measurements. A smaller wall shows part of the mural.</p>
               )}
              <Button variant="outline" className="mt-2 h-10" onClick={() => update({ view: "room" })}>
                <Camera />
                See it in my room
              </Button>
            </>
          ) : (
            <MyRoom design={design} selection={selection} designerName={designer.name} onAskFit={(w) => { setPrefill(oversizePrefill(design.title, w, muralMaxLabel(design, selection))); setChatOpen(true); }} />
          )}
        </div>
         <aside className="min-w-0 space-y-5">
          <div className="space-y-4">
            <AskDesignerButton onClick={() => ask()} /><RequestChange design={design} designer={designer} open={chatOpen} onOpenChange={setChatOpen} prefill={prefill} trigger={false} /><OversizePopup open={popup} onOpenChange={setPopup} max={muralMaxLabel(design, selection)} title={design.title} designer={designer.name} onAsk={() => ask(true)} />
          </div>
           <div className="space-y-5 border-t border-border pt-5">
            <WallMeasurements selection={selection} onChange={change} />
            <SizeNotice design={design} designer={designer} selection={selection} onContact={() => ask(true)} />
            <MatchFixed design={design as any} className="mt-1" />
            {material && mounted && (
              <MaterialSelector
                material={material}
                options={materials}
                design={design}
                selection={selection}
                onChange={(finish) => update({ finish })}
              />
            )}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-sm">Print estimate</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sqft.toFixed(1)} sq ft / {(sqft / 10.7639).toFixed(2)} m²
                </p>
              </div>
              <p className="text-2xl font-semibold">{money(sqft * unitPrice(design, material))}</p>
            </div>
            {tooBig ? (
              <Button className="h-12 w-full" data-testid="fit-cta" onClick={() => ask(true)}>
                <Pencil />
                Ask the designer to make it fit
              </Button>
            ) : (
              <>
              <Button
                className="h-12 w-full"
                data-testid="add-to-cart"
                onClick={() => {
                  if (!material) return;
                  const line = { design: design.slug, finish: material.id, selection: { ...selection, color: search.color } };
                  if (editLine) { cart.update(editLine.id, line); void navigate({ to: "/cart" }); return; }
                  if (sameInCart.length && !askWall) { setAskWall(true); return; }
                  cart.add(line);
                  void navigate({ to: "/cart" });
                }}
              >
                <ShoppingBag />
                {editLine ? `Update ${editLine.name ?? "cart"}` : "Add to cart"}
                <ArrowRight />
              </Button>
              {askWall && !editLine && material && <div role="dialog" aria-label="Already in your cart" data-testid="add-wall-choice" className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
                <p>{design.title} is already in your cart. Is this for another wall?</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => { const n = sameInCart.length; sameInCart.forEach((it, k) => !it.name && cart.update(it.id, { name: `Wall ${k + 1}` })); cart.add({ design: design.slug, finish: material.id, selection: { ...selection, color: search.color }, name: `Wall ${n + 1}` }); void navigate({ to: "/cart" }); }}>Add as another wall</Button>
                  <Button size="sm" variant="outline" onClick={() => { const last = sameInCart[sameInCart.length - 1]; cart.update(last.id, { finish: material.id, selection: { ...selection, color: search.color } }); void navigate({ to: "/cart" }); }}>Replace{sameInCart.length > 1 ? ` ${sameInCart[sameInCart.length - 1].name ?? "last"}` : ""}</Button>
                </div>
              </div>}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
