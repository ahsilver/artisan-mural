import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignInPage } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money } from "@/components/projects";

export const Route = createFileRoute("/projects/$id/pay")({
  head: () => ({ meta: [{ title: "Wall size and payment — Artisan Murals" }, { name: "robots", content: "noindex" }] }),
  component: Pay,
});

function Pay() {
  const { id } = Route.useParams();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [f, setF] = useState({ width: "", height: "", unit: "ft", finish: "", name: "", phone: "", address: "", state: "", card: "", exp: "", cardName: "", billing: "" });
  const [price, setPrice] = useState<any>(null);
  const [sameBill, setSameBill] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (session) papi(`projects/${id}`).then((x) => { setP(x); if (x.wallSize) { const m = String(x.wallSize).match(/(\d+(?:\.\d+)?)\s*[x×by]+\s*(\d+(?:\.\d+)?)/i); if (m) setF((v) => ({ ...v, width: m[1], height: m[2] })); } }).catch((e) => setErr(e.message)); }, [session?.user?.id, id]);
  useEffect(() => { if (!session || !p || p.status !== "approved") return; const t = setTimeout(() => papi(`projects/${id}/price`, { width: Number(f.width), height: Number(f.height), unit: f.unit, finish: f.finish, state: f.state }).then((r) => { setPrice(r); if (!f.finish && r.finish) setF((v) => ({ ...v, finish: r.finish })); }).catch(() => {}), 250); return () => clearTimeout(t); }, [f.width, f.height, f.unit, f.finish, f.state, p?.status]);
  const shell = (children: React.ReactNode) => <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/projects">My requests</Link><span>/</span><Link to="/projects/$id" params={{ id }}>{p?.title ?? "Request"}</Link><span>/</span><b>Pay</b></nav></div>{children}</div>;
  if (loading) return shell(<p className="pg hint">Loading…</p>);
  if (!session) return <SignInPage kicker="Payment" title="Sign in to pay" sub="Sign in with the account you used for this request." />;
  if (!p) return shell(<section className="pg">{err ? <p className="rq-ok err">{err}</p> : <p className="hint">Loading…</p>}</section>);
  if (p.status !== "approved") return shell(<section className="pg"><div className="sa-done"><b>{p.status === "in_progress" || p.status === "delivered" ? "This request is already paid." : "Approve a price first."}</b><Link className="btn optline btn-sm" to="/projects/$id" params={{ id }}>Back to the request</Link></div></section>);
  const q = price?.quote;
  const accepted = p.quotes.find((x: any) => x.status === "accepted");
  async function pay(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await papi(`projects/${id}/pay`, { ...f, billing: sameBill ? "" : f.billing, width: Number(f.width), height: Number(f.height) }); await navigate({ to: "/projects/$id", params: { id }, search: { paid: 1 } as any }); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return shell(
    <form className="pg co-wrap" onSubmit={pay}>
      <div className="co-main">
        <div className="co-head"><h1>Your wall &amp; payment</h1><span className="co-secure"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Secure checkout</span></div>
        <p className="hint">{p.title}. You pay the printing and {accepted?.designer ?? "the designer"}'s work together. The designer starts as soon as you pay.</p>
        <section className="co-step"><header><span className="n">1</span><h2>Wall measurements</h2></header><div className="co-body">
          <div className="co-grid"><label className="cf"><span>Width</span><input required inputMode="decimal" value={f.width} onChange={set("width")} /></label><label className="cf"><span>Height</span><input required inputMode="decimal" value={f.height} onChange={set("height")} /></label>
            <label className="cf w2"><span>Unit</span><select value={f.unit} onChange={set("unit")}><option value="ft">feet</option><option value="in">inches</option><option value="cm">cm</option><option value="m">meters</option></select></label></div>
          {price?.sqft > 0 && <p className="hint">{price.sqft} sq ft to print</p>}
        </div></section>
        <section className="co-step"><header><span className="n">2</span><h2>Paper</h2></header><div className="co-body">
          <div className="co-opts" role="radiogroup" aria-label="Paper">{(price?.finishes ?? []).map((m: any) => <button key={m.id} type="button" role="radio" aria-checked={f.finish === m.id} onClick={() => setF({ ...f, finish: m.id })}><b>{m.name}</b><small>{m.adj ? `+${money(m.adj)} / sq ft` : "Included in the price"}</small></button>)}</div>
        </div></section>
        <section className="co-step"><header><span className="n">3</span><h2>Shipping</h2></header><div className="co-body">
          <div className="co-grid"><label className="cf"><span>Full name</span><input required value={f.name} onChange={set("name")} autoComplete="name" /></label><label className="cf"><span>Phone <small>(for delivery)</small></span><input value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
            <label className="cf w2"><span>Address</span><textarea required rows={2} value={f.address} onChange={set("address")} autoComplete="street-address" /></label>
            <label className="cf"><span>State</span><input maxLength={2} value={f.state} onChange={set("state")} placeholder="NY" /></label></div>
        </div></section>
        <section className="co-step"><header><span className="n">4</span><h2>Payment</h2></header><div className="co-body">
          <div className="co-grid"><label className="cf w2"><span>Card number</span><input required inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={f.card} onChange={set("card")} /></label>
            <label className="cf"><span>Expiry</span><input inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" maxLength={7} value={f.exp} onChange={set("exp")} /></label>
            <label className="cf"><span>Name on card</span><input autoComplete="cc-name" maxLength={80} value={f.cardName} onChange={set("cardName")} /></label></div>
          <label className="co-check"><input type="checkbox" checked={sameBill} onChange={(e) => setSameBill(e.target.checked)} /><span>Billing address is the same as shipping</span></label>
          {!sameBill && <label className="cf"><span>Billing address</span><textarea rows={2} maxLength={600} value={f.billing} onChange={set("billing")} autoComplete="billing street-address" /></label>}
          <p className="co-test">Test mode: no card is charged.</p>
          {err && <p className="co-err" role="alert">{err}</p>}
          <button type="submit" className="btn btn-wine big" disabled={busy || !(price?.sqft > 0)}>{busy ? "Paying…" : `Pay ${money(q?.due ?? 0)}`}</button>
        </div></section>
      </div>
      <aside className="co-side"><div className="co-sumcard">
        <h2>Order summary</h2>
        <div className="co-rows">
          <div><span>Printing{price?.sqft > 0 ? ` · ${price.sqft} sq ft × ${money(price.unit)}` : ""}{price?.finishName ? <small> · {price.finishName}</small> : null}</span><b>{money(price?.printing)}</b></div>
          <div><span>Design work · {accepted?.designer}, {p.days} day{p.days === 1 ? "" : "s"}</span><b>{money(p.fee)}</b></div>
          {q?.special > 0 && <div><span>Trade price</span><b>−{money(q.special)}</b></div>}
          <div><span>Delivery</span><b>{q ? (q.shipping ? money(q.shipping) : "Free") : "—"}</b></div>
          {q?.tax > 0 && <div><span>{q.taxLabel}</span><b>{money(q.tax)}</b></div>}
          <div className="tot"><span>Total</span><b>{money(q?.due ?? 0)}</b></div>
        </div>
        <p className="co-trust">After payment the designer starts. Your order shows "Waiting on designer" until the final file is ready, then we print.</p>
      </div></aside>
    </form>
  );
}
