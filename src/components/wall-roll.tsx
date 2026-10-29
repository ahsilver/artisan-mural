import type { ReactNode } from "react";

/** One wide wallpaper roll that unrolls down across the full width of the section (top to bottom), then the content fades in. */
export function WallRoll({ src, children, className = "", minH = "min-h-[420px] sm:min-h-[520px]", label }: { src: string; children?: ReactNode; className?: string; minH?: string; label?: string }) {
  return <section className={`wall-roll ${minH} ${className}`} aria-label={label} data-testid="wall-roll">
    <div className="wall-roll-rod" aria-hidden="true" />
    <div className="wall-roll-paper" style={{ backgroundImage: `url(${src})` }} role="img" aria-label={label ?? "Wallpaper"} />
    <div className="wall-roll-cyl" aria-hidden="true" style={{ backgroundImage: `linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0) 35%,rgba(8,38,53,.25) 70%,rgba(8,38,53,.55)),url(${src})` }} />
    {children && <div className="wall-roll-content">{children}</div>}
  </section>;
}
