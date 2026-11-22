import { Lock, Ruler, Truck } from "lucide-react";

// Shared look for the customer cart + checkout (same tokens as the designer sign-up page: designer-auth-shell.tsx).
export const shopPage = "w-full overflow-x-clip bg-background";
export const shopCard = "rounded-xl border border-border bg-card";
export const shopInput = "mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/60 focus:ring-2 focus:ring-foreground/10";
export const shopLabel = "block text-sm font-medium text-foreground";
export const shopHint = "mt-1.5 block text-[13px] font-normal text-muted-foreground";
export const shopPrimary = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[12.5px] font-bold uppercase tracking-[.14em] text-primary-foreground transition hover:bg-foreground/85 active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 [&_svg]:size-4";
export const shopSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-foreground/70 bg-transparent px-4 text-[12px] font-bold uppercase tracking-[.12em] text-foreground transition hover:bg-secondary active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 [&_svg]:size-4";
export const shopQuiet = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5";
export const shopBar = "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-border max-lg:bg-card max-lg:px-4 max-lg:pt-3 max-lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))]";

/** True facts only: no card is taken at checkout (proof + payment link first), every wall is printed to its size,
 *  and the footer's own line "printed and shipped from our own press". */
export function ShopTrust({ className = "" }: { className?: string }) {
  const items: [typeof Lock, string][] = [[Lock, "No payment today. You pay after you approve your print proof."], [Ruler, "Made to order, printed to the exact size of your wall."], [Truck, "Printed and shipped from our own press."]];
  return <ul className={"space-y-2.5 text-[13px] leading-snug text-muted-foreground " + className} data-testid="shop-trust">
    {items.map(([I, t]) => <li key={t} className="flex gap-2.5"><span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-foreground"><I className="size-3" strokeWidth={2.4} /></span><span>{t}</span></li>)}
  </ul>;
}

export function SummaryRow({ label, value, muted, testid }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; testid?: string }) {
  return <div className="flex items-baseline justify-between gap-4" data-testid={testid}><span className={muted ? "text-muted-foreground" : "text-foreground/85"}>{label}</span><span className={"tabular-nums " + (muted ? "text-muted-foreground" : "font-medium text-foreground")}>{value}</span></div>;
}
