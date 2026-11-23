import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Loader2, X } from "lucide-react";
import { designBySlug, designerBySlug, materials, money, designRate, registerShop } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { useCompare } from "@/lib/compare";
import { useMyRooms } from "@/lib/my-rooms";
import { CornerTapper, RoomRender, addRoomPhoto, useLoadedRoom } from "@/components/try-on-wall";
import { MyRoomsPicker, SampleRoomsRow } from "@/components/my-rooms-picker";
import { useState } from "react";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [
    { title: "Compare wallpaper designs — Artisan Murals" },
    { name: "description", content: "Compare wallpaper designs side by side: style, colors, rooms, finishes and price per square foot." },
    { property: "og:title", content: "Compare wallpaper designs — Artisan Murals" },
    { property: "og:description", content: "See your favorite wallpaper designs side by side before you order." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => ensureShop(context.queryClient),
  component: ComparePage,
});

/** The approved preview's comparison: one table, a column per design (picture, room, type, designer, colors, style, price). */
function ComparePage() {
  registerShop(Route.useLoaderData());
  const { list, remove } = useCompare();
  const items = list.map(designBySlug).filter((d) => !!d) as NonNullable<ReturnType<typeof designBySlug>>[];
  const row = (h: string, f: (d: (typeof items)[number]) => React.ReactNode) => <tr><th>{h}</th>{items.map((d) => <td key={d.slug}>{f(d)}</td>)}</tr>;
  return <div className="am">
    <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/browse">Shop</Link><span>/</span><b>Compare</b></nav></div>
    <section className="pg">
      <div className="dir-head"><div><span className="k">Side by side</span><h1>Compare designs</h1><p>{items.length ? `${items.length} design${items.length > 1 ? "s" : ""} side by side. Tick "Compare" on up to 4 designs in the shop.` : 'Nothing to compare yet. Tick "Compare" under any design in the shop.'}</p></div><Link className="btn optline" to="/browse">Add more designs</Link></div>
      {items.length > 0 && <div className="cmp-wrap"><table className="cmp"><tbody>
        {row("Design", (d) => <><Link to="/design/$slug" params={{ slug: d.slug }}><img src={d.image} alt="" /><b>{d.title}</b></Link><br /><button type="button" className="rm" onClick={() => remove(d.slug)}>Remove</button></>)}
        {row("In a room", (d) => (d.mockups?.[0] ? <img src={d.mockups[0]} alt="" /> : <small>Room pictures coming soon</small>))}
        {row("Type", (d) => (d.kind === "mural" ? <>Mural<br /><small>One scene, sized to your wall</small></> : <>Repeating pattern<br /><small>Covers any wall</small></>))}
        {row("Designer", (d) => { const x = designerBySlug(d.designer); return x ? <><Link to="/designers/$slug" params={{ slug: x.slug }}>{x.name}</Link>{x.reviews ? <><br /><small>★ {x.rating.toFixed(1)}</small></> : null}</> : d.designer; })}
        {row("Colors", (d) => d.palette || "—")}
        {row("Style", (d) => d.categories.join(", ") || "—")}
        {row("Best for", (d) => d.room.join(", ") || "—")}
        {row("Price", (d) => <>{money(designRate(d))} / sq ft<br /><small>{materials.length} papers to choose from</small></>)}
        {row("", (d) => <div className="up-row"><Link className="btn btn-wine btn-sm" to="/design/$slug" params={{ slug: d.slug }}>View &amp; order</Link></div>)}
      </tbody></table></div>}
      {items.length > 0 && <OnYourWall items={items} />}
    </section>
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
