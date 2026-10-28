import { Link } from "@tanstack/react-router";
import { designs, designBySlug } from "@/lib/catalog";
import { Camera, Upload, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { BeforeAfter } from "@/components/before-after";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cropArtwork, type WallSelection } from "@/lib/wall-selection";
import { streamImage } from "@/lib/stream-image";
import { analysisPhoto, buildWallRegion, canvasBlob, compositeRoom, drawWallMask, pointInPolygon, type DetectedWall } from "@/lib/room-composite";
import type { Design } from "@/lib/catalog";
import { RoomPhotoGallery } from "@/components/room-photo-gallery";
import { savedRoomPhotos, rememberRoomPhoto, forgetRoomPhoto, type SavedRoomPhoto } from "@/lib/room-photos";
import { roomDetectionCache, roomRenderCache, roomPhotoKey } from "@/lib/room-preview-cache";
import { plainError } from "@/lib/original-source";

type Region = { canvas: HTMLCanvasElement; url: string };

export function RoomPreview({ design, selection }: { design: Design; selection: WallSelection }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [walls, setWalls] = useState<DetectedWall[]>([]);
  const [wallIndex, setWallIndex] = useState(0);
  const [region, setRegion] = useState<Region | null>(null);
  const [stage, setStage] = useState<"idle" | "finding" | "rendering">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [error, setError] = useState("");
  const [savedPhotos, setSavedPhotos] = useState<SavedRoomPhoto[]>([]);
  const [storageError, setStorageError] = useState("");
  const [compares, setCompares] = useState<Record<string, { url: string | null; done: boolean }>>({});
  const [lastWall, setLastWall] = useState<{ wall: DetectedWall; area: Region } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoKey = useRef("");
  const busy = stage !== "idle";

  useEffect(() => {
    let active = true;
    void savedRoomPhotos().then(photos => { if (active) setSavedPhotos(photos); }).catch(() => { if (active) setStorageError("Photo saving isn't available in this browser. You can still upload and preview a room."); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => { setResult(null); setFinal(false); setCompares({}); }, [design.slug, design.image, selection.width, selection.height, selection.unit, selection.zoom, selection.x, selection.y, selection.artRatio]);

  async function analyse(src: string) {
    setStage("finding"); setError(""); setWalls([]); setRegion(null);
    try {
      const analysedPhoto = await analysisPhoto(src);
      photoKey.current = await roomPhotoKey(analysedPhoto);
      const foundWalls = await roomDetectionCache.getOrCreate(photoKey.current, async () => {
        const form = new FormData(); form.append("room", analysedPhoto, "room.jpg");
        const res = await fetch("/api/wall-detect", { method: "POST", body: form });
        const json = await res.json().catch(() => ({})) as { walls?: DetectedWall[]; error?: string };
        if (!res.ok || !json.walls) throw new Error(json.error ?? "We couldn't read your room photo.");
        if (!json.walls.length) throw new Error("We couldn't see a wall in this photo. Try a photo that shows more of the wall.");
        return json.walls;
      });
      setWalls(foundWalls); setWallIndex(0);
      const firstWall = foundWalls[0];
      if (!firstWall) throw new Error("We couldn't see a wall in this photo.");
      const next = await selectWall(src, firstWall);
      setStage("idle");
      if (next) await render(src, firstWall, next);
    } catch (err) { setError(plainError(err, "We couldn't read your room photo.")); setStage("idle"); }
  }
  async function selectWall(src: string, wall: DetectedWall) {
    const r = await buildWallRegion(src, wall);
    if (r.coverage < 0.01) { setError("That wall is too small to preview. Try another photo."); return null; }
    const next = { canvas: r.canvas, url: r.canvas.toDataURL() };
    setRegion(next); return next;
  }
  async function chooseWall(i: number) {
    if (!photo || busy || !walls[i]) return;
    setWallIndex(i); setResult(null); setError("");
    const next = await selectWall(photo, walls[i]);
    if (next) await render(photo, walls[i], next);
  }

  async function chooseAll() {
    if (!photo || busy || walls.length < 2) return;
    setWallIndex(-1); setResult(null); setError("");
    const parts = await Promise.all(walls.map(w => buildWallRegion(photo, w)));
    const first = parts[0]; const firstWall = walls[0]; if (!first || !firstWall) return;
    const base = first.canvas; const c = document.createElement("canvas"); c.width = base.width; c.height = base.height;
    const ctx = c.getContext("2d"); if (!ctx) return; parts.forEach(p => ctx.drawImage(p.canvas, 0, 0, c.width, c.height));
    const area = { canvas: c, url: c.toDataURL() }; setRegion(area);
    const all = { ...firstWall, label: "All walls", polygon: walls.flatMap(w => w.polygon), samples: walls.flatMap(w => w.samples), objects: walls.flatMap(w => w.objects) };
    await render(photo, all, area);
  }

  function pick(file?: File) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) { setError("Choose an image under 15 MB."); return; }
    choosePhoto(URL.createObjectURL(file));
    void rememberRoomPhoto(file, file.name).then(() => savedRoomPhotos()).then(setSavedPhotos).catch(() => setStorageError("This photo couldn't be saved on your browser. Your preview can still continue."));
  }

  function choosePhoto(url: string) {
    if (busy) return;
    setPhoto(url); setResult(null); setFinal(false); setCompares({}); setLastWall(null);
    void analyse(url);
  }

  async function removePhoto(id: string) {
    try { await forgetRoomPhoto(id); setSavedPhotos(photos => photos.filter(p => p.id !== id)); }
    catch { setStorageError("We couldn't remove the saved photo. Please try again."); }
  }

  async function render(src: string, wall: DetectedWall, area: Region, d: Design = design) {
    const main = d.slug === design.slug;
    if (main) { setStage("rendering"); setError(""); setResult(null); setFinal(false); setCompares({}); setLastWall({ wall, area }); }
    else setCompares(c => ({ ...c, [d.slug]: { url: null, done: false } }));
    try {
      const image = new Image(); image.src = src; await image.decode();
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio < 1 / 3 || ratio > 3) throw new Error("Please choose a room photo that is not panoramic.");
      const scale = Math.min(1, Math.sqrt(1048576 / (image.naturalWidth * image.naturalHeight)));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(image.naturalWidth * scale / 16) * 16; canvas.height = Math.round(image.naturalHeight * scale / 16) * 16;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Your browser could not prepare the photo.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const wallMask = drawWallMask(canvas.width, canvas.height, area.canvas, []);
      const [room, mask] = await Promise.all([canvasBlob(canvas), canvasBlob(wallMask)]);
      const artwork = d.kind === "repeating" ? await (await fetch(d.image)).blob() : await cropArtwork(d.image, main ? selection : { ...selection, zoom: 1, x: 0.5, y: 0.5 });
      const pts = wall.samples.length ? wall.samples : wall.polygon;
      const point = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
      const objects = wall.objects.map(o => o.label).slice(0, 12).join(", ");
      const form = new FormData(); form.append("room", room, "room.png"); form.append("artwork", artwork, "artwork.png"); form.append("mask", mask, "wall-mask.png"); form.set("point", JSON.stringify(point)); form.set("instruction", objects ? `Keep these in front of the wall exactly as they are: ${objects}.` : ""); form.set("size", `${canvas.width}x${canvas.height}`);
      const cacheKey = JSON.stringify([photoKey.current, area.url, d.image, selection.width, selection.height, selection.unit, selection.zoom, selection.x, selection.y, selection.artRatio]);
      const completed = await roomRenderCache.getOrCreate(cacheKey, async () => {
        let frames = Promise.resolve();
        let completedFrame: string | null = null;
        await streamImage("/api/room-preview", form, (frame, done) => {
          frames = frames.then(async () => {
            const merged = await compositeRoom(canvas, wallMask, frame);
            if (done) completedFrame = merged;
            if (main) { setResult(merged); setFinal(done); } else setCompares(c => ({ ...c, [d.slug]: { url: merged, done } }));
          });
        });
        await frames;
        if (!completedFrame) throw new Error("The preview didn't finish. Please try again.");
        return completedFrame;
      });
      if (main) { setResult(completed); setFinal(true); } else setCompares(c => ({ ...c, [d.slug]: { url: completed, done: true } }));
    } catch (err) { if (main) setError(plainError(err, "Could not create your room preview.")); else setCompares(c => { const n = { ...c }; delete n[d.slug]; return n; }); }
    finally { if (main) setStage("idle"); }
  }

  function tapPhoto(e: React.PointerEvent<HTMLDivElement>) {
    if (busy || result || walls.length < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const i = walls.findIndex(w => pointInPolygon(p, w.polygon));
    if (i >= 0 && i !== wallIndex) void chooseWall(i);
  }
  const others = designs.filter(o => o.slug !== design.slug).slice(0, 12);
  const maskStyle = region ? { maskImage: `url(${region.url})`, WebkitMaskImage: `url(${region.url})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" } : undefined;

  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-eyebrow text-primary">Your room. Your design.</p><h3 className="mt-2 text-2xl">See it on your wall</h3><p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Upload a photo of your room. We find the wall and your furniture automatically, then put the wallpaper on.</p></div>{photo && !busy && <Button variant="ghost" size="sm" onClick={() => { setPhoto(null); setResult(null); setWalls([]); setRegion(null); setError(""); }}><RotateCcw />New photo</Button>}</div>
    {!photo ? <><div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-12 text-center"><Camera className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-4 text-sm">A clear, well-lit photo works best.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Button onClick={() => cameraRef.current?.click()}><Camera />Take a photo</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Upload photo</Button></div></div><RoomPhotoGallery photos={savedPhotos} disabled={busy} onChooseDemo={choosePhoto} onChooseSaved={p => choosePhoto(URL.createObjectURL(p.blob))} onRemove={id => void removePhoto(id)} /></> : <>
      {result ? <BeforeAfter before={photo} after={result} beforeAlt="Your room before" afterAlt="Your room with the wallpaper" blurAfter={!final} className="mt-6 rounded-xl" /> : <div className={`relative mt-6 overflow-hidden rounded-xl bg-muted ${walls.length > 1 && !busy ? "cursor-pointer" : ""}`} onPointerDown={tapPhoto}>
        <img src={photo} alt="Your room" className="block w-full" />
        {region && <div className="pointer-events-none absolute inset-0 animate-pulse bg-primary/40" style={maskStyle} />}
        {busy && <div role="status" className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />{stage === "finding" ? "Finding your wall and furniture…" : "Putting the wallpaper on your wall…"}</div>}
      </div>}
      {walls.length > 1 && !busy && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Walls we found:</span>{walls.map((w, i) => <Button key={i} size="sm" variant={i === wallIndex ? "secondary" : "outline"} className="rounded-full" onClick={() => void chooseWall(i)}>{w.label || `Wall ${i + 1}`}</Button>)}<Button size="sm" variant={wallIndex === -1 ? "secondary" : "outline"} className="rounded-full" onClick={() => void chooseAll()}>All walls</Button></div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {result && !busy && <p className="text-sm text-muted-foreground">Drag the slider to compare before and after.</p>}
        {!result && !busy && region && walls[wallIndex] && <Button onClick={() => { const wall = walls[wallIndex]; if (wall) void render(photo, wall, region); }}><Sparkles />Show it on my wall</Button>}
        {!busy && !walls.length && error && <Button variant="outline" onClick={() => void analyse(photo)}><Sparkles />Try again</Button>}
      </div>
    </>}
    {result && final && !busy && photo && lastWall && <div className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-eyebrow text-primary">Compare designs</p><h4 className="mt-1 text-xl">Try other designs on this wall</h4></div><p className="text-xs text-muted-foreground">Pick up to 3 to see side by side</p></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{others.map(o => { const on = o.slug in compares; return <button key={o.slug} type="button" aria-pressed={on} disabled={!on && Object.keys(compares).length >= 3} onClick={() => { if (on) setCompares(c => { const n = { ...c }; delete n[o.slug]; return n; }); else void render(photo, lastWall.wall, lastWall.area, o); }} className={`shrink-0 overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-40 ${on ? "border-primary" : "border-transparent hover:border-border"}`}><img src={o.image} alt="" className="h-20 w-24 object-cover" /><span className="block w-24 truncate px-1.5 py-1 text-xs">{o.title}</span></button>; })}</div>
      {Object.keys(compares).length > 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <figure><img src={result} alt={`Your room with ${design.title}`} className="w-full rounded-xl" /><figcaption className="mt-2 text-sm">{design.title} <span className="text-muted-foreground">· current</span></figcaption></figure>
        {Object.entries(compares).map(([slug, c]) => { const o = designBySlug(slug); if (!o) return null; return <figure key={slug}>{c.url ? <img src={c.url} alt={`Your room with ${o.title}`} className={`w-full rounded-xl ${c.done ? "" : "blur-sm"}`} /> : <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Putting {o.title} on your wall…</div>}<figcaption className="mt-2 flex items-center justify-between text-sm">{o.title}<Link to="/design/$slug/preview" params={{ slug }} search={{ view: "room" } as never} className="text-xs text-primary underline-offset-4 hover:underline">View this design</Link></figcaption></figure>; })}
      </div>}
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {storageError && <p role="status" className="mt-4 text-sm text-muted-foreground">{storageError}</p>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Only the wall changes; your furniture and the rest of the room stay as they are. Previews are approximate, not print proofs.</p>
    <input ref={cameraRef} aria-label="Take room photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} /><input ref={fileRef} aria-label="Upload room photo" type="file" accept="image/*" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
  </section>;
}
