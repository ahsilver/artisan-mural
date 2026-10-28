import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Loader2, RotateCcw, Plus, Brush, Undo2, Sparkles } from "lucide-react";
import { SAMPLE_ROOMS, autoFurnitureMask, maskCanvas, type AutoMask } from "@/lib/room-mask";
import { Button } from "@/components/ui/button";
import type { Design } from "@/lib/catalog";
import { cropArtwork, measurementInches, panelGeometry, tileGeometry, repeatStyle, sizeIssue, PANEL_WIDTH_IN, type WallSelection } from "@/lib/wall-selection";
import { OversizeNote, OversizePopup, useOversizePrompt } from "@/components/oversize";
import { muralMaxLabel } from "@/components/size-notice";
import { warp, loadImg, wallArt, isColouredWall, colourWallCanvas } from "@/lib/wall-render";
import { aiWalls, freeWalls, isOldGuess, mergeWalls } from "@/lib/find-walls";
import { CompareSlider } from "@/components/compare-slider";
import { MyRoomsPicker, SampleRoomsRow } from "@/components/my-rooms-picker";
import { chooseSample, saveRoomPhoto, updateRoom, useMyRooms, type MyRoomPhoto } from "@/lib/my-rooms";

type P = { x: number; y: number };
type Wall = { side: string; corners: P[]; objects: { label: string; polygon: P[] }[]; widthIn: number; heightIn: number; auto?: boolean };
const RIGID = /cabinet|window|door|shel|hood|applian|fridge|refrigerator|oven|stove|range|counter|backsplash|radiator|baseboard|skirting|mirror|frame|art|tv|television|screen|outlet|switch|socket|fireplace|built|closet|bookcase|headboard|wardrobe|dresser|sideboard|desk/i;
const DILATE: [number, number][] = [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]];
const maskCache = new WeakMap<object, { c: HTMLCanvasElement; x: number; y: number } | null>();
/** Pixels inside an object's outline that differ from the wall colour just around it. */
function objectMask(px: ImageData, o: { polygon: P[] }) {
  if (maskCache.has(o)) return maskCache.get(o)!;
  let out: { c: HTMLCanvasElement; x: number; y: number } | null = null;
  try {
    const W = px.width, H = px.height, d = px.data;
    const xs = o.polygon.map((p) => p.x * W), ys = o.polygon.map((p) => p.y * H);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw > 3 && bh > 3) {
      const R: number[] = [], G: number[] = [], B: number[] = [], band = Math.max(4, Math.round(Math.min(W, H) * 0.012));
      const take = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); };
      for (let x = x0 - band; x <= x1 + band; x += 2) for (let k = 1; k <= band; k += 2) { take(x, y0 - k); take(x, y1 + k); }
      for (let y = y0; y <= y1; y += 2) for (let k = 1; k <= band; k += 2) { take(x0 - k, y); take(x1 + k, y); }
      if (R.length > 20) {
        const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
        const mr = med(R), mg = med(G), mb = med(B);
        const c = document.createElement("canvas"); c.width = bw; c.height = bh;
        const cx = c.getContext("2d")!; const id = cx.createImageData(bw, bh); let on = 0;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const i = ((y0 + y) * W + x0 + x) * 4, j = (y * bw + x) * 4;
          if (Math.abs(d[i] - mr) + Math.abs(d[i + 1] - mg) + Math.abs(d[i + 2] - mb) > 54) { id.data[j] = id.data[j + 1] = id.data[j + 2] = id.data[j + 3] = 255; on++; }
        }
        // almost nothing differs (object the same colour as the wall): keep the whole outline instead
        if (on > bw * bh * 0.04) { cx.putImageData(id, 0, 0); out = { c, x: x0, y: y0 }; }
      }
    }
  } catch { out = null; }
  maskCache.set(o, out);
  return out;
}
const SIDES = ["left", "back", "right"] as const;
const sideName = (s: string) => (s === "left" ? "Left wall" : s === "right" ? "Right wall" : s === "back" ? "Back wall" : s);
export function ftIn(inches: number) { const t = Math.round(inches); const f = Math.floor(t / 12), i = t % 12; return f ? `${f} ft${i ? ` ${i} in` : ""}` : `${i} in`; }




export function MyRoom({ design, selection, designerName, onAskFit }: { design: Design; selection: WallSelection; designerName?: string; onAskFit?: (wall: WallSelection) => void }) {
  const [ai, setAi] = useState<{ walls?: boolean; freeOverlay?: boolean; roomRender?: boolean } | null>(null);
  const [real, setReal] = useState<{ url: string; key: string; secs: number } | null>(null);
  const [realBusy, setRealBusy] = useState(false);
  // the AI picture of the shopper's room (the default result, like the old site); the quick preview is the fallback
  const [aiPic, setAiPic] = useState<{ url: string; key: string; secs: number } | null>(null);
  const [aiBusy, setAiBusy] = useState<string>("");
  const [aiFail, setAiFail] = useState<string>("");
  const [view, setView] = useState<"ai" | "quick">("ai");
  const [userWall, setUserWall] = useState<string>("");
  const aiCache = useRef(new Map<string, { url: string; secs: number }>());
  const [photo, setPhoto] = useState<{ url: string; w: number; h: number; pixels: ImageData; ai: string; exact?: HTMLCanvasElement; sample?: string } | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [pick, setPick] = useState<string>("");
  const [mode, setMode] = useState<"idle" | "finding" | "pick" | "corners" | "show">("idle");
  const [taps, setTaps] = useState<P[]>([]);
  const [panels, setPanels] = useState(false);
  const [keep, setKeep] = useState(true);
  const [adjust, setAdjust] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [layer, setLayer] = useState<ImageData | null>(null);
  type Stroke = { mode: "paper" | "keep"; r: number; pts: P[] };
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [brush, setBrush] = useState<null | "paper" | "keep">(null);
  const [brushOpen, setBrushOpen] = useState(false);
  const [size, setSize] = useState(0.025);
  const [live, setLive] = useState<Stroke | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const myRooms = useMyRooms();
  const restored = useRef(false);
  const keepTouched = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ w: number; c: number; links: { w: number; c: number }[] } | null>(null);
  const selW = measurementInches(selection.width, selection.unit), selH = measurementInches(selection.height, selection.unit);

  useEffect(() => { fetch("/backend/ai/status").then((r) => r.json()).then(setAi).catch(() => setAi({})); }, []);

  const active = useMemo(() => walls.map((w, i) => ({ w, i })).filter(({ w }) => pick === "all" || w.side === pick), [walls, pick]);

  /** No AI: guess the walls from the photo's lines (free, in the browser) and ask the shopper to check the corners.
   *  Nothing found = ask for 4 taps; never a rectangle over the whole photo. */
  function autoWall(pixels: ImageData, lead = "") {
    const g = freeWalls(pixels, selW, selH);
    if (typeof window !== "undefined") (window as any).__wallGuess = g.why;
    if (!g.walls.length) { setWalls([]); setPick(""); setTaps([]); setMode("corners"); setNote(`${lead}We couldn't find the walls in this photo. Tap the 4 corners of a wall.`); return; }
    setWalls(g.walls); setPick(g.walls.length > 1 ? "all" : g.walls[0].side); setMode("show"); setAdjust(!ai?.roomRender); // the AI picture is the main result; corners only for the quick preview
    const names = g.walls.map((w) => sideName(w.side).replace(" wall", "").toLowerCase());
    setNote(g.walls.length > 1
      ? `${lead}We guessed ${g.walls.length} walls (${names.join(", ")}) from the lines in your photo. Please check them: drag the green corners onto the corners of each wall, then tap Looks right. Pick one wall below to paper only that one.`
      : `${lead}We guessed your wall from the photo. Please check it: drag the green corners onto the wall's corners, then tap Looks right.`);
  }
  async function onFile(f: File) {
    setError(""); setNote(""); setWalls([]); setPick(""); setTaps([]); setAdjust(false); resetTools();
    const url = URL.createObjectURL(f);
    let img: HTMLImageElement;
    try { img = await loadImg(url); } catch { setError("That file isn't a photo we can open. Try a JPG or PNG."); return; }
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    const s2 = Math.min(1, 768 / Math.max(w, h)); const c2 = document.createElement("canvas"); c2.width = Math.round(w * s2); c2.height = Math.round(h * s2); c2.getContext("2d")!.drawImage(c, 0, 0, c2.width, c2.height);
    const p = { url: c.toDataURL("image/jpeg", 0.9), w, h, pixels, ai: c2.toDataURL("image/jpeg", 0.8) };
    URL.revokeObjectURL(url);
    setPhoto(p); setRoomId(null); restored.current = true;
    c.toBlob((b) => { if (b) saveRoomPhoto(b, f.name || "Room photo", w, h).then((r) => setRoomId(r.id)).catch(() => {}); }, "image/jpeg", 0.86);
    if (ai?.walls) {
      setMode("finding");
      const t0 = performance.now();
      try {
        const found: Wall[] = mergeWalls(await aiWalls(p.ai, selW, selH), freeWalls(pixels, selW, selH), pixels);
        setWalls(found); setPick(found.length > 1 ? "all" : found[0].side); setMode("show");
        setNote(`Found ${found.length} wall${found.length > 1 ? "s" : ""} in ${((performance.now() - t0) / 1000).toFixed(1)} s${found.length > 1 ? " (" + found.map((w) => sideName(w.side).replace(" wall", "").toLowerCase()).join(", ") + ")" : ""}. Tap a wall below to paper only that one, or Adjust corners if an edge is off.`);
      } catch (e: any) { autoWall(pixels, `${e.message} `); }
    } else { autoWall(pixels); }
  }

  function resetTools() { setStrokes([]); setLive(null); setBrush(null); setBrushOpen(false); setLayer(null); keepTouched.current = false; setKeep(true); }

  /** Open a room photo the shopper saved before, with the walls they set last time. */
  async function openSaved(r: MyRoomPhoto) {
    if (r.sample) { restored.current = true; return onSample(r.sample, false); }
    setError(""); setNote(""); setTaps([]); setAdjust(false); resetTools(); restored.current = true;
    const url = URL.createObjectURL(r.blob);
    let img: HTMLImageElement;
    try { img = await loadImg(url); } catch { setError("Could not open that saved photo."); return; }
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    setPhoto({ url, w, h, pixels: ctx.getImageData(0, 0, w, h), ai: "" });
    setRoomId(r.id);
    const ws: Wall[] = (r.walls ?? []).map((x) => ({ ...x, objects: x.objects ?? [] }));
    if (r.strokes?.length) setStrokes(r.strokes as Stroke[]);
    if (r.keep === false) { keepTouched.current = true; setKeep(false); }
    if (ws.length && !isOldGuess(ws)) { setWalls(ws); setPick(ws.length > 1 ? "all" : ws[0].side); setMode("show"); setNote("Your saved room photo. Drag the line to see it before and after."); }
    else autoWall(ctx.getImageData(0, 0, w, h));
  }
  // coming back: the last room photo is ready
  useEffect(() => {
    if (restored.current || photo || !myRooms.ready) return;
    if (!myRooms.room) { if (myRooms.synced) restored.current = true; return; }
    restored.current = true;
    openSaved(myRooms.room);
  }, [myRooms.ready, myRooms.synced, myRooms.room?.id]);
  // remember the walls and cut-out choices with the photo
  useEffect(() => {
    if (!roomId || mode !== "show" || !walls.length) return;
    const t = setTimeout(() => updateRoom(roomId, { walls: walls.map(({ side, corners, objects, widthIn, heightIn, auto }) => ({ side, corners, objects, widthIn, heightIn, ...(auto ? { auto } : {}) })), keep, strokes }), 400);
    return () => clearTimeout(t);
  }, [roomId, mode, walls, keep, strokes]);

  async function onSample(id: string, remember = true) {
    const room = SAMPLE_ROOMS.find((r) => r.id === id); if (!room) return;
    if (remember) chooseSample(id).catch(() => {});
    setError(""); setNote(""); setTaps([]); setAdjust(false); resetTools(); setBusy(true);
    try {
      const [img, mimg] = await Promise.all([loadImg(room.image), loadImg(room.mask)]);
      const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      // hand-made mask: white = furniture. Turn it into an alpha canvas at the photo's size.
      const mc = document.createElement("canvas"); mc.width = w; mc.height = h; const mx = mc.getContext("2d")!; mx.drawImage(mimg, 0, 0, w, h);
      const md = mx.getImageData(0, 0, w, h); for (let k = 0; k < md.data.length; k += 4) { const v = md.data[k]; md.data[k] = md.data[k + 1] = md.data[k + 2] = 255; md.data[k + 3] = v; } mx.putImageData(md, 0, 0);
      setPhoto({ url: room.image, w, h, pixels, ai: "", exact: mc, sample: room.id }); setRoomId(null); restored.current = true;
      setWalls([{ side: "back", corners: room.corners, objects: [], widthIn: selW, heightIn: selH }]); setPick("back"); setMode("show");
      setNote(`Sample room: ${room.name}. Drag the line to see it before and after.`);
    } catch { setError("Could not load the sample room."); }
    finally { setBusy(false); }
  }

  /** "Make it realistic": the AI repaints our true-scale preview as a real photo (owner's key). Falls back to the quick preview. */
  const realKey = `${roomId ?? photo?.sample ?? ""}|${design.slug}|${JSON.stringify(active.map(({ w }) => w.corners))}`;
  async function makeRealistic() {
    if (!photo || !canvasRef.current || realBusy) return;
    setRealBusy(true); setError(""); const t0 = performance.now();
    try {
      const jpeg = (c: HTMLCanvasElement, max = 1280) => { const s2 = Math.min(1, max / Math.max(c.width, c.height)); const o = document.createElement("canvas"); o.width = Math.round(c.width * s2); o.height = Math.round(c.height * s2); o.getContext("2d")!.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/jpeg", 0.85); };
      const pc = document.createElement("canvas"); pc.width = photo.w; pc.height = photo.h; pc.getContext("2d")!.putImageData(photo.pixels, 0, 0);
      const di = await loadImg(design.image); const dc = document.createElement("canvas"); const ds = Math.min(1, 1024 / Math.max(di.naturalWidth, di.naturalHeight)); dc.width = Math.round(di.naturalWidth * ds); dc.height = Math.round(di.naturalHeight * ds); dc.getContext("2d")!.drawImage(di, 0, 0, dc.width, dc.height);
      const r = await fetch("/backend/ai/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "room", room: jpeg(pc), guide: jpeg(canvasRef.current), design: jpeg(dc, 1024), walls: active.map(({ w }) => ({ side: w.side, corners: w.corners })), kind: design.kind, repeat: design.repeat, scaleText: `the wall is about ${ftIn(active[0]?.w.widthIn ?? selW)} wide` }), signal: AbortSignal.timeout(120000) });
      const d = await r.json().catch(() => ({}));
      if (d.code === "quota") { setAi((a) => (a ? { ...a, roomRender: false } : a)); throw new Error("Realistic AI pictures aren't switched on yet"); }
      if (!r.ok || !d.image) throw new Error(d.error || "The AI picture didn't come back.");
      const secs = (performance.now() - t0) / 1000;
      setReal({ url: d.image, key: realKey, secs }); setNote(`Realistic picture made in ${secs.toFixed(0)} s. Drag the line to compare with your photo. It is an AI picture: the quick preview (button below) shows the exact pattern size and panels.`);
    } catch (e: any) { setReal(null); setNote(`The realistic picture didn't work this time (${String(e?.message || "error").slice(0, 120)}). Showing the quick preview.`); }
    finally { setRealBusy(false); }
  }
  const realShown = real && real.key === realKey ? real : null;

  // Default result: the AI repaints the shopper's own photo with the wallpaper (the old site's approach, owner's Google key).
  const [aiRetry, setAiRetry] = useState(0);
  const photoTok = photo ? (photo.sample || photo.url.slice(-64)) : "";
  const wallScope = userWall && userWall !== "all" ? sideName(userWall as any).toLowerCase() : "";
  const scaleText = design.kind === "mural"
    ? `the mural is printed ${ftIn(selW)} wide and ${ftIn(selH)} tall.`
    : design.repeat === "horizontal"
      ? `image 2 is the whole wall, about ${ftIn(selW)} wide and ${ftIn(selH)} tall, already laid out at its real size.`
      : `${design.repeatCm ? `one pattern repeat (all of image 2) is ${Math.round(design.repeatCm / 2.54)} in (${Math.round(design.repeatCm)} cm) wide on the wall; ` : ""}the walls are about ${ftIn(selH)} tall, so show the pattern at that real size, not shrunk.`;
  const aiKey = `${photoTok}|${design.image}|${wallScope}|${scaleText}`;
  useEffect(() => {
    if (!photo || !ai?.roomRender) return;
    const hit = aiCache.current.get(aiKey);
    if (hit) { setAiPic({ ...hit, key: aiKey }); setAiFail(""); return; }
    let gone = false;
    const key = aiKey;
    const t = setTimeout(async () => {
      setAiBusy(key); setAiFail(""); const t0 = performance.now();
      try {
        const jpeg = (c: HTMLCanvasElement, max: number) => { const k = Math.min(1, max / Math.max(c.width, c.height)); const o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext("2d")!.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/jpeg", 0.88); };
        const pc = document.createElement("canvas"); pc.width = photo.w; pc.height = photo.h; pc.getContext("2d")!.putImageData(photo.pixels, 0, 0);
        const di = await loadImg(design.image); const dc = document.createElement("canvas");
        const strip = repeatStyle(design as any) === "horizontal" && selW > 0 && selH > 0;
        if (strip) { // sideways-only: hand the model the whole wall already laid out (copies side by side, one copy = full height)
          const r0 = di.naturalWidth / di.naturalHeight, hh = Math.min(di.naturalHeight, 1024, Math.floor(4000 / Math.max(1, selW / selH))), ww = Math.round(hh * selW / selH), one = hh * r0;
          dc.width = ww; dc.height = hh; const x = dc.getContext("2d")!; for (let X = (ww % one) / 2 - (ww % one ? one : 0); X < ww; X += one) x.drawImage(di, X, 0, one, hh);
        } else { dc.width = di.naturalWidth; dc.height = di.naturalHeight; dc.getContext("2d")!.drawImage(di, 0, 0); }
        const r = await fetch("/backend/ai/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose: "room", mode: "photo", room: jpeg(pc, 1280), design: jpeg(dc, strip ? 1600 : 1024), w: photo.w, h: photo.h, kind: design.kind, repeat: design.repeat, strip, wall: wallScope, scaleText }), signal: AbortSignal.timeout(100000) });
        const d = await r.json().catch(() => ({}));
        if (d.code === "quota" || d.code === "off" || d.code === "no_key") setAi((a) => (a ? { ...a, roomRender: false } : a));
        if (!r.ok || !d.image) throw new Error(d.error || "The AI picture didn't come back.");
        const secs = (performance.now() - t0) / 1000;
        aiCache.current.set(key, { url: d.image, secs });
        if (!gone) setAiPic({ url: d.image, key, secs });
      } catch (e: any) { if (!gone) setAiFail(String(e?.message || "error").slice(0, 140)); }
      finally { setAiBusy((b) => (b === key ? "" : b)); }
    }, 250);
    return () => { gone = true; clearTimeout(t); };
  }, [aiKey, ai?.roomRender, aiRetry]);
  const aiShown = view === "ai" && aiPic && aiPic.key === aiKey ? aiPic : null;
  // AI picture failed: the quick preview takes over, with the corner check when the walls were only guessed
  useEffect(() => { if (aiFail && active.some(({ w }) => w.auto)) setAdjust(true); }, [aiFail]);
  const aiWorking = view === "ai" && !!ai?.roomRender && aiBusy === aiKey && !aiShown;

  function boxPoint(e: { clientX: number; clientY: number }): P { const r = boxRef.current!.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; }
  function onTap(e: React.MouseEvent) {
    if (mode !== "corners" || aiShown || aiWorking) return;
    const t = [...taps, boxPoint(e)];
    if (t.length < 4) { setTaps(t); return; }
    const side = walls.some((w) => w.side === "back") ? (walls.some((w) => w.side === "left") ? "right" : "left") : "back";
    const nw: Wall = { side, corners: t, objects: [], widthIn: walls.length ? Math.round(selH * 0.8) : selW, heightIn: selH };
    setWalls([...walls, nw]); setTaps([]); setPick(walls.length ? "all" : side); setMode("show");
  }

  // automatic cut-out for uploaded photos (one per active wall); the AI's outlines or a sample room's exact mask win
  const autos = useMemo<(AutoMask | null)[]>(() => {
    if (!photo || photo.exact || mode !== "show") return [];
    return active.map(({ w }) => (w.objects.length ? null : autoFurnitureMask(photo.pixels, w.corners)));
  }, [photo, active, mode]);
  const unsure = autos.some((a) => a && !a.sure && !isColouredWall(a.wc));
  // doubtful cut-out: start with it off rather than leave holes in the wallpaper
  useEffect(() => {
    if (keepTouched.current || !autos.length) return;
    if (unsure && !active.some(({ w }) => w.objects.length)) { setKeep(false); setNote("This photo's furniture is hard to tell from the wall, so the cut-out is off. Use the brush (Keep in front) to paint over anything that should stay in front."); }
    else setKeep(true);
  }, [autos, unsure]);

  // the wallpaper layer, warped onto the chosen walls
  useEffect(() => {
    if (!photo || !active.length || mode !== "show") { setLayer(null); return; }
    let gone = false;
    (async () => {
      setBusy(true);
      try {
        const lc = document.createElement("canvas"); lc.width = photo.w; lc.height = photo.h;
        const lctx = lc.getContext("2d")!;
        for (const { w } of active) {
          const art = await wallArt(design, selection, w.widthIn, w.heightIn, panels);
          if (gone) return;
          warp(lctx, art, w.corners.map((c) => ({ x: c.x * photo.w, y: c.y * photo.h })));
        }
        if (!gone) setLayer(lctx.getImageData(0, 0, photo.w, photo.h));
      } catch (e: any) { if (!gone) setError(e.message || "Could not draw the wallpaper."); }
      finally { if (!gone) setBusy(false); }
    })();
    return () => { gone = true; };
  }, [photo, active, panels, mode, design.image, selection.zoom, selection.x, selection.y]);

  // furniture in front: exact / AI / automatic mask, then the customer's brush strokes on top
  function furniture(): Uint8ClampedArray {
    const fc = document.createElement("canvas"); fc.width = photo!.w; fc.height = photo!.h;
    const fx = fc.getContext("2d")!; fx.imageSmoothingEnabled = true; fx.fillStyle = "#fff";
    if (keep) {
      if (photo!.exact) fx.drawImage(photo!.exact, 0, 0);
      active.forEach(({ w }, n) => {
        if (photo!.exact) return;
        if (w.objects.length) for (const o of w.objects) {
          fx.beginPath(); o.polygon.forEach((p, k) => (k ? fx.lineTo(p.x * photo!.w, p.y * photo!.h) : fx.moveTo(p.x * photo!.w, p.y * photo!.h))); fx.closePath();
          // cabinets, windows, doors…: the whole outline stays in front. Lamps, plants, chairs…: only the pixels that
          // don't look like the wall around them, so no beige block of bare wall is left around a lamp
          const m = RIGID.test(o.label) ? null : objectMask(photo!.pixels, o);
          if (!m) { fx.fill(); continue; }
          fx.save(); fx.clip(); for (const [dx, dy] of DILATE) fx.drawImage(m.c, m.x + dx, m.y + dy); fx.restore();
        }
        else { const a = autos[n]; if (a && isColouredWall(a.wc)) fx.drawImage(colourWallCanvas(photo!.pixels, w.corners, a.wc!), 0, 0); else if (a && a.sure && a.frac > 0) fx.drawImage(maskCanvas(a), 0, 0, photo!.w, photo!.h); }
      });
    }
    fx.lineCap = "round"; fx.lineJoin = "round"; fx.strokeStyle = "#fff";
    for (const st of strokes) {
      fx.globalCompositeOperation = st.mode === "keep" ? "source-over" : "destination-out";
      const lw = st.r * 2 * photo!.w; fx.lineWidth = lw;
      fx.beginPath(); st.pts.forEach((p, k) => (k ? fx.lineTo(p.x * photo!.w, p.y * photo!.h) : fx.moveTo(p.x * photo!.w, p.y * photo!.h)));
      if (st.pts.length === 1) { fx.arc(st.pts[0].x * photo!.w, st.pts[0].y * photo!.h, lw / 2, 0, Math.PI * 2); fx.fill(); } else fx.stroke();
    }
    fx.globalCompositeOperation = "source-over";
    return fx.getImageData(0, 0, photo!.w, photo!.h).data;
  }

  // composite
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !photo) return;
    cv.width = photo.w; cv.height = photo.h;
    const out = cv.getContext("2d")!;
    if (!layer || mode !== "show" || layer.width !== photo.w) { out.putImageData(photo.pixels, 0, 0); return; }
    try {
      const A = layer.data, Pp = photo.pixels.data, F = furniture();
      let sum = 0, n = 0;
      for (let i = 0; i < A.length; i += 16) if (A[i + 3] > 200 && F[i + 3] < 128) { sum += 0.299 * Pp[i] + 0.587 * Pp[i + 1] + 0.114 * Pp[i + 2]; n++; }
      const L = n ? sum / n : 200;
      const res = out.createImageData(photo.w, photo.h), R = res.data;
      for (let i = 0; i < A.length; i += 4) {
        const a = (A[i + 3] / 255) * (1 - F[i + 3] / 255);
        if (a <= 0) { R[i] = Pp[i]; R[i + 1] = Pp[i + 1]; R[i + 2] = Pp[i + 2]; R[i + 3] = 255; continue; }
        const sh = Math.min(1.15, Math.max(0.3, (0.299 * Pp[i] + 0.587 * Pp[i + 1] + 0.114 * Pp[i + 2]) / L));
        R[i] = Pp[i] * (1 - a) + Math.min(255, A[i] * sh) * a; R[i + 1] = Pp[i + 1] * (1 - a) + Math.min(255, A[i + 1] * sh) * a; R[i + 2] = Pp[i + 2] * (1 - a) + Math.min(255, A[i + 2] * sh) * a; R[i + 3] = 255;
      }
      out.putImageData(res, 0, 0);
    } catch (e: any) { setError(e.message || "Could not draw the wallpaper."); }
  }, [photo, layer, keep, strokes, autos, mode]);

  // brush
  function startStroke(e: React.PointerEvent) {
    if (!brush || mode !== "show") return;
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setLive({ mode: brush, r: size, pts: [boxPoint(e)] });
  }
  function endStroke() { if (live) { setStrokes((s) => [...s, live]); setLive(null); } }

  const summary = active.map(({ w }) => { const g = panelGeometry(w.widthIn, "in"); return { w, count: g.count, sqft: (w.widthIn * w.heightIn) / 144 }; });
  const totalPanels = summary.reduce((n, s) => n + s.count, 0), totalSqft = summary.reduce((n, s) => n + s.sqft, 0);
  const setWall = (i: number, patch: Partial<Wall>) => setWalls(walls.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const unitLabel = selection.unit;
  const toUnit = (inch: number) => Math.round((selection.unit === "cm" ? inch * 2.54 : selection.unit === "ft" ? inch / 12 : inch) * 10) / 10;
  const fromUnit = (v: number) => measurementInches(v, selection.unit);
  const sides = SIDES.filter((s) => walls.some((w) => w.side === s));
  // murals: a wall bigger than the design's size gets the same note and popup as the size boxes
  const wallSel = (w: Wall): WallSelection => ({ ...selection, width: toUnit(w.widthIn), height: toUnit(w.heightIn) });
  const tooBigWall = (w: Wall) => repeatStyle(design as any) === "none" && !!sizeIssue(design as any, { ...selection, unit: "in", width: w.widthIn, height: w.heightIn });
  const tallForSideways = (w: Wall) => { if (repeatStyle(design as any) !== "horizontal" || !(design as any).printHeightCm) return ""; const max = (design as any).printHeightCm * 1.1 / 2.54; const t = Math.floor(max); return w.heightIn > max ? `${Math.floor(t / 12)} ft ${t % 12} in max` : ""; };
  const bigWall = mode === "show" ? active.map(({ w }) => w).find((w) => !w.auto && tooBigWall(w)) : undefined; // guessed walls have estimated sizes: no popup
  const [roomPopup, setRoomPopup] = useOversizePrompt(!!bigWall, active.map(({ w }) => `${w.widthIn}x${w.heightIn}`).join(","));
  const maxLabel = muralMaxLabel(design, selection);
  const showOverlay = photo && (mode === "pick" || mode === "show");

  function onMove(e: React.PointerEvent) { if (live) { const p = boxPoint(e); setLive((l) => (l ? { ...l, pts: [...l.pts, p] } : l)); return; } if (!drag.current) return; const p = boxPoint(e); const { links } = drag.current; setWalls((ws) => ws.map((x, j) => (links.some((l) => l.w === j) ? { ...x, corners: x.corners.map((q, k) => (links.some((l) => l.w === j && l.c === k) ? p : q)) } : x))); }
  /** A corner shared by two walls (where the back wall meets a side wall) moves for both. */
  function startDrag(i: number, k: number) { const c = walls[i].corners[k]; const links = [{ w: i, c: k }]; walls.forEach((w, j) => w.corners.forEach((q, m) => { if ((j !== i) && Math.abs(q.x - c.x) < 0.004 && Math.abs(q.y - c.y) < 0.004) links.push({ w: j, c: m }); })); drag.current = { w: i, c: k, links }; }

  return <div className="space-y-4" data-testid="my-room">
    <OversizePopup open={roomPopup} onOpenChange={setRoomPopup} max={maxLabel} title={design.title} designer={designerName ?? "the designer"} onAsk={() => bigWall && onAskFit?.(wallSel(bigWall))} />
    <div>
      <h3 className="text-lg">See it in your room</h3>
      <p className="text-sm text-muted-foreground">Upload a photo of your room, or pick a sample room. {ai?.roomRender ? "Our AI hangs the wallpaper on your walls in about 10 seconds." : ai?.walls ? "We find the walls for you, then you pick one." : "Then tap the 4 corners of the wall."} The wallpaper is placed at its real size for your wall ({ftIn(selW)} × {ftIn(selH)}), with the print panels marked.</p>
    </div>
    {myRooms.rooms.length > 0 && <MyRoomsPicker selected={photo?.sample ? null : roomId} onPick={(r) => openSaved(r)} onNew={(f) => onFile(f)} />}
    {!photo && <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-10 text-center text-sm hover:bg-muted/40">
      <Camera className="h-6 w-6" /> <span className="font-medium">Upload a room photo</span><span className="text-xs text-muted-foreground">Stand back so the whole wall is in the picture.</span>
      <input type="file" accept="image/*" className="sr-only" aria-label="Room photo" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>}
    <SampleRoomsRow selected={photo?.sample ?? null} onPick={(r) => r.sample && onSample(r.sample, false)} label={photo ? "Sample rooms" : "Or pick a sample room"} />
    {photo && <div ref={boxRef} className="relative select-none overflow-hidden rounded-md bg-muted touch-none" style={{ aspectRatio: `${photo.w} / ${photo.h}`, width: `min(100%, calc(72svh * ${(photo.w / photo.h).toFixed(4)}))`, marginInline: "auto" }} onClick={onTap} onPointerDown={startStroke} onPointerMove={onMove} onPointerUp={() => { drag.current = null; endStroke(); }} onPointerCancel={() => { drag.current = null; endStroke(); }} onPointerLeave={() => { drag.current = null; endStroke(); }} data-brush={brush ?? undefined}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Your room with the wallpaper" role="img" style={{ cursor: brush ? "crosshair" : undefined }} />
      {aiShown && !adjust && !brush && <img src={aiShown.url} alt="AI picture of your room with this wallpaper" className="absolute inset-0 h-full w-full object-fill" data-testid="room-ai" />}
      {!aiShown && mode === "show" && realShown && !adjust && !brush && <img src={realShown.url} alt="Realistic AI picture of your room" className="absolute inset-0 h-full w-full object-fill" data-testid="room-realistic" />}
      {aiWorking && !adjust && !brush && <><img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-fill" /><div role="status" data-testid="room-ai-busy" className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-black/35 text-center text-white"><Loader2 className="h-8 w-8 animate-spin" /><span className="text-base font-medium">Creating your room…</span><span className="text-xs opacity-90">Hanging {design.title} on your walls, about 10 seconds</span></div></>}
      {!aiWorking && ((aiShown && !adjust && !brush) || (mode === "show" && layer && !adjust && !brush)) && <CompareSlider before={photo.url} className="absolute inset-0 z-[1]">{null}</CompareSlider>}
      {realBusy && <div role="status" className="absolute bottom-2 right-2 z-[2] flex items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Making it realistic… about 20-40 s</div>}
      {live && <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${photo.w} ${photo.h}`}>
        <polyline points={live.pts.map((p) => `${p.x * photo.w},${p.y * photo.h}`).join(" ")} fill="none" stroke={live.mode === "keep" ? "rgba(220,38,38,0.45)" : "rgba(21,128,61,0.45)"} strokeWidth={live.r * 2 * photo.w} strokeLinecap="round" strokeLinejoin="round" />
      </svg>}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {mode === "pick" && walls.map((w, i) => <polygon key={i} points={w.corners.map((c) => `${c.x * 1000},${c.y * 1000}`).join(" ")} fill={pick === "all" || pick === w.side ? "rgba(21,128,61,0.35)" : "rgba(255,255,255,0.18)"} stroke="#15803D" strokeWidth={3} vectorEffect="non-scaling-stroke" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setPick(w.side); setMode("show"); }} />)}
        {showOverlay && mode === "show" && adjust && active.map(({ w, i }) => <g key={i}>
          <polygon points={w.corners.map((c) => `${c.x * 1000},${c.y * 1000}`).join(" ")} fill="none" stroke="#15803D" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>)}
        {mode === "corners" && taps.map((t, i) => <circle key={i} cx={t.x * 1000} cy={t.y * 1000} r={9} fill="#15803D" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
        {mode === "corners" && taps.length > 1 && <polyline points={taps.map((t) => `${t.x * 1000},${t.y * 1000}`).join(" ")} fill="none" stroke="#15803D" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      {mode === "show" && adjust && active.map(({ w, i }) => w.corners.map((c, k) => <button key={`${i}-${k}`} type="button" aria-label={`Move corner ${k + 1}`} className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#15803D] shadow" style={{ left: `${Math.min(1, Math.max(0, c.x)) * 100}%`, top: `${Math.min(1, Math.max(0, c.y)) * 100}%`, touchAction: "none" }} onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); startDrag(i, k); }} onClick={(e) => e.stopPropagation()} />))}
      {mode === "corners" && !aiShown && !aiWorking && <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/90 px-3 py-1.5 text-xs font-medium">Tap corner {taps.length + 1} of 4: {["top-left", "top-right", "bottom-right", "bottom-left"][taps.length]}</div>}
      {!aiWorking && !aiShown && (mode === "finding" || busy) && <div role="status" className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />{mode === "finding" ? "Finding your walls…" : "Placing the wallpaper…"}</div>}
    </div>}
    {aiShown ? <p className="text-xs text-muted-foreground" role="status" data-testid="room-ai-note">AI picture of your room with {design.title}, made in {aiShown.secs.toFixed(0)} s. Drag the line to compare with your photo.{walls.length > 1 ? " Tap a wall below to paper only that one." : ""} For the exact pattern size and print panels, tap Quick preview.</p>
      : aiWorking ? null
      : <>{aiFail && view === "ai" && <p className="text-xs text-muted-foreground" role="status">The AI picture didn't work this time ({aiFail}). Showing the quick preview instead.</p>}{note && <p className="text-xs text-muted-foreground" role="status">{note}</p>}</>}
    {error && <p className="text-sm text-destructive">{error}</p>}
    {photo && (mode === "pick" || mode === "show") && sides.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Which wall">
      {sides.map((s) => <Button key={s} size="sm" variant={pick === s ? "default" : "outline"} onClick={() => { setPick(s); setUserWall(s); setMode("show"); }}>{sideName(s)}</Button>)}
      {walls.length > 1 && <Button size="sm" variant={pick === "all" ? "default" : "outline"} onClick={() => { setPick("all"); setUserWall("all"); setMode("show"); }}>All walls</Button>}
    </div>}
    {photo && mode === "show" && active.length > 0 && <div className="space-y-3 rounded-md border border-border p-3 text-sm">
      {summary.map(({ w, count, sqft }) => { const i = walls.indexOf(w); return <div key={i} className="space-y-1">
        <div className="flex flex-wrap items-center gap-2"><b className="min-w-20">{sideName(w.side)}</b>
          <label className="flex items-center gap-1 text-xs">Width <input aria-label={`${sideName(w.side)} width`} className="h-8 w-20 rounded border border-border px-2" type="number" step="0.1" value={toUnit(w.widthIn)} onChange={(e) => Number(e.target.value) > 0 && setWall(i, { widthIn: fromUnit(Number(e.target.value)) })} />{unitLabel}</label>
          <label className="flex items-center gap-1 text-xs">Height <input aria-label={`${sideName(w.side)} height`} className="h-8 w-20 rounded border border-border px-2" type="number" step="0.1" value={toUnit(w.heightIn)} onChange={(e) => Number(e.target.value) > 0 && setWall(i, { heightIn: fromUnit(Number(e.target.value)) })} />{unitLabel}</label>
        </div>
        {tooBigWall(w) && <OversizeNote max={maxLabel} designer={designerName ?? "the designer"} onAsk={() => onAskFit?.(wallSel(w))} />}
        {tallForSideways(w) && <p className="text-xs text-amber-800" data-testid="sideways-tall-note">This wall is taller than the design ({tallForSideways(w)}). It does not repeat upward, so it is stretched to fit; ask {designerName ?? "the designer"} for a taller version.</p>}
        <p className="text-xs text-muted-foreground">{ftIn(w.widthIn)} × {ftIn(w.heightIn)} · <b className="text-foreground">{count} panel{count > 1 ? "s" : ""}</b>, each {ftIn(PANEL_WIDTH_IN)} wide × {ftIn(w.heightIn)} long (3 in overlap) · {sqft.toFixed(1)} sq ft</p>
      </div>; })}
      <p className="border-t border-border pt-2"><b>Total: {totalPanels} panel{totalPanels > 1 ? "s" : ""} · {totalSqft.toFixed(1)} sq ft</b></p>
    </div>}
    {photo && mode === "show" && brushOpen && <div className="space-y-2 rounded-md border border-border p-3 text-sm" role="group" aria-label="Brush">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={brush === "paper" ? "default" : "outline"} aria-pressed={brush === "paper"} onClick={() => setBrush("paper")}>Paint wallpaper</Button>
        <Button size="sm" variant={brush === "keep" ? "default" : "outline"} aria-pressed={brush === "keep"} onClick={() => setBrush("keep")}>Keep in front</Button>
        <span className="ml-1 text-xs text-muted-foreground">Size</span>
        {([["S", 0.012], ["M", 0.025], ["L", 0.05]] as const).map(([l, v]) => <Button key={l} size="sm" variant={size === v ? "default" : "outline"} className="w-9 px-0" aria-label={`Brush size ${l}`} onClick={() => setSize(v)}>{l}</Button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}><Undo2 />Undo</Button>
        <Button size="sm" variant="outline" disabled={!strokes.length} onClick={() => setStrokes([])}><RotateCcw />Reset</Button>
        <span className="text-xs text-muted-foreground">{brush === "keep" ? "Paint over furniture to keep it in front." : "Paint over wall the wallpaper missed."}</span>
      </div>
    </div>}
    {photo && <div className="flex flex-wrap gap-2">
      {mode === "show" && <Button size="sm" variant="outline" onClick={() => setPanels(!panels)}>{panels ? "Hide panels" : "Show panels"}</Button>}
      {mode === "show" && <Button size="sm" variant="outline" aria-pressed={keep} onClick={() => { keepTouched.current = true; setKeep(!keep); }}>{keep ? "Furniture in front: on" : "Furniture in front: off"}</Button>}
      {mode === "show" && <Button size="sm" variant={brushOpen ? "default" : "outline"} aria-pressed={brushOpen} onClick={() => { const o = !brushOpen; setBrushOpen(o); setBrush(o ? "keep" : null); if (o) setAdjust(false); }}><Brush />Brush</Button>}
      {ai?.roomRender && (view === "ai"
        ? <Button size="sm" variant="outline" onClick={() => { setView("quick"); if (active.some(({ w }) => w.auto)) setAdjust(true); }}>Quick preview (exact size)</Button>
        : <Button size="sm" onClick={() => { setView("ai"); setAdjust(false); }}><Sparkles />AI picture</Button>)}
      {ai?.roomRender && view === "ai" && aiFail && !aiBusy && !aiShown && <Button size="sm" onClick={() => setAiRetry((n) => n + 1)}><Sparkles />Try the AI picture again</Button>}
      {mode === "show" && !brushOpen && <Button size="sm" variant="outline" onClick={() => setAdjust(!adjust)}>{adjust ? (active.some(({ w }) => w.auto) ? "Looks right" : "Done adjusting") : "Adjust corners"}</Button>}
      {(mode === "show" || mode === "pick") && <Button size="sm" variant="outline" onClick={() => { setTaps([]); setMode("corners"); }}><Plus />Add a wall by hand</Button>}
      {mode === "show" && <Button size="sm" variant="outline" onClick={() => { const a = document.createElement("a"); a.href = aiShown && !adjust ? aiShown.url : canvasRef.current!.toDataURL("image/jpeg", 0.9); a.download = "my-room.jpg"; a.click(); }}><Download />Save picture</Button>}
      <Button size="sm" variant="ghost" onClick={() => { setPhoto(null); setWalls([]); setMode("idle"); setNote(""); setTaps([]); resetTools(); }}><RotateCcw />{photo.sample ? "Other room" : "New photo"}</Button>
    </div>}
  </div>;
}
