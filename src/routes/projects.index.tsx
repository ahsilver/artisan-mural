import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignInPage } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money, day } from "@/components/projects";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: [{ title: "My design requests — Artisan Murals" }, { name: "robots", content: "noindex" }] }),
  component: Projects,
});

/** The approved preview's "My design requests": each request with its picture, what was asked, and a progress track. */
export const STAGES = ["Sent", "Price", "Approved", "Paid", "Finished"];
export const stageOf = (status: string) => ({ requested: 0, quoted: 1, approved: 2, in_progress: 3, delivered: 4 } as Record<string, number>)[status] ?? 0;
export const Track = ({ status }: { status: string }) => <div className="track">{STAGES.map((s, k) => <span key={s} className={k <= stageOf(status) ? "on" : ""}>{s}</span>)}</div>;

function Projects() {
  const { session, loading } = useSession();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (session) papi("projects/mine").then((r) => setList(r.projects)).catch((e) => setErr(e.message)); }, [session?.user?.id]);
  if (loading) return <div className="am"><p className="pg hint" style={{ padding: "60px 20px" }}>Loading…</p></div>;
  if (!session) return <SignInPage kicker="My requests" title="My design requests" sub="Sign in to see your requests and the designers' prices." />;
  return (
    <div className="am">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/account">My account</Link><span>/</span><b>My requests</b></nav></div>
      <section className="pg">
        <div className="pg-head msgs-head"><div><span className="k">Requests &amp; projects</span><h1>My design requests</h1><p>Every change request and custom design, with prices and where it stands.</p></div><Link className="btn btn-wine" to="/custom-request">New request</Link></div>
        {err && <p className="rq-ok err">{err}</p>}
        {!list ? <p className="hint">Loading…</p> : list.length === 0 ? <div className="sa-done"><b>No requests yet</b><p>Ask a designer to change a design, or post a request for something new.</p><Link className="btn btn-wine btn-sm" to="/custom-request">Post a request</Link></div> : (
          <div className="req-list">{list.map((p) => {
            const action = p.status === "requested" ? "Waiting for a price" : p.status === "quoted" ? (p.newQuotes > 1 ? `${p.newQuotes} prices to compare` : "See the price") : p.status === "approved" ? "Pay & choose wall size" : "Open";
            return (
              <div key={p.id} className="req">
                {p.designThumb ? <img src={p.designThumb} alt="" /> : <span className="req-ph">Custom</span>}
                <div><b>{p.title}</b><small>{p.kind === "edit" ? "Change request" : "Custom design"} · {day(p.createdAt)}{p.status === "quoted" && p.bestQuote != null ? ` · from ${money(p.bestQuote)}` : ""}</small><Track status={p.status} /></div>
                <Link className={"btn btn-sm " + (p.status === "approved" || p.status === "quoted" ? "btn-wine" : "optline")} to={p.status === "approved" ? "/projects/$id/pay" : "/projects/$id"} params={{ id: p.id }}>{action}</Link>
              </div>
            );
          })}</div>
        )}
      </section>
    </div>
  );
}
