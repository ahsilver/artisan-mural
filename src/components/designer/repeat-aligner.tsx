import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Line up a repeat by hand (or let the site find it): the next copy is dragged with the mouse until it joins exactly,
 *  a magnifier shows the join pixel by pixel, and the result is the true repeat size (a part of the file when the
 *  designer's file holds more than one repeat). Nothing is saved here; the caller makes the corrected print file. */
export type RepeatMode = "sideways" | "straight" | "halfdrop";
export type RepeatFit = { w: number; h: number; mode: RepeatMode; blend?: boolean };

const MAX_WORK = 2000; // the picture we work on (the shop picture is up to 3200 px)

function gray(img: ImageData) { const g = new Float32Array(img.width * img.height); const d = img.data; for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j]! + 0.587 * d[j + 1]! + 0.114 * d[j + 2]!; return g; }

/** How well the copies join: 1 = like any two neighbouring pixel columns (invisible), 2+ = a visible line. */
function joinScore(g: Float32Array, W: number, H: number, pw: number, ph: number, mode: RepeatMode) {
  let base = 0, n = 0; for (let y = 0; y < H; y += 3) for (let x = 0; x < W - 1; x += 3) { base += Math.abs(g[y * W + x]! - g[y * W + x + 1]!); n++; } base = base / n || 1;
  const drop = mode === "halfdrop" ? Math.round(ph / 2) : 0;
  let s = 0; n = 0; for (let y = 0; y < ph; y++) { const y2 = (y + drop) % ph; s += Math.abs(g[y * W + pw - 1]! - g[y2 * W]!); n++; }
  const side = s / n / base;
  let top = 0;
  if (mode !== "sideways") { s = 0; n = 0; for (let x = 0; x < pw; x++) { s += Math.abs(g[(ph - 1) * W + x]! - g[x]!); n++; } top = s / n / base; }
  return { side, top };
}

/** Finds the true repeat: if the file holds the pattern more than once, the strip where it starts again. */
function findRepeat(g: Float32Array, W: number, H: number, mode: RepeatMode) {
  const band = 6;
  let base = 0, n = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W - 1; x += 2) { base += Math.abs(g[y * W + x]! - g[y * W + x + 1]!); n++; } base = base / n || 1;
  const bestPeriod = (len: number, other: number, at: (i: number, j: number) => number, drops: number[]) => {
    let best = { c: Infinity, p: len, d: 0 };
    for (let p = Math.floor(len * 0.5); p < len - band; p++) for (const d of drops) {
      let s = 0, k = 0;
      for (let j = 0; j < other; j += 2) for (let b = 0; b < band; b++) { s += Math.abs(at(p + b, j) - at(b, (j + d) % other)); k++; }
      const c = s / k / base; if (c < best.c) best = { c, p, d };
    }
    return best;
  };
  const drops = mode === "halfdrop" ? [Math.round(H / 2)] : [0];
  const sx = bestPeriod(W, H, (x, y) => g[y * W + x]!, drops);
  const w = sx.c < 0.9 ? sx.p : W; // the pattern starts again inside the file: that's the repeat width
  let h = H;
  if (mode !== "sideways") { const sy = bestPeriod(H, w, (y, x) => g[y * W + x]!, [0]); if (sy.c < 0.9) h = sy.p; }
  return { w, h };
}

export function RepeatAligner({ src, mode: mode0, initial, busy, onSave, onCancel }: { src: string; mode: RepeatMode; initial?: Partial<RepeatFit>; busy?: boolean; onSave: (r: RepeatFit) => void; onCancel: () => void }) {
  const [img, setImg] = useState<{ c: HTMLCanvasElement; g: Float32Array; W: number; H: number } | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<RepeatMode>(mode0);
  const [pw, setPw] = useState(0); const [ph, setPh] = useState(0);
  const [zoom, setZoom] = useState(8);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 }); // where the magnifiers look along each join
  const [auto, setAuto] = useState("");
  const [blend, setBlend] = useState<boolean>(!!initial?.blend);
  const view = useRef<HTMLCanvasElement>(null); const lSide = useRef<HTMLCanvasElement>(null); const lTop = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; pw: number; ph: number } | null>(null);

  useEffect(() => {
    let off = false; const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => {
      if (off) return;
      const k = Math.min(1, MAX_WORK / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      const x = c.getContext("2d", { willReadFrequently: true })!; x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, c.width, c.height);
      const g = gray(x.getImageData(0, 0, c.width, c.height));
      setImg({ c, g, W: c.width, H: c.height });
      setPw(Math.round((initial?.w ?? 1) * c.width)); setPh(Math.round((initial?.h ?? 1) * c.height));
    };
    im.onerror = () => setErr("Couldn't load the picture of this design.");
    im.src = src; return () => { off = true; };
  }, [src]);

  const W = img?.W ?? 1, H = img?.H ?? 1;
  const tileH = mode === "sideways" ? H : ph;
  const clampW = (v: number) => Math.max(Math.round(W * 0.3), Math.min(W, Math.round(v)));
  const clampH = (v: number) => Math.max(Math.round(H * 0.3), Math.min(H, Math.round(v)));
  const score = useMemo(() => (img && pw && ph ? joinScore(img.g, W, H, pw, tileH, mode) : null), [img, pw, ph, mode]);

  // one repeat as it will be printed: with "blend", the strip past the end fades softly into the start
  const tile = useMemo(() => {
    if (!img || !pw) return null;
    const t = document.createElement("canvas"); t.width = pw; t.height = tileH; const x = t.getContext("2d")!;
    x.drawImage(img.c, 0, 0, pw, tileH, 0, 0, pw, tileH);
    const ov = Math.min(W - pw, pw);
    if (blend && ov > 0) {
      const s2 = document.createElement("canvas"); s2.width = ov; s2.height = tileH; const y = s2.getContext("2d")!;
      y.drawImage(img.c, pw, 0, ov, tileH, 0, 0, ov, tileH);
      const g = y.createLinearGradient(0, 0, ov, 0); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      y.globalCompositeOperation = "destination-in"; y.fillStyle = g; y.fillRect(0, 0, ov, tileH);
      x.drawImage(s2, 0, 0);
    }
    return t;
  }, [img, pw, tileH, blend]);
  // the copies, side by side (and stacked unless it repeats sideways only); half-drop: every second column moves down half a repeat
  const draw = useCallback(() => {
    const cv = view.current; if (!cv || !img || !pw || !tile) return;
    const cols = 2, rows = mode === "sideways" ? 1 : 2;
    const box = cv.parentElement!.clientWidth;
    const k = Math.min(box / (pw * cols), 560 / (tileH * rows));
    cv.width = Math.round(pw * cols * k); cv.height = Math.round(tileH * rows * k);
    const x = cv.getContext("2d")!; x.imageSmoothingQuality = "high"; x.fillStyle = "#eee"; x.fillRect(0, 0, cv.width, cv.height);
    for (let c = 0; c < cols; c++) for (let r = -1; r <= rows; r++) {
      const dy = mode === "halfdrop" && c % 2 ? tileH / 2 : 0;
      x.drawImage(tile!, c * pw * k, (r * tileH + dy) * k, pw * k, tileH * k);
    }
    x.setLineDash([5, 5]); x.strokeStyle = "rgba(176,58,46,.55)"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(pw * k + 0.5, 0); x.lineTo(pw * k + 0.5, cv.height); if (rows > 1) { x.moveTo(0, tileH * k + 0.5); x.lineTo(cv.width, tileH * k + 0.5); } x.stroke();
    x.setLineDash([]); x.strokeStyle = "#201D1D"; x.lineWidth = 2; x.strokeRect(pw * k - 26, focus.y * tileH * k - 26, 52, 52);
    if (rows > 1) x.strokeRect(focus.x * pw * k - 26, tileH * k - 26, 52, 52);
    // magnifiers: the exact pixels where the copies meet
    const lens = (cv2: HTMLCanvasElement | null, cx: number, cy: number) => {
      if (!cv2) return; const S = 220; cv2.width = S; cv2.height = S; const g = cv2.getContext("2d")!; g.imageSmoothingEnabled = false;
      const half = S / zoom / 2; g.fillStyle = "#eee"; g.fillRect(0, 0, S, S);
      for (let c = 0; c < 2; c++) for (let r = -1; r <= 1; r++) {
        const dy = mode === "halfdrop" && c % 2 ? tileH / 2 : 0;
        const ox = c * pw - (cx - half), oy = r * tileH + dy - (cy - half);
        g.drawImage(tile!, ox * zoom, oy * zoom, pw * zoom, tileH * zoom);
      }
      g.strokeStyle = "rgba(176,58,46,.6)"; g.setLineDash([4, 4]); g.beginPath();
      const jx = (pw - (cx - half)) * zoom, jy = (tileH - (cy - half)) * zoom;
      if (jx > 0 && jx < S) { g.moveTo(jx, 0); g.lineTo(jx, S); } if (rows > 1 && jy > 0 && jy < S) { g.moveTo(0, jy); g.lineTo(S, jy); } g.stroke();
    };
    lens(lSide.current, pw, focus.y * tileH);
    if (rows > 1) lens(lTop.current, focus.x * pw, tileH);
  }, [img, pw, ph, tileH, mode, zoom, focus, tile]);
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const r = () => draw(); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, [draw]);

  const scale = () => { const cv = view.current; return cv && pw ? cv.width / (pw * 2) : 1; };
  const onDown = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, pw, ph }; };
  const onMove = (e: React.PointerEvent) => {
    const cv = view.current!; const r = cv.getBoundingClientRect(); const k = scale();
    const vx = (e.clientX - r.left) / k, vy = (e.clientY - r.top) / k;
    if (!drag.current) { setFocus({ x: Math.min(0.98, Math.max(0.02, (vx % pw) / pw)), y: Math.min(0.98, Math.max(0.02, (vy % tileH) / tileH)) }); return; }
    // dragging the next copy left/up brings it closer (the copies overlap more); right/down pulls it away
    const d = drag.current; setPw(clampW(d.pw + (e.clientX - d.x) / k)); if (mode !== "sideways") setPh(clampH(d.ph + (e.clientY - d.y) / k));
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1; let used = true;
    if (e.key === "ArrowLeft") setPw((v) => clampW(v - step)); else if (e.key === "ArrowRight") setPw((v) => clampW(v + step));
    else if (e.key === "ArrowUp" && mode !== "sideways") setPh((v) => clampH(v - step)); else if (e.key === "ArrowDown" && mode !== "sideways") setPh((v) => clampH(v + step)); else used = false;
    if (used) e.preventDefault();
  };
  const findIt = () => { if (!img) return; const r = findRepeat(img.g, W, H, mode); setPw(r.w); setPh(r.h); setAuto(r.w < W || r.h < H ? `Found it: the pattern starts again ${r.w < W ? `${Math.round((1 - r.w / W) * 100)}% before the right edge` : ""}${r.w < W && r.h < H ? " and " : ""}${r.h < H ? `${Math.round((1 - r.h / H) * 100)}% above the bottom` : ""}. The extra strip is left out.` : "Your file already ends exactly where the pattern starts again."); };
  const word = (v: number) => (v < 1.35 ? ["ok", "Joins perfectly"] : v < 2 ? ["warn", "Small step: check the magnifier"] : ["bad", "Visible line"]);
  if (err) return <p className="rq-ok err">{err}</p>;
  if (!img) return <p className="hint"><span className="up-spin" aria-hidden="true" />Loading the design…</p>;
  const pct = (v: number, of: number) => `${Math.round((v / of) * 1000) / 10}%`;
  return (
    <div className="ra">
      <div className="ra-modes" role="radiogroup" aria-label="How it repeats">{([["sideways", "Sideways only", "A border or a scene: the height covers the wall"], ["straight", "All sides, straight", "Copies sit side by side and on top of each other"], ["halfdrop", "All sides, half-drop", "Every second column moves down half a repeat"]] as const).map(([v, n, s]) => <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}><b>{n}</b><small>{s}</small></button>)}</div>
      <p className="hint"><b>Drag the picture</b> left or right{mode !== "sideways" ? " (and up or down)" : ""} to bring the copies closer until they join, or use the arrow keys for one pixel at a time (Shift for 10). Move the mouse over a join to look at it in the magnifier.</p>
      <div className="ra-grid">
        <div className="ra-view"><canvas ref={view} tabIndex={0} aria-label="The copies of your design side by side. Drag to line them up; arrow keys for one pixel." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey} /></div>
        <div className="ra-side">
          <figure><figcaption>Side join · {zoom}×{score && <span className={"ra-q " + word(score.side)[0]}>{word(score.side)[1]}</span>}</figcaption><canvas ref={lSide} /></figure>
          {mode !== "sideways" && <figure><figcaption>Top / bottom join · {zoom}×{score && <span className={"ra-q " + word(score.top)[0]}>{word(score.top)[1]}</span>}</figcaption><canvas ref={lTop} /></figure>}
          <label className="ra-zoom"><span>Magnifier</span><input type="range" min={2} max={16} step={1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        </div>
      </div>
      <div className="ra-ctl">
        <div className="ra-n"><span>Repeat width</span><button type="button" onClick={() => setPw((v) => clampW(v - 1))} aria-label="Repeat width one pixel less">−</button><b>{pct(pw, W)}</b><button type="button" onClick={() => setPw((v) => clampW(v + 1))} aria-label="Repeat width one pixel more">+</button></div>
        {mode !== "sideways" && <div className="ra-n"><span>Repeat height</span><button type="button" onClick={() => setPh((v) => clampH(v - 1))} aria-label="Repeat height one pixel less">−</button><b>{pct(ph, H)}</b><button type="button" onClick={() => setPh((v) => clampH(v + 1))} aria-label="Repeat height one pixel more">+</button></div>}
        <button type="button" className="btn optline btn-sm" onClick={findIt}>Find the repeat for me</button>
        {pw < W && <label className="sa-check ra-blend"><input type="checkbox" checked={blend} onChange={(e) => setBlend(e.target.checked)} /><span><b>Blend the overlap</b> · the copies lie one on top of the other and fade softly into each other, so no line shows (for designs that weren't drawn to repeat)</span></label>}
        <button type="button" className="up-link" onClick={() => { setPw(W); setPh(H); setAuto(""); }}>Back to the whole file</button>
      </div>
      {auto && <p className="ra-auto" role="status">{auto}</p>}
      {(pw < W || (mode !== "sideways" && ph < H)) && <p className="hint">When you save, we make a corrected print file with only the repeat ({pct(pw, W)} of the width{mode !== "sideways" ? `, ${pct(ph, H)} of the height` : ""}). Your original file is kept.</p>}
      <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={() => onSave({ w: pw / W, h: mode === "sideways" ? 1 : ph / H, mode, blend: blend && pw < W })}>{busy ? "Saving…" : "Use this repeat"}</button><button type="button" className="btn optline btn-sm" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}
