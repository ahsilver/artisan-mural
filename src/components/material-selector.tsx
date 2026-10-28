import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { materials, finishPriceLabel, recommendedOf, type Design, type Material } from "@/lib/catalog";
import { measurementInches } from "@/lib/wall-selection";
import { cropArtwork, type WallSelection } from "@/lib/wall-selection";
import { textureTile } from "@/lib/texture-tile";

export function MaterialSelector({ material, options = materials, design, selection, onChange, closeUp = true }: { closeUp?: boolean; material: Material; options?: Material[] | undefined; design: Design; selection: WallSelection; onChange: (id: string) => void }) {
  const [view, setView] = useState<"printed" | "wall" | "unprinted">("printed");
  const wallIn = Math.max(1, measurementInches(selection.width, selection.unit));
  const sample = material.sampleIn && material.sampleIn > 0 ? material.sampleIn : 2;
  const PATCH = 12; // close-up shows 12 inches of wall
  const [crop, setCrop] = useState<{ source: string; url: string } | null>(null);
  const [tile, setTile] = useState<{ src: string; url: string; frac: number } | null>(null);
  useEffect(() => { let on = true; if (material.texture) textureTile(material.texture).then(t => { if (on) setTile({ src: material.texture!, ...t }); }).catch(() => {}); return () => { on = false; }; }, [material.texture]);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void cropArtwork(design.image, selection).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setCrop({ source: design.image, url });
    }).catch(() => { if (active) setCrop(null); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [design.image, selection.width, selection.height, selection.zoom, selection.x, selection.y, selection.artRatio]);
  const rec = recommendedOf(design, options ?? []);
  const note = design.finishNote?.trim();
  return <div className="space-y-3" data-testid="finish-picker">
    <p className="text-sm font-medium">Finish: <span className="font-normal text-muted-foreground">{material.name}</span></p>
    <div className="flex flex-wrap items-start gap-4" role="radiogroup" aria-label="Choose your finish">
      {options.map(m => <Button variant="ghost" key={m.id} type="button" role="radio" aria-checked={m.id === material.id} aria-label={rec.includes(m.id) ? `${m.name}, recommended by the designer` : m.name} title={m.name} onClick={() => onChange(m.id)} className="flex h-auto max-w-24 flex-col items-center justify-start gap-1.5 whitespace-normal p-0 text-center text-[11px] font-normal text-muted-foreground">
        <span className={`block h-11 w-11 overflow-hidden rounded-full border-2 transition ${m.id === material.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/40"}`}>{(m.ball ?? m.texture) ? <img src={m.ball ?? m.texture} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-muted" />}</span>
        <span className={m.id === material.id ? "text-foreground" : ""}>{m.name}</span>
        <span className="text-[10px] text-muted-foreground">{finishPriceLabel(m)}</span>
        {rec.includes(m.id) && <span data-testid="rec-badge" className="rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-semibold leading-tight text-primary-foreground">Recommended by the designer</span>}
      </Button>)}
    </div>
    {note && <p data-testid="finish-note" className="rounded-lg border-l-4 border-primary bg-primary/10 px-3 py-2 text-xs leading-relaxed text-foreground"><span className="font-semibold">From the designer:</span> {note}</p>}
    <p className="text-xs leading-relaxed text-muted-foreground">{material.blurb}</p>
    {closeUp && material.texture && <div>
      <div className="mb-3 flex border-b border-border" role="tablist" aria-label="Material photo">
        <Button type="button" role="tab" aria-selected={view === "printed"} variant="ghost" className={`rounded-none ${view === "printed" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setView("printed")}>Real size close-up</Button>
        <Button type="button" role="tab" aria-selected={view === "wall"} variant="ghost" className={`rounded-none ${view === "wall" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setView("wall")}>Whole wall</Button>
        <Button type="button" role="tab" aria-selected={view === "unprinted"} variant="ghost" className={`rounded-none ${view === "unprinted" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setView("unprinted")}>Unprinted</Button>
      </div>
      <div role="tabpanel" aria-label={`${material.name} ${view} close-up`} className="relative isolate aspect-[4/3] overflow-hidden rounded-md bg-muted">
        {view !== "unprinted" && (() => {
          const art = crop?.source === design.image ? crop.url : design.image;
          const zoom = view === "printed" ? wallIn / PATCH : 1; // how much bigger than the box the wall is
          const t = tile && tile.src === material.texture ? tile : null;
          const tileIn = sample * (t ? t.frac : 1); // inches of material one tile covers
          const tilePct = view === "printed" ? (tileIn / PATCH) * 100 : (tileIn / wallIn) * 100; // texture tile as % of box width
          return <>
            <div role="img" aria-label={`${design.title} on ${material.name}${view === "printed" ? ", 12 inches of wall at real size" : ", whole wall"}`} className="absolute inset-0" style={{ backgroundImage: `url("${art}")`, backgroundSize: view === "printed" ? `${zoom * 100}% auto` : "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
            <div aria-hidden className="pointer-events-none absolute inset-0" style={t ? { backgroundImage: `url("${t.url}")`, backgroundSize: `${tilePct}% auto`, backgroundRepeat: "repeat", mixBlendMode: "multiply", opacity: view === "printed" ? 0.95 : 0.8 } : {}} />
            {view === "printed" && <span className="absolute bottom-2 left-2 rounded bg-background/85 px-2 py-0.5 text-[10px]">12 in of wall · photo shows {sample} in of {material.name.toLowerCase()}</span>}
          </>;
        })()}
        {view === "unprinted" && <img src={material.texture} alt={`${material.name} — unprinted material`} className="h-full w-full object-cover" />}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{view !== "unprinted" ? "Texture shown at real size against your design. Order a sample to see the actual printed finish." : `${material.name} · Unprinted texture`}</p>
    </div>}
  </div>;
}