import { useEffect, useRef, useState } from "react";
import { Pencil, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { WallSelection } from "@/lib/wall-selection";

/** Wall size written the way the customer typed it: 12 ft 6 in x 9 ft, 150 x 100 in, 400 x 300 cm. */
export function wallLabel(s: Pick<WallSelection, "width" | "height" | "unit">) {
  if (s.unit !== "ft") return `${Math.round(s.width * 10) / 10} x ${Math.round(s.height * 10) / 10} ${s.unit}`;
  const ft = (v: number) => { let f = Math.floor(v), i = Math.round((v - f) * 12); if (i === 12) { f += 1; i = 0; } return i ? `${f} ft ${i} in` : `${f} ft`; };
  return `${ft(s.width)} x ${ft(s.height)}`;
}

/** What the request form starts with when the customer asks the designer for a change. */
export type RequestPrefill = { brief?: string; wallSize?: string };
export function oversizePrefill(title: string, s: WallSelection, max: string | null): RequestPrefill {
  return { wallSize: wallLabel(s), brief: `My wall is ${wallLabel(s)}${max ? `, bigger than the ${max} this design was made for` : ""}. Can you make ${title} fit my wall?` };
}

/**
 * Opens the "too big" popup once when the wall goes above the design's size.
 * It waits until the customer stops typing (so "6" -> "60" does not flash it), and it does not come back
 * while the wall stays too big; it can come back after the wall fits again and then grows too big again.
 */
export function useOversizePrompt(tooBig: boolean, sizeKey: string) {
  const [open, setOpen] = useState(false);
  const shownFor = useRef<boolean>(tooBig); // a page that opens already too big shows the note, not the popup
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      if (!tooBig) { shownFor.current = false; return; }
      if (!shownFor.current) { shownFor.current = true; setOpen(true); }
    }, 700);
    return () => clearTimeout(t);
  }, [tooBig, sizeKey]);
  return [open, setOpen] as const;
}

const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] px-3 text-[13.5px] font-medium transition-colors";

/** Small modal on a computer, bottom sheet on a phone. */
export function OversizePopup({ open, onOpenChange, max, title, designer, onAsk }: { open: boolean; onOpenChange: (o: boolean) => void; max: string | null; title: string; designer: string; onAsk: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid="oversize-popup" onOpenAutoFocus={(e) => e.preventDefault()} className="gap-0 border-[#E5E7EB] p-5 shadow-none sm:max-w-[400px] sm:rounded-[6px] max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-[10px] max-sm:pb-[max(20px,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100">
      <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#E5E7EB] sm:hidden" aria-hidden />
      <DialogTitle className="pr-6 text-[16px] font-semibold leading-snug tracking-normal">This mural is made for walls up to {max ?? "its original size"}</DialogTitle>
      <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Your wall is bigger than the size {title} was created for. Don't worry, we can fix it: {designer} can make it fit your wall for a fee.
      </DialogDescription>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" data-testid="oversize-ask" className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90 w-full`} onClick={() => { onOpenChange(false); onAsk(); }}><Pencil className="size-3.5" />Ask the designer to make it fit</button>
        <button type="button" data-testid="oversize-change" className={`${btn} border border-[#E5E7EB] bg-background hover:bg-muted/60`} onClick={() => onOpenChange(false)}>Change my measurements</button>
      </div>
    </DialogContent>
  </Dialog>;
}

/** The slim note under the size boxes while the wall is too big. */
export function OversizeNote({ max, designer, onAsk }: { max: string | null; designer: string; onAsk: () => void }) {
  return <div role="status" data-testid="oversize-note" className="flex gap-2 rounded-[6px] border border-[#E5E7EB] bg-accent/40 px-3 py-2.5 text-[13.5px] leading-snug">
    <Info className="mt-[3px] size-3.5 shrink-0 text-primary" />
    <p><b className="font-medium">This mural is made for walls up to <span suppressHydrationWarning>{max ?? "its original size"}</span>.</b> <span className="text-muted-foreground">Don't worry, {designer} can make it fit your wall for a fee.</span> <button type="button" onClick={onAsk} className="font-medium text-primary underline underline-offset-2">Ask the designer to make it fit</button></p>
  </div>;
}

/** The always-there way to ask for changes: slim outlined button, pencil icon. */
export function AskDesignerButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
    <button type="button" data-testid="ask-designer" onClick={onClick} className={`${btn} border border-[#E5E7EB] bg-background hover:bg-muted/60`}><Pencil className="size-3.5" />Customize this design</button>
    <span className="text-xs text-muted-foreground">Private chat with the designer · free to ask</span>
  </div>;
}
