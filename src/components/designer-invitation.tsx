import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Palette } from "lucide-react";
import artwork from "@/assets/design-cranes.jpg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { COMMISSION_RATE, ROYALTY_TIERS, money } from "@/lib/catalog";

const dismissalKey = "artisan-designer-invitation-dismissed";
const quietPeriod = 7 * 24 * 60 * 60 * 1000;

export function DesignerInvitation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = Number(localStorage.getItem(dismissalKey));
      if (dismissed && Date.now() - dismissed < quietPeriod) return;
    } catch {
      // The invitation still works when browser storage is unavailable.
    }
    const timer = window.setTimeout(() => setOpen(true), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      try { localStorage.setItem(dismissalKey, String(Date.now())); } catch { /* Storage is optional. */ }
    }
  }

  return (
    <>
      <section aria-label="Designer invitation" className="border-b border-primary/30 bg-accent">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
          <p className="flex items-center gap-3 text-sm text-accent-foreground">
            <Palette className="size-5 shrink-0" />
            <span>Are you a designer? <strong className="font-semibold">Create for us. Get paid for your art.</strong></span>
          </p>
          <Button variant="ghost" className="h-10 shrink-0 text-accent-foreground" onClick={() => setOpen(true)}>
            Discover the opportunity <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-y-auto rounded-lg p-0">
          <div className="grid sm:grid-cols-[.38fr_.62fr]">
            <div className="relative h-32 overflow-hidden sm:h-auto">
              <img src={artwork} alt="Cranes and botanical wallpaper artwork" className="h-full w-full object-cover" />
              <div className="absolute bottom-4 left-4 bg-background/95 px-3 py-2 text-xs text-foreground">Art made for real walls.</div>
            </div>
            <div className="px-6 pb-6 pt-8 sm:p-9">
              <p className="text-xs font-medium uppercase text-clay">Join the Artisan Mural designers</p>
              <DialogTitle className="mt-3 font-display text-3xl font-medium leading-tight sm:text-4xl">Your art. Their walls.<br />Your earnings.</DialogTitle>
              <DialogDescription className="mt-4 leading-6">Turn your murals and repeating patterns into wallpaper. We handle printing and shipping; you earn when customers choose your design.</DialogDescription>
              <div className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4">
                <div><p className="font-display text-3xl">{money(ROYALTY_TIERS[0].rate)}–{money(ROYALTY_TIERS[2].rate)}</p><p className="mt-1 text-xs text-muted-foreground">per sq ft ordered</p></div>
                <div><p className="font-display text-3xl">{Math.round((1 - COMMISSION_RATE) * 100)}%</p><p className="mt-1 text-xs text-muted-foreground">of your custom design fee</p></div>
              </div>
              <Button asChild className="mt-6 h-12 w-full" onClick={() => changeOpen(false)}><Link to="/designers/how-it-works">See how it works <ArrowRight /></Link></Button>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button asChild variant="link" className="h-10 px-0" onClick={() => changeOpen(false)}><Link to="/become-designer">Ready? Apply as a designer</Link></Button>
                <Button variant="ghost" className="h-10 text-muted-foreground" onClick={() => changeOpen(false)}>Not now</Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Designers and designs need studio approval. Payouts are handled manually; automatic payments are not connected yet.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}