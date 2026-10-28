import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Check, Loader2, Plus, X } from "lucide-react";
import type { Design } from "@/lib/catalog";
import { loadRoom, renderOnRoom, type LoadedRoom, type P } from "@/lib/wall-render";
import { findWalls, freeWalls, isOldGuess } from "@/lib/find-walls";
import { saveRoomPhoto, updateRoom, useMyRooms, type MyRoomPhoto } from "@/lib/my-rooms";
import { useCompare } from "@/lib/compare";
import { initialWall } from "@/lib/wall-selection";
import { CompareSlider } from "@/components/compare-slider";
import { MyRoomsPicker, SampleRoomsRow } from "@/components/my-rooms-picker";

/** Shrink a picked photo to the working size (max 1280 px) and save it as the shopper's room. */
export async function addRoomPhoto(f: File) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't a photo we can open. Try a JPG or PNG.")); i.src = url; });
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read the photo."))), "image/jpeg", 0.86));
    const r = await saveRoomPhoto(blob, f.name || "Room photo", w, h);
    // find the walls right away (AI when the owner's key is set, else the free guess from the photo's lines);
    // nothing found = no walls, so the shopper is asked to tap the 4 corners (never a rectangle over the whole photo)
    const found = await findWalls(c.getContext("2d")!.getImageData(0, 0, w, h), 120, 96).catch(() => ({ walls: [] as any[] }));
    await updateRoom(r.id, { walls: found.walls });
    return r;
  } finally { URL.revokeObjectURL(url); }
}

/** The saved room, decoded and ready to draw on (re-made when its walls change). */
export function useLoadedRoom(room: MyRoomPhoto | null) {
  const [loaded, setLoaded] = useState<LoadedRoom | null>(null);
  const sig = room ? `${room.id}|${JSON.stringify(room.walls ?? [])}|${room.keep !== false}|${(room.strokes ?? []).length}` : "";
  useEffect(() => {
    if (!room || !room.walls?.length) { setLoaded(null); return; }
    let gone = false;
    if (!room.sample && isOldGuess(room.walls)) { // saved by the old guess: find the walls again (or ask for taps)
      setLoaded(null);
      const url = URL.createObjectURL(room.blob);
      const img = new Image();
      img.onload = () => { if (gone) return; const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); const x = c.getContext("2d")!; x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); updateRoom(room.id, { walls: freeWalls(x.getImageData(0, 0, c.width, c.height), 120, 96).walls }); };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
      return () => { gone = true; };
    }
    loadRoom(sig, room.blob, room.walls, room.keep !== false, room.strokes ?? [], room.mask).then((l) => { if (!gone) setLoaded(l); }).catch(() => { if (!gone) setLoaded(null); });
    return () => { gone = true; };
  }, [sig]);
  return loaded;
}

/** One design drawn on the saved room, with the before / after line. */
export function RoomRender({ loaded, design, className = "", slider = true }: { loaded: LoadedRoom; design: Design; className?: string; slider?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let gone = false; setErr("");
    renderOnRoom(loaded, design).then((u) => { if (!gone) setUrl(u); }).catch((e) => { if (!gone) setErr(e?.message || "Could not draw this wallpaper."); });
    return () => { gone = true; };
  }, [loaded, design.slug, design.image]);
  const ratio = { aspectRatio: `${loaded.w} / ${loaded.h}` };
  const pic = url ? <img src={url} alt={`${design.title} on your wall`} className="block h-full w-full object-cover" draggable={false} /> : <img src={loaded.url} alt="" className="block h-full w-full object-cover opacity-60" />;
  return <div className={`relative overflow-hidden rounded-md bg-muted ${className}`} style={ratio}>
    {slider && url ? <CompareSlider before={loaded.url} wholeArea className="h-full w-full">{pic}</CompareSlider> : pic}
    {!url && !err && <div role="status" className="absolute inset-0 flex items-center justify-center"><span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Putting it on your wall…</span></div>}
    {err && <p className="absolute inset-x-2 bottom-2 rounded bg-background/90 px-2 py-1 text-xs text-destructive">{err}</p>}
  </div>;
}

/** Tap the 4 corners of the wall on a saved photo (used when the walls were not set yet). */
export function CornerTapper({ room, className = "" }: { room: MyRoomPhoto; className?: string }) {
  const [taps, setTaps] = useState<P[]>([]);
  const [src, setSrc] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const u = URL.createObjectURL(room.blob); setSrc(u); setTaps([]); return () => URL.revokeObjectURL(u); }, [room.id]);
  const names = ["top-left", "top-right", "bottom-right", "bottom-left"];
  function tap(e: React.MouseEvent) {
    const r = box.current!.getBoundingClientRect();
    const t = [...taps, { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }];
    if (t.length < 4) { setTaps(t); return; }
    setTaps([]);
    updateRoom(room.id, { walls: [{ side: "back", corners: t, objects: [], widthIn: 120, heightIn: 96 }] });
  }
  return <div ref={box} onClick={tap} className={`relative cursor-crosshair select-none overflow-hidden rounded-md bg-muted ${className}`} style={{ aspectRatio: room.w && room.h ? `${room.w} / ${room.h}` : "4 / 3" }}>
    {src && <img src={src} alt="Your room" className="block h-full w-full object-cover" draggable={false} />}
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      {taps.length > 1 && <polyline points={taps.map((t) => `${t.x * 1000},${t.y * 1000}`).join(" ")} fill="none" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      {taps.map((t, i) => <circle key={i} cx={t.x * 1000} cy={t.y * 1000} r={8} fill="#1f2937" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
    </svg>
    <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/90 px-2.5 py-1 text-xs font-medium">Tap corner {taps.length + 1} of 4: {names[taps.length]} of the wall</div>
  </div>;
}

/** Browse page panel: the shopper's wall with whichever wallpaper they tap. */
export function TryOnPanel({ design, onClose }: { design: Design | null; onClose: () => void }) {
  const { room, ready } = useMyRooms();
  const loaded = useLoadedRoom(room);
  const compare = useCompare();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [top, setTop] = useState(64);
  const [rooms, setRooms] = useState(false);
  useEffect(() => { const h = document.querySelector("header") as HTMLElement | null; if (h) setTop(h.offsetHeight); }, []);
  async function onNew(f: File) { setBusy(true); setError(""); try { await addRoomPhoto(f); } catch (e: any) { setError(e.message || "Could not save the photo."); } finally { setBusy(false); } }
  const on = design ? compare.has(design.slug) : false;
  return <section aria-label="Try on my wall" data-testid="try-on" className="sticky z-30 -mx-5 mb-6 border-b border-border bg-background/97 px-5 pb-3 pt-3 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.35)] backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4" style={{ top }}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">On your wall</p>
        <p className="truncate font-display text-lg leading-tight">{design ? design.title : room ? "Tap any wallpaper below" : "Add your room or pick a sample"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {design && <button type="button" onClick={() => compare.toggle(design.slug)} disabled={!on && compare.full} aria-pressed={on} className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs hover:bg-muted/50">{on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}Compare</button>}
        {design && <Link to="/design/$slug" params={{ slug: design.slug }} className="hidden h-8 items-center rounded-full bg-foreground px-3 text-xs font-medium text-background sm:inline-flex">View & order</Link>}
        <button type="button" onClick={onClose} aria-label="Close try on" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
    <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
      <div className="mx-auto w-full min-w-0" style={{ maxWidth: room?.w && room?.h ? `calc(min(30svh, 420px) * ${(room.w / room.h).toFixed(3)})` : undefined }}>
        {!ready ? <div className="h-40 animate-pulse rounded-md bg-muted" /> :
          !room ? <div className="space-y-3"><label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm hover:bg-muted/40">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}<span className="font-medium">Upload a room photo</span><span className="text-xs text-muted-foreground">Then tap any wallpaper to see it on your wall. Saved for next time.</span>
            <input type="file" accept="image/*" className="sr-only" aria-label="Room photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onNew(f); }} />
          </label><SampleRoomsRow /></div> :
          !room.walls?.length ? <CornerTapper room={room} /> :
          !loaded ? <div className="flex aspect-4/3 items-center justify-center rounded-md bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> :
          design ? <RoomRender loaded={loaded} design={design} /> :
          <div className="relative overflow-hidden rounded-md" style={{ aspectRatio: `${loaded.w} / ${loaded.h}` }}><img src={loaded.url} alt="Your room" className="block h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-2 mx-auto w-max rounded-full bg-background/90 px-3 py-1 text-xs">Tap a wallpaper below</span></div>}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {room && <button type="button" onClick={() => setRooms(!rooms)} aria-expanded={rooms} className="mt-1.5 text-[11px] text-muted-foreground underline underline-offset-2 md:hidden">{rooms ? "Hide rooms" : "Change room & options"}</button>}
      </div>
      <div className={`space-y-2 ${rooms ? "" : "hidden md:block"}`}>
        {room && <MyRoomsPicker onNew={onNew} label="Your rooms" showAccountNote />}
        {room && <SampleRoomsRow label="Sample rooms" />}
        {room && room.walls?.length ? <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Drag the line: before / after.</span>
          {!room.sample && <button type="button" className="underline underline-offset-2" onClick={() => updateRoom(room.id, { walls: [] })}>Mark the wall again</button>}
          <button type="button" className="underline underline-offset-2" aria-pressed={room.keep !== false} onClick={() => updateRoom(room.id, { keep: room.keep === false })}>Furniture in front: {room.keep === false ? "off" : "on"}</button>
          {design && <Link to="/design/$slug/preview" params={{ slug: design.slug }} search={{ ...initialWall, view: "room" }} className="underline underline-offset-2">Measure & panels</Link>}
        </div> : null}
      </div>
    </div>
  </section>;
}
