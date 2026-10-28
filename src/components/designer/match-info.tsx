import { useEffect, useId, useRef, useState } from "react";

/** "Match" label + a small "?" that explains Straight vs Half-drop. Tap/click toggles; mouse hover opens on desktop; Esc or a tap outside closes. */
export function MatchLabel() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setPinned(false); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setOpen(false); setPinned(false); } }; // capture: Esc closes only the popover, not the drawer around it
    document.addEventListener("pointerdown", down); window.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key, true); };
  }, [open]);
  return <span className="de-match" ref={wrap}
    onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={(e) => { if (e.pointerType === "mouse" && !pinned) setOpen(false); }}>
    <span className="bo-sub">Match</span>
    <button type="button" className="de-qi" aria-label="What do Straight and Half-drop mean?" aria-expanded={open} aria-controls={id} data-testid="match-info"
      onClick={() => { if (pinned) { setPinned(false); setOpen(false); } else { setPinned(true); setOpen(true); } }}>?</button>
    {open && <span className="de-pop" id={id} role="tooltip" data-testid="match-info-pop">
      <span><b>Straight:</b> the tile repeats side by side at the same height.</span>
      <span><b>Half-drop:</b> the tile is drawn so the next column is moved down exactly half the tile height; the right edge must connect to the left edge shifted half down. Upload the full repeat as the tile; we shift by exactly 50% automatically.</span>
    </span>}
  </span>;
}

/** Customers: the match is fixed by the designer — "Match: Straight" / "Match: Half-drop" as plain info with the same "?" explanation. Not a selector. Murals / sideways-only repeats show nothing. */
export function MatchFixed({ design, className = "" }: { design: { kind?: string; repeat?: string; match?: string }; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setPinned(false); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setOpen(false); setPinned(false); } };
    document.addEventListener("pointerdown", down); window.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key, true); };
  }, [open]);
  if (design.kind === "mural" || design.repeat === "horizontal" || design.repeat === "none") return null;
  const hd = design.match === "halfdrop" || design.repeat === "halfdrop";
  return <span ref={wrap} className={"relative inline-flex items-center gap-1.5 text-xs text-muted-foreground " + className} data-testid="match-fixed"
    onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={(e) => { if (e.pointerType === "mouse" && !pinned) setOpen(false); }}>
    <span>Match: <span className="font-medium text-foreground" data-testid="match-value">{hd ? "Half-drop" : "Straight"}</span></span>
    <button type="button" aria-label="What do Straight and Half-drop mean?" aria-expanded={open} aria-controls={id} data-testid="match-info"
      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold text-foreground hover:bg-accent"
      onClick={() => { if (pinned) { setPinned(false); setOpen(false); } else { setPinned(true); setOpen(true); } }}>?</button>
    {open && <span id={id} role="tooltip" data-testid="match-info-pop" className="absolute left-0 top-full z-30 mt-1.5 flex w-[min(280px,80vw)] flex-col gap-1.5 rounded-lg border border-border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-lg">
      <span><b>{hd ? "Half-drop" : "Straight"}</b> is set by the designer for this pattern, so the strips join the way it was drawn.</span>
      <span><b>Straight:</b> the pattern lines up side by side at the same height.</span>
      <span><b>Half-drop:</b> every second strip is shifted down half a repeat, so the pattern flows diagonally — common for florals and leaves.</span>
    </span>}
  </span>;
}
