import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Line up a repeat by hand (or let the site find it): the next copy is dragged with the mouse until it joins exactly,
 *  a magnifier shows the join pixel by pixel, and the result is the true repeat size (a part of the file when the
 *  designer's file holds more than one repeat). Nothing is saved here; the caller makes the corrected print file. */
export type RepeatMode = "sideways" | "straight" | "halfdrop";
export type RepeatFit = { w: number; h: number; mode: RepeatMode; blend?: boolean };

const MAX_WORK = 2000; // the picture we work on (the shop picture is up to 3200 px)

function gray(img: ImageData) { const g = new Float32Array(img.width * img.height); const d = img.data; for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j]! + 0.587 * d[j + 1]! + 0.114 * d[j + 2]!; return g; }

/** How well the copies join: 1 = like any two neighbouring pixel columns (invisible), 2+ = a visible line. */
function joinScore(g: Float32Array, W: number, H: number, pw: number, ph: number, mode: RepeatMode, blend = false) {
  let base = 0, n = 0; for (let y = 0; y < H; y += 3) for (let x = 0; x < W - 1; x += 3) { base += Math.abs(g[y * W + x]! - g[y * W + x + 1]!); n++; } base = base / n || 1;
  const drop = mode === "halfdrop" ? Math.round(ph / 2) : 0;
  // with blend, the next copy starts with the file's own continuation (the strip past the end), faded into the start
  const nx = blend && pw < W ? pw : 0;
  let s = 0; n = 0; for (let y = 0; y < ph; y++) { const y2 = (y + drop) % ph; s += Math.abs(g[y * W + pw - 1]! - g[y2 * W + nx]!); n++; }
  const side = s / n / base;
  let top = 0;
  if (mode !== "sideways") { s = 0; n = 0; for (let x = 0; x < pw; x++) { s += Math.abs(g[(ph - 1) * W + x]! - g[x]!); n++; } top = s / n / base; }
  return { side, top };
}

/** What the finder decided about a file:
 *  inside  = the pattern starts again inside the file (the extra strip is left out)
 *  overlap = the file's end really continues its start, so the ends are laid over each other and blended
 *  joins   = the file already ends where the pattern starts again
 *  none    = the file wasn't made as a repeat: no part of the end matches the start, so nothing is changed */
export type RepeatVerdict = "inside" | "overlap" | "joins" | "none";

/** Finds the true repeat. Only says "repeat" when one position matches far better than the file's typical ones,
 *  so a picture that was never built as a repeat is reported as such instead of being forced into one. */
export function findRepeat(g: Float32Array, W: number, H: number, mode: RepeatMode): { w: number; h: number; blend: boolean; verdict: RepeatVerdict } {
  const band = 6;
  let base = 0, n = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W - 1; x += 2) { base += Math.abs(g[y * W + x]! - g[y * W + x + 1]!); n++; } base = base / n || 1;
  const bestPeriod = (len: number, other: number, at: (i: number, j: number) => number, drops: number[]) => {
    let best = { c: Infinity, p: len, d: 0 }; const all: number[] = [];
    for (let p = Math.floor(len * 0.5); p < len - band; p++) for (const d of drops) {
      let s = 0, k = 0;
      for (let j = 0; j < other; j += 2) for (let b = 0; b < band; b++) { s += Math.abs(at(p + b, j) - at(b, (j + d) % other)); k++; }
      const c = s / k / base; all.push(c); if (c < best.c) best = { c, p, d };
    }
    // compared with the file itself: a true repeat is far better than a typical position (works for soft and sharp files)
    all.sort((x, y) => x - y); const typical = all[Math.floor(all.length / 2)] || 1;
    return { ...best, c: best.c / typical };
  };
  const drops = mode === "halfdrop" ? [Math.round(H / 2)] : [0];
  const sx = bestPeriod(W, H, (x, y) => g[y * W + x]!, drops);
  let w = W, blend = false, verdict: RepeatVerdict = "joins";
  if (sx.c < 0.35) { w = sx.p; verdict = "inside"; }
  else {
    // do the ends meet? a band at the end against the band at the start, shape for shape, compared with how the end
    // continues into the band just before it (a real continuation). The same answer on small and large pictures.
    const bw = Math.max(4, Math.round(W * 0.006)); let jn = 0, inn = 0;
    for (let y = 0; y < H; y += 2) for (let d = 0; d < bw; d++) { jn += Math.abs(g[y * W + W - bw + d]! - g[y * W + d]!); inn += Math.abs(g[y * W + W - bw + d]! - g[y * W + W - 2 * bw + d]!); }
    if (jn / (inn || 1) > 1.1) {
      // the ends don't join. Is the end a real continuation of the start (an overlap)? Try 4% to 25% and keep the
      // best only if it is far better than the typical overlap; otherwise the file simply isn't a repeat.
      const tries: [number, number][] = [];
      for (let ov = Math.round(W * 0.04); ov <= Math.round(W * 0.25); ov += 2) {
        let s2 = 0, n2 = 0;
        for (let y = 0; y < H; y += 4) for (let x = 0; x < ov; x += Math.max(1, Math.floor(ov / 24))) { s2 += Math.abs(g[y * W + W - ov + x]! - g[y * W + x]!); n2++; }
        tries.push([ov, s2 / n2]);
      }
      const sorted = [...tries].sort((a, b) => a[1] - b[1]); const best = sorted[0]; const typical = sorted[sorted.length >> 1]?.[1] || 1;
      if (best && best[1] / typical < 0.5 && best[1] / base < 3) { w = W - best[0]; blend = true; verdict = "overlap"; }
      else verdict = "none";
    }
  }
  let h = H;
  if (mode !== "sideways") { const sy = bestPeriod(H, w, (y, x) => g[y * W + x]!, [0]); if (sy.c < 0.35) { h = sy.p; if (verdict === "joins" || verdict === "none") verdict = "inside"; } }
  return { w, h, blend, verdict };
}

export function RepeatAligner({ src, mode: mode0, initial, busy, onSave, onCancel }: { src: string; mode: RepeatMode; initial?: Partial<RepeatFit>; busy?: boolean; onSave: (r: RepeatFit) => void; onCancel: () => void }) {
  const [img, setImg] = useState<{ c: HTMLCanvasElement; g: Float32Array; W: number; H: number } | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<RepeatMode>(mode0);
  const [pw, setPw] = useState(0); const [ph, setPh] = useState(0);
  const [zoom, setZoom] = useState(4);
  const [showJoin, setShowJoin] = useState(true); const [big, setBig] = useState(false);
  const wallRef = useRef<HTMLCanvasElement>(null); const bigRef = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 }); // where the magnifiers look along each join
  const [auto, setAuto] = useState("");
  const [blend, setBlend] = useState<boolean>(!!initial?.blend);
  const [notRepeat, setNotRepeat] = useState(false);
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
  const score = useMemo(() => (img && pw && ph ? joinScore(img.g, W, H, pw, tileH, mode, blend) : null), [img, pw, ph, mode, blend]);

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
    if (showJoin) {
      x.beginPath(); x.moveTo(pw * k, 0); x.lineTo(pw * k, cv.height); if (rows > 1) { x.moveTo(0, tileH * k); x.lineTo(cv.width, tileH * k); }
      x.lineWidth = 4; x.strokeStyle = "rgba(255,255,255,.85)"; x.stroke(); x.setLineDash([10, 7]); x.lineWidth = 2; x.strokeStyle = "rgba(32,29,29,.75)"; x.stroke();
    }
    x.setLineDash([]); x.strokeStyle = "#201D1D"; x.lineWidth = 2; x.strokeRect(pw * k - 26, focus.y * tileH * k - 26, 52, 52);
    if (rows > 1) x.strokeRect(focus.x * pw * k - 26, tileH * k - 26, 52, 52);
    // magnifiers: the exact pixels where the copies meet
    const lens = (cv2: HTMLCanvasElement | null, cx: number, cy: number) => {
      if (!cv2) return; const S = 300; cv2.width = S; cv2.height = S; const g = cv2.getContext("2d")!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      const half = S / zoom / 2; g.fillStyle = "#eee"; g.fillRect(0, 0, S, S);
      for (let c = 0; c < 2; c++) for (let r = -1; r <= 1; r++) {
        const dy = mode === "halfdrop" && c % 2 ? tileH / 2 : 0;
        const ox = c * pw - (cx - half), oy = r * tileH + dy - (cy - half);
        g.drawImage(tile!, ox * zoom, oy * zoom, pw * zoom, tileH * zoom);
      }
      // small marks on the edges show where the copies meet, without covering the join itself
      const jx = (pw - (cx - half)) * zoom, jy = (tileH - (cy - half)) * zoom; g.fillStyle = "#201D1D"; g.beginPath();
      if (jx > 0 && jx < S) { g.moveTo(jx - 7, 0); g.lineTo(jx + 7, 0); g.lineTo(jx, 10); g.moveTo(jx - 7, S); g.lineTo(jx + 7, S); g.lineTo(jx, S - 10); }
      if (rows > 1 && jy > 0 && jy < S) { g.moveTo(0, jy - 7); g.lineTo(0, jy + 7); g.lineTo(10, jy); g.moveTo(S, jy - 7); g.lineTo(S, jy + 7); g.lineTo(S - 10, jy); }
      g.fill();
    };
    lens(lSide.current, pw, focus.y * tileH);
    if (rows > 1) lens(lTop.current, focus.x * pw, tileH);
    // on a wall: four repeats side by side (two rows for all-sides repeats), as it will be printed
    const paintWall = (wc: HTMLCanvasElement | null, scale: number) => {
      if (!wc) return; const cols = 4, wr = mode === "sideways" ? 1 : 2;
      wc.width = Math.round(pw * cols * scale); wc.height = Math.round(tileH * wr * scale); const w2 = wc.getContext("2d")!; w2.imageSmoothingQuality = "high";
      for (let c = 0; c < cols; c++) for (let r = -1; r <= wr; r++) { const dy = mode === "halfdrop" && c % 2 ? tileH / 2 : 0; w2.drawImage(tile!, c * pw * scale, (r * tileH + dy) * scale, pw * scale, tileH * scale); }
    };
    const wbox = wallRef.current?.parentElement?.clientWidth || 900; paintWall(wallRef.current, Math.min(1, wbox / (pw * 4)));
    if (big) paintWall(bigRef.current, 1);
  }, [img, pw, ph, tileH, mode, zoom, focus, tile, showJoin, big]);
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
  const findIt = (quiet = false) => {
    if (!img) return; const r = findRepeat(img.g, W, H, mode); setPw(r.w); setPh(r.h); setBlend(r.blend); setNotRepeat(r.verdict === "none");
    if (r.verdict === "none") setAuto("This file doesn't look like it was made as a repeat: no part of its end continues its start, so we didn't change anything. Sell it as a mural (choose \"Mural, no repeat\"), or upload a real repeat file. You can still drag it by hand and blend the join, but trees and other shapes may look cut or doubled where the copies meet.");
    else if (r.blend) setAuto(`Your file doesn't repeat by itself, but its end continues its start, so we overlap the ends by ${Math.round((1 - r.w / W) * 100)}% (where they match) and blend them softly, one on top of the other. Check the join in the magnifier; drag to adjust if you like.`);
    else if (r.w < W || r.h < H) setAuto(`Found it: the pattern starts again ${r.w < W ? `${Math.round((1 - r.w / W) * 100)}% before the right edge` : ""}${r.w < W && r.h < H ? " and " : ""}${r.h < H ? `${Math.round((1 - r.h / H) * 100)}% above the bottom` : ""}. The extra strip is left out.`);
    else if (!quiet) setAuto("Your file already ends exactly where the pattern starts again.");
  };
  // the first time it opens, it lines itself up (the designer checks and saves, or adjusts by hand)
  const ran = useRef(false);
  useEffect(() => { if (img && !ran.current && !initial?.w) { ran.current = true; findIt(true); } }, [img]);
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
          <div className="ra-zoom2"><span>Zoom on the join</span>{[2, 4, 8].map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z}×</button>)}</div>
          <label className="sa-check"><input type="checkbox" checked={showJoin} onChange={(e) => setShowJoin(e.target.checked)} /><span>Show the join on the picture</span></label>
        </div>
      </div>
      <div className="ra-ctl">
        <label className="ra-sl"><span>Bring copies closer sideways</span><input type="range" min={0} max={70} step={0.5} value={Math.round((1 - pw / W) * 1000) / 10} onChange={(e) => setPw(clampW(W * (1 - Number(e.target.value) / 100)))} /></label>
        {mode !== "sideways" && <label className="ra-sl"><span>Up / down</span><input type="range" min={0} max={70} step={0.5} value={Math.round((1 - ph / H) * 1000) / 10} onChange={(e) => setPh(clampH(H * (1 - Number(e.target.value) / 100)))} /></label>}
        <div className="ra-n"><span>Repeat width</span><button type="button" onClick={() => setPw((v) => clampW(v - 1))} aria-label="Repeat width one pixel less">−</button><b>{pct(pw, W)}</b><button type="button" onClick={() => setPw((v) => clampW(v + 1))} aria-label="Repeat width one pixel more">+</button></div>
        {mode !== "sideways" && <div className="ra-n"><span>Repeat height</span><button type="button" onClick={() => setPh((v) => clampH(v - 1))} aria-label="Repeat height one pixel less">−</button><b>{pct(ph, H)}</b><button type="button" onClick={() => setPh((v) => clampH(v + 1))} aria-label="Repeat height one pixel more">+</button></div>}
        <button type="button" className="btn optline btn-sm" onClick={() => findIt()}>Find the repeat for me</button>
        {pw < W && <label className="sa-check ra-blend"><input type="checkbox" checked={blend} onChange={(e) => setBlend(e.target.checked)} /><span><b>Fade the overlapping ends together</b> · your repeat is now shorter than the file, so the end of one copy lies on top of the start of the next. This mixes those two parts softly into each other, so there is no hard line where the copies meet. Use it only if the join still shows a small step.</span></label>}
        <button type="button" className="up-link" onClick={() => { setPw(W); setPh(H); setAuto(""); setNotRepeat(false); }}>Back to the whole file</button>
      </div>
      {auto && <p className={"ra-auto" + (notRepeat ? " warn" : "")} role="status">{auto}</p>}
      {(pw < W || (mode !== "sideways" && ph < H)) && <p className="hint">When you save, we make a corrected print file with only the repeat ({pct(pw, W)} of the width{mode !== "sideways" ? `, ${pct(ph, H)} of the height` : ""}). Your original file is kept.</p>}
      <div className="ra-wall"><div className="ra-wh"><b>On a wall · 4 repeats</b><button type="button" className="btn optline btn-sm" onClick={() => setBig(true)}>⤢ Open full size to zoom</button></div><canvas ref={wallRef} onClick={() => setBig(true)} title="Open full size to zoom" /></div>
      {big && <div className="ra-big" role="dialog" aria-modal="true" aria-label="The wall at full size"><div className="ra-big-h"><b>On a wall · full size</b><span className="hint">Scroll to look around; this is the real detail of your file.</span><button type="button" className="btn optline btn-sm" onClick={() => setBig(false)}>Close</button></div><div className="ra-big-in"><canvas ref={bigRef} /></div></div>}
      <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={() => onSave({ w: pw / W, h: mode === "sideways" ? 1 : ph / H, mode, blend: blend && pw < W })}>{busy ? "Saving…" : "Use this repeat"}</button><button type="button" className="btn optline btn-sm" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}
