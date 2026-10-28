import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { loadSite } from "@/lib/site-settings";
import { backend } from "@/lib/pro";

const HIDE = "am-popup-hide-until", DONE = "am-welcome-code";
const SKIP = /^\/(checkout|admin|admin-classic|dashboard|pro\/apply|reset-password|designer-login|designer-upload|studio-demo)/;

/** "10% off your first order" — small slide-in, one-time code per email. Owner settings: Settings → First-order popup. */
export function FirstOrderPopup() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [cfg, setCfg] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const shown = useRef(false);
  const blocked = SKIP.test(path);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (localStorage.getItem(DONE) || Number(localStorage.getItem(HIDE) || 0) > Date.now()) return;
        const s: any = await loadSite(); const p = s?.popup;
        if (!p?.enabled || dead) return;
        const me = await backend("pro/me").catch(() => null);
        if (me?.signedIn && (me.orders > 0 || me.status === "approved")) return;
        if (!dead) setCfg(p);
      } catch {}
    })();
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (!cfg || blocked || shown.current) return;
    let t = 0, waited = false;
    // never on top of another window (e.g. the designer invitation): wait until it's closed, then a few seconds more
    const show = () => {
      if (shown.current || SKIP.test(window.location.pathname)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) { waited = true; t = window.setTimeout(show, 1500); return; }
      if (waited) { waited = false; t = window.setTimeout(show, 6000); return; }
      shown.current = true; setOpen(true);
    };
    t = window.setTimeout(show, Math.max(2, Number(cfg.delaySec) || 8) * 1000);
    const exit = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0) show(); };
    if (cfg.exitIntent && window.matchMedia("(pointer: fine)").matches) document.addEventListener("mouseout", exit);
    return () => { window.clearTimeout(t); document.removeEventListener("mouseout", exit); };
  }, [cfg, blocked]);
  if (!cfg || !open || blocked) return null;
  const close = () => { setOpen(false); if (!code) try { localStorage.setItem(HIDE, String(Date.now() + (Number(cfg.hideDays) || 14) * 864e5)); } catch {} };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await backend("pro/first-order", { email, page: path, source: "popup" }); setCode(r.code); localStorage.setItem(DONE, r.code); }
    catch (x: any) { setErr(x.message || "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  return <div role="dialog" aria-modal="false" aria-labelledby="fo-title" data-first-order-popup className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[360px]">
    <div className="relative rounded-lg border border-border bg-background p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,.25)]">
      <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      {code ? <>
        <p className="text-xs font-medium uppercase text-clay">Welcome</p>
        <h2 id="fo-title" className="mt-2 pr-8 text-2xl leading-tight">Here's your code.</h2>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {}); }} className="mt-4 flex h-12 w-full items-center justify-between rounded-md border border-dashed border-foreground/40 px-4 font-mono text-base tracking-wider" aria-label="Copy code"><span>{code}</span><span className="font-sans text-xs text-muted-foreground">{copied ? "Copied" : "Copy"}</span></button>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{cfg.pct}% off your first order. It's applied at checkout when you sign in with {email}. We also emailed it to you.</p>
      </> : <>
        <p className="text-xs font-medium uppercase text-clay">New here?</p>
        <h2 id="fo-title" className="mt-2 pr-8 text-2xl leading-tight">{cfg.headline || `${cfg.pct}% off your first order`}</h2>
        {cfg.text && <p className="mt-2 text-sm leading-6 text-muted-foreground">{cfg.text}</p>}
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Your email" autoComplete="email" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
          <button type="submit" disabled={busy} className="h-11 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60">{busy ? "…" : "Get code"}</button>
        </form>
        {err && <p role="alert" className="mt-2 text-xs text-destructive">{err}</p>}
        <button type="button" onClick={close} className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline">No thanks</button>
      </>}
    </div>
  </div>;
}
