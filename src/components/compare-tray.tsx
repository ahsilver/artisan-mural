import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { designBySlug } from "@/lib/catalog";
import { COMPARE_MAX, useCompare } from "@/lib/compare";

export function CompareTray() {
  const { list, remove, clear } = useCompare();
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!list.length || path === "/compare") return null;
  return <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lift backdrop-blur">
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{list.map(s => { const d = designBySlug(s); return d && <div key={s} className="relative shrink-0"><img src={d.image} alt={d.title} className="h-12 w-12 rounded-lg object-cover" /><button type="button" aria-label={`Remove ${d.title}`} onClick={() => remove(s)} className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground p-0.5 text-background"><X className="h-3 w-3" /></button></div>; })}</div>
    <span className="hidden text-xs text-muted-foreground sm:block">{list.length}/{COMPARE_MAX}</span>
    <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
    <Button asChild size="sm" disabled={list.length < 2}><Link to="/compare">Compare{list.length < 2 ? " (pick 2+)" : ""}</Link></Button>
  </div>;
}
