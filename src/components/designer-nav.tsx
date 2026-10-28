import { Link, useRouterState } from "@tanstack/react-router";
import { ImagePlus, LayoutGrid, Palette } from "lucide-react";

/** The designer's three places: studio overview, all their designs, and the page to add a new one. */
export function DesignerNav() {
  const path = useRouterState({ select: (s) => s.location.pathname + (s.location.searchStr ?? "") });
  const items = [
    { to: "/studio", label: "Studio", icon: LayoutGrid, on: path === "/studio" || (path.startsWith("/studio") && !path.includes("view=designs")) },
    { to: "/studio?view=designs", label: "My designs", icon: Palette, on: path.includes("view=designs") },
    { to: "/designer-upload", label: "Add a design", icon: ImagePlus, on: path.startsWith("/designer-upload") },
  ];
  return <nav aria-label="Designer menu" className="flex flex-wrap gap-1.5">
    {items.map((i) => <a key={i.label} href={i.to} aria-current={i.on ? "page" : undefined} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${i.on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted"}`}><i.icon className="h-3.5 w-3.5" />{i.label}</a>)}
  </nav>;
}
