import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { Design } from "@/lib/catalog";
import { pic, roomSources } from "@/lib/pics";

/** Smallest good picture of a design for compact tiles (room picture first, else the artwork). */
export function thumbOf(d: Design, widths: number[] = [320, 480]) {
  const room = roomSources(d)[0];
  return (room && pic(d, room, widths)) || pic(d, d.image, widths) || { src: d.image };
}

export function Thumb({ d, sizes, className = "", room = true }: { d: Design; sizes: string; className?: string; room?: boolean }) {
  const p = room ? thumbOf(d) : pic(d, d.image, [320, 480]) || { src: d.image };
  return (
    <img
      src={p.src}
      srcSet={(p as any).srcSet}
      sizes={(p as any).srcSet ? sizes : undefined}
      alt={d.title}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] ${className}`}
      style={(p as any).lq ? { backgroundImage: `url("${(p as any).lq}")`, backgroundSize: "cover" } : undefined}
    />
  );
}

/** Compact square design tile: 2 per row on phone, 3 on tablet, 4 on desktop. */
export function WorkTile({ d }: { d: Design }) {
  return (
    <Link
      to="/design/$slug"
      params={{ slug: d.slug }}
      className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
      data-testid="work-tile"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-paper ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-lift">
        <Thumb d={d} sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 46vw" />
        <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground backdrop-blur-sm">
          {d.kind === "repeating" ? "Repeat" : "Mural"}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-medium leading-tight group-hover:text-foreground">{d.title}</p>
      {d.colorways && d.colorways.length > 1 ? (
        <p className="text-[11px] text-muted-foreground">{d.colorways.length} colors</p>
      ) : null}
    </Link>
  );
}

export function Chip({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-testid={testid}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs capitalize transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

/** Preview-only option badge ("Designers A – current" / "Designers B – new") with a link to the other option.
 *  Drawn only in the browser and only on preview addresses (*.artisan-mural.pages.dev), never on the live site. */
export function VersionSwitch({ v, raised = false }: { v?: string; raised?: boolean }) {
  const [preview, setPreview] = useState(false);
  useEffect(() => { setPreview(/\.artisan-mural\.pages\.dev$/.test(window.location.hostname)); }, []);
  if (!preview) return null;
  const cur = v === "a" ? "a" : "b";
  const other = cur === "a" ? "b" : "a";
  return (
    <div className={`fixed right-3 z-50 flex items-center gap-2 rounded-full bg-[#082635]/92 py-1 pr-1 pl-3 text-[11px] font-medium text-white shadow-lift backdrop-blur ${raised ? "bottom-20 lg:bottom-5" : "bottom-5"}`} data-testid="version-switch">
      <span>{cur === "a" ? "Designers A – current" : "Designers B – new"}</span>
      <a href={`?v=${other}`} className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">See {other.toUpperCase()}</a>
    </div>
  );
}
