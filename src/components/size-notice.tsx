import { TriangleAlert } from "lucide-react";
import { OversizeNote } from "@/components/oversize";
import type { Design, Designer } from "@/lib/catalog";
import { repeatStyle, repeatWords, sizeIssue, sizeLimits, type WallSelection } from "@/lib/wall-selection";

/** The largest wall a mural prints at, written in the customer's unit. */
export function muralMaxLabel(design: Design, selection: WallSelection) {
  const lim = sizeLimits(design, selection.artRatio);
  if (!lim.maxWidthCm || !lim.maxHeightCm) return null;
  const f = (cm: number) => selection.unit === "cm" ? `${Math.floor(cm)}` : selection.unit === "in" ? `${Math.floor(cm / 2.54)}` : `${Math.floor(cm / 30.48 * 10) / 10}`;
  return `${f(lim.maxWidthCm)} × ${f(lim.maxHeightCm)} ${selection.unit}`;
}

export function SizeNotice({ design, designer, selection, onContact }: { design: Design; designer: Designer; selection: WallSelection; onContact?: (() => void) | undefined }) {
  const issue = sizeIssue(design, selection);
  const style = repeatStyle(design);
  const first = designer.name.split(" ")[0];
  if (!issue) return <p className="text-xs text-muted-foreground">{style === "both" ? `Repeats in every direction${(design as any).match === "halfdrop" ? " (half-drop match)" : ""} — any wall size, zoom as you like.` : style === "horizontal" ? `Repeats sideways — ${repeatWords(design, selection.unit).detail.replace(/^Any width/, "any width")}` : `One scene — made for walls up to ${muralMaxLabel(design, selection) ?? "its original size"}. Smaller walls choose the part they love.`}</p>;
  if (style === "none") return <OversizeNote max={muralMaxLabel(design, selection)} designer={designer.name} onAsk={() => onContact?.()} />;
  return <div role="alert" className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p>{style === "horizontal" ? <>Your wall is {issue}. This design repeats only sideways, so it can't continue upward. Lower the height, or ask {designer.name} for a taller version.</> : <>Your wall is {issue}, the most this design can print without losing quality. Lower the height, or ask {designer.name} to adapt it for your wall.</>}{onContact && <> <button type="button" onClick={onContact} className="font-medium text-primary underline">Contact {first}</button></>}</p></div>;
}
