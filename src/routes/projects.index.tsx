import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { papi, money, day, StatusPill } from "@/components/projects";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: [{ title: "My design requests — Artisan Mural" }, { name: "robots", content: "noindex" }] }),
  component: Projects,
});

function Projects() {
  const { session, loading } = useSession();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (session) papi("projects/mine").then((r) => setList(r.projects)).catch((e) => setErr(e.message)); }, [session?.user?.id]);
  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><h1 className="text-4xl">My design requests</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to see your requests and the designers' prices.</p><div className="mt-6"><AuthPanel /></div></div>;
  return <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl sm:text-5xl">My design requests</h1><p className="mt-2 text-sm text-muted-foreground">Changes to a design and custom designs: prices, chat and progress.</p></div>
      <Button asChild><Link to="/custom-request"><Plus />New custom design</Link></Button></div>
    {err && <p className="mt-6 text-sm text-destructive">{err}</p>}
    {!list ? <Loader2 className="mx-auto my-16 animate-spin" /> : list.length === 0 ? <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center"><p className="text-lg">No requests yet</p><p className="mt-1 text-sm text-muted-foreground">Ask a designer to change any design from its page, or start a fully custom one.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Button asChild variant="outline"><Link to="/browse">Browse designs</Link></Button><Button asChild><Link to="/custom-request">Custom design</Link></Button></div></div> :
      <ul className="mt-8 divide-y divide-border border-y border-border">{list.map((p) => <li key={p.id}><Link to="/projects/$id" params={{ id: p.id }} className="flex items-center gap-4 py-4 hover:bg-muted/30 sm:px-2">
        {p.designThumb ? <img src={p.designThumb} alt="" className="size-16 shrink-0 rounded object-cover" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded bg-accent text-xs text-muted-foreground">Custom</div>}
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.kind === "edit" ? "Change request" : "Custom design"} · {day(p.createdAt)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2"><StatusPill status={p.status} customer />{p.status === "quoted" && p.bestQuote != null && <span className="text-xs font-medium">{p.newQuotes > 1 ? `${p.newQuotes} prices, from ` : ""}{money(p.bestQuote)}</span>}{p.status === "in_progress" && p.dueAt && <span className="text-xs text-muted-foreground">Due {day(p.dueAt)}</span>}</div></div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul>}
  </div>;
}
