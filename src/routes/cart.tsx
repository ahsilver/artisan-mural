import { ownDesign } from "@/lib/own-image";
import { ensureShop, useLiveDesigns } from "@/lib/shop";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { StorefrontSprite } from "@/components/storefront/icons";
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
  const lines = items.map(i => { const d = i.own ? ownDesign(i.own) : designBySlug(i.design); return { ...i, d: d ? withColorway(d, i.selection.color) : undefined, m: materials.find(m => m.id === i.finish) }; }).filter(l => l.d && l.m);
  const tooBigLine = (l: (typeof lines)[number]) => !l.own && repeatStyle(l.d!) === "none" && !!sizeIssue(l.d!, l.selection);
  const anyBig = lines.some(tooBigLine);
  const total = lines.reduce((n, l) => n + orderSqft(l.selection) * unitPrice(l.d, l.m), 0);
  const crumbs = <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Cart</b></nav></div>;
  if (lines.length === 0) return (
    <div className="am"><StorefrontSprite />{crumbs}
      <section className="pg"><div className="pg-head"><span className="k">Your cart</span><h1>Your cart is empty</h1></div>
        <div className="empty-box">Nothing here yet. <Link to="/browse">Browse designs</Link> or <Link to="/custom-request">post a request</Link>.</div>
      </section>
    </div>
  );
  return (
    <div className="am" data-testid="cart-page"><StorefrontSprite />{crumbs}
      <section className="pg">
        <div className="pg-head"><span className="k">Your cart</span><h1>Your cart · {lines.length} {lines.length === 1 ? "wall" : "walls"}</h1></div>
        <div className="cart-grid">
          <div className="cart-items">
            {lines.map((l) => { const sqft = orderSqft(l.selection); const cw = colorOf(l.d, l.selection.color); return (
              <div key={l.id} className="ci ci-big" data-testid="cart-line">
                <div className="ci-crop-pic"><MuralFramer design={l.d!} selection={l.selection} compact /></div>
                <div className="ci-body">
                  {(l.name || lines.filter((x) => x.design === l.design).length > 1) && <input className="ci-name" aria-label="Wall name" data-testid="wall-name" defaultValue={l.name ?? ""} placeholder="Wall name" maxLength={40} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (l.name ?? "")) cart.update(l.id, { name: v || undefined } as any); }} />}
                  <b>{l.own ? <Link to="/own">Your own image · {l.own.filename}</Link> : <Link to="/design/$slug" params={{ slug: l.design }}>{l.d!.title}{cw ? ` · ${cw.name}` : ""}</Link>}</b>
                  <small>{l.selection.width} × {l.selection.height} {l.selection.unit} · {sqft.toFixed(1)} sq ft · {l.m!.name}</small>
                  <small className="ci-crop">Exactly as printed on your wall</small>
                  {tooBigLine(l) && <p role="status" data-testid="cart-oversize" className="notice">This mural is made for walls up to {muralMaxLabel(l.d!, l.selection) ?? "its original size"}. The designer can make it fit: open it and choose “Chat with the designer”.</p>}
                  {l.own ? <span className="ci-act"><button type="button" className="rm" onClick={() => cart.remove(l.id)} aria-label="Remove your own image">Remove</button></span> : <span className="ci-act">
                    <Link className="ed" to="/design/$slug/preview" params={{ slug: l.design }} search={{ ...l.selection, finish: l.finish, line: l.id }}>Edit</Link>
                    <button type="button" className="ed" onClick={() => anotherWall(l)}>Add another wall</button>
                    <button type="button" className="rm" onClick={() => cart.remove(l.id)} aria-label={`Remove ${l.d!.title}`}>Remove</button>
                  </span>}
                </div>
                <strong>{money(sqft * unitPrice(l.d, l.m))}</strong>
              </div>
            ); })}
          </div>
          <aside className="cart-sum" data-testid="cart-summary">
            <div className="cs-row"><span>Subtotal{lines.length > 1 ? ` · ${lines.length} walls` : ""}</span><b>{money(total)}</b></div>
            <div className="cs-row"><span>Shipping</span><b>At checkout</b></div>
            <div className="cs-row"><span>Tax</span><b>At checkout</b></div>
            <div className="cs-row tot"><span>Total</span><b>{money(total)}</b></div>
            <ProLine total={total} />
            {anyBig
              ? <button type="button" className="btn btn-wine big" disabled title="One design needs the designer to fit your wall first">Checkout</button>
              : <Link to="/checkout" className="btn btn-wine big" data-testid="cart-checkout">Checkout</Link>}
            {anyBig && <p className="hint">One design needs the designer to fit your wall first.</p>}
            <Link to="/browse" className="btn optline">Keep shopping</Link>
            <small className="hint">Every wall is printed to order in numbered panels and ships in 5–7 days. Delivery and tax are worked out at checkout.</small>
          </aside>
        </div>
      </section>
    </div>
  );
}

function ProLine({ total }: { total: number }) {
  const { me } = useProMe(); const pro = useProSettings();
  if (!me || me.status !== "approved" || !(me.discountPct > 0)) return null;
  return <p className="hint" data-pro-line><span>{pro.name}</span> {me.discountPct}% off: −{money(total * me.discountPct / 100)} · {money(total * (1 - me.discountPct / 100))} before shipping and tax</p>;
}
