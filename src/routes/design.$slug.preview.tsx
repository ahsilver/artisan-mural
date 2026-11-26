import { MatchFixed } from "@/components/designer/match-info";
import { orderSqft } from "@/lib/wall-selection";
import { cart, useCart } from "@/lib/cart";
import { ensureShop } from "@/lib/shop";
import { getShopDesign } from "@/lib/shop.functions";
import { isHidden } from "@/lib/catalog";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Image, Pencil, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SizeStudio } from "@/components/storefront/size-studio";
import { MyRoom } from "@/components/my-room";
import { WallMeasurements } from "@/components/wall-measurements";
import { MaterialSelector } from "@/components/material-selector";
import { SizeNotice, muralMaxLabel } from "@/components/size-notice";
import { AskDesignerButton, OversizePopup, oversizePrefill, useOversizePrompt, wallLabel, type RequestPrefill } from "@/components/oversize";
import { RequestChange } from "@/components/projects";
import { unitPrice, withColorway, designBySlug, designerBySlug, materials as allMaterials, offeredFinishes, recommendedOf, money, designRate } from "@/lib/catalog";
import { useEffect, useState } from "react";
import { StorefrontSprite } from "@/components/storefront/icons";
import { pic } from "@/lib/pics";
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
  const rate = unitPrice(design, material);
  const addToCart = () => {
    if (!material) return;
    const line = { design: design.slug, finish: material.id, selection: { ...selection, color: search.color } };
    if (editLine) { cart.update(editLine.id, line); void navigate({ to: "/cart" }); return; }
    if (sameInCart.length && !askWall) { setAskWall(true); return; }
    cart.add(line);
    void navigate({ to: "/cart" });
  };
  const thumb = pic(design, design.image, [320])?.src ?? design.image;
  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/design/$slug" params={{ slug: design.slug }} search={{ ...selection, color: search.color }}>{design.title}</Link><span>/</span><b>Customize &amp; order</b></nav></div>
      <section className="pg sz">
        <div className="sz-head">
          <div><span className="k">{tab === "room" ? "See it in your room" : "Step 2 · Made for your wall"}</span><h1>Your wall, <span>your size.</span></h1></div>
          <ol className="sz-steps"><li className="on">Wall size</li><li className="on">Size &amp; crop</li><li>Add to cart</li></ol>
        </div>
        <SizeStudio
          design={design} designerName={designer.name} title={design.title} thumb={thumb} colorName={colorway?.name}
          selection={selection} onChange={change}
          materials={mounted ? materials : []} material={material} onMaterial={(id) => update({ finish: id })}
          addLabel={editLine ? `Update ${editLine.name ?? "cart"}` : "Add to cart"} onAdd={addToCart} onChat={(fit) => ask(fit)}
          changeHref={<Link to="/design/$slug" params={{ slug: design.slug }} search={{ color: search.color }}>Change</Link>}
          tryAnother={<Link to="/browse">Try another design</Link>}
          stageOverride={tab === "room" ? <><MyRoom design={design} selection={selection} designerName={designer.name} onAskFit={(w) => { setPrefill(oversizePrefill(design.title, w, muralMaxLabel(design, selection))); setChatOpen(true); }} /><p className="hint"><button type="button" className="up-link" onClick={() => update({ view: "artwork" })}>← Back to your wall</button></p></> : undefined}
          below={<>
            {askWall && !editLine && material && (
              <div className="notice" role="dialog" aria-label="Already in your cart" data-testid="add-wall-choice">
                <b>{design.title} is already in your cart.</b><p>Is this for another wall?</p>
                <div className="notice-opts">
                  <button type="button" className="btn btn-wine btn-sm" onClick={() => { const n = sameInCart.length; sameInCart.forEach((it, k) => !it.name && cart.update(it.id, { name: `Wall ${k + 1}` })); cart.add({ design: design.slug, finish: material.id, selection: { ...selection, color: search.color }, name: `Wall ${n + 1}` }); void navigate({ to: "/cart" }); }}>Yes, another wall</button>
                  <button type="button" className="btn btn-sm optline" onClick={() => { const last = sameInCart[sameInCart.length - 1]!; cart.update(last.id, { finish: material.id, selection: { ...selection, color: search.color } }); void navigate({ to: "/cart" }); }}>Replace it</button>
                </div>
              </div>
            )}
            <RequestChange design={design} designer={designer} open={chatOpen} onOpenChange={setChatOpen} prefill={prefill} trigger={false} />
          </>}
        />
      </section>
    </div>
  );
}
