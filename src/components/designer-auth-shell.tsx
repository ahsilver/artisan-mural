import { useEffect, useId, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Eye, EyeOff } from "lucide-react";
import { DEFAULT_TERMS, termsFrom, type DesignerTerms } from "@/lib/designer-faq";

// One of the shop's own catalog pictures (Cranes at Dusk), served by the site itself.
const PIC = "/backend/img/cranes-at-dusk/p1yzhhj68";
const PIC_SRCSET = `${PIC}-720 720w, ${PIC}-1080 1080w, ${PIC}-1400 1400w`;

function useDesignerTerms(): DesignerTerms {
  const [t, setT] = useState<DesignerTerms>(DEFAULT_TERMS);
  useEffect(() => {
    let live = true;
    fetch("/backend/public/settings").then((r) => (r.ok ? r.json() : null)).then((s) => { if (live && s?.designerTerms) setT(termsFrom(s.designerTerms)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return t;
}
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function Benefits({ tone }: { tone: "light" | "dark" }) {
  const t = useDesignerTerms();
  const items = [
    ["You choose the designs", "Upload your patterns and murals, up to 6 colors each."],
    ["We print and ship", "Artisan Mural prints and ships every order to the customer."],
    ["You earn on every sale", `${usd(t.royaltyStarter)} per sq ft ordered, rising to ${usd(t.royaltyAtelier)} as your designs sell.`],
  ];
  const dark = tone === "dark";
  return <ul className="space-y-4">
    {items.map(([h, p]) => <li key={h} className="flex gap-3">
      <span className={"mt-0.5 grid size-6 shrink-0 place-items-center rounded-full " + (dark ? "bg-white/20 text-white ring-1 ring-white/40" : "bg-accent text-accent-foreground")}><Check className="size-3.5" strokeWidth={2.5} /></span>
      <span><span className={"block text-[15px] font-semibold " + (dark ? "text-white" : "text-foreground")}>{h}</span><span className={"block text-sm leading-relaxed " + (dark ? "text-white/85" : "text-muted-foreground")}>{p}</span></span>
    </li>)}
  </ul>;
}

/** Split page used by the designer sign-up, sign-in and password pages. */
export function DesignerAuthShell({ children, title = "Sell your designs on Artisan Mural", eyebrow = "For designers", benefits = true }: { children: ReactNode; title?: string; eyebrow?: string; benefits?: boolean }) {
  return <section className="grid w-full overflow-x-hidden bg-background lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.08fr_1fr]">
    <aside className="relative h-[250px] overflow-hidden sm:h-[320px] lg:h-auto lg:min-h-[680px]">
      <img src={`${PIC}-1080`} srcSet={PIC_SRCSET} sizes="(min-width: 1024px) 52vw, 100vw" alt="Cranes at Dusk wallpaper from the Artisan Mural collection" className="absolute inset-0 size-full origin-bottom scale-[1.07] object-cover" fetchPriority="high" />
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.18_0.03_235/0.88)] via-[oklch(0.18_0.03_235/0.35)] to-[oklch(0.18_0.03_235/0.05)]" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-14">
        <p className="text-eyebrow text-white/80">{eyebrow}</p>
        <h2 className="mt-2 max-w-[15ch] font-display text-[30px] leading-[1.05] text-white sm:text-4xl lg:text-[54px]">{title}</h2>
        {benefits && <div className="mt-8 hidden max-w-md lg:block"><Benefits tone="dark" /></div>}
        <Link to="/design/$slug" params={{ slug: "cranes-at-dusk" }} className="mt-4 inline-block text-xs text-white/75 underline-offset-4 hover:text-white hover:underline lg:mt-10">Pictured: Cranes at Dusk</Link>
      </div>
    </aside>
    <div className="flex items-start justify-center bg-[radial-gradient(120%_80%_at_100%_0%,var(--accent),transparent_60%),linear-gradient(180deg,var(--background),var(--secondary))] px-4 py-8 sm:px-8 sm:py-12 lg:items-center lg:px-16">
      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-12px_rgb(20_40_70/0.18)] sm:p-8">{children}</div>
        {benefits && <div className="mt-8 px-1 lg:hidden"><Benefits tone="light" /></div>}
      </div>
    </div>
  </section>;
}

export function AuthHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return <div className="mb-6">
    {eyebrow && <p className="text-eyebrow text-clay">{eyebrow}</p>}
    <h1 className="mt-1.5 font-display text-[34px] leading-tight text-foreground">{title}</h1>
    {sub && <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
  </div>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; invalidText?: string };
/** Labelled input with soft border, brand focus ring, inline error and (for passwords) a show/hide eye. */
export function AuthInput({ label, hint, invalidText, type = "text", className, onInvalid, onChange, ...rest }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const isPw = type === "password";
  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
    <div className="relative">
      <input id={id} type={isPw && show ? "text" : type} aria-invalid={err ? true : undefined} aria-describedby={err ? id + "-err" : hint ? id + "-hint" : undefined}
        className={"h-12 w-full rounded-xl border bg-background px-4 text-base text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.03)] outline-none transition placeholder:text-muted-foreground/70 hover:border-[oklch(0.7_0.02_220)] focus:border-ring focus:ring-4 focus:ring-ring/15 " + (err ? "border-destructive focus:border-destructive focus:ring-destructive/15 " : "border-input ") + (isPw ? "pr-12 " : "") + (className ?? "")}
        onInvalid={(e) => { e.preventDefault(); const v = e.currentTarget.validity; setErr(invalidText && !v.valueMissing ? invalidText : v.valueMissing ? `Please enter your ${label.toLowerCase().replace(/^your /, "")}.` : v.typeMismatch ? "Please enter a valid email address." : v.tooShort ? `Use at least ${e.currentTarget.minLength} characters.` : e.currentTarget.validationMessage); onInvalid?.(e); }}
        onChange={(e) => { if (err && e.currentTarget.validity.valid) setErr(""); onChange?.(e); }}
        {...rest} />
      {isPw && <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>}
    </div>
    {err ? <p id={id + "-err"} role="alert" className="text-[13px] text-destructive">{err}</p> : hint ? <p id={id + "-hint"} className="text-[13px] text-muted-foreground">{hint}</p> : null}
  </div>;
}

export function AuthButton({ children, busy, ...rest }: { children: ReactNode; busy?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} disabled={busy || rest.disabled} className={"inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-clay px-5 text-[15px] font-semibold text-clay-foreground shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_6px_16px_-6px_oklch(0.44_0.07_235/0.6)] transition hover:brightness-110 active:translate-y-px active:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 " + (rest.className ?? "")}>{busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}{children}</button>;
}

export function AuthNotice({ text, tone = "info" }: { text: string; tone?: "info" | "error" | "ok" }) {
  if (!text) return null;
  const cls = tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : tone === "ok" ? "border-emerald-600/25 bg-emerald-50 text-emerald-800" : "border-ring/25 bg-accent text-accent-foreground";
  return <p role={tone === "error" ? "alert" : "status"} className={"rounded-xl border px-4 py-3 text-sm leading-relaxed " + cls}>{text}</p>;
}

export function AuthDivider() { return <div className="my-5 h-px bg-border" />; }
