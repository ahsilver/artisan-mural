import { orderSqft, repeatStyle, sizeIssue } from "@/lib/wall-selection";
import { ArrowRight, Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { OversizePopup, useOversizePrompt } from "@/components/oversize";
import { WallMeasurements } from "@/components/wall-measurements";
import { SizeNotice, muralMaxLabel } from "@/components/size-notice";
import { SampleRequest } from "@/components/sample-request";
import { MaterialSelector } from "@/components/material-selector";
import { unitPrice, designRate, money, type Design, type Designer, type Material } from "@/lib/catalog";
import type { WallSelection } from "@/lib/wall-selection";

export function WallCalculator({ design, color, designer, selection, onSelectionChange, material, materialOptions, onMaterialChange, onContact }: { design: Design; color?: string | undefined; designer: Designer; selection: WallSelection; onSelectionChange: (s: WallSelection) => void; material: Material; materialOptions?: Material[]; onMaterialChange: (id: string) => void; onContact: (fit?: boolean) => void }) {
  const sqft = orderSqft(selection);
  const link = { to: "/design/$slug/preview" as const, params: { slug: design.slug }, search: { ...selection, color, finish: material.id } };
  const tooBig = repeatStyle(design) === "none" && !!sizeIssue(design, selection);
  const [popup, setPopup] = useOversizePrompt(tooBig, `${selection.width}x${selection.height}${selection.unit}`);
  return <div className="space-y-4">
    <div className="soft-panel space-y-5">
      <div>
        <p className="text-eyebrow text-muted-foreground">Made to your measurements</p>
        <h3 className="mt-2 text-2xl leading-snug">Let's get the fit right.</h3>
      </div>
      <WallMeasurements selection={selection} onChange={onSelectionChange} />
      <SizeNotice design={design} designer={designer} selection={selection} onContact={() => onContact(true)} />
      <div className="flex items-center justify-between border-t border-border pt-4"><div><p className="text-sm">Print estimate</p><p className="mt-1 text-xs text-muted-foreground">{sqft.toFixed(1)} sq ft · {(sqft / 10.7639).toFixed(2)} m²</p></div><p className="text-2xl font-semibold">{money(sqft * unitPrice(design, material))}</p></div>
      {tooBig ? <Button className="h-12 w-full" data-testid="fit-cta" onClick={() => onContact(true)}><Pencil />Ask the designer to make it fit</Button> : <Button asChild className="h-12 w-full"><Link {...link}>Continue with this design<ArrowRight /></Link></Button>}
    </div>
    <div className="soft-panel"><MaterialSelector material={material} options={materialOptions} design={design} selection={selection} onChange={onMaterialChange} closeUp={true} /></div>
    <div className="soft-panel flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium">Order a sample</p><p className="mt-1 text-xs text-muted-foreground">Feel the finish before you order.</p></div><div className="shrink-0"><SampleRequest design={design} selection={selection} /></div></div>
    <OversizePopup open={popup} onOpenChange={setPopup} max={muralMaxLabel(design, selection)} title={design.title} designer={designer.name} onAsk={() => onContact(true)} />
  </div>;
}
