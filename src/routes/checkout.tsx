import { ensureShop, useLiveDesigns } from "@/lib/shop";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCircle2, Loader2, Lock, ArrowLeft } from "lucide-react";
import { shopPage, shopCard, shopInput, shopLabel, shopHint, shopPrimary, shopSecondary, shopBar, ShopTrust, SummaryRow } from "@/components/shop-ui";
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
  head: () => ({ meta: [{ title: "Checkout — Artisan Mural" }, { name: "description", content: "Sign in, add your shipping address and place your made-to-measure wallpaper order." }, { property: "og:title", content: "Checkout — Artisan Mural" }, { property: "og:description", content: "Review your cart and place your wallpaper order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
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
  useEffect(() => { if (session) api("account/me").then((a) => { setAcct(a); const first = a?.addresses?.[0]; if (first) { setAddr((cur: any) => cur ?? first); setState((s) => s || first.state || ""); } }).catch(() => setAcct(null)); }, [session?.user.id]);
  useEffect(() => { if (session && total > 0) api("account/quote", { body: { subtotal: total, coupon: appliedCoupon, state, useCredit } }).then(setQ).catch(() => setQ(null)); }, [session?.user.id, total, appliedCoupon, state, useCredit]);
  const due = q ? q.due : total;

  if (placed) return <div className={shopPage + " -mb-24 pb-16"}><div className="mx-auto max-w-xl px-4 py-14 sm:py-20"><div className={shopCard + " px-6 py-10 text-center sm:px-10"}><span className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-clay"><CheckCircle2 className="h-8 w-8" /></span><h1 className="mt-5 font-display text-[40px] leading-tight sm:text-5xl">Thank you — your order is in</h1><p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Our studio checks your print files and emails a print proof and secure payment link to {placed.email}. Printing starts once you approve and pay.</p><p className="mt-6 text-3xl font-semibold tabular-nums">{money(placed.total)}</p><div className="mt-8 grid gap-3 sm:grid-cols-2"><Link to="/browse" className={shopSecondary + " h-12"}>Keep browsing</Link><Link to="/account" className={shopPrimary}>My orders</Link></div></div></div></div>;
  if (lines.length === 0) return <div className={shopPage + " -mb-24 pb-16"}><div className="mx-auto max-w-lg px-6 py-24 text-center"><div className={shopCard + " px-6 py-12"}><h1 className="font-display text-4xl">Your cart is empty</h1><p className="mt-3 text-sm text-muted-foreground">Choose a wallpaper, enter your wall size and add it to your cart.</p><Link to="/browse" className={shopPrimary + " mt-6 w-auto"}>Browse wallpaper</Link></div></div></div>;
  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "");
    const big = lines.find(l => repeatStyle(l.d!) === "none" && sizeIssue(l.d!, l.selection));
    if (big) { setError(`Your wall is bigger than ${big.d!.title} was made for. Don't worry, we can fix it: open it from your cart and tap "Ask the designer to make it fit".`); return; }
    setBusy(true); setError("");
    try {
      const r = await create({ data: { items: lines.map(l => ({ design: l.design, finish: l.finish, selection: l.selection, ...(l.name ? { name: l.name } : {}) })), name: v("name"), phone: v("phone"), address: [v("address"), v("city"), v("state"), v("postal"), v("country")].filter(Boolean).join(", "), notes: v("notes") } });
      let fin: any = null;
      try { fin = await api("account/finalize", { body: { cartId: r.cartId, coupon: appliedCoupon, state: v("state"), useCredit } }); } catch {} if (fin?.firstOrder) try { localStorage.removeItem("am-welcome-code"); localStorage.setItem("am-popup-hide-until", String(Date.now() + 365 * 864e5)); } catch {}
      cart.clear(); setPlaced({ total: fin ? fin.due : r.total, email: r.email }); window.scrollTo({ top: 0 });
    } catch (err) { setError(plainError(err, "Your order could not be placed.")); }
    finally { setBusy(false); }
  }
  const field = shopInput;
  const step = (n: number, done?: boolean) => <span className={"grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold " + (done ? "bg-clay text-clay-foreground" : "bg-accent text-clay")}>{done ? <Check className="size-3.5" strokeWidth={3} /> : n}</span>;
  const secHead = (n: number, title: string, sub?: string) => <div className="flex items-start gap-3">{step(n)}<div><h2 className="font-display text-[24px] leading-tight">{title}</h2>{sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}</div></div>;
  return <div className={shopPage + " -mb-24 pb-16"} data-testid="checkout-page">{session && <style>{"@media (max-width:1023.98px){footer{padding-bottom:calc(84px + env(safe-area-inset-bottom))}}"}</style>}
   <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
    <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to cart</Link>
    <p className="mt-5 text-eyebrow text-clay">Secure checkout</p>
    <h1 className="mt-1.5 font-display text-[40px] leading-tight sm:text-5xl">Checkout</h1>
    <ol className="mt-4 flex items-center gap-x-3 text-[13px] text-muted-foreground sm:gap-x-2" aria-label="Order steps">
      <li className="flex items-center gap-2">{step(1, true)}<span className="font-medium text-foreground">Cart</span></li><li aria-hidden className="hidden h-px w-8 bg-border sm:block" />
      <li className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-clay text-[13px] font-semibold text-clay-foreground">2</span><span className="font-medium text-foreground">Details</span></li><li aria-hidden className="hidden h-px w-8 bg-border sm:block" />
      <li className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full border border-border bg-card text-[13px] font-semibold">3</span><span>Proof &amp; payment</span></li>
    </ol>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      {!session ? <div className={shopCard + " p-5 sm:p-8"}><h2 className="font-display text-[28px] leading-tight">Sign in to place your order</h2><p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Your account keeps your orders, delivery status and designer chats in one place. Your cart is saved.</p><div className="mt-2"><AuthPanel /></div></div> :
      <form id="checkout-form" onSubmit={submit} className="min-w-0 space-y-4">
        <div className={shopCard + " space-y-5 p-5 sm:p-7"}>{secHead(1, "Contact", `Signed in as ${session.user.email}`)}<div className="grid gap-4 sm:grid-cols-2"><label className={shopLabel}>Full name<input name="name" required maxLength={100} autoComplete="name" placeholder="First and last name" className={field} /></label><label className={shopLabel}>Phone (for delivery)<input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Optional" className={field} /><span className={shopHint}>Only used by the delivery company.</span></label></div></div>
        <div className={shopCard + " space-y-5 p-5 sm:p-7"}>{secHead(2, "Shipping address", "Where should we send your wallpaper?")}
          {(acct?.addresses ?? []).length > 0 && <div className="flex flex-wrap gap-2">{acct.addresses.map((a: any) => <button key={a.id} type="button" aria-pressed={addr?.id === a.id} className={"inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition " + (addr?.id === a.id ? "border-clay bg-accent text-clay" : "border-border bg-card text-foreground hover:border-[oklch(0.7_0.02_220)]")} onClick={() => { setAddr(a); setState(a.state || ""); }}>{addr?.id === a.id && <Check className="size-3.5" strokeWidth={3} />}{a.label}</button>)}</div>}
          <div key={addr?.id ?? "new"} className="space-y-4"><label className={shopLabel}>Street address<input name="address" required maxLength={300} autoComplete="street-address" placeholder="House number and street" className={field} defaultValue={addr?.address ?? ""} /></label><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className={shopLabel}>City<input name="city" required maxLength={100} autoComplete="address-level2" className={field} defaultValue={addr?.city ?? ""} /></label><label className={shopLabel}>State<input name="state" maxLength={40} autoComplete="address-level1" className={field} defaultValue={addr?.state ?? ""} onBlur={(e) => setState(e.target.value)} /><span className={shopHint}>Used for sales tax.</span></label><label className={shopLabel}>Postal code<input name="postal" required maxLength={20} autoComplete="postal-code" className={field} defaultValue={addr?.postal ?? ""} /></label><label className={shopLabel}>Country<input name="country" required maxLength={80} autoComplete="country-name" className={field} defaultValue={addr?.country ?? ""} /></label></div></div><label className={shopLabel}>Notes for our studio <span className="font-normal text-muted-foreground">(optional)</span><textarea name="notes" maxLength={1000} placeholder="Delivery times, wall details, anything we should know" className={field + " min-h-24 py-3 leading-relaxed"} /></label></div>
        <div className={shopCard + " space-y-4 p-5 sm:p-7"}>{secHead(3, "Payment")}<div className="flex gap-3 rounded-xl border border-border bg-secondary/60 p-4"><Lock className="mt-0.5 size-4 shrink-0 text-clay" /><p className="text-sm leading-relaxed text-foreground/85" data-testid="checkout-payment-note">No payment is taken yet. We email a print proof and secure payment link; printing starts after you approve and pay.</p></div></div>
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        <div className={shopBar + " flex items-center gap-3"} data-testid="checkout-bar"><div className="min-w-0 lg:hidden"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold tabular-nums leading-tight">{money(due)}</p></div><button type="submit" disabled={busy} className={shopPrimary + " h-[52px] min-w-0 flex-1"}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}{busy ? "Placing order…" : <><span className="lg:hidden">Place order</span><span className="hidden lg:inline">{`Place order · ${money(due)}`}</span></>}</button></div>
      </form>}
      <aside className={shopCard + " min-w-0 space-y-4 p-5 sm:p-6 lg:sticky lg:top-24 max-lg:order-first"} data-testid="checkout-summary">
        <h2 className="font-display text-[26px] leading-tight">Order summary <span className="font-sans text-base font-normal text-muted-foreground">({lines.length})</span></h2>
        {lines.map(l => <div key={l.id} className="flex gap-3 text-sm"><img src={l.d!.image} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border/70 object-cover" /><div className="min-w-0 flex-1"><p className="font-medium">{l.d!.title}{l.name ? <span className="font-normal text-muted-foreground"> · {l.name}</span> : null}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{colorOf(l.d, l.selection.color) ? `${colorOf(l.d, l.selection.color)!.name} · ` : ""}{l.selection.width} × {l.selection.height} {l.selection.unit} · <span className="tabular-nums">{orderSqft(l.selection).toFixed(1)} sq ft</span> · {l.m!.name}</p></div><p className="shrink-0 font-medium tabular-nums">{money(orderSqft(l.selection) * unitPrice(l.d, l.m))}</p></div>)}
        {session && <div className="space-y-2 border-t border-border pt-4">
          <div className="flex gap-2"><input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Discount code" aria-label="Discount code" className={field.replace("mt-1.5 ", "") + " h-11 min-w-0 flex-1 uppercase placeholder:normal-case"} /><button type="button" className={shopSecondary} onClick={() => setAppliedCoupon(coupon.trim())}>Apply</button></div>
          {q?.couponError && <p className="text-xs text-destructive">{q.couponError}</p>}
          {acct?.credit > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--clay)]" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />Use my store credit ({money(acct.credit)})</label>}
        </div>}
        <div className="space-y-2.5 border-t border-border pt-4 text-sm">
          <SummaryRow label="Subtotal" value={money(total)} />
          {q?.special > 0 && <SummaryRow label={q.proName ? `${q.proName} discount (${q.proPct}%)` : "Your special price"} value={`−${money(q.special)}`} />}
          {q?.couponDiscount > 0 && <SummaryRow label={q.couponLabel ?? `Code ${q.coupon}`} value={`−${money(q.couponDiscount)}`} />}
          {q && <SummaryRow label="Shipping" value={q.shipping ? money(q.shipping) : "Free"} />}
          {q?.tax > 0 && <SummaryRow label={q.taxLabel} value={money(q.tax)} />}
          {q?.credit > 0 && <SummaryRow label="Store credit" value={`−${money(q.credit)}`} />}
          {q?.netTerms && <p className="text-xs text-muted-foreground">Your account can pay by invoice (net terms).</p>}
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-4"><p className="text-sm font-medium">Total</p><p className="text-3xl font-semibold tabular-nums">{money(due)}</p></div>
        <ShopTrust className="border-t border-border pt-4" />
      </aside>
    </div>
   </div>
  </div>;
}
