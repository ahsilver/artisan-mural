import { ChevronsLeftRight } from "lucide-react";
import { useRef, useState } from "react";

/** Drag-to-compare slider: original on the left, wallpapered room on the right. */
export function BeforeAfter({
  before,
  after,
  beforeAlt,
  afterAlt,
  blurAfter = false,
  className = "",
  loading = "eager",
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  blurAfter?: boolean;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [split, setSplit] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  function move(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  }
  return (
    <div
      ref={ref}
      className={`relative touch-none select-none overflow-hidden bg-muted ${className}`}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) move(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <img
        src={before}
        alt={beforeAlt}
        draggable={false}
        loading={loading}
        decoding="async"
        width={1536}
        height={1024}
        className="block h-full w-full object-cover"
      />
      <img
        src={after}
        alt={afterAlt}
        draggable={false}
        loading={loading}
        decoding="async"
        width={1536}
        height={1024}
        className={`absolute inset-0 h-full w-full object-cover ${blurAfter ? "blur-sm" : ""}`}
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background"
        style={{ left: `${split}%` }}
      />
      <button
        type="button"
        aria-label="Drag to compare before and after"
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-border bg-background text-foreground shadow-paper"
        style={{ left: `${split}%` }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSplit((s) => Math.max(0, s - 5));
          if (e.key === "ArrowRight") setSplit((s) => Math.min(100, s + 5));
        }}
      >
        <ChevronsLeftRight className="h-4 w-4" />
      </button>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[11px] uppercase tracking-[0.14em]">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[11px] uppercase tracking-[0.14em]">
        After
      </span>
    </div>
  );
}
