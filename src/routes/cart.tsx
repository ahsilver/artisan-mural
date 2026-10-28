import { ensureShop, useLiveDesigns } from "@/lib/shop";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { shopPage, shopCard, shopPrimary, shopSecondary, shopQuiet, shopBar, ShopTrust, SummaryRow } from "@/components/shop-ui";
import { MuralFramer } from "@/components/mural-framer";
import { cart, useCart } from "@/lib/cart";
import { useProMe, useProSettings } from "@/lib/pro";
import { unitPrice, designBySlug, materials, money, designRate, withColorway, colorOf, swatchStyle } from "@/lib/catalog";
import { orderSqft, repeatStyle, sizeIssue } from "@/lib/wall-selection";
import { muralMaxLabel } from "@/components/size-notice";

export const Route = createFileRoute("/cart")({
  loader: ({ context }) => ensureShop(context.queryClient),
  head: () => ({ meta: [{ title: "Your cart — Artisan Mural" }, { name: "description", content: "Review the made-to-measure wallpapers in your cart before checkout." }, { property: "og:title", content: "Your cart — Artisan Mural" }, { property: "og:description", content: "Your selected wallpapers, sizes and finishes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const items = useCart();
  const navigate = useNavigate();
  const anotherWall = (l: { id: string; design: string; finish: string; selection: any }) => { const id = cart.duplicate(l.id); if (id) void navigate({ to: "/design/$slug/preview", params: { slug: l.design }, search: { ...l.selection, finish: l.finish, line: id } }); };
  useLiveDesigns(); // registers uploaded designs on the client after a hard reload
  const lines = items.map(i => { const d = designBySlug(i.design); return { ...i, d: d ? withColorway(d, i.selection.color) : undefined, m: materials.find(m => m.id === i.finish) }; }).filter(l => l.d && l.m);
  const tooBigLine = (l: (typeof lines)[number]) => repeatStyle(l.d!) === "none" && !!sizeIssue(l.d!, l.selection);
  const anyBig = lines.some(tooBigLine);
  const total = lines.reduce((n, l) => n + orderSqft(l.selection) * unitPrice(l.d, l.m), 0);
  if (lines.length === 0) return <div className={shopPage + " -mb-24 pb-16"}><div className="mx-auto max-w-lg px-6 py-24 text-center"><div className={shopCard + " px-6 py-12"}><h1 className="font-display text-4xl">Your cart is empty</h1><p className="mt-3 text-sm text-muted-foreground">Pick a design, enter your wall size and choose "Add to cart".</p><Link to="/browse" className={shopPrimary + " mt-6 w-auto"}>Browse wallpaper</Link></div></div></div>;
  return <div className={shopPage + " -mb-24 pb-16"} data-testid="cart-page"><style>{"@media (max-width:1023.98px){footer{padding-bottom:calc(84px + env(safe-area-inset-bottom))}}"}</style>
   <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <p className="text-eyebrow text-clay">Your order</p>
    <h1 className="mt-1.5 font-display text-[40px] leading-tight sm:text-5xl">Your cart</h1>
    <p className="mt-1.5 text-[15px] text-muted-foreground">{lines.length} {lines.length === 1 ? "wall" : "walls"} · each printed to the exact size you entered</p>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
    <div className="min-w-0 space-y-4">
      {lines.map(l => { const sqft = orderSqft(l.selection); const cw = colorOf(l.d, l.selection.color); return <div key={l.id} className={shopCard + " grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-4 p-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6 sm:p-5"} data-testid="cart-line">
        <div className="min-w-0 self-start overflow-hidden rounded-xl bg-secondary/60"><MuralFramer design={l.d!} selection={l.selection} compact /></div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><div className="min-w-0">{(l.name || lines.filter((x) => x.design === l.design).length > 1) && <input aria-label="Wall name" data-testid="wall-name" defaultValue={l.name ?? ""} placeholder="Wall name" maxLength={40} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (l.name ?? "")) cart.update(l.id, { name: v || undefined }); }} className="mb-1 w-44 max-w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 -ml-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-clay hover:border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15" />}<p className="font-display text-[22px] leading-tight sm:text-[26px]">{l.d!.title}</p>{cw ? <p className="mt-1.5 flex items-center gap-1.5 text-sm text-foreground/85" data-testid="cart-color"><span className="inline-block h-3.5 w-3.5 rounded-full border border-border" style={swatchStyle(cw)} />Color: {cw.name}</p> : null}</div><p className="shrink-0 text-lg font-semibold tabular-nums sm:text-xl">{money(sqft * unitPrice(l.d, l.m))}</p></div>
          <dl className="mt-3 flex flex-wrap gap-1.5 text-[13px]"><div className="rounded-full bg-secondary px-2.5 py-1"><dt className="sr-only">Size</dt><dd className="tabular-nums">{l.selection.width} × {l.selection.height} {l.selection.unit}</dd></div><div className="rounded-full bg-secondary px-2.5 py-1"><dt className="sr-only">Area</dt><dd className="tabular-nums">{sqft.toFixed(1)} sq ft</dd></div><div className="rounded-full bg-secondary px-2.5 py-1"><dt className="sr-only">Finish</dt><dd>{l.m!.name}</dd></div>{repeatStyle(l.d!) === "both" && <div className="rounded-full bg-secondary px-2.5 py-1" data-testid="cart-match"><dt className="sr-only">Match</dt><dd>Match: {(l.d as any).match === "halfdrop" ? "Half-drop" : "Straight"}</dd></div>}</dl>
          {tooBigLine(l) && <p role="status" data-testid="cart-oversize" className="mt-3 rounded-xl border border-[#E5E7EB] bg-accent/40 px-3 py-2.5 text-[13.5px] leading-snug">This mural is made for walls up to {muralMaxLabel(l.d!, l.selection) ?? "its original size"}. Don't worry, we can fix it: the designer can make it fit your wall. <Link to="/design/$slug/preview" params={{ slug: l.design }} search={{ ...l.selection, finish: l.finish }} className="font-medium text-primary underline underline-offset-2">Ask the designer to make it fit</Link></p>}
          <div className="mt-auto flex flex-wrap items-center gap-x-1 pt-3 -ml-2.5 sm:pt-4"><Link to="/design/$slug/preview" params={{ slug: l.design }} search={{ ...l.selection, finish: l.finish, line: l.id }} className={shopQuiet}><Pencil />Edit</Link><button type="button" className={shopQuiet} data-testid="add-wall" onClick={() => anotherWall(l)}><Plus />Add another wall</button><button type="button" className={shopQuiet + " hover:text-destructive"} onClick={() => cart.remove(l.id)}><Trash2 />Remove</button></div>
        </div>
      </div>; })}
    </div>
    <aside className={shopCard + " p-5 sm:p-6 lg:sticky lg:top-24"} data-testid="cart-summary">
      <h2 className="font-display text-[26px] leading-tight">Order summary</h2>
      <div className="mt-4 space-y-2.5 text-sm">
        <SummaryRow label={`Subtotal${lines.length > 1 ? ` · ${lines.length} walls` : ""}`} value={money(total)} />
        <SummaryRow label="Shipping" value="At checkout" muted />
        <SummaryRow label="Tax" value="At checkout" muted />
      </div>
      <div className="mt-4 border-t border-border pt-4"><div className="flex items-baseline justify-between gap-4"><p className="text-sm font-medium">Total{lines.length > 1 ? ` · ${lines.length} walls` : ""}</p><p className="text-3xl font-semibold tabular-nums">{money(total)}</p></div><ProLine total={total} /></div>
      <div className={shopBar + " mt-5 flex items-center gap-3"} data-testid="cart-bar">
        <div className="min-w-0 lg:hidden"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold tabular-nums leading-tight">{money(total)}</p></div>
        <div className="min-w-0 flex-1">{anyBig ? <button type="button" className={shopPrimary} disabled title="One design needs the designer to fit your wall first">Checkout<ArrowRight /></button> : <Link to="/checkout" className={shopPrimary} data-testid="cart-checkout">Checkout<ArrowRight /></Link>}</div>
      </div>
      {anyBig && <p className="mt-2 text-[13px] text-muted-foreground">One design needs the designer to fit your wall first.</p>}
      <Link to="/browse" className={shopSecondary + " mt-3 w-full"}>Keep shopping</Link>
      <ShopTrust className="mt-5 border-t border-border pt-5" />
    </aside>
    </div>
   </div>
  </div>;
}

function ProLine({ total }: { total: number }) {
  const { me } = useProMe(); const pro = useProSettings();
  if (!me || me.status !== "approved" || !(me.discountPct > 0)) return null;
  return <p className="mt-1 text-sm text-muted-foreground" data-pro-line><span className="font-medium text-foreground">{pro.name}</span> {me.discountPct}% off: −{money(total * me.discountPct / 100)} · {money(total * (1 - me.discountPct / 100))} before shipping and tax</p>;
}
