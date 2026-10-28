import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { attachDismissed, attachGuestRooms, chooseRoom, chooseSample, deleteRoom, dismissAttach, isSampleId, useMyRooms, type MyRoomPhoto } from "@/lib/my-rooms";
import { SAMPLE_ROOMS, SAMPLE_TYPES, variantsOf, categoryOf } from "@/lib/room-mask";
import { RoomCategoryTabs, usedCategories } from "@/components/room-category-tabs";

/** Object URLs for the saved photos, made once per photo. */
export function useRoomThumbs(rooms: MyRoomPhoto[]) {
  const urls = useMemo(() => new Map(rooms.map((r) => [r.id, URL.createObjectURL(r.blob)])), [rooms.map((r) => r.id + ":" + r.blob.size).join(",")]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/** A small row of the shopper's saved room photos: pick one, delete one, or add a new photo. */
export function MyRoomsPicker({ selected, onPick, onNew, label = "My rooms", showAccountNote = true }: { selected?: string | null; onPick?: (r: MyRoomPhoto) => void; onNew?: (f: File) => void; label?: string; showAccountNote?: boolean }) {
  const { rooms, uid, guestRooms, current } = useMyRooms();
  const thumbs = useRoomThumbs(rooms);
  const [saving, setSaving] = useState(false);
  const [, force] = useState(0);
  const sel = selected === undefined ? current : selected;
  if (!rooms.length && !onNew) return null;
  return <div className="space-y-2" data-testid="my-rooms">
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {showAccountNote && rooms.length > 0 && (uid ? <span className="text-[11px] text-muted-foreground">Saved to your account</span> : <span className="text-[11px] text-muted-foreground">Saved on this device · <Link to="/account" className="underline underline-offset-2">Sign in</Link> to keep them</span>)}
    </div>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {rooms.map((r) => <div key={r.id} className="relative shrink-0">
        <button type="button" onClick={() => { chooseRoom(r.id); onPick?.(r); }} aria-pressed={sel === r.id} aria-label={`Use room photo ${r.name}`}
          className={`block h-14 w-20 overflow-hidden rounded-md border transition ${sel === r.id ? "border-foreground ring-1 ring-foreground" : "border-border opacity-85 hover:opacity-100"}`}>
          <img src={thumbs.get(r.id)} alt="" className="h-full w-full object-cover" />
        </button>
        <button type="button" aria-label={`Delete room photo ${r.name}`} onClick={() => { if (confirm("Delete this room photo?")) deleteRoom(r.id); }}
          className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground"><X className="h-3 w-3" /></button>
      </div>)}
      {onNew && <label className="flex h-14 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted/40">
        <Plus className="h-4 w-4" />New photo
        <input type="file" accept="image/*" className="sr-only" aria-label="Upload a new room photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onNew(f); }} />
      </label>}
    </div>
    {uid && guestRooms.length > 0 && !attachDismissed() && <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <span className="flex-1">Keep {guestRooms.length === 1 ? "the room photo you added" : `the ${guestRooms.length} room photos you added`} before signing in?</span>
      <button type="button" disabled={saving} className="font-medium underline underline-offset-2" onClick={async () => { setSaving(true); await attachGuestRooms(); setSaving(false); }}>{saving ? "Saving…" : "Save to my account"}</button>
      <button type="button" className="text-muted-foreground" onClick={() => { dismissAttach(); force((n) => n + 1); }}>No thanks</button>
    </div>}
  </div>;
}

/** Account page: every saved room photo, bigger, with delete and a way back to trying wallpaper on it. */
export function AccountRooms() {
  const { rooms, guestRooms, ready } = useMyRooms();
  const thumbs = useRoomThumbs(rooms);
  const [saving, setSaving] = useState(false);
  if (!ready) return null;
  return <div className="space-y-4" data-testid="account-rooms">
    <div><h2 className="text-2xl">My rooms</h2><p className="mt-1 text-sm text-muted-foreground">Room photos you uploaded to try wallpaper on. They are saved here automatically, so they are ready every time you come back.</p></div>
    {guestRooms.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"><span className="flex-1">{guestRooms.length === 1 ? "1 photo" : `${guestRooms.length} photos`} on this device {guestRooms.length === 1 ? "isn't" : "aren't"} in your account yet.</span><button type="button" disabled={saving} className="font-medium underline underline-offset-2" onClick={async () => { setSaving(true); await attachGuestRooms(); setSaving(false); }}>{saving ? "Saving…" : "Save to my account"}</button></div>}
    {rooms.length === 0 ? <p className="text-sm text-muted-foreground">No room photos yet. <Link to="/browse" hash="try" className="text-primary underline">Upload one and try wallpaper on it</Link></p> :
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{rooms.map((r) => <figure key={r.id} className="group relative">
      <img src={thumbs.get(r.id)} alt={r.name} className="aspect-4/3 w-full rounded-md border border-border object-cover" />
      <figcaption className="mt-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate text-muted-foreground">{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{r.account ? "" : " · this device"}</span>
        <span className="flex shrink-0 gap-3"><Link to="/browse" hash="try" onClick={() => chooseRoom(r.id)} className="font-medium underline underline-offset-2">Try wallpaper</Link><button type="button" onClick={() => { if (confirm("Delete this room photo?")) deleteRoom(r.id); }} className="text-muted-foreground hover:text-destructive">Delete</button></span>
      </figcaption>
    </figure>)}</div>}
  </div>;
}

/** "Or pick a sample room": one small photo per room type (tap again for another version of that room); works exactly like an uploaded photo. */
export function SampleRoomsRow({ selected, onPick, label = "Or pick a sample room", className = "" }: { selected?: string | null; onPick?: (r: MyRoomPhoto) => void; label?: string; className?: string }) {
  const { current } = useMyRooms();
  const [busy, setBusy] = useState<string | null>(null);
  const sel = selected === undefined ? (isSampleId(current) ? current!.slice(7) : null) : selected;
  const selRoom = SAMPLE_ROOMS.find((r) => r.id === sel) ?? null;
  async function pick(id: string) {
    setBusy(id);
    try { const r = await chooseSample(id); if (r) onPick?.(r); } finally { setBusy(null); }
  }
  const [cat, setCat] = useState<string>(() => categoryOf(selRoom));
  useEffect(() => { if (selRoom) setCat(categoryOf(selRoom)); }, [selRoom?.id]);
  return <div className={`min-w-0 max-w-full space-y-1.5 ${className}`} data-testid="sample-rooms">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p className="text-xs text-muted-foreground">{label}</p><RoomCategoryTabs value={cat} onChange={setCat} /></div>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {SAMPLE_TYPES.filter((t) => categoryOf(t) === cat || usedCategories().length < 2).map((t) => {
        const vs = variantsOf(t.type); const on = selRoom?.type === t.type; const shown = on ? selRoom! : t;
        const n = on ? vs.findIndex((v) => v.id === shown.id) : 0;
        const next = vs[(n + 1) % vs.length];
        return <button key={t.type} type="button" onClick={() => pick(on && vs.length > 1 ? next.id : t.id)} disabled={!!busy} aria-pressed={on}
          aria-label={on && vs.length > 1 ? `Another ${t.name.toLowerCase()} (${n + 1} of ${vs.length})` : `Use the sample ${t.name.toLowerCase()}`}
          title={on && vs.length > 1 ? "Tap for another version of this room" : t.name} className="group w-[4.5rem] shrink-0 text-left disabled:cursor-wait">
          <span className={`relative block h-12 w-[4.5rem] overflow-hidden rounded-md border transition ${on ? "border-foreground ring-1 ring-foreground" : "border-border group-hover:border-foreground/40"} ${busy ? "animate-pulse" : ""}`}>
            <img src={shown.thumb} alt="" width={144} height={96} loading="lazy" className="h-full w-full object-cover" />
            {on && vs.length > 1 && <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[9px] leading-tight text-foreground">{n + 1}/{vs.length} ↻</span>}
          </span>
          <span className={`mt-1 block truncate text-[10.5px] leading-tight ${on ? "text-foreground" : "text-muted-foreground"}`}>{t.name}</span>
        </button>;
      })}
    </div>
  </div>;
}
