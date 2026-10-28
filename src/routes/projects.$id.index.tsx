import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Check, CheckCircle2, Clock } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money, day, when, StatusPill, Chat, AttList } from "@/components/projects";

export const Route = createFileRoute("/projects/$id/")({
  validateSearch: z.object({ sent: z.coerce.number().optional(), paid: z.coerce.number().optional() }),
  head: () => ({ meta: [{ title: "Design request — Artisan Mural" }, { name: "robots", content: "noindex" }] }),
  component: Project,
});

const STEPS = [["requested", "Request sent"], ["quoted", "Price received"], ["approved", "Approved"], ["in_progress", "Paid, designer working"], ["delivered", "Design finished"]];

function Project() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<string | null>(null);
  const load = () => papi(`projects/${id}`).then(setP).catch((e) => setErr(e.message));
  useEffect(() => { if (session) void load(); }, [session?.user?.id, id]);
  useEffect(() => { if (!session) return; const t = setInterval(load, 30000); return () => clearInterval(t); }, [session?.user?.id, id]);
  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><h1 className="text-4xl">Design request</h1><div className="mt-6"><AuthPanel /></div></div>;
  if (err) return <div className="mx-auto max-w-3xl px-6 py-12"><p className="text-destructive">{err}</p><Link to="/projects" className="mt-4 inline-block text-sm underline">My design requests</Link></div>;
  if (!p) return <Loader2 className="mx-auto my-20 animate-spin" />;
  const idx = STEPS.findIndex(([s]) => s === p.status);
  const open = p.quotes.filter((q: any) => q.status === "sent");
  const accepted = p.quotes.find((q: any) => q.status === "accepted");
  const threads = p.threads.length ? p.threads : [];
  const cur = threads.find((t: any) => t.designer.uid === tab) ?? threads.find((t: any) => t.designer.uid === p.quotes.find((q: any) => q.status === "accepted")?.designerUid) ?? threads[0];
  const act = async (what: string, quote: string) => { setBusy(quote + what); setErr(""); try { const r = await papi(`projects/${id}/${what}`, { quote }); if (r.next) await navigate({ to: "/projects/$id/pay", params: { id } }); else await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); } };
  return <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
    <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My design requests</Link>
    {search.sent ? <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Request sent. You'll get an email and a notification when the designer sends a price.</div> : null}
    {search.paid ? <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>Payment confirmed (test mode, no real charge). The designer is working on it{p.dueAt ? ` and will be done by ${day(p.dueAt)}` : ""}. Then we print and ship.</span></div> : null}
    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
      {p.designThumb && <img src={p.designThumb} alt="" className="size-20 rounded object-cover" />}
      <div className="min-w-0 flex-1"><p className="text-eyebrow text-muted-foreground">{p.kind === "edit" ? "Change request" : "Custom design"}</p><h1 className="mt-1 text-3xl leading-tight sm:text-4xl">{p.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill status={p.status} customer /><span className="text-xs text-muted-foreground">Sent {day(p.createdAt)}{p.open ? " to all designers" : ""}</span></div></div>
    </div>
    {p.status !== "cancelled" && <ol className="mt-6 grid grid-cols-5 gap-1 text-[10px] sm:text-xs" aria-label="Progress">{STEPS.map(([s, l], i) => <li key={s} className={`border-t-2 pt-1.5 ${i <= idx ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>{i < idx || p.status === "delivered" ? <Check className="mb-0.5 inline size-3" /> : null} {l}</li>)}</ol>}
    {err && <p className="mt-4 text-sm text-destructive" role="alert">{err}</p>}

    {(p.status === "requested" || p.status === "quoted") && <section className="mt-8"><h2 className="text-2xl">Prices</h2>
      {open.length === 0 ? <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Clock className="size-4" />Waiting for {p.open ? "designers" : "the designer"} to send a price. You'll get an email and a notification.</p> :
        <div className="mt-3 space-y-3">{open.map((q: any) => <div key={q.id} className="rounded-lg border border-primary/40 bg-accent/30 p-4">
          <p className="text-sm"><b className="font-medium">{q.designer}</b> came back with a price</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1"><p><span className="text-2xl font-semibold">{money(q.fee)}</span> <span className="text-sm text-muted-foreground">for the design work</span></p><p className="text-sm">Ready in <b className="font-medium">{q.days} day{q.days === 1 ? "" : "s"}</b> after payment</p></div>
          {q.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{q.note}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Next you enter your wall size and pay the printing and the design together.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => act("approve", q.id)}>{busy === q.id + "approve" ? <Loader2 className="animate-spin" /> : <Check />}Approve price and continue</Button><Button variant="outline" disabled={!!busy} onClick={() => act("decline", q.id)}>Decline</Button></div>
        </div>)}</div>}
    </section>}
    {p.status === "approved" && <section className="mt-8 rounded-lg border border-primary/40 bg-accent/30 p-5"><h2 className="text-2xl">Price approved: {money(p.fee)}</h2><p className="mt-1 text-sm text-muted-foreground">{accepted?.designer} needs {p.days} day{p.days === 1 ? "" : "s"} after payment. Enter your wall size to see the full price with printing.</p><Button asChild className="mt-4"><Link to="/projects/$id/pay" params={{ id }}>Enter wall size and pay</Link></Button></section>}
    {(p.status === "in_progress" || p.status === "delivered") && p.order && <section className="mt-8 rounded-lg border border-border p-5"><h2 className="text-2xl">Your order</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4"><dt className="text-muted-foreground">Wall</dt><dd>{p.order.selection?.width} × {p.order.selection?.height} {p.order.selection?.unit} ({p.order.sqft} sq ft)</dd><dt className="text-muted-foreground">Design work</dt><dd>{money(p.order.designFee)}</dd><dt className="text-muted-foreground">Paid</dt><dd>{money(p.order.due)}</dd><dt className="text-muted-foreground">{p.status === "delivered" ? "Designer finished" : "Designer due"}</dt><dd>{p.status === "delivered" ? day(p.deliveredAt) : day(p.dueAt)}</dd></dl>
      <p className="mt-3 text-sm text-muted-foreground">{p.status === "delivered" ? "The design is finished. We're getting it ready to print, and we'll email you the tracking number when it ships." : "The designer is working on it. Ask anything in the chat below."}</p></section>}

    <section className="mt-8"><h2 className="text-2xl">Your request</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.brief}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 text-xs text-muted-foreground">{p.room && <span>Room: {p.room}</span>}{p.wallSize && <span>Wall: {p.wallSize}</span>}{p.budget && <span>Budget: {p.budget}</span>}{p.deadline && <span>Needed by {new Date(p.deadline + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}{p.budget && <span>Budget: {p.budget}</span>}{p.designSlug && <Link to="/design/$slug" params={{ slug: p.designSlug }} className="underline">{p.designTitle}</Link>}</div>
      {p.attachments.length > 0 && <div className="mt-3"><AttList items={p.attachments} /></div>}</section>

    <section className="mt-8"><h2 className="text-2xl">Messages</h2>
      {threads.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{threads.map((t: any) => <Button key={t.designer.uid} size="sm" variant={cur?.designer.uid === t.designer.uid ? "default" : "outline"} onClick={() => setTab(t.designer.uid)}>{t.designer.name}</Button>)}</div>}
      <div className="mt-3">{cur ? <Chat projectId={id} thread={cur} designerUid={cur.designer.uid} onSent={load} canWrite={p.status !== "cancelled"} /> : <p className="text-sm text-muted-foreground">{p.open ? "When a designer sends a price, you can chat with them here." : "No messages yet."}</p>}</div>
      {!cur && !p.open && p.status !== "cancelled" && null}
    </section>
    {(p.status === "requested" || p.status === "quoted") && <button className="mt-8 text-xs text-muted-foreground underline" onClick={async () => { if (confirm("Cancel this request?")) { await papi(`projects/${id}/cancel`, {}); void load(); } }}>Cancel this request</button>}
  </div>;
}
