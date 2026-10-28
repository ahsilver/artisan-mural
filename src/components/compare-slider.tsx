import { useEffect, useRef } from "react";

/**
 * Before / after divider laid over any picture. `before` (the untouched photo) shows to the left of the line,
 * the children (the wallpapered room) to the right. Drag the handle (or the whole picture with `wholeArea`),
 * or use the arrow keys. Moves are written straight to a CSS variable, so it stays smooth on phones.
 */
export function CompareSlider({ before, children, wholeArea = false, start = 50, className = "", style }: { before: string; children: React.ReactNode; wholeArea?: boolean; start?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const pos = useRef(start);
  const drag = useRef(false);
  const frame = useRef(0);
  function paint(v: number) {
    pos.current = Math.max(0, Math.min(100, v));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty("--split", `${pos.current}%`);
      handle.current?.setAttribute("aria-valuenow", String(Math.round(pos.current)));
    });
  }
  useEffect(() => { paint(start); return () => cancelAnimationFrame(frame.current); }, [start]);
  function at(clientX: number) { const r = ref.current!.getBoundingClientRect(); paint(((clientX - r.left) / r.width) * 100); }
  const down = (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); at(e.clientX); };
  const move = (e: React.PointerEvent) => { if (drag.current) { e.stopPropagation(); at(e.clientX); } };
  const up = (e: React.PointerEvent) => { if (drag.current) e.stopPropagation(); drag.current = false; };
  const area = wholeArea ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } : {};
  return <div ref={ref} className={`am-compare ${className.includes("absolute") ? "" : "relative"} select-none overflow-hidden ${wholeArea ? "touch-pan-y cursor-ew-resize" : "pointer-events-none"} ${className}`} style={{ ["--split" as any]: `${start}%`, ...style }} {...area}>
    {children}
    <img src={before} alt="Your room before the wallpaper" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ clipPath: "inset(0 calc(100% - var(--split)) 0 0)" }} />
    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">Before</span>
    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">After</span>
    <div ref={handle} role="slider" tabIndex={0} aria-label="Drag to compare before and after" aria-valuemin={0} aria-valuemax={100} aria-valuenow={start}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { const k = e.key; const step = e.shiftKey ? 20 : 5; if (k === "ArrowLeft" || k === "ArrowDown") paint(pos.current - step); else if (k === "ArrowRight" || k === "ArrowUp") paint(pos.current + step); else if (k === "Home") paint(0); else if (k === "End") paint(100); else return; e.preventDefault(); e.stopPropagation(); }}
      className="group pointer-events-auto absolute inset-y-0 z-10 flex w-11 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none" style={{ left: "var(--split)" }}>
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.45)]" />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md ring-black/10 transition-transform group-focus-visible:ring-2 group-focus-visible:ring-primary group-active:scale-95">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 7-5 5 5 5" /><path d="m15 7 5 5-5 5" /></svg>
      </span>
    </div>
  </div>;
}
