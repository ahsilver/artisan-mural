import { ensureShop, useLiveDesigns } from "@/lib/shop";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { cart, useCart } from "@/lib/cart";
import { unitPrice, designBySlug, materials, money, designRate, withColorway, colorOf } from "@/lib/catalog";
import { orderSqft, repeatStyle, sizeIssue } from "@/lib/wall-selection";
import { createCartOrder } from "@/lib/orders.functions";
import { api } from "@/components/bo/common";
import { useEffect } from "react";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/checkout")({
  loader: ({ context }) => ensureShop(context.queryClient),
  head: () => ({ meta: [{ title: "Checkout — Artisan Murals" }, { name: "description", content: "Sign in, add your shipping address and place your made-to-measure wallpaper order." }, { property: "og:title", content: "Checkout — Artisan Murals" }, { property: "og:description", content: "Review your cart and place your wallpaper order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function Checkout() {
  const items = useCart();
  useLiveDesigns(); // registers uploaded designs on the client after a hard reload
  const { session, loading } = useSession();
  const create = useServerFn(createCartOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<{ total: number; email: string } | null>(null);
  const lines = items.map(i => { const d0 = designBySlug(i.design); return { ...i, d: d0 ? withColorway(d0, i.selection.color) : undefined, m: materials.find(m => m.id === i.finish) }; }).filter(l => l.d && l.m);
  const total = lines.reduce((n, l) => n + orderSqft(l.selection) * unitPrice(l.d, l.m), 0);
  const [acct, setAcct] = useState<any>(null);
  const [coupon, setCoupon] = useState(""); const [appliedCoupon, setAppliedCoupon] = useState("");
  useEffect(() => { try { const w = localStorage.getItem("am-welcome-code"); if (w) { setCoupon(w); setAppliedCoupon(w); } } catch {} }, []);
  const [useCredit, setUseCredit] = useState(true);
  const [state, setState] = useState("");
  const [q, setQ] = useState<any>(null);
  const [addr, setAddr] = useState<any>(null);
  const [sameBill, setSameBill] = useState(true);
  useEffect(() => { if (session) api("account/me").then((a) => { setAcct(a); const first = a?.addresses?.[0]; if (first) { setAddr((cur: any) => cur ?? first); setState((s) => s || first.state || ""); } }).catch(() => setAcct(null)); }, [session?.user.id]);
  useEffect(() => { if (session && total > 0) api("account/quote", { body: { subtotal: total, coupon: appliedCoupon, state, useCredit } }).then(setQ).catch(() => setQ(null)); }, [session?.user.id, total, appliedCoupon, state, useCredit]);
  const due = q ? q.due : total;

  const crumbs = (here: string) => <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/cart">Cart</Link><span>/</span><b>{here}</b></nav></div>;
  if (placed) return <div className="am">{crumbs("Order placed")}<section className="pg auth-page"><div className="sa-done co-placed"><span className="pill ok">Order received</span><b>Thank you. Your order is in.</b><p>We emailed a confirmation to {placed.email}. Next we send you a print proof and a secure payment link; printing starts after you approve and pay. Total {money(placed.total)}.</p><div className="up-row"><Link className="btn btn-wine btn-sm" to="/account">My orders</Link><Link className="btn optline btn-sm" to="/browse">Keep shopping</Link></div></div></section></div>;
  if (lines.length === 0) return <div className="am">{crumbs("Checkout")}<section className="pg auth-page"><div className="sa-done"><b>Your cart is empty</b><p>Choose a wallpaper, enter your wall size and add it to your cart.</p><Link className="btn btn-wine btn-sm" to="/browse">Browse designs</Link></div></section></div>;
  if (loading) return <div className="am"><p className="pg hint" style={{ padding: "60px 20px" }}>Loading…</p></div>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "");
    const big = lines.find(l => repeatStyle(l.d!) === "none" && sizeIssue(l.d!, l.selection));
    if (big) { setError(`Your wall is bigger than ${big.d!.title} was made for. Don't worry, we can fix it: open it from your cart and tap "Ask the designer to make it fit".`); return; }
    setBusy(true); setError("");
    try {
      const r = await create({ data: { items: lines.map(l => ({ design: l.design, finish: l.finish, selection: l.selection, ...(l.name ? { name: l.name } : {}) })), name: v("name"), phone: v("phone"), address: [v("address"), v("city"), v("state"), v("postal"), v("country")].filter(Boolean).join(", "), ...(sameBill ? {} : { billing: [v("bname"), v("baddress"), v("bcity"), v("bstate"), v("bpostal"), v("bcountry")].filter(Boolean).join(", ") }), notes: v("notes") } });
      void fetch("/backend/orders-placed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartId: (r as any)?.cartId }) }).catch(() => {});
      let fin: any = null;
      try { fin = await api("account/finalize", { body: { cartId: r.cartId, coupon: appliedCoupon, state: v("state"), useCredit } }); } catch {} if (fin?.firstOrder) try { localStorage.removeItem("am-welcome-code"); localStorage.setItem("am-popup-hide-until", String(Date.now() + 365 * 864e5)); } catch {}
      cart.clear(); setPlaced({ total: fin ? fin.due : r.total, email: r.email }); window.scrollTo({ top: 0 });
    } catch (err) { setError(plainError(err, "Your order could not be placed.")); }
    finally { setBusy(false); }
  }
  const head = (n: number, title: string) => <header><span className="n">{n}</span><h2>{title}</h2></header>;
  return <div className="am" data-testid="checkout-page">
    {crumbs("Checkout")}
    <section className="pg co-wrap">
      <div className="co-main">
        <div className="co-head"><h1>Checkout</h1><span className="co-secure"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Secure checkout</span></div>
        {!session ? <section className="co-step">{head(1, "Sign in to place your order")}<div className="co-body"><p className="co-signin">Your account keeps your orders, delivery status and designer chats in one place. Your cart is saved.</p><AuthPanel kicker="" title="" sub="" cta="Continue" /></div></section> :
        <form id="checkout-form" onSubmit={submit} className="co-form">
          <section className="co-step">{head(1, "Contact")}<div className="co-body">
            <p className="co-signin">Signed in as {session.user.email}</p>
            <div className="co-grid"><label className="cf"><span>Full name</span><input name="name" required maxLength={100} autoComplete="name" placeholder="First and last name" /></label><label className="cf"><span>Phone <small>(for delivery)</small></span><input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Optional" /></label></div>
          </div></section>
          <section className="co-step">{head(2, "Shipping address")}<div className="co-body">
            {(acct?.addresses ?? []).length > 0 && <div className="co-opts co-addr" role="radiogroup" aria-label="Saved addresses">{acct.addresses.map((a: any) => <button key={a.id} type="button" role="radio" aria-checked={addr?.id === a.id} onClick={() => { setAddr(a); setState(a.state || ""); }}><b>{a.label}</b><small>{[a.address, a.city].filter(Boolean).join(", ")}</small></button>)}</div>}
            <div key={addr?.id ?? "new"} className="co-grid">
              <label className="cf w2"><span>Street address</span><input name="address" required maxLength={300} autoComplete="street-address" placeholder="House number and street" defaultValue={addr?.address ?? ""} /></label>
              <label className="cf"><span>City</span><input name="city" required maxLength={100} autoComplete="address-level2" defaultValue={addr?.city ?? ""} /></label>
              <label className="cf"><span>State <small>(for sales tax)</small></span><input name="state" maxLength={40} autoComplete="address-level1" defaultValue={addr?.state ?? ""} onBlur={(e) => setState(e.target.value)} /></label>
              <label className="cf"><span>Postal code</span><input name="postal" required maxLength={20} autoComplete="postal-code" defaultValue={addr?.postal ?? ""} /></label>
              <label className="cf"><span>Country</span><input name="country" required maxLength={80} autoComplete="country-name" defaultValue={addr?.country ?? ""} /></label>
              <label className="cf w2"><span>Notes for our studio <small>(optional)</small></span><textarea name="notes" maxLength={1000} rows={3} placeholder="Delivery times, wall details, anything we should know" /></label>
            </div>
            <label className="co-check"><input type="checkbox" checked={sameBill} onChange={(e) => setSameBill(e.target.checked)} /><span>Billing address is the same as shipping</span></label>
            {!sameBill && <div className="co-grid"><b className="w2 co-sub">Billing address</b>
              <label className="cf w2"><span>Name on the bill</span><input name="bname" required maxLength={100} autoComplete="billing name" /></label>
              <label className="cf w2"><span>Street address</span><input name="baddress" required maxLength={300} autoComplete="billing street-address" /></label>
              <label className="cf"><span>City</span><input name="bcity" required maxLength={100} autoComplete="billing address-level2" /></label>
              <label className="cf"><span>State</span><input name="bstate" maxLength={40} autoComplete="billing address-level1" /></label>
              <label className="cf"><span>Postal code</span><input name="bpostal" required maxLength={20} autoComplete="billing postal-code" /></label>
              <label className="cf"><span>Country</span><input name="bcountry" required maxLength={80} autoComplete="billing country-name" /></label>
            </div>}
          </div></section>
          <section className="co-step">{head(3, "Proof & payment")}<div className="co-body">
            <p className="co-test" data-testid="checkout-payment-note">No payment is taken yet. We email a print proof and a secure payment link; printing starts after you approve and pay.</p>
            {error && <p className="co-err" role="alert">{error}</p>}
            <button className="btn btn-wine big" type="submit" disabled={busy}>{busy ? "Placing your order…" : `Place order · ${money(due)}`}</button>
          </div></section>
        </form>}
      </div>
      <aside className="co-side" data-testid="checkout-summary"><div className="co-sumcard">
        <h2>Order summary <small>({lines.length})</small></h2>
        <div className="co-items">{lines.map((l) => <div key={l.id} className="co-it"><img src={l.d!.image} alt="" /><div><b>{l.d!.title}</b><small>{l.selection.width} × {l.selection.height} {l.selection.unit} · {l.m!.name}{colorOf(l.d!, l.selection.color) ? ` · ${colorOf(l.d!, l.selection.color)!.name}` : ""}</small></div><b>{money(orderSqft(l.selection) * unitPrice(l.d!, l.m!))}</b></div>)}</div>
        {session && <><div className="co-promo"><input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Promo or Artisan Pro code" aria-label="Discount code" /><button type="button" className="btn optline btn-sm" onClick={() => setAppliedCoupon(coupon.trim())}>Apply</button></div>
          {q?.couponError && <p className="co-promo-msg err">{q.couponError}</p>}
          {acct?.credit > 0 && <label className="co-check"><input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /><span>Use my store credit ({money(acct.credit)})</span></label>}</>}
        <div className="co-rows">
          <div><span>Subtotal</span><b>{money(total)}</b></div>
          {q?.special > 0 && <div><span>{q.proName ? `${q.proName} discount (${q.proPct}%)` : "Your special price"}</span><b>−{money(q.special)}</b></div>}
          {q?.couponDiscount > 0 && <div><span>{q.couponLabel ?? `Code ${q.coupon}`}</span><b>−{money(q.couponDiscount)}</b></div>}
          <div><span>Delivery</span><b>{q ? (q.shipping ? money(q.shipping) : "Free") : "Calculated next"}</b></div>
          {q?.tax > 0 && <div><span>{q.taxLabel}</span><b>{money(q.tax)}</b></div>}
          {q?.credit > 0 && <div><span>Store credit</span><b>−{money(q.credit)}</b></div>}
          <div className="tot"><span>Total</span><b>{money(due)}</b></div>
        </div>
        {q?.netTerms && <p className="co-trust">Your account can pay by invoice (net terms).</p>}
        <p className="co-trust">Printed to order · You approve a proof first · Secure payment</p>
      </div></aside>
    </section>
  </div>;
}
