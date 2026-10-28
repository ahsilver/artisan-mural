import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { backend, useProMe, useProSettings } from "@/lib/pro";

export const Route = createFileRoute("/pro/apply")({
  head: () => ({ meta: [{ title: "Apply | Artisan Mural for professionals" }, { name: "description", content: "Apply for professional pricing, free samples and a dedicated specialist. About three minutes." }, { name: "robots", content: "noindex" }] }),
  component: Apply,
});

const ROLES = ["Interior designer", "Architect", "Contractor / installer", "Home stager", "Hospitality buyer", "Healthcare buyer", "Developer / property manager", "Other"];
const PROJECTS = ["Residential", "Commercial", "Hospitality", "Healthcare / senior living", "Retail", "Education"];
const YEARS = ["Less than 1 year", "1–3 years", "3–10 years", "10+ years"];
const VOLUME = ["Under 500 sq ft", "500–2,000 sq ft", "2,000–10,000 sq ft", "10,000+ sq ft", "Not sure yet"];
const HEARD = ["Search", "Instagram", "Pinterest", "A colleague", "A client", "Trade show / event", "Other"];
const STEPS = ["Your business", "Contact", "Your work", "Documents"];
const KEY = "am-pro-apply";

function Apply() {
  const pro = useProSettings();
  const { me } = useProMe();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<any>({ projects: [], country: "United States" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (v) { setA(v.a); setStep(v.step || 0); } } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ a, step })); } catch {} }, [a, step]);
  const set = (k: string, v: any) => { setErr(""); setA((x: any) => ({ ...x, [k]: v })); };
  const field = "mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-sm";
  const need = (): string => {
    if (step === 0) { if (!a.business?.trim()) return "Please add your business name."; if (!a.role) return "Please choose your role."; if (!(a.website || a.instagram || a.portfolio)?.trim?.()) return "Please add a website, Instagram or portfolio link."; }
    if (step === 1) { if (!a.address?.trim() || !a.city?.trim()) return "Please add your business address."; if (!a.phone?.trim()) return "Please add a phone number."; }
    if (step === 2) { if (!a.projects?.length) return "Please pick at least one project type."; if (!a.years) return "Please choose years in business."; }
    return "";
  };
  const next = () => { const e = need(); setErr(e); if (!e) { setStep(step + 1); window.scrollTo({ top: 0 }); } };
  async function submit() {
    setBusy(true); setErr("");
    try {
      let f: any = null;
      if (file) {
        if (file.size > 6 * 1024 * 1024) throw new Error("That file is too large (6 MB max).");
        const buf = new Uint8Array(await file.arrayBuffer()); let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
        f = { name: file.name, type: file.type, data: btoa(bin) };
      }
      await backend("pro/apply", { answers: a, file: f });
      sessionStorage.removeItem(KEY); setDone(true); window.scrollTo({ top: 0 });
    } catch (e: any) { setErr(e.message || "Could not send the application."); } finally { setBusy(false); }
  }
  const chip = (on: boolean) => "min-h-11 rounded-full border px-4 text-sm transition-colors " + (on ? "border-foreground bg-foreground text-background" : "border-input bg-background hover:border-foreground/50");

  const wrap = (children: any) => <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12"><Link to="/pro" className="text-xs text-muted-foreground hover:text-foreground">← {pro.name}</Link>{children}</div>;
  if (done || me?.status === "pending") return wrap(<div className="mt-8"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-border"><Check className="h-5 w-5" /></span><h1 className="mt-5 text-4xl">Application received.</h1><p className="mt-3 text-muted-foreground">Thank you. We review every application by hand, usually within {pro.approvalDays}, and we'll email you as soon as you're approved. Your status is also in your account.</p><div className="mt-6 flex gap-3"><Button asChild><a href="/browse">Browse designs</a></Button><Button asChild variant="outline"><a href="/account">Your account</a></Button></div></div>);
  if (me?.status === "approved") return wrap(<div className="mt-8"><h1 className="text-4xl">You're a member.</h1><p className="mt-3 text-muted-foreground">Your {me.discountPct}% {pro.name} price is applied automatically when you're signed in.</p><Button asChild className="mt-6"><a href="/browse">Shop now</a></Button></div>);

  return wrap(<>
    <h1 className="mt-5 text-4xl sm:text-5xl">Apply to {pro.name}</h1>
    <p className="mt-3 text-muted-foreground">About three minutes. Free, no minimum order.</p>
    {me && !me.signedIn ? <div className="soft-panel mt-8"><h2 className="text-xl">First, sign in or create an account</h2><p className="mt-1 text-sm text-muted-foreground">Your professional price is linked to this account.</p><AuthPanel /></div> : <>
    <div className="mt-8" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      <div className="flex gap-1.5">{STEPS.map((s, i) => <span key={s} className={"h-1 flex-1 rounded-full " + (i <= step ? "bg-foreground" : "bg-border")} />)}</div>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
    </div>
    <div className="mt-6 space-y-5" data-step={step}>
      {step === 0 && <>
        <label className="block text-sm">Business name<input className={field} value={a.business ?? ""} onChange={(e) => set("business", e.target.value)} autoComplete="organization" maxLength={160} /></label>
        <label className="block text-sm">Your name<input className={field} value={a.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" maxLength={120} /></label>
        <div className="text-sm">What do you do?<div className="mt-2 flex flex-wrap gap-2">{ROLES.map((r) => <button type="button" key={r} className={chip(a.role === r)} onClick={() => set("role", r)}>{r}</button>)}</div></div>
        {a.role === "Other" && <label className="block text-sm">Tell us your role<input className={field} value={a.roleOther ?? ""} onChange={(e) => set("roleOther", e.target.value)} maxLength={120} /></label>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Website<input className={field} value={a.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="studio.com" inputMode="url" /></label>
          <label className="block text-sm">Instagram<input className={field} value={a.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@studio" /></label>
        </div>
        <label className="block text-sm">Portfolio link <span className="text-muted-foreground">(optional)</span><input className={field} value={a.portfolio ?? ""} onChange={(e) => set("portfolio", e.target.value)} placeholder="Houzz, Behance, a PDF link…" inputMode="url" /></label>
      </>}
      {step === 1 && <>
        <label className="block text-sm">Business address<input className={field} value={a.address ?? ""} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">City<input className={field} value={a.city ?? ""} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /></label>
          <label className="block text-sm">State<input className={field} value={a.state ?? ""} onChange={(e) => set("state", e.target.value)} autoComplete="address-level1" /></label>
          <label className="block text-sm">Postal code<input className={field} value={a.postal ?? ""} onChange={(e) => set("postal", e.target.value)} autoComplete="postal-code" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Country<input className={field} value={a.country ?? ""} onChange={(e) => set("country", e.target.value)} autoComplete="country-name" /></label>
          <label className="block text-sm">Business phone<input className={field} value={a.phone ?? ""} onChange={(e) => set("phone", e.target.value)} type="tel" autoComplete="tel" /></label>
        </div>
      </>}
      {step === 2 && <>
        <div className="text-sm">Project types<span className="text-muted-foreground"> · pick all that apply</span><div className="mt-2 flex flex-wrap gap-2">{PROJECTS.map((r) => { const on = a.projects?.includes(r); return <button type="button" key={r} className={chip(on)} aria-pressed={on} onClick={() => set("projects", on ? a.projects.filter((x: string) => x !== r) : [...(a.projects ?? []), r])}>{r}</button>; })}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Years in business<select className={field} value={a.years ?? ""} onChange={(e) => set("years", e.target.value)}><option value="">Choose</option>{YEARS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="block text-sm">Wallcovering per year (estimate)<select className={field} value={a.volume ?? ""} onChange={(e) => set("volume", e.target.value)}><option value="">Choose</option>{VOLUME.map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
        <label className="block text-sm">How did you hear about us?<select className={field} value={a.heard ?? ""} onChange={(e) => set("heard", e.target.value)}><option value="">Choose</option>{HEARD.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="block text-sm">Anything else? <span className="text-muted-foreground">(optional)</span><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={a.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={1000} placeholder="A current project, a timeline, a question…" /></label>
      </>}
      {step === 3 && <>
        <p className="text-sm text-muted-foreground">Optional, but it helps us approve you faster.</p>
        <label className="block text-sm">Tax ID / resale number<input className={field} value={a.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} maxLength={60} /></label>
        <div className="text-sm">Resale certificate or business license
          {file ? <div className="mt-2 flex h-12 items-center justify-between rounded-md border border-input px-3"><span className="truncate">{file.name}</span><button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="p-2"><X className="h-4 w-4" /></button></div>
            : <label className="mt-2 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-muted-foreground hover:border-foreground/50"><Upload className="h-4 w-4" />Upload PDF or photo<input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}
          <p className="mt-1 text-xs text-muted-foreground">PDF, JPG or PNG, up to 6 MB. Only the studio sees it.</p></div>
        <div className="rounded-md border border-border p-4 text-sm"><p className="font-medium">{a.business}</p><p className="text-muted-foreground">{a.role === "Other" ? a.roleOther || "Other" : a.role} · {[a.city, a.state].filter(Boolean).join(", ")} · {(a.projects ?? []).join(", ")}</p></div>
      </>}
    </div>
    {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      {step > 0 ? <Button variant="ghost" onClick={() => { setErr(""); setStep(step - 1); }}><ArrowLeft />Back</Button> : <span />}
      {step < STEPS.length - 1 ? <Button className="h-12 min-w-36" onClick={next}>Continue<ArrowRight /></Button> : <Button className="h-12 min-w-36" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send application"}</Button>}
    </div></>}
  </>);
}
