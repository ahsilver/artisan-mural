import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import before from "@/assets/showcase-before.jpg";
import afterAsset from "@/assets/showcase-after.webp.asset.json";
import { Button } from "@/components/ui/button";
import { BeforeAfter } from "@/components/before-after";
import { staticPic } from "@/lib/pics";
const W = [1080];

export function RoomShowcase() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Before you make it yours</p>
        <h2 className="mt-3 text-4xl sm:text-5xl">
          Your room.
          <br />
          Reimagined.
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Find the wallpaper that feels right at home. Preview your favorite design in your own room before you order.
        </p>
        <Button asChild className="mt-6 h-12 rounded-sm px-6">
          <Link to="/design/$slug/preview" params={{ slug: "long-mist" }} search={{ view: "room" }}>
            <Camera />
            See it in my room
          </Link>
        </Button>
      </div>
      <div className="relative min-w-0">
        <BeforeAfter
          before={staticPic(before, W)!.src}
          after={staticPic(afterAsset.url, W)!.src}
          beforeAlt="Living room with a plain wall"
          afterAlt="The same living room with Long Mist wallpaper"
          loading="lazy"
          className="aspect-[3/2] rounded-sm"
        />
        <span className="absolute bottom-4 left-4 rounded-sm bg-background/90 px-3 py-1.5 text-xs">Before</span>
        <span className="absolute bottom-4 right-4 rounded-sm bg-background/90 px-3 py-1.5 text-xs">After</span>
      </div>
    </section>
  );
}
