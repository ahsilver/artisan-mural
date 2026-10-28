import { Lock, Ruler, Truck } from "lucide-react";

// Shared look for the customer cart + checkout (same tokens as the designer sign-up page: designer-auth-shell.tsx).
export const shopPage = "w-full overflow-x-clip bg-[radial-gradient(120%_60%_at_100%_0%,var(--accent),transparent_60%),linear-gradient(180deg,var(--background),var(--secondary))]";
export const shopCard = "rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-12px_rgb(20_40_70/0.18)]";
export const shopInput = "mt-1.5 h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.03)] outline-none transition placeholder:text-muted-foreground/70 hover:border-[oklch(0.7_0.02_220)] focus:border-ring focus:ring-4 focus:ring-ring/15 sm:text-[15px]";
export const shopLabel = "block text-sm font-medium text-foreground";
export const shopHint = "mt-1.5 block text-[13px] font-normal text-muted-foreground";
export const shopPrimary = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_6px_16px_-6px_oklch(0.6_0.09_235/0.55)] transition hover:bg-[oklch(0.75_0.08_235)] active:translate-y-px active:bg-[oklch(0.71_0.085_235)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[oklch(0.44_0.07_235/0.35)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:active:translate-y-0 [&_svg]:size-4";
export const shopSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:border-[oklch(0.7_0.02_220)] hover:bg-secondary/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 [&_svg]:size-4";
export const shopQuiet = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5";
export const shopBar = "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-border/80 max-lg:bg-card/95 max-lg:px-4 max-lg:pt-3 max-lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-lg:shadow-[0_-8px_24px_-12px_rgb(20_40_70/0.25)] max-lg:backdrop-blur";

/** True facts only: no card is taken at checkout (proof + payment link first), every wall is printed to its size,
 *  and the footer's own line "printed and shipped from our own press". */
export function ShopTrust({ className = "" }: { className?: string }) {
  const items: [typeof Lock, string][] = [[Lock, "No payment today. You pay after you approve your print proof."], [Ruler, "Made to order, printed to the exact size of your wall."], [Truck, "Printed and shipped from our own press."]];
  return <ul className={"space-y-2.5 text-[13px] leading-snug text-muted-foreground " + className} data-testid="shop-trust">
    {items.map(([I, t]) => <li key={t} className="flex gap-2.5"><span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-accent text-clay"><I className="size-3" strokeWidth={2.4} /></span><span>{t}</span></li>)}
  </ul>;
}

export function SummaryRow({ label, value, muted, testid }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; testid?: string }) {
  return <div className="flex items-baseline justify-between gap-4" data-testid={testid}><span className={muted ? "text-muted-foreground" : "text-foreground/85"}>{label}</span><span className={"tabular-nums " + (muted ? "text-muted-foreground" : "font-medium text-foreground")}>{value}</span></div>;
}
