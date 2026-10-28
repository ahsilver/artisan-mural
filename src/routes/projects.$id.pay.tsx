import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money } from "@/components/projects";

export const Route = createFileRoute("/projects/$id/pay")({
  head: () => ({ meta: [{ title: "Wall size and payment — Artisan Mural" }, { name: "robots", content: "noindex" }] }),
  component: Pay,
});

function Pay() {
  const { id } = Route.useParams();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [f, setF] = useState({ width: "", height: "", unit: "ft", finish: "", name: "", phone: "", address: "", state: "", card: "" });
  const [price, setPrice] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (session) papi(`projects/${id}`).then((x) => { setP(x); if (x.wallSize) { const m = String(x.wallSize).match(/(\d+(?:\.\d+)?)\s*[x×by]+\s*(\d+(?:\.\d+)?)/i); if (m) setF((v) => ({ ...v, width: m[1], height: m[2] })); } }).catch((e) => setErr(e.message)); }, [session?.user?.id, id]);
  useEffect(() => { if (!session || !p || p.status !== "approved") return; const t = setTimeout(() => papi(`projects/${id}/price`, { width: Number(f.width), height: Number(f.height), unit: f.unit, finish: f.finish, state: f.state }).then((r) => { setPrice(r); if (!f.finish && r.finish) setF((v) => ({ ...v, finish: r.finish })); }).catch(() => {}), 250); return () => clearTimeout(t); }, [f.width, f.height, f.unit, f.finish, f.state, p?.status]);
  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><AuthPanel /></div>;
  if (!p) return err ? <p className="mx-auto max-w-xl px-6 py-12 text-destructive">{err}</p> : <Loader2 className="mx-auto my-20 animate-spin" />;
  if (p.status !== "approved") return <div className="mx-auto max-w-xl px-6 py-12"><p>{p.status === "in_progress" || p.status === "delivered" ? "This request is already paid." : "Approve a price first."}</p><Link to="/projects/$id" params={{ id }} className="mt-3 inline-block text-sm underline">Back to the request</Link></div>;
  const q = price?.quote; const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const accepted = p.quotes.find((x: any) => x.status === "accepted");
  async function pay(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await papi(`projects/${id}/pay`, { ...f, width: Number(f.width), height: Number(f.height) }); await navigate({ to: "/projects/$id", params: { id }, search: { paid: 1 } as any }); } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
    <Link to="/projects/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to the request</Link>
    <h1 className="mt-4 text-3xl leading-tight sm:text-5xl">Your wall size</h1>
    <p className="mt-2 text-sm text-muted-foreground">{p.title}. Enter the wall to print. You pay the printing and {accepted?.designer ?? "the designer"}'s work together.</p>
    <form onSubmit={pay} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <fieldset><legend className="text-lg font-medium">Wall measurements</legend>
          <div className="mt-3 grid grid-cols-[1fr_1fr_90px] gap-3">
            <div><label htmlFor="w" className="text-sm">Width</label><input id="w" required inputMode="decimal" className={inp + " mt-1"} value={f.width} onChange={(e) => setF({ ...f, width: e.target.value })} /></div>
            <div><label htmlFor="h" className="text-sm">Height</label><input id="h" required inputMode="decimal" className={inp + " mt-1"} value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} /></div>
            <div><label htmlFor="u" className="text-sm">Unit</label><select id="u" className={inp + " mt-1"} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option value="ft">feet</option><option value="in">inches</option><option value="cm">cm</option></select></div>
          </div>
          {price?.sqft > 0 && <p className="mt-2 text-sm text-muted-foreground">{price.sqft} sq ft to print</p>}
        </fieldset>
        <fieldset><legend className="text-lg font-medium">Finish</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{(price?.finishes ?? []).map((m: any) => <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm ${f.finish === m.id ? "border-primary bg-accent/40" : "border-input"}`}><span><input type="radio" name="finish" className="mr-2" checked={f.finish === m.id} onChange={() => setF({ ...f, finish: m.id })} />{m.name}</span><span className="text-xs text-muted-foreground">{m.standard || !m.adj ? "Standard" : `${m.adj > 0 ? "+" : "−"}$${Math.abs(m.adj).toFixed(2)}/sq ft`}</span></label>)}</div>
        </fieldset>
        <fieldset><legend className="text-lg font-medium">Shipping</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="n" className="text-sm">Full name</label><input id="n" required className={inp + " mt-1"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
            <div><label htmlFor="ph" className="text-sm">Phone (for delivery)</label><input id="ph" className={inp + " mt-1"} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></div>
            <div className="sm:col-span-2"><label htmlFor="a" className="text-sm">Address</label><textarea id="a" required rows={2} className={inp + " mt-1"} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} autoComplete="street-address" /></div>
            <div><label htmlFor="st" className="text-sm">State</label><input id="st" maxLength={2} className={inp + " mt-1 uppercase"} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} placeholder="NY" /></div>
          </div>
        </fieldset>
      </div>
      <aside className="h-fit rounded-lg border border-border p-5 lg:sticky lg:top-24">
        <h2 className="text-2xl">Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt>Printing{price?.sqft > 0 ? ` (${price.sqft} sq ft × ${money(price.unit)})` : ""}<span className="block text-xs text-muted-foreground">{price?.finishName}</span></dt><dd>{money(price?.printing)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Design work<span className="block text-xs text-muted-foreground">{accepted?.designer}, ready in {p.days} day{p.days === 1 ? "" : "s"}</span></dt><dd>{money(p.fee)}</dd></div>
          {q?.special > 0 && <div className="flex justify-between"><dt>Trade price</dt><dd>−{money(q.special)}</dd></div>}
          {q && <div className="flex justify-between"><dt>Shipping</dt><dd>{q.shipping ? money(q.shipping) : "Free"}</dd></div>}
          {q?.tax > 0 && <div className="flex justify-between"><dt>{q.taxLabel}</dt><dd>{money(q.tax)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd>{money(q?.due ?? 0)}</dd></div>
        </dl>
        <div className="mt-5"><label htmlFor="card" className="text-sm">Card</label><input id="card" required className={inp + " mt-1"} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={f.card} onChange={(e) => setF({ ...f, card: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Test mode: use 4242 4242 4242 4242. No real money is taken.</p></div>
        {err && <p className="mt-3 text-sm text-destructive" role="alert">{err}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={busy || !(price?.sqft > 0)}>{busy ? <><Loader2 className="animate-spin" />Paying…</> : <><Lock />Pay {money(q?.due ?? 0)}</>}</Button>
        <p className="mt-2 text-xs text-muted-foreground">After payment the designer starts. Your order shows "Waiting on designer" until the final file is ready, then we print.</p>
      </aside>
    </form>
  </div>;
}
