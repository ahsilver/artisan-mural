import { Link, useRouter } from "@tanstack/react-router";

import { Check, Plus } from "lucide-react";
import { designerBySlug, withColorway, type Design } from "@/lib/catalog";
import { DesignRating } from "@/components/community";
import { useCompare } from "@/lib/compare";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { pic, roomSources, BIG_W, type Pic } from "@/lib/pics";

const SIZES = "(min-width: 1280px) 400px, (min-width: 640px) 45vw, 50vw";

function CardImg({ p, alt, eager, shown }: { p: Pic; alt: string; eager?: boolean; shown: boolean }) {
  return (
    <img
      src={p.src}
      srcSet={p.srcSet}
      sizes={p.srcSet ? SIZES : undefined}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      width={640}
      height={800}
      draggable={false}
      aria-hidden={!shown}
      className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03] ${shown ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/** Shop card: the room picture first, a small switch to see the full design (hover on desktop, swipe on phone). */
export function DesignCard({ design: base, eager = false, onPick, picked = false }: { design: Design; eager?: boolean; onPick?: (d: Design) => void; picked?: boolean }) {
  const designer = designerBySlug(base.designer);
  const compare = useCompare();
  const router = useRouter();
  const on = compare.has(base.slug);
  const [color, setColor] = useState(base.colorways?.[0]?.id);
  const design = withColorway(base, color);
  const roomSrc = roomSources(design)[0] ?? roomSources(base)[0];
  const room = pic(base, roomSrc);
  const art = pic(base, design.image)!;
  const [view, setView] = useState<"room" | "art">("room");
  const [hover, setHover] = useState(false);
  const hasRoom = !!room;
  // desktop hover shows the other picture; the switch (or a swipe) flips it for good
  const showing: "room" | "art" = !hasRoom ? "art" : hover ? (view === "room" ? "art" : "room") : view;
  // the second picture loads once the page is idle (or on first touch/hover), so it never slows the first view
  const [artReady, setArtReady] = useState(!hasRoom);
  useEffect(() => {
    if (artReady) return;
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => setArtReady(true), { timeout: 3000 }) : setTimeout(() => setArtReady(true), 1500);
    return () => (w.cancelIdleCallback && w.requestIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, [artReady]);
  const touch = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const warmed = useRef(false);
  const warm = () => { // the product page's first picture starts loading before the click
    setArtReady(true);
    if (warmed.current) return; warmed.current = true;
    const first = pic(base, roomSources(design)[0] ?? design.image, BIG_W);
    if (first && typeof Image !== "undefined") { const im = new Image(); if (first.srcSet) { im.sizes = "(min-width: 1024px) 60vw, 100vw"; im.srcset = first.srcSet; } im.src = first.src; }
    router.preloadRoute({ to: "/design/$slug", params: { slug: base.slug } }).catch(() => {});
  };
  const flip = (e: React.SyntheticEvent, to?: "room" | "art") => { e.preventDefault(); e.stopPropagation(); setHover(false); setView(to ?? (view === "room" ? "art" : "room")); };
  const lq = (showing === "room" ? room : art)?.lq;

  return (
    <Link
      to="/design/$slug"
      params={{ slug: base.slug }}
      search={{ color }}
      onMouseEnter={(e) => { warm(); if (window.matchMedia("(hover: hover)").matches) setHover(true); }}
      onMouseLeave={() => setHover(false)}
      onTouchStart={(e) => { warm(); const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, swiped: false }; }}
      onFocus={warm}
      onClick={(e) => { if (touch.current?.swiped) { e.preventDefault(); touch.current = null; return; } if (onPick) { e.preventDefault(); onPick(design); } }}
      aria-current={picked || undefined}
      className={`group block min-w-0 rounded-lg border bg-card ${picked ? "border-foreground ring-1 ring-foreground" : "border-border"} p-2.5 shadow-paper transition-shadow duration-300 hover:shadow-lift sm:p-3`}
    >
      <div
        className="relative aspect-4/5 touch-pan-y overflow-hidden rounded-sm bg-muted bg-cover bg-center shadow-paper transition-shadow duration-300 group-hover:shadow-lift"
        style={lq ? { backgroundImage: `url("${lq}")` } : undefined}
        onTouchMove={(e) => { const s = touch.current; if (!s || s.swiped || !hasRoom) return; const t = e.touches[0]; const dx = t.clientX - s.x, dy = t.clientY - s.y; if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) { s.swiped = true; setView(view === "room" ? "art" : "room"); } }}
      >
        {room && <CardImg p={room} alt={`${base.title} wallpaper in a room`} eager={eager} shown={showing === "room"} />}
        {(artReady || showing === "art") && <CardImg p={art} alt={base.title} eager={eager && !room} shown={showing === "art"} />}
        <Button size="icon" variant="ghost" type="button" aria-label={on ? `Remove ${base.title} from comparison` : `Compare ${base.title}`} title="Compare" aria-pressed={on} disabled={!on && compare.full} onClick={(e) => { e.preventDefault(); e.stopPropagation(); compare.toggle(base.slug); }} className={`absolute top-2 right-2 h-7 w-7 rounded-full [&_svg]:size-3.5 ${on ? "bg-primary text-primary-foreground" : "bg-background/70 text-foreground hover:bg-background"}`}>
          {on ? <Check /> : <Plus />}
        </Button>
        {hasRoom && (
          <div role="group" aria-label="Picture" className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center" onTouchStart={(e) => e.stopPropagation()} data-testid="card-switch">
            {(["room", "art"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={showing === k} aria-label={k === "room" ? "Show room picture" : base.kind === "repeating" ? "Show pattern" : "Show design"} onClick={(e) => flip(e, k)} onMouseEnter={(e) => { e.stopPropagation(); }} className="flex h-6 w-5 items-center justify-center">
                <span className={`block h-1.5 w-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.15)] transition-colors ${showing === k ? "bg-white" : "bg-white/50"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h3 className="font-display text-lg leading-tight">{base.title}</h3>
        <span className="text-xs text-muted-foreground">{base.orders} walls</span>
      </div>
      <p className="text-sm text-muted-foreground">{designer?.name}<span className="text-xs"> · {base.kind === "repeating" ? "Repeat" : "Mural"}</span><DesignRating slug={base.slug} className="ml-1.5" /></p>
      {base.colorways && base.colorways.length > 1 && <div className="mt-2 flex flex-wrap items-center gap-0.5" role="radiogroup" aria-label={`${base.title} colors`}>
        {base.colorways.map(c => { const sw = c.swatch.startsWith("url(") ? pic(base, c.image, [320]) : undefined; return <Button key={c.id} variant="ghost" role="radio" aria-checked={color === c.id} aria-label={`${base.title} — ${c.name}`} title={c.name} className={`h-8 w-8 rounded-full p-1.5 ${color === c.id ? "ring-1 ring-foreground" : ""}`} onClick={e => { e.preventDefault(); e.stopPropagation(); setColor(c.id); }}>
          <span className="h-full w-full rounded-full border border-border" style={sw ? { backgroundImage: `url("${sw.src}")`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: c.swatch }} />
        </Button>; })}
        <span className="ml-1 text-[11px] text-muted-foreground" data-testid="card-colors">{base.colorways.length} colors</span>
      </div>}
    </Link>
  );
}
