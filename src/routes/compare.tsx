import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { designBySlug, designerBySlug, materials, money, designRate } from "@/lib/catalog";
import { useCompare } from "@/lib/compare";
import { initialWall } from "@/lib/wall-selection";
import { useMyRooms } from "@/lib/my-rooms";
import { CornerTapper, RoomRender, addRoomPhoto, useLoadedRoom } from "@/components/try-on-wall";
import { MyRoomsPicker, SampleRoomsRow } from "@/components/my-rooms-picker";
import { useState } from "react";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [
    { title: "Compare wallpaper designs — Artisan Mural" },
    { name: "description", content: "Compare wallpaper designs side by side: style, colors, rooms, finishes and price per square foot." },
    { property: "og:title", content: "Compare wallpaper designs — Artisan Mural" },
    { property: "og:description", content: "See your favorite wallpaper designs side by side before you order." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ComparePage,
});

function ComparePage() {
  const { list, remove } = useCompare();
  const items = list.map(designBySlug).filter(d => !!d);
  const rows: [string, (d: (typeof items)[number]) => React.ReactNode][] = [
    ["Type", d => d.kind === "mural" ? "Mural — one scene" : "Repeating pattern"],
    ["Designer", d => designerBySlug(d.designer)?.name],
    ["Colors", d => d.palette],
    ["Style", d => d.categories.join(", ")],
    ["Best for", d => d.room.join(", ")],
    ["Price", d => `${money(designRate(d))} / sq ft`],
    ["Finishes", () => `${materials.length} to choose from`],
  ];
  return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
    <p className="text-eyebrow text-primary">Side by side</p>
    <h1 className="mt-2 text-4xl sm:text-5xl">Compare designs</h1>
    {items.length > 0 && <OnYourWall items={items} />}
    {items.length === 0 ? <div className="soft-panel mt-8 text-center"><p>You haven't picked any designs yet.</p><Button asChild className="mt-4"><Link to="/browse">Browse designs</Link></Button></div> :
    <div className="mt-8 -mx-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(220px, 1fr))` }}>
        {items.map(d => <div key={d.slug} className="soft-panel flex flex-col">
          <div className="relative"><img src={d.image} alt={d.title} className="aspect-4/5 w-full rounded-lg object-cover" /><button type="button" aria-label={`Remove ${d.title}`} onClick={() => remove(d.slug)} className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5"><X className="h-4 w-4" /></button></div>
          <h2 className="mt-4 text-2xl">{d.title}</h2>
          <dl className="mt-3 flex-1 space-y-3 text-sm">{rows.map(([label, fn]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5">{fn(d)}</dd></div>)}</dl>
          <div className="mt-5 grid gap-2"><Button asChild><Link to="/design/$slug" params={{ slug: d.slug }}>View & order</Link></Button><Button asChild variant="outline"><Link to="/design/$slug/preview" params={{ slug: d.slug }} search={{ ...initialWall, view: "room" }}><Camera />See in my room</Link></Button></div>
        </div>)}
      </div>
    </div>}
  </div>;
}

function OnYourWall({ items }: { items: NonNullable<ReturnType<typeof designBySlug>>[] }) {
  const { room, ready } = useMyRooms();
  const loaded = useLoadedRoom(room);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function onNew(f: File) { setBusy(true); setErr(""); try { await addRoomPhoto(f); } catch (e: any) { setErr(e.message || "Could not save the photo."); } finally { setBusy(false); } }
  if (!ready) return null;
  return <section className="mt-8" aria-label="On your wall" data-testid="compare-wall">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl">On your wall</h2><p className="mt-1 text-sm text-muted-foreground">{room ? (room.walls?.length ? "The same wall, each design. Drag a line to see before and after." : "Tap the 4 corners of the wall once, then every design goes on it.") : "Add a photo of your room, or pick a sample room, to see these designs on a wall."}</p></div>
      {!room && <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-input px-4 text-xs hover:bg-muted/50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}Upload a room photo<input type="file" accept="image/*" className="sr-only" aria-label="Room photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onNew(f); }} /></label>}
    </div>
    {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    {!room && ready && <SampleRoomsRow className="mt-4" />}
    {room && !room.walls?.length && <div className="mt-4 max-w-xl"><CornerTapper room={room} /></div>}
    {room && loaded && <div className="mt-4 -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((d, i) => <figure key={d.slug} className="w-[86%] shrink-0 snap-center sm:w-auto">
        <RoomRender loaded={loaded} design={d} />
        <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{d.title}</span><span className="shrink-0 text-xs text-muted-foreground sm:hidden">{i + 1} / {items.length}</span></figcaption>
      </figure>)}
    </div>}
    {room && <div className="mt-4 grid gap-4 md:grid-cols-2"><MyRoomsPicker onNew={onNew} label="Your rooms" /><SampleRoomsRow label="Sample rooms" /></div>}
  </section>;
}
