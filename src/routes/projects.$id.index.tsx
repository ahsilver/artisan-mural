import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SignInPage } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money, day } from "@/components/projects";
import { Track } from "./projects.index";

export const Route = createFileRoute("/projects/$id/")({
  validateSearch: z.object({ sent: z.coerce.number().optional(), paid: z.coerce.number().optional() }),
  head: () => ({ meta: [{ title: "Design request — Artisan Murals" }, { name: "robots", content: "noindex" }] }),
  component: Project,
});

function Project() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = () => papi(`projects/${id}`).then(setP).catch((e) => setErr(e.message));
  useEffect(() => { if (session) void load(); }, [session?.user?.id, id]);
  useEffect(() => { if (!session) return; const t = setInterval(load, 30000); return () => clearInterval(t); }, [session?.user?.id, id]);
  const shell = (children: React.ReactNode) => <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/projects">My requests</Link><span>/</span><b>{p?.title ?? "Request"}</b></nav></div><section className="pg pj">{children}</section></div>;
  if (loading) return shell(<p className="hint">Loading…</p>);
  if (!session) return <SignInPage kicker="Design request" title="Sign in to see this request" />;
  if (err && !p) return shell(<div className="sa-done"><b>{err}</b><Link className="btn optline btn-sm" to="/projects">My design requests</Link></div>);
  if (!p) return shell(<p className="hint">Loading…</p>);
  const open = p.quotes.filter((q: any) => q.status === "sent");
  const accepted = p.quotes.find((q: any) => q.status === "accepted");
  const threads: any[] = p.threads ?? [];
  const act = async (what: string, quote: string) => { setBusy(quote + what); setErr(""); try { const r = await papi(`projects/${id}/${what}`, { quote }); if (r.next) await navigate({ to: "/projects/$id/pay", params: { id } }); else await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); } };
  const chatHref = (uid: string) => `/messages?c=${encodeURIComponent(`p.${id}.${uid}`)}`;
  return shell(<>
    {search.sent ? <p className="pj-note ok">Request sent. You'll get an email and a notification when the designer sends a price.</p> : null}
    {search.paid ? <p className="pj-note ok">Payment confirmed. The designer is working on it{p.dueAt ? ` and will be done by ${day(p.dueAt)}` : ""}. Then we print and ship your wall.</p> : null}
    <div className="pj-head">
      {p.designThumb ? <img src={p.designThumb} alt="" /> : <span className="req-ph">Custom</span>}
      <div><span className="k">{p.kind === "edit" ? "Change request" : "Custom design"} · sent {day(p.createdAt)}{p.open ? " to all designers" : ""}</span><h1>{p.title}</h1>{p.status !== "cancelled" ? <Track status={p.status} /> : <span className="pill">Cancelled</span>}</div>
    </div>
    {err && <p className="rq-ok err" role="alert">{err}</p>}

    {(p.status === "requested" || p.status === "quoted") && <div className="pj-sec"><h2>Prices</h2>
      {open.length === 0 ? <p className="hint">Waiting for {p.open ? "designers" : "the designer"} to send a price. You'll get an email and a notification.</p> :
        <div className="pj-offers">{open.map((q: any) => <div key={q.id} className="offer">
          <span className="ot">Price offer from {q.designer}</span><span className="op">{money(q.fee)}</span>
          <p>Ready in {q.days} day{q.days === 1 ? "" : "s"} after payment.{q.note ? ` ${q.note}` : ""} Printing is priced separately by your wall size.</p>
          <div className="ob"><button type="button" className="btn btn-wine btn-sm" disabled={!!busy} onClick={() => void act("approve", q.id)}>{busy === q.id + "approve" ? "…" : "Approve price"}</button><button type="button" className="btn btn-sm optline" disabled={!!busy} onClick={() => void act("decline", q.id)}>Decline</button><a className="btn btn-sm optline" href={chatHref(q.designerUid)}>Ask {q.designer.split(" ")[0]}</a></div>
        </div>)}</div>}
    </div>}
    {p.status === "approved" && <div className="offer pj-pay"><span className="ot">Price approved</span><span className="op">{money(p.fee)}</span><p>{accepted?.designer} needs {p.days} day{p.days === 1 ? "" : "s"} after payment. Enter your wall size and paper, then pay the design and the print together.</p><div className="ob"><Link className="btn btn-wine btn-sm" to="/projects/$id/pay" params={{ id }}>Pay {money(p.fee)} + print</Link></div></div>}
    {(p.status === "in_progress" || p.status === "delivered") && p.order && <div className="pj-sec"><h2>Your order</h2>
      <dl className="pj-dl"><dt>Wall</dt><dd>{p.order.selection?.width} × {p.order.selection?.height} {p.order.selection?.unit} ({p.order.sqft} sq ft)</dd><dt>Paper</dt><dd>{p.order.finish}</dd><dt>Design work</dt><dd>{money(p.order.designFee)}</dd><dt>Total</dt><dd>{money(p.order.total)}</dd></dl>
      <p className="hint">{p.status === "delivered" ? "The design is finished. We're getting it ready to print, and we'll email you the tracking number when it ships." : "The designer is working on it. Ask anything in the chat."}</p></div>}

    <div className="pj-sec"><h2>Your request</h2><p className="pj-brief">{p.brief}</p>
      <div className="dp-meta">{p.room && <span>Room: {p.room}</span>}{p.wallSize && <span>Wall: {p.wallSize}</span>}{p.budget && <span>Budget: {p.budget}</span>}{p.deadline && <span>Needed by {new Date(p.deadline + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}</div>
      {p.attachments?.length > 0 && <div className="pj-atts">{p.attachments.map((a: any, i: number) => <a key={i} href={a.url} target="_blank" rel="noreferrer">{/\.(jpe?g|png|webp|gif)$/i.test(a.name) ? <img src={a.url} alt={a.name} /> : a.name}</a>)}</div>}</div>

    <div className="pj-sec"><h2>Messages</h2>
      {threads.length ? <div className="pj-threads">{threads.map((t: any) => <a key={t.designer.uid} className="thread" href={chatHref(t.designer.uid)}><span className="av" style={{ background: "#5E7A55" }}>{t.designer.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}</span><span><b>{t.designer.name}</b><small>{t.messages.length ? `${t.messages.length} message${t.messages.length > 1 ? "s" : ""} · ${t.messages[t.messages.length - 1].body?.slice(0, 60) ?? ""}` : "Open the chat"}</small></span><span className="btn btn-sm optline">Open chat</span></a>)}</div>
        : <p className="hint">{p.open ? "When a designer sends a price, you can chat with them here." : "No messages yet."}</p>}
    </div>
    {(p.status === "requested" || p.status === "quoted") && <button type="button" className="up-link pj-cancel" onClick={async () => { if (confirm("Cancel this request?")) { await papi(`projects/${id}/cancel`, {}); void load(); } }}>Cancel this request</button>}
  </>);
}
