import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/auth-panel";
import { backend, useProMe, useProSettings } from "@/lib/pro";

export const Route = createFileRoute("/pro/apply")({
  head: () => ({ meta: [{ title: "Apply | Artisan Murals for professionals" }, { name: "description", content: "Apply for professional pricing, free samples and a dedicated specialist. About three minutes." }, { name: "robots", content: "noindex" }] }),
  component: Apply,
});

/** The approved preview's Pro application ("apply-form"): one short form, plus an optional part that helps approve faster. */
const ROLES = ["Interior designer", "Architect", "Decorator / stager", "Hospitality / commercial", "Contractor / installer", "Other"];
const PROJECTS = ["Residential", "Commercial", "Hospitality", "Healthcare / senior living", "Retail", "Education"];
const KEY = "am-pro-apply";

function Apply() {
  const pro = useProSettings();
  const { me } = useProMe();
  const [a, setA] = useState<any>({ role: ROLES[0], projects: [], country: "United States" });
  const [more, setMore] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (v?.a) setA(v.a); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ a })); } catch {} }, [a]);
  const set = (k: string, v: any) => { setErr(""); setA((x: any) => ({ ...x, [k]: v })); };
  const inp = (k: string, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => <label className={"rqf" + (wide ? " af-wide" : "")}><span>{label}</span><input value={a[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...extra} /></label>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!a.contactName?.trim()) return setErr("Please add your name.");
    if (!a.business?.trim()) return setErr("Please add your business name.");
    if (!a.phone?.trim()) return setErr("Please add a phone number.");
    if (!(a.website || a.instagram)?.trim?.()) return setErr("Please add your website, portfolio or Instagram.");
    setBusy(true);
    try {
      let f: any = null;
      if (file) {
        if (file.size > 6 * 1024 * 1024) throw new Error("That file is too large (6 MB max).");
        const buf = new Uint8Array(await file.arrayBuffer()); let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
        f = { name: file.name, type: file.type, data: btoa(bin) };
      }
      await backend("pro/apply", { answers: a, file: f });
      sessionStorage.removeItem(KEY); setDone(true); window.scrollTo({ top: 0 });
    } catch (x: any) { setErr(x.message || "Could not send the application."); } finally { setBusy(false); }
  }
  const page = (children: React.ReactNode) => <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/pro">{pro.name}</a><span>/</span><b>Apply</b></nav></div><section className="pg sec pro-apply-pg">{children}</section></div>;

  if (done || me?.status === "pending") return page(<div className="apply-form sa-done"><span className="pill wait">Pending review</span><b>Thank you. Your application is in.</b><p>We review every application by hand, usually within {pro.approvalDays}. You'll get an email and a notification in your account as soon as you're approved.</p><div className="up-row"><a className="btn btn-wine btn-sm" href="/browse">Browse designs</a><a className="btn optline btn-sm" href="/account">My account</a></div></div>);
  if (me?.status === "approved") return page(<div className="apply-form sa-done"><span className="pill ok">Member</span><b>You're an {pro.name} member.</b><p>Your {me.discountPct}% price is applied automatically when you're signed in.</p><div className="up-row"><a className="btn btn-wine btn-sm" href="/browse">Shop now</a></div></div>);
  if (me && !me.signedIn) return page(<div className="apply-form"><div className="pro-fh"><span className="k">Free to join</span><h2>Apply to {pro.name}</h2><p>First, sign in or create your account. Your professional price is linked to it.</p></div><AuthPanel kicker="" title="" sub="" cta="Continue" /></div>);

  return page(
    <form className="apply-form" id="proForm" noValidate onSubmit={submit}>
      <div className="pro-fh"><span className="k">Free to join</span><h2>Apply to {pro.name}</h2><p>About three minutes. We confirm by email, usually within {pro.approvalDays}.</p></div>
      <div className="af-grid">
        {inp("contactName", "Your name", { autoComplete: "name", maxLength: 120 })}
        {inp("business", "Business name", { autoComplete: "organization", maxLength: 160 })}
        {inp("phone", "Phone", { type: "tel", autoComplete: "tel", maxLength: 40 })}
        {inp("instagram", "Instagram (optional)", { placeholder: "@studio", maxLength: 120 })}
        <div className="rqf af-wide"><span>You are</span><div className="seg-chips" role="radiogroup">{ROLES.map((r) => <button key={r} type="button" role="radio" aria-checked={a.role === r} onClick={() => set("role", r)}>{r}</button>)}</div></div>
        {a.role === "Other" && inp("roleOther", "Tell us your role", { maxLength: 120 }, true)}
        {inp("website", "Website or portfolio", { type: "url", inputMode: "url", placeholder: "https://", maxLength: 300 }, true)}
      </div>
      <button type="button" className="af-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "− " : "+ "}Optional: details that help us approve you faster</button>
      {more && <div className="af-grid">
        <div className="rqf af-wide"><span>Project types</span><div className="seg-chips multi">{PROJECTS.map((r) => { const on = a.projects?.includes(r); return <button type="button" key={r} aria-pressed={on} onClick={() => set("projects", on ? a.projects.filter((x: string) => x !== r) : [...(a.projects ?? []), r])}>{r}</button>; })}</div></div>
        {inp("address", "Business address", { autoComplete: "street-address" }, true)}
        {inp("city", "City", { autoComplete: "address-level2" })}
        {inp("state", "State", { autoComplete: "address-level1" })}
        {inp("taxId", "Tax ID / resale number", { maxLength: 60 })}
        <label className="rqf"><span>Resale certificate or license</span><span className="af-file">{file ? <>{file.name}<button type="button" aria-label="Remove file" onClick={() => setFile(null)}>✕</button></> : <>Upload PDF or photo<input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></>}</span></label>
        <label className="rqf af-wide"><span>Anything else?</span><textarea rows={3} maxLength={1000} value={a.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="A current project, a timeline, a question…" /></label>
      </div>}
      <button className="btn btn-wine big" type="submit" disabled={busy}>{busy ? "Sending…" : "Send application"}</button>
      {err && <p className="rq-ok err" role="alert">{err}</p>}
    </form>,
  );
}
