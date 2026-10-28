import { Columns3, Minus, Plus, Ruler, PersonStanding } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Design } from "@/lib/catalog";
import {
  frameGeometry,
  tileGeometry,
  measurementInches,
  panelGeometry,
  PANEL_WIDTH_IN,
  PANEL_OVERLAP_IN,
  MIN_ARTWORK_ZOOM,
  MAX_REPEAT_ZOOM,
  type WallSelection,
} from "@/lib/wall-selection";

/** Viewport proportions (width / height) and how much of it the wall frame may fill. */
const FILL = 0.88;
/** One fixed viewport shape for every wall: the wall is drawn inside it at its true proportions ("contain", centred),
 *  so 5x5, 7x5, 12x9 and 30x8 walls all look comparable and nothing grows past the page. */
const viewRatioFor = (_wallRatio: number, compact: boolean) => (compact ? 4 / 3 : 16 / 10);

type Props = {
  design: Design;
  selection: WallSelection;
  onChange?: (selection: WallSelection) => void;
  compact?: boolean;
  maxHeight?: string;
  /** Show the panels / person / ruler toggles even when the wall is not movable (product page). */
  tools?: boolean;
};

/** A typical adult man, used for the "person for scale" overlay. */
const PERSON_IN = 69;
const ftIn = (inches: number) => {
  const r = Math.round(inches);
  const f = Math.floor(r / 12), i = r % 12;
  return f ? `${f} ft${i ? ` ${i} in` : ""}` : `${i} in`;
};
/** Ruler step in inches so there are at most ~7 labels along a side. */
const rulerStep = (inches: number) => [6, 12, 24, 36, 48, 60, 96, 120, 240, 480, 960].find((s) => inches / s <= 7) ?? 1200;

/**
 * Fixed wall frame over movable artwork. The frame size only depends on the wall's
 * proportions, so zooming changes the artwork size, never the frame.
 */
export function MuralFramer({ design, selection, onChange, compact = false, maxHeight, tools }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [rulers, setRulers] = useState(false);
  const [panels, setPanels] = useState(true);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(el.getBoundingClientRect().width));
    ro.observe(el);
    setBoxW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const [person, setPerson] = useState(false);
  const dragRef = useRef<{ clientX: number; clientY: number; selection: WallSelection } | null>(null);
  const frame = frameGeometry(selection);
  const wallRatio = selection.width / selection.height;
  // Frame size in viewport fractions (independent of zoom).
  const VIEW_RATIO = viewRatioFor(wallRatio, compact);
  const fw = Math.min(FILL, (FILL * wallRatio) / VIEW_RATIO);
  const fh = (fw * VIEW_RATIO) / wallRatio;
  // Artwork size in viewport fractions: the frame covers frame.w of the artwork width.
  const aw = fw / frame.w;
  const ah = fh / frame.h;
  const tile = tileGeometry(design, selection);
  // half-drop match: every other column sits half a tile lower, drawn once into a two-column tile
  const hdOn = tile.style === "both" && design.match === "halfdrop";
  const [hdTile, setHdTile] = useState<string | null>(null);
  useEffect(() => {
    if (!hdOn) { setHdTile(null); return; }
    let url = "", dead = false;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { try { const w = Math.min(img.naturalWidth, 1200), h = Math.round((w * img.naturalHeight) / img.naturalWidth); const c = document.createElement("canvas"); c.width = 2 * w; c.height = h; const x = c.getContext("2d")!; x.drawImage(img, 0, 0, w, h); x.drawImage(img, w, -h / 2, w, h); x.drawImage(img, w, h / 2, w, h); c.toBlob((b) => { if (b && !dead) { url = URL.createObjectURL(b); setHdTile(url); } }, "image/jpeg", 0.9); } catch { /* straight match stays */ } };
    img.src = design.image;
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [hdOn, design.image]);
  const repeating = tile.style !== "none";
  const maxZoom = repeating ? MAX_REPEAT_ZOOM : Math.min(1, wallRatio / selection.artRatio);
  const minZoom = Math.min(MIN_ARTWORK_ZOOM, maxZoom);
  const currentZoom = Math.min(maxZoom, Math.max(minZoom, selection.zoom));
  // Logarithmic travel keeps original-size repeats easy to adjust across a wide range.
  const sizePosition = Math.log(maxZoom / currentZoom) / Math.log(maxZoom / minZoom);
  const tW = fw * tile.tw,
    tH = fh * tile.th;
  function clampSel(s: WallSelection) {
    if (repeating) return s;
    const g = frameGeometry(s);
    return { ...s, x: Math.min(1 - g.w / 2, Math.max(g.w / 2, s.x)), y: Math.min(1 - g.h / 2, Math.max(g.h / 2, s.y)) };
  }
  function move(clientX: number, clientY: number) {
    const el = boxRef.current,
      drag = dragRef.current;
    if (!el || !onChange || !drag) return;
    const box = el.getBoundingClientRect();
    if (repeating) {
      const wrap = (v: number) => ((v % 1) + 1) % 1;
      const x = wrap(drag.selection.x - (clientX - drag.clientX) / (box.width * tW));
      const y =
        tile.style === "both"
          ? wrap(drag.selection.y - (clientY - drag.clientY) / (box.height * tH))
          : tH - fh > 0.0001
            ? Math.min(1, Math.max(0, drag.selection.y - (clientY - drag.clientY) / (box.height * (tH - fh))))
            : 0.5;
      onChange({ ...drag.selection, x, y });
      return;
    }
    const start = frameGeometry(drag.selection);
    const x = start.x - (clientX - drag.clientX) / (box.width * aw);
    const y = start.y - (clientY - drag.clientY) / (box.height * ah);
    onChange(clampSel({ ...drag.selection, x, y }));
  }
  const setZoom = (zoom: number) =>
    onChange?.(
      clampSel({
        ...selection,
        ...(repeating ? {} : { x: frame.x, y: frame.y }),
        zoom: Math.min(maxZoom, Math.max(minZoom, zoom)),
      }),
    );
  const left = { frame: (1 - fw) / 2, art: 0.5 - frame.x * aw };
  const top = { frame: (1 - fh) / 2, art: 0.5 - frame.y * ah };
  const shade = "pointer-events-none absolute bg-background/80";
  const panelLayout = panelGeometry(selection.width, selection.unit);
  const wIn = measurementInches(selection.width, selection.unit);
  const hIn = measurementInches(selection.height, selection.unit);
  const showTools = !compact && (!!onChange || !!tools);
  // Person at true scale: the frame is the wall's full height, so PERSON_IN / wall height of the frame.
  const personH = Math.min(top.frame + fh, (fh * PERSON_IN) / hIn);
  const advance = PANEL_WIDTH_IN - PANEL_OVERLAP_IN;
  // Panel cells between seam centres; each labelled with that panel's width on the wall.
  const cells = Array.from({ length: Math.min(panelLayout.count, 200) }, (_, i) => {
    const a = i === 0 ? 0 : i * advance + PANEL_OVERLAP_IN / 2;
    const b = i === panelLayout.count - 1 ? wIn : (i + 1) * advance + PANEL_OVERLAP_IN / 2;
    const width = Math.min(PANEL_WIDTH_IN, wIn - i * advance);
    return { a: a / wIn, b: b / wIn, width };
  });
  const cellPx = boxW ? (boxW * fw * advance) / wIn : 99;
  const lastTrim = cells.length > 1 && cells[cells.length - 1].width < PANEL_WIDTH_IN - 0.5 ? cells[cells.length - 1].width : null;
  const step = rulerStep(Math.max(wIn, hIn));
  const ticks = (len: number) => Array.from({ length: Math.floor(len / step + 1e-9) + 1 }, (_, k) => k * step);
  const sizeStyle = maxHeight ? { width: `min(100%, calc(${maxHeight} * ${VIEW_RATIO}))`, marginInline: "auto" } : {};
  return (
    <div data-wall-tools-root>
      <div style={sizeStyle}>
      <div
        ref={boxRef}
        role={onChange ? "group" : undefined}
        aria-label="Wall artwork position"
        tabIndex={onChange ? 0 : undefined}
        className={`relative overflow-hidden rounded-xl bg-muted select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${onChange ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ aspectRatio: VIEW_RATIO }}
        onPointerDown={(e) => {
          if (!onChange) return;
          dragRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            selection: repeating ? selection : { ...selection, x: frame.x, y: frame.y },
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragRef.current) move(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
        }}
        onKeyDown={(e) => {
          if (!onChange) return;
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
             setZoom(currentZoom / 1.1);
            return;
          }
          if (e.key === "-") {
            e.preventDefault();
             setZoom(currentZoom * 1.1);
            return;
          }
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          const x = frame.x + (e.key === "ArrowLeft" ? 0.02 : e.key === "ArrowRight" ? -0.02 : 0);
          const y = frame.y + (e.key === "ArrowUp" ? 0.02 : e.key === "ArrowDown" ? -0.02 : 0);
          onChange(clampSel({ ...selection, x, y }));
        }}
      >
        {repeating &&
          (() => {
            const ox = left.frame - selection.x * tW,
              oy =
                tile.style === "both" ? top.frame - selection.y * tH : top.frame - selection.y * Math.max(0, tH - fh);
            // half-drop tile spans two columns: snap by two so column parity matches the print file
            const perX = hdTile && tW <= 1 ? 2 * tW : tW;
            const sx = ox - Math.ceil(ox / perX) * perX,
              sy = tile.style === "both" ? oy - Math.ceil(oy / tH) * tH : oy;
            return (
              <div
                data-repeat-layer
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  left: `${sx * 100}%`,
                  top: `${sy * 100}%`,
                  width: "300%",
                  height: tile.style === "both" ? "300%" : `${tH * 100}%`,
                  backgroundImage: `url(${hdTile ?? design.image})`,
                  backgroundRepeat: tile.style === "both" ? "repeat" : "repeat-x",
                  backgroundSize: `${(tW / 3) * (hdTile ? 2 : 1) * 100}% ${tile.style === "both" ? (tH / 3) * 100 : 100}%`,
                }}
              />
            );
          })()}
        <img
          src={design.image}
          alt={design.title}
          draggable={false}
          loading={onChange ? undefined : "lazy"}
          className={`pointer-events-none absolute ${repeating ? "opacity-0" : ""} max-w-none object-fill`}
          style={{
            width: `${aw * 100}%`,
            height: `${ah * 100}%`,
            left: `${left.art * 100}%`,
            top: `${top.art * 100}%`,
          }}
          onLoad={(e) => {
            const image = e.currentTarget;
            const ratio = image.naturalWidth / image.naturalHeight;
            if (onChange && Math.abs(ratio - selection.artRatio) > 0.001)
              onChange(clampSel({ ...selection, artRatio: ratio }));
          }}
        />
        <div className={`${shade} inset-x-0 top-0`} style={{ height: `${top.frame * 100}%` }} />
        <div className={`${shade} inset-x-0 bottom-0`} style={{ height: `${top.frame * 100}%` }} />
        <div
          className={`${shade} left-0`}
          style={{ top: `${top.frame * 100}%`, height: `${fh * 100}%`, width: `${left.frame * 100}%` }}
        />
        <div
          className={`${shade} right-0`}
          style={{ top: `${top.frame * 100}%`, height: `${fh * 100}%`, width: `${left.frame * 100}%` }}
        />
        <div
          data-print-frame
          className="pointer-events-none absolute border-2 border-dashed border-foreground"
          style={{
            left: `${left.frame * 100}%`,
            top: `${top.frame * 100}%`,
            width: `${fw * 100}%`,
            height: `${fh * 100}%`,
          }}
        >
          {panels && showTools && (
            <div data-panel-guides className="absolute inset-0 overflow-hidden">
              {panelLayout.guides.map((guide, i) => (
                <div
                  key={i}
                  className="absolute inset-y-0 border-x border-white/90 bg-white/25"
                  style={{ left: `${guide.start * 100}%`, width: `max(2px, ${guide.overlap * 100}%)`, boxShadow: "0 0 0 1px rgba(17,24,39,.35)" }}
                />
              ))}
            </div>
          )}
          {rulers && showTools && (
            <div data-wall-rulers className="pointer-events-none absolute inset-0" style={{ color: "#111827" }}>
              {ticks(wIn).map((n) => (
                <span key={"x" + n} className="absolute top-0 h-[7px] -translate-y-full border-l border-[#111827]" style={{ left: `${(n / wIn) * 100}%` }}>
                  <span className="absolute bottom-[9px] -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-white/90 px-1 text-[10.5px] leading-[14px]">
                    {n}{n === 0 ? " in" : ""}
                  </span>
                </span>
              ))}
              {ticks(hIn).map((n) => (
                <span key={"y" + n} className="absolute left-0 w-[7px] -translate-x-full border-t border-[#111827]" style={{ top: `${(n / hIn) * 100}%` }}>
                  <span className="absolute right-[9px] -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-white/90 px-[1px] py-1 text-[10.5px] leading-[14px] [writing-mode:vertical-rl] rotate-180">
                    {n}{n === 0 ? " in" : ""}
                  </span>
                </span>
              ))}
            </div>
          )}
          {!compact && !rulers && (
            <>
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-foreground bg-background px-3 py-1 text-xs text-foreground">
                {selection.width} {selection.unit}
              </span>
              <span className="absolute left-full top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-foreground bg-background px-3 py-1 text-xs text-foreground [writing-mode:vertical-rl]">
                {selection.height} {selection.unit}
              </span>
            </>
          )}
        </div>
        {person && showTools && (
          <div
            data-person-scale
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              right: `${(left.frame + fw * 0.05) * 100}%`,
              bottom: `${top.frame * 100}%`,
              height: `${personH * 100}%`,
              aspectRatio: "48 / 165",
            }}
          >
            <svg viewBox="-2 -2 52 169" className="h-full w-full" preserveAspectRatio="xMidYMax meet">
              <g fill="#1F2937" fillOpacity="0.88" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round">
                <circle cx="24" cy="10" r="10" />
                <path d="M15 23 Q24 20 33 23 L39 32 L47 76 L40 79 L31 43 L32 91 L36 158 L28 165 L23 99 L19 161 L9 165 L15 90 L16 43 L8 78 L1 75 L9 32 Z" />
              </g>
            </svg>
          </div>
        )}
      </div>
      {panels && showTools && (
        <div data-panel-widths className="relative h-7 select-none" aria-label={`${panelLayout.count} panels`}>
          <div className="absolute top-[3px] h-px bg-[#9CA3AF]" style={{ left: `${left.frame * 100}%`, width: `${fw * 100}%` }} />
          {cells.map((c, i) => (
            <div key={i} className="absolute top-0 h-full" style={{ left: `${(left.frame + fw * c.a) * 100}%`, width: `${fw * (c.b - c.a) * 100}%` }}>
              <span className="absolute left-0 top-0 h-[7px] border-l border-[#6B7280]" />
              {i === cells.length - 1 && <span className="absolute right-0 top-0 h-[7px] border-r border-[#6B7280]" />}
              {(cellPx >= 34 || cells.length === 1) && (
                <span className="absolute inset-x-0 top-[9px] truncate text-center text-[11.5px] leading-4 text-[#374151]">
                  {Math.round(c.width)} in
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
      {showTools && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2" data-wall-tools onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5">
            {([
              ["panels", "Panels", "Show panels", Columns3, panels, setPanels],
              ["person", "Person", "Show person for scale", PersonStanding, person, setPerson],
              ["ruler", "Ruler", "Show ruler", Ruler, rulers, setRulers],
            ] as const).map(([key, label, aria, Icon, on, set]) => (
              <button
                key={key}
                type="button"
                data-tool={key}
                aria-label={aria}
                aria-pressed={on}
                title={aria}
                onClick={() => (set as (f: (v: boolean) => boolean) => void)((v) => !v)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2.5 text-[13.5px] transition-colors ${on ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] leading-5 text-[#6B7280]" data-wall-caption>
            {[
              panels &&
                `${panelLayout.count} panel${panelLayout.count > 1 ? "s" : ""}, ${PANEL_WIDTH_IN} in wide, ${PANEL_OVERLAP_IN} in overlap${lastTrim ? `, last ${Math.round(lastTrim)} in` : ""}`,
              person && `Person ${ftIn(PERSON_IN)}`,
              rulers && `Wall ${Math.round(wIn)} x ${Math.round(hIn)} in`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}
      {onChange && (
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="shrink-0">Design size</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Make design smaller"
             disabled={currentZoom >= maxZoom}
             title="Make design smaller"
             onClick={() => setZoom(currentZoom * 1.1)}
          >
            <Minus />
          </Button>
          <input
            aria-label="Design size"
            type="range"
            min={0}
            max={100}
            value={Number.isFinite(sizePosition) ? Math.round(sizePosition * 100) : 0}
            onChange={(e) =>
              setZoom(maxZoom * Math.pow(minZoom / maxZoom, Number(e.target.value) / 100))
            }
            className="w-full accent-primary"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Make design bigger"
             disabled={currentZoom <= minZoom}
             title="Make design bigger"
             onClick={() => setZoom(currentZoom / 1.1)}
          >
            <Plus />
          </Button>
        </div>
      )}
    </div>
  );
}
