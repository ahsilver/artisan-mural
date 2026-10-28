import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoRooms } from "@/lib/demo-rooms";
import type { SavedRoomPhoto } from "@/lib/room-photos";

function SavedPhoto({ photo, disabled, onChoose, onRemove }: { photo: SavedRoomPhoto; disabled: boolean; onChoose: () => void; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const src = URL.createObjectURL(photo.blob); setUrl(src);
    return () => URL.revokeObjectURL(src);
  }, [photo.blob]);
  return <div className="relative min-w-0">
    <Button variant="ghost" aria-label={photo.name} disabled={disabled || !url} onClick={onChoose} className="block h-auto w-full overflow-hidden rounded-lg p-0 text-left">
      {url && <img src={url} alt={photo.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
      <span className="block truncate px-3 py-2.5 text-sm">{photo.name}</span>
    </Button>
    <Button variant="secondary" size="icon" disabled={disabled} onClick={onRemove} aria-label={`Remove ${photo.name}`} title="Remove saved photo" className="absolute right-2 top-2 h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
  </div>;
}

export function RoomPhotoGallery({ photos, disabled, onChooseSaved, onRemove, onChooseDemo }: {
  photos: SavedRoomPhoto[]; disabled: boolean; onChooseSaved: (photo: SavedRoomPhoto) => void;
  onRemove: (id: string) => void; onChooseDemo: (src: string) => void;
}) {
  return <div className="mt-8 space-y-8">
    {photos.length > 0 && <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-display text-2xl">Your saved rooms</h4><p className="text-xs text-muted-foreground">Saved on this browser only</p></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{photos.map(photo => <SavedPhoto key={photo.id} photo={photo} disabled={disabled} onChoose={() => onChooseSaved(photo)} onRemove={() => onRemove(photo.id)} />)}</div>
    </div>}
    <div>
      <h4 className="mb-4 font-display text-2xl">Or try a beautiful demo room</h4>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">{demoRooms.map(room => <Button key={room.name} aria-label={room.name} variant="ghost" disabled={disabled} onClick={() => onChooseDemo(room.image)} className="group block h-auto w-full overflow-hidden rounded-lg p-0 text-left">
        <img src={room.image} alt={room.name} loading="lazy" width={1280} height={960} className="aspect-[4/3] w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
        <span className="block px-3 py-2.5 text-sm">{room.name}</span>
      </Button>)}</div>
    </div>
  </div>;
}