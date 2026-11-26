/**
 * Customize & order, built exactly like the sample site's page: the wall with numbered panels, sizes and a
 * "Drag to move" hint; under it the panel line and a design-size slider; on the right the wall size, design size
 * with a real sharpness (DPI) meter, the "bigger than the design" choices, paper, total and Add to cart.
 *
 * Everything is stored as the shared WallSelection (wall-selection.ts), and the wall is drawn from printGeometry,
 * the same numbers the print file is made from, so what the customer sees is exactly what gets printed.
 */
import { useEffect, useRef, useState } from "react";
import type { Design, Material } from "@/lib/catalog";
import { money, unitPrice } from "@/lib/catalog";
import { MAX_REPEAT_ZOOM, MIN_ARTWORK_ZOOM, initialWall, frameGeometry, measurementInches, orderSqft, panelGeometry, repeatStyle, tileGeometry, type WallSelection } from "@/lib/wall-selection";
import { MIN_PRINT_DPI, printGeometry } from "@/lib/print-pdf";

/** Without the original's pixel size we assume the designer's size is a 250 DPI print, as the shop asks designers to send. */
export const DESIGN_DPI = 250;
const STEP = 1.08;

/** Size of the design compared with the designer's own size (1 = 100%), and what that means in print. */
export function sizeFacts(design: Design, sel: WallSelection) {
  const wallWcm = measurementInches(sel.width, sel.unit) * 2.54, wallHcm = measurementInches(sel.height, sel.unit) * 2.54;
  const style = repeatStyle(design);
  if (style === "none") {
    const Dw = design.designWidthCm ?? design.maxWidthCm ?? wallWcm, Dh = Dw / sel.artRatio;
    const f = frameGeometry(sel);
    const printedW = wallWcm / f.w; // the whole picture's printed width
    const s = printedW / Dw;
    const need = Math.max(wallWcm / Dw, wallHcm / Dh); // smallest size that still covers the wall
    const px = design.printPx ?? Math.round((Dw / 2.54) * DESIGN_DPI);
    const dpi = Math.round(px / (printedW / 2.54));
    const maxCm = design.maxWidthCm ?? Dw;
    return { mural: true, s, need, dpi, Dw, Dh, printedW, printedH: printedW / sel.artRatio, maxCm, px, wallWcm, wallHcm, tileCm: 0, baseW: 0 };
  }
  const { tw } = tileGeometry(design, sel);
  const baseW = design.repeatCm ?? (design.printHeightCm ? design.printHeightCm * sel.artRatio : 60);
  const tileCm = tw * wallWcm;
  const s = tileCm / baseW;
  const px = design.printPx ?? Math.round((baseW / 2.54) * DESIGN_DPI);
  const dpi = Math.round(px / (tileCm / 2.54));
  return { mural: false, s, need: 0, dpi, Dw: baseW, Dh: baseW / sel.artRatio, printedW: tileCm, printedH: tileCm / sel.artRatio, maxCm: Infinity, px, wallWcm, wallHcm, tileCm, baseW };
}
/** The selection for a given size (1 = designer's size), keeping the wall and the chosen spot. */
export function withSize(design: Design, sel: WallSelection, s: number): WallSelection {
  const wallWcm = measurementInches(sel.width, sel.unit) * 2.54;
  if (repeatStyle(design) === "none") {
    const Dw = design.designWidthCm ?? design.maxWidthCm ?? wallWcm;
    return { ...sel, zoom: Math.min(1, Math.max(MIN_ARTWORK_ZOOM, wallWcm / (s * Dw))) };
  }
  const k = repeatStyle(design) === "both" ? 2 : 0.7;
  return { ...sel, zoom: Math.min(MAX_REPEAT_ZOOM, Math.max(MIN_ARTWORK_ZOOM, k / s)) };
}
const fmt1 = (n: number) => String(Math.round(n * 10) / 10);
const unitWord = (u: WallSelection["unit"]) => u;
const ftOf = (cm: number) => fmt1(cm / 30.48);

type Props = {
  design: Design; designerName: string; title: string; thumb: string; colorName?: string | undefined;
  selection: WallSelection; onChange: (s: WallSelection) => void;
  materials: Material[]; material?: Material | undefined; onMaterial: (id: string) => void;
  addLabel: string; onAdd: () => void; onChat: (fit?: boolean) => void; changeHref: React.ReactNode; tryAnother: React.ReactNode;
  below?: React.ReactNode; stageOverride?: React.ReactNode;
};

export function SizeStudio(p: Props) {
  const { design, selection: sel, onChange } = p;
  const F = sizeFacts(design, sel);
  const mural = F.mural;
  const wallRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [enlarge, setEnlarge] = useState(false);
  const [modal, setModal] = useState(false);
  const shownBig = useRef(false);
  const latest = useRef(sel); latest.current = sel;
  // untouched default size (nobody has sized it yet): start at the designer's size
  const fresh = useRef(sel.zoom === initialWall.zoom && sel.x === 0.5 && sel.y === 0.5);

  // the picture's real proportion (a picture that loaded before the page was ready never fires onLoad)
  useEffect(() => {
    const im = new Image(); im.onload = () => {
      const cur = latest.current, r = im.naturalWidth / im.naturalHeight; if (!(r > 0)) return;
      let next = Math.abs(r - cur.artRatio) > 0.001 ? { ...cur, artRatio: r } : cur;
      // a fresh visit (no size chosen yet) starts at the designer's size: 100% for repeats, "just covers the wall" for murals
      if (fresh.current) { fresh.current = false; next = withSize(design, next, repeatStyle(design) === "none" ? sizeFacts(design, next).need : 1); }
      if (next !== cur) onChange(next);
    }; im.src = design.image;
  }, [design.image, sel.artRatio]);
  // the wall keeps the proportion of the customer's wall and fits the screen
  useEffect(() => {
    const st = stageRef.current; if (!st) return;
    const fit = () => { const W = measurementInches(sel.width, sel.unit), H = measurementInches(sel.height, sel.unit); const maxW = st.clientWidth - 48, maxH = Math.max(220, window.innerHeight * 0.62);
      let w = maxW, h = (w * H) / W; if (h > maxH && window.innerWidth > 560) { h = maxH; w = (h * W) / H; } setBox({ w, h }); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(st); return () => ro.disconnect();
  }, [sel.width, sel.height, sel.unit]);

  // limits of the slider: murals from "just covers the wall" up to the sharpest-allowed size; repeats 35% to the same
  const sharpMax = Math.max(0.05, F.px / ((MIN_PRINT_DPI / 2.54) * F.Dw)); // size at which it reaches the lowest print DPI
  const lo = mural ? F.need : 0.35, hi = mural ? Math.max(F.need, Math.min(sharpMax, F.maxCm / F.Dw) * 1.0001, 1) : Math.max(1, sharpMax);
  const toSlider = (s: number) => (hi <= lo ? 0 : Math.round((1000 * Math.log(Math.max(lo, Math.min(hi, s)) / lo)) / Math.log(hi / lo)));
  const fromSlider = (v: number) => lo * Math.pow(hi / lo, v / 1000);
  const setS = (s: number) => onChange(withSize(design, sel, Math.min(hi, Math.max(lo, s))));

  // when the wall changes, murals go back to "just covers the wall" (the sample does the same)
  const wallKey = `${sel.width}x${sel.height}${sel.unit}`; const lastWall = useRef(wallKey);
  useEffect(() => { if (lastWall.current === wallKey) return; lastWall.current = wallKey; setEnlarge(false); shownBig.current = false; if (mural) onChange(withSize(design, sel, F.need)); }, [wallKey]);

  // bigger than the design: may we enlarge it (sharp enough and within the designer's largest size)?
  const bigger = mural && F.need > 1.001;
  const needDpi = Math.round(F.px / ((F.need * F.Dw) / 2.54));
  const tooBig = bigger && (needDpi < MIN_PRINT_DPI || F.need * F.Dw > F.maxCm + 0.5);
  useEffect(() => { if (bigger && !enlarge && !shownBig.current) { shownBig.current = true; setModal(true); } if (!bigger) shownBig.current = false; }, [bigger, enlarge]);
  const blocked = (bigger && (tooBig || !enlarge)) || F.dpi < MIN_PRINT_DPI;
  const q = F.dpi >= 240 ? "Excellent" : F.dpi >= 200 ? "Very good" : F.dpi >= MIN_PRINT_DPI ? "Good from a normal distance" : "Too soft to print";
  const pct = Math.round(F.s * 100);

  // the wall, drawn from the print geometry (exactly what is printed)
  let draws: { x: number; y: number; w: number; h: number }[] = [];
  try { draws = printGeometry(design as any, sel).draws.slice(0, 4000); } catch { draws = []; }
  const panels = panelGeometry(sel.width, sel.unit);
  const starts = [0, ...panels.guides.map((g) => g.start)];
  const wIn = measurementInches(sel.width, sel.unit);
  const lastPanelIn = Math.round(wIn - (panels.count - 1) * 49);

  // drag to move: murals choose the part, repeats slide the pattern
  const drag = useRef<{ x: number; y: number; s: WallSelection } | null>(null);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, s: sel }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); wallRef.current?.classList.add("drag"); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !box.w) return; const dx = (e.clientX - d.x) / box.w, dy = (e.clientY - d.y) / box.h;
    if (mural) { const f = frameGeometry(d.s); onChange({ ...d.s, x: Math.min(1, Math.max(0, f.x - dx * f.w)), y: Math.min(1, Math.max(0, f.y - dy * f.h)) }); return; }
    const { tw, th, style } = tileGeometry(design, d.s); const wrap = (v: number) => ((v % 1) + 1) % 1;
    onChange({ ...d.s, x: wrap(d.s.x - dx / tw), y: style === "both" ? wrap(d.s.y - dy / th) : th > 1 ? Math.min(1, Math.max(0, d.s.y - dy / (th - 1))) : d.s.y });
  };
  const up = () => { drag.current = null; wallRef.current?.classList.remove("drag"); };

  const setWall = (k: "width" | "height", v: string) => { const n = Number(v); if (!(n > 0)) return; onChange({ ...sel, [k]: n }); };
  const setUnit = (u: WallSelection["unit"]) => { const conv = (v: number) => { const inch = measurementInches(v, sel.unit); return Math.round((u === "cm" ? inch * 2.54 : u === "ft" ? inch / 12 : inch) * 10) / 10; }; onChange({ ...sel, unit: u, width: conv(sel.width), height: conv(sel.height) }); };
  const sq = orderSqft(sel);
  const rate = p.material ? unitPrice(design, p.material) : 0;
  const wallTxt = `${fmt1(sel.width)} × ${fmt1(sel.height)} ${unitWord(sel.unit)}`;
  const zoomRow = (id: string) => <>
    <button type="button" className="zb" aria-label="Make the design smaller" onClick={() => setS(F.s / STEP)}>−</button>
    <label htmlFor={id} className="sr">Design size</label>
    <input id={id} type="range" min={0} max={1000} value={toSlider(F.s)} onChange={(e) => setS(fromSlider(Number(e.target.value)))} />
    <button type="button" className="zb" aria-label="Make the design bigger" onClick={() => setS(F.s * STEP)}>+</button>
  </>;

  return <div className="sz-grid">
    <div className="sz-stage" ref={stageRef}>
      {p.stageOverride ?? <>
        <div className="sz-wall" ref={wallRef} style={{ width: box.w || undefined, height: box.h || undefined }} aria-label="Your wall. Drag to move the design." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="sz-art">{draws.map((d, k) => <span key={k} className="sz-tile" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `calc(${d.w * 100}% + 1px)`, height: `calc(${d.h * 100}% + 1px)`, backgroundImage: `url("${design.image}")` }} />)}</div>
          <div className="sz-guides">{panels.guides.map((g, k) => <i key={k} style={{ left: `${g.start * 100}%` }} />)}{starts.map((s0, k) => <b key={k} style={{ left: `calc(${s0 * 100}% + 6px)` }}>{k + 1}</b>)}</div>
          <span className="sz-dim w">{fmt1(sel.width)} {sel.unit}</span><span className="sz-dim h">{fmt1(sel.height)} {sel.unit}</span>
          <span className="sz-hint">Drag to move</span>
        </div>
        <div className="sz-under"><span>{panels.count} panel{panels.count > 1 ? "s" : ""}, 52 in wide, 3 in overlap</span>
          <span>{mural ? `Designer's size ${ftOf(F.Dw)} × ${ftOf(F.Dh)} ft · printed at ${ftOf(F.printedW)} × ${ftOf(F.printedH)} ft` : `Covers any wall size · pattern tile ${Math.round(F.tileCm / 2.54)} in wide (designer's size ${Math.round(F.baseW / 2.54)} in)`}</span></div>
        <div className="sz-zoom">{zoomRow("zoom")}<span className="zpct">{pct}%</span></div>
      </>}
      {p.below}
    </div>

    <aside className="sz-panel">
      <div className="sz-item"><img src={p.thumb} alt="" /><div><b>{p.title}{p.colorName ? ` · ${p.colorName}` : ""}</b><small>by {p.designerName} · {mural ? "Mural" : "Repeat"}</small></div>{p.changeHref}</div>

      <div className="blk">
        <h3 className="bh"><span>1</span>Your wall</h3>
        <div className="sz-inputs">
          <label className="fld"><span>Width</span><span className="iv"><input type="number" min={0.5} step={sel.unit === "ft" ? 0.5 : 1} value={sel.width} inputMode="decimal" onChange={(e) => setWall("width", e.target.value)} /><em><select aria-label="Unit" value={sel.unit} onChange={(e) => setUnit(e.target.value as WallSelection["unit"])}><option value="ft">ft</option><option value="in">in</option><option value="cm">cm</option></select></em></span></label>
          <span className="x" aria-hidden="true">×</span>
          <label className="fld"><span>Height</span><span className="iv"><input type="number" min={0.5} step={sel.unit === "ft" ? 0.5 : 1} value={sel.height} inputMode="decimal" onChange={(e) => setWall("height", e.target.value)} /><em>{sel.unit}</em></span></label>
        </div>
        <p className="hint">Wall to wall, floor to ceiling. Trim is added for you.</p>
      </div>

      <div className="blk">
        <h3 className="bh"><span>2</span>Design size <b className="bh-val">{pct}%</b></h3>
        <div className="sizer">{zoomRow("zoom2")}</div>
        <div className="seg2" role="group" aria-label="Quick sizes">
          <button type="button" aria-pressed={Math.abs(F.s - 1) < 0.005} onClick={() => setS(1)}>Designer's original size</button>
          {mural && <button type="button" aria-pressed={Math.abs(F.s - F.need) < 0.005} onClick={() => setS(F.need)}>Fit to my wall</button>}
        </div>
        <div className={"sharp" + (F.dpi < MIN_PRINT_DPI ? " bad" : F.dpi < 200 ? " warn" : "")}>
          <div className="sharp-top"><span>Sharpness <button type="button" className="qtip sm" title={`At the designer's size this file prints at ${Math.round(F.px / (F.Dw / 2.54))} DPI. 200 is very good, ${MIN_PRINT_DPI} is the lowest we print.`} aria-label="About sharpness">?</button></span><b>{F.dpi} DPI · {q}</b></div>
          <div className="meter"><i style={{ left: `${Math.max(2, Math.min(98, ((F.dpi - 75) / (250 - 75)) * 100))}%` }} /><span style={{ left: "40%" }} title="150 DPI" /><span style={{ left: "60%" }} title="200 DPI" /></div>
        </div>
      </div>

      {bigger && <div className={"notice" + (tooBig ? " bad" : "")} role="alert">
        <b>Your wall is bigger than this design ({ftOf(F.Dw)} × {ftOf(F.Dh)} ft).</b>
        <p>{tooBig ? `To cover it we would have to enlarge it to ${needDpi} DPI${F.need * F.Dw > F.maxCm + 0.5 ? `, beyond the largest size the designer allows (${ftOf(F.maxCm)} ft wide)` : ", which prints blurry"}. ${p.designerName} can extend the scene or send a larger file, free to ask.` : `We can enlarge it to fit: it prints at ${needDpi} DPI, sharp from a normal distance but softer up close. Or ask ${p.designerName} to extend the scene for your wall.`}</p>
        <div className="notice-opts">
          {!tooBig && <button type="button" className="btn btn-wine btn-sm" onClick={() => { setEnlarge(true); setS(F.need); }}>{enlarge ? "✓ Enlarging it" : `Enlarge it (${needDpi} DPI)`}</button>}
          <button type="button" className="btn btn-sm optline" onClick={() => p.onChat(true)}>Chat with the designer to extend it</button>
        </div>
      </div>}

      {p.materials.length > 0 && <div className="blk">
        <h3 className="bh"><span>3</span>Paper</h3>
        <div className="chips papers" role="radiogroup" aria-label="Paper">{p.materials.map((m) => <button key={m.id} type="button" role="radio" aria-checked={m.id === p.material?.id} className="chip" onClick={() => p.onMaterial(m.id)}>{m.name} <small>{money(unitPrice(design, m))}</small></button>)}</div>
      </div>}

      <div className="sz-total"><div><b>{fmt1(sq)} sq ft</b><small>{p.material ? `${p.material.name} · ` : ""}{money(rate)} / sq ft</small></div><strong>{money(sq * rate)}</strong></div>
      <button type="button" className={"btn btn-wine big" + (blocked ? " disabled" : "")} aria-disabled={blocked} data-testid="add-to-cart" onClick={() => { if (!blocked) p.onAdd(); else if (bigger) setModal(true); }}>{p.addLabel}</button>
      <p className="sz-note">{blocked ? (tooBig ? "Chat with the designer, or enter a smaller wall." : F.dpi < MIN_PRINT_DPI ? "Too soft to print at this size: make the design smaller." : 'Choose "Enlarge it" or chat with the designer first.') : `Printed for ${wallTxt} at ${pct}% size, ${F.dpi} DPI, just as you see it.`}</p>
      <div className="sz-links"><button type="button" className="up-link" onClick={() => p.onChat()}>Chat with the designer</button>{p.tryAnother}</div>
    </aside>

    {modal && bigger && <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bmH"><h3 id="bmH">Your wall is bigger than this design</h3>
        <p>{p.title} was made for walls up to {ftOf(F.Dw)} ft wide. {tooBig ? `Stretching it to your wall would print at ${needDpi} DPI, which looks blurry.` : `We can enlarge it to fit: it prints at ${needDpi} DPI, sharp from a normal distance, softer up close.`} {p.designerName.split(" ")[0]} can also extend the scene to fit your wall exactly.</p>
        <div className="mb"><button type="button" className="btn btn-wine" onClick={() => { setModal(false); p.onChat(true); }}>Chat with {p.designerName.split(" ")[0]} to extend it</button>{!tooBig && <button type="button" className="btn optline" onClick={() => { setModal(false); setEnlarge(true); setS(F.need); }}>Enlarge it ({needDpi} DPI)</button>}</div>
        <button type="button" className="link" onClick={() => setModal(false)}>Change my wall size</button>
      </div>
    </div>}
  </div>;
}
