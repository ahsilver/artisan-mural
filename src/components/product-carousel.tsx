import { ChevronLeft, ChevronRight, Expand, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Pic } from "@/lib/pics";

/** Hovia-style slider: every slide has the same height, its width follows the picture's own shape, so pictures are never cut off. */
export function ProductCarousel({ slides, pics = [], previews = [], artIndex, title, repeating = false, overlay }: { slides: string[]; pics?: (Pic | undefined)[]; previews?: (string | undefined)[]; artIndex: number; title: string; repeating?: boolean; overlay?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [full, setFull] = useState<number | null>(null);
  const [bar, setBar] = useState<{ left: number; width: number; wide: boolean }>({ left: 0, width: 1, wide: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0, dist = Infinity;
      kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft + k.clientWidth / 2 - center); if (d < dist) { dist = d; best = i; } });
      setIndex(best);
      const k = kids[best]; const sw = el.scrollWidth;
      setBar({ left: el.scrollLeft / sw, width: Math.min(1, el.clientWidth / sw), wide: !!k && k.clientWidth > el.clientWidth * 0.98 });
    };
    onScroll();
    const ro = new ResizeObserver(onScroll); ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, [slides.length, Object.keys(ratios).length]);

  useEffect(() => { track.current?.scrollTo({ left: 0 }); setIndex(0); setRatios({}); }, [slides[0]]);

  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  function go(i: number) {
    const el = track.current;
    const kid = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (el && kid) el.scrollTo({ left: Math.max(0, kid.offsetLeft - Math.max(0, (el.clientWidth - kid.clientWidth) / 2)), behavior: "smooth" });
  }
  const trim = (i: number) => (i === artIndex && repeating ? 0.96 : 1);

  return (
    <div className="group/car relative w-full min-w-0">
      <div ref={track} onPointerDown={(e) => { if (e.pointerType !== "mouse" || !track.current) return; drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false }; track.current.style.scrollSnapType = "none"; }} onPointerMove={(e) => { const d = drag.current, el = track.current; if (!d || !el) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 4) d.moved = true; el.scrollLeft = d.left - dx; }} onPointerUp={() => { const el = track.current; drag.current = null; if (el) { el.style.scrollSnapType = ""; } }} onPointerLeave={() => { if (drag.current && track.current) { drag.current = null; track.current.style.scrollSnapType = ""; } }} className="relative flex cursor-grab snap-x snap-proximity gap-3 overflow-x-auto px-[3%] active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Product photos">
        {slides.map((src, i) => {
          const art = i === artIndex;
          return (
            <div key={src + i} data-slide={i} style={{ aspectRatio: String((ratios[i] ?? pics[i]?.ar ?? 1.5) * trim(i)), ...(pics[i]?.lq ? { backgroundImage: [previews[i] ? `url("${previews[i]}")` : "", `url("${pics[i]!.lq}")`].filter(Boolean).join(", "), backgroundSize: "cover", backgroundPosition: "left center" } : {}) }} className="relative h-[360px] shrink-0 snap-center overflow-hidden rounded-lg bg-muted sm:h-[520px] lg:h-[680px]">
              <img src={pics[i]?.src ?? src} srcSet={pics[i]?.srcSet} sizes={pics[i]?.srcSet ? "(min-width: 1024px) 60vw, 100vw" : undefined} alt={art ? `${title} ${repeating ? "pattern preview" : "artwork"}` : `${title} wallpaper in a room`} onLoad={(e) => { const im = e.currentTarget; if (im.naturalHeight) setRatios((r) => ({ ...r, [i]: im.naturalWidth / im.naturalHeight })); }} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} decoding="async" draggable={false} onContextMenu={e=>e.preventDefault()} onDoubleClick={() => setFull(i)} className="block h-full w-full select-none object-cover object-left" />
            </div>
          );
        })}
      </div>
      <button type="button" aria-label="Open picture full screen" title="Full screen" onClick={() => setFull(index)} data-testid="expand" className="absolute right-[calc(3%+8px)] top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/95 backdrop-blur-[2px] transition-colors hover:bg-black/45 focus-visible:outline-2 focus-visible:outline-white"><Expand className="h-3.5 w-3.5" strokeWidth={2} /></button>
      {slides.length > 1 && index > 0 && <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} className="absolute left-[calc(3%+8px)] top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/75 text-foreground opacity-0 transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 group-hover/car:opacity-100 [@media(hover:hover)]:flex"><ChevronLeft className="h-4 w-4" /></button>}
      {slides.length > 1 && index < slides.length - 1 && <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} className="absolute right-[calc(3%+8px)] top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/75 text-foreground opacity-0 transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 group-hover/car:opacity-100 [@media(hover:hover)]:flex"><ChevronRight className="h-4 w-4" /></button>}
      {bar.width < 0.999 && <div className="mx-[3%] mt-2.5 h-[3px] overflow-hidden rounded-full bg-foreground/10" aria-hidden="true" data-testid="pan-bar"><div className="h-full rounded-full bg-foreground/45 transition-[margin] duration-75" style={{ width: `${bar.width * 100}%`, marginLeft: `${bar.left * 100}%` }} /></div>}
      {overlay && <div className="mt-3 flex items-center px-[3%]">{overlay}</div>}
      <div className="mt-3 flex gap-2 overflow-x-auto px-[3%] pb-1" aria-label="Choose product picture">{slides.map((src,i)=><Button key={src+i} variant="ghost" aria-label={i===artIndex ? repeating ? "View pattern preview" : "View full artwork" : `View room photo ${i+1}`} aria-pressed={i===index} onClick={()=>go(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 p-0 ${i===index?"border-primary":"border-border"}`}><img src={pics[i]?.srcSet ? pics[i]!.srcSet!.split(", ")[0].split(" ")[0] : src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover"/></Button>)}</div>
      <Dialog open={full !== null} onOpenChange={(o) => !o && setFull(null)}>
        <DialogContent className="flex h-[94vh] max-w-[96vw] items-center justify-center border-0 bg-background p-2 sm:max-w-[96vw]">
          <DialogTitle className="sr-only">{title} picture</DialogTitle>
          {full !== null && (
            <>
              <ZoomView key={full} src={slides[full]} alt={title} trimmed={full === artIndex && repeating} />
              {slides.length > 1 && <Button variant="secondary" size="icon" aria-label="Previous photo" disabled={full === 0} onClick={() => setFull(full - 1)} className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/80"><ChevronLeft /></Button>}
              {slides.length > 1 && <Button variant="secondary" size="icon" aria-label="Next photo" disabled={full === slides.length - 1} onClick={() => setFull(full + 1)} className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/80"><ChevronRight /></Button>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Full-screen picture: pinch or wheel to zoom, drag to move, double-tap to zoom in/out. */
function ZoomView({ src, alt, trimmed }: { src: string; alt: string; trimmed: boolean }) {
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ s: number; x: number; y: number; d: number; cx: number; cy: number } | null>(null);
  const clamp = (s: number) => Math.min(6, Math.max(1, s));
  const set = (s: number, x: number, y: number) => setZ(s <= 1.001 ? { s: 1, x: 0, y: 0 } : { s, x, y });
  const dist = () => { const p = [...pts.current.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const mid = () => { const p = [...pts.current.values()]; return p.length < 2 ? p[0] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };
  return <div className="relative h-full w-full touch-none select-none overflow-hidden" data-testid="zoom-view"
    onWheel={(e) => { const s = clamp(z.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); set(s, z.x * (s / z.s), z.y * (s / z.s)); }}
    onDoubleClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; z.s > 1 ? set(1, 0, 0) : set(2.5, 0, 0); }}
    onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const m = mid(); start.current = { s: z.s, x: z.x, y: z.y, d: dist(), cx: m.x, cy: m.y }; }}
    onPointerMove={(e) => { if (!pts.current.has(e.pointerId) || !start.current) return; pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const st = start.current; const m = mid(); if (pts.current.size >= 2 && st.d) { const s = clamp(st.s * (dist() / st.d)); set(s, st.x * (s / st.s) + (m.x - st.cx), st.y * (s / st.s) + (m.y - st.cy)); } else if (z.s > 1) setZ({ s: z.s, x: st.x + (m.x - st.cx), y: st.y + (m.y - st.cy) }); }}
    onPointerUp={(e) => { pts.current.delete(e.pointerId); const m = mid(); start.current = pts.current.size ? { s: z.s, x: z.x, y: z.y, d: dist(), cx: m.x, cy: m.y } : null; }}
    onPointerCancel={(e) => { pts.current.delete(e.pointerId); start.current = null; }}>
    <img src={src} alt={alt} draggable={false} onContextMenu={(e) => e.preventDefault()} style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, transformOrigin: "center center", cursor: z.s > 1 ? "grab" : "zoom-in" }} className={`h-full w-full object-contain ${trimmed ? "[clip-path:inset(0_4%_0_0)]" : ""}`} />
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-background/85 p-0.5">
      <Button variant="ghost" size="icon" aria-label="Zoom out" className="h-8 w-8 rounded-full" onClick={() => set(clamp(z.s / 1.5), z.x / 1.5, z.y / 1.5)}><Minus /></Button>
      <button type="button" className="min-w-12 text-xs tabular-nums" onClick={() => set(1, 0, 0)} aria-label="Fit to screen">{Math.round(z.s * 100)}%</button>
      <Button variant="ghost" size="icon" aria-label="Zoom in" className="h-8 w-8 rounded-full" onClick={() => set(clamp(z.s * 1.5), z.x * 1.5, z.y * 1.5)}><Plus /></Button>
    </div>
  </div>;
}
