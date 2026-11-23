import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { attachFile, type Att } from "@/components/projects";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { applyAsDesigner, getMyDesignerProfile, type DesignerProfile } from "@/lib/designer-profile.functions";
import { defaultStyles } from "@/lib/design-taxonomy";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/become-designer")({
  head: () => ({ meta: [{ title: "Apply to sell on Artisan Murals" }, { name: "description", content: "Apply to sell your wallpaper and mural designs. About 6 minutes; your answers are saved as you go." }, { property: "og:title", content: "Apply to sell on Artisan Murals" }, { property: "og:description", content: "Sell your wallpaper designs and get paid on every order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: BecomeDesigner,
});

/** The approved preview's designer application: account first, then About you · Your work · Custom work · Getting paid · Review. */
const STEPS = ["Account", "About you", "Your work", "Custom work", "Getting paid", "Review"];
const TOOLS = ["Procreate", "Photoshop", "Illustrator", "Affinity", "Hand-painted, scanned", "AI-assisted (declared)"];
const FILES = ["TIFF", "PSD", "PNG", "PDF / vector", "AI / EPS"];
const YEARS: [string, string][] = [["<2", "Under 2 years"], ["2-5", "2–5 years"], ["5-10", "5–10 years"], ["10+", "10+ years"]];
const KEY = "am_designer_app";
type F = { name: string; studio: string; country: string; city: string; site: string; insta: string; bio: string; years: string; styles: string[]; tools: string[]; files: string[]; links: string[]; samples: Att[]; custom: string; turnaround: string; newFrom: string; adaptFrom: string; exclusive: string; method: string; often: string; payEmail: string; bank: string; currency: string; taxCountry: string; taxForm: boolean; rights: boolean; terms: boolean };
const EMPTY: F = { name: "", studio: "", country: "", city: "", site: "", insta: "", bio: "", years: "", styles: [], tools: [], files: [], links: ["", "", ""], samples: [], custom: "yes", turnaround: "1 week", newFrom: "", adaptFrom: "", exclusive: "no", method: "paypal", often: "monthly", payEmail: "", bank: "", currency: "USD", taxCountry: "", taxForm: false, rights: false, terms: false };
const isUrl = (s: string) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };

function Radios({ value, list, onPick }: { value: string; list: [string, string, string?][]; onPick: (v: string) => void }) {
  return <div className="sa-radios" role="radiogroup">{list.map(([v, n, h]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onPick(v)}><b>{n}</b>{h && <small>{h}</small>}</button>)}</div>;
}
function Chips({ list, on, toggle }: { list: string[]; on: string[]; toggle: (v: string) => void }) {
  return <div className="up-chips">{list.map((v) => <button key={v} type="button" className="up-chip" aria-pressed={on.includes(v)} onClick={() => toggle(v)}>{v}</button>)}</div>;
}

function BecomeDesigner() {
  const { session, loading } = useSession();
  const getProfile = useServerFn(getMyDesignerProfile);
  const apply = useServerFn(applyAsDesigner);
  const [profile, setProfile] = useState<DesignerProfile | null | undefined>(undefined);
  const [step, setStep] = useState(1);
  const [f, setF] = useState<F>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (v?.f) { setF({ ...EMPTY, ...v.f }); setStep(Math.max(1, v.step || 1)); } } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ f, step })); } catch {} }, [f, step]);
  useEffect(() => { if (!session) return; void getProfile().then((r) => setProfile(r.profile)).catch(() => setProfile(null)); }, [session?.user.id]);
  const set = <K extends keyof F>(k: K, v: F[K]) => { setErr(""); setF((p) => ({ ...p, [k]: v })); };
  const tog = (k: "styles" | "tools" | "files", v: string) => setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : k === "styles" && p.styles.length >= 10 ? p.styles : [...p[k], v] }));
  const inp = (k: keyof F, label: React.ReactNode, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="rqf"><span>{label}</span><input value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as any)} {...extra} /></label>;

  const check = (): string => {
    if (step === 1) { if (f.name.trim().length < 2) return "Add your full name."; if (f.country.trim().length < 2) return "Add your country."; if (f.site && !isUrl(f.site)) return "The website should start with https://"; }
    if (step === 2) { if (f.bio.trim().length < 20) return "Write a short bio (at least 20 characters)."; if (!f.years) return "How long have you been designing?"; if (f.links.some((l) => l && !isUrl(l))) return "Portfolio links should start with https://"; if (!f.links.some(Boolean) && !f.samples.length) return "Add a portfolio link or a few sample images."; }
    if (step === 4) { if ((f.method === "paypal" || f.method === "wise") && !/^\S+@\S+\.\S+$/.test(f.payEmail)) return "Add the email for payouts."; if (f.method === "bank" && f.bank.trim().length < 8) return "Add your bank details."; }
    if (step === 5) { if (!f.rights || !f.terms) return "Please tick both boxes to send."; }
    return "";
  };
  const next = () => { const e = check(); if (e) { setErr(e); return; } if (step < 5) { setStep(step + 1); setErr(""); document.getElementById("saBox")?.scrollIntoView({ block: "start", behavior: "smooth" }); } else void submit(); };
  async function submit() {
    setBusy(true); setErr("");
    try {
      const application: Record<string, string | boolean | string[]> = {
        city: f.city, website: f.site, instagram: f.insta, years: f.years, tools: f.tools, files: f.files, samples: f.samples.map((s) => s.key),
        custom: f.custom, turnaround: f.turnaround, newFrom: f.newFrom, adaptFrom: f.adaptFrom, exclusive: f.exclusive,
        payMethod: f.method, payOften: f.often, payEmail: f.payEmail, payBank: f.bank, currency: f.currency, taxCountry: f.taxCountry || f.country, taxForm: f.taxForm,
      };
      await apply({ data: { fullName: f.name.trim(), studioName: f.studio.trim(), country: f.country.trim(), bio: f.bio.trim(), styles: f.styles, portfolio: [f.site, ...f.links].map((p) => p.trim()).filter(isUrl).slice(0, 5), application } });
      try { sessionStorage.removeItem(KEY); } catch {}
      try { const { data: ss } = await supabase.auth.getSession(); await fetch("/backend/designer/applied", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ss.session?.access_token ?? ""}` }, body: "{}" }); } catch {}
      setProfile((await getProfile()).profile);
    } catch (e) { setErr(plainError(e, "Could not send your application.")); } finally { setBusy(false); }
  }

  const shell = (children: React.ReactNode, steps = true) => (
    <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/sell">Sell your art</a><span>/</span><b>Apply</b></nav></div>
      <section className="pg sec sl-apply-wrap sa-page"><div className="sl-apply">
        <div className="sl-apply-head"><span className="k">Designer application</span><h2 className="sl-h">Apply to sell on Artisan Murals</h2><p>About 6 minutes. Your answers are saved as you go.</p></div>
        {steps && <nav className="up-steps" aria-label="Application steps">{STEPS.map((n, i) => { const cur = session ? step : 0; return <button key={n} type="button" className={i === cur ? "on" : i < cur ? "done" : ""} disabled={i > cur || i === 0} onClick={() => { setErr(""); setStep(i); }}>{i < cur ? "✓" : i + 1}<span>{n}</span></button>; })}</nav>}
        <div id="saBox">{children}</div>
      </div></section></div>
  );
  if (loading || (session && profile === undefined)) return shell(<p className="hint">Loading…</p>, false);
  if (!session) return shell(<div className="sa-acc"><div><b>First, your account</b><p>Your application, uploads, sales and payouts all live in one account. Use it to sign in to your designer studio once you're approved.</p></div><AuthPanel designer kicker="" title="" sub="" cta="Continue" /></div>);
  if (profile) {
    const first = profile.full_name.split(" ")[0];
    if (profile.status === "approved") return shell(<div className="sa-done"><span className="pill ok">Approved</span><b>You're approved, {first}.</b><p>Your designer studio is open. Upload designs, answer requests and see your sales.</p><div className="up-row"><a className="btn btn-wine btn-sm" href="/studio">Open my studio</a></div></div>, false);
    if (profile.status === "rejected") return shell(<div className="sa-done"><span className="pill">Not approved</span><b>Your application wasn't approved this time.</b>{profile.review_note && <p>“{profile.review_note}”</p>}<p>You can write to the Artisan Murals studio with any questions.</p><div className="up-row"><a className="btn optline btn-sm" href="/messages">Messages</a></div></div>, false);
    return shell(<div className="sa-done"><span className="pill wait">Pending review</span><b>Thank you, {first}. Your application is in.</b><p>Sent {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. The studio approves every designer personally, usually within 2 business days. You'll get an email and a notification in your account.</p>
      <ol className="sa-next"><li className="done">Account created</li><li className="done">Application sent</li><li className="now">Studio review</li><li>Approved: your designer studio opens and you can upload</li></ol>
      <div className="up-row"><a className="btn btn-wine btn-sm" href="/account">Go to my account</a><a className="btn optline btn-sm" href="/designers">Meet our designers</a></div></div>, false);
  }
  const row = (k: string, v: React.ReactNode) => (v ? <div className="up-sum-r"><span>{k}</span><b>{v}</b></div> : null);
  const nav = (label: string) => <div className="up-nav">{step > 1 ? <button type="button" className="btn optline btn-sm" onClick={() => { setErr(""); setStep(step - 1); }}>Back</button> : <span />}<p className="up-err" aria-live="polite">{err}</p><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={next}>{busy ? "Sending…" : label}</button></div>;
  return shell(<>
    {step === 1 && <><div className="sa-grid">{inp("name", "Full name", { autoComplete: "name", maxLength: 100 })}{inp("studio", <>Studio or brand name <small>(optional)</small></>, { maxLength: 100 })}{inp("country", "Country", { autoComplete: "country-name", maxLength: 60 })}{inp("city", "City", { autoComplete: "address-level2", maxLength: 80 })}{inp("site", <>Website <small>(optional)</small></>, { type: "url", placeholder: "https://", maxLength: 300 })}{inp("insta", <>Instagram or Behance <small>(optional)</small></>, { placeholder: "@yourstudio", maxLength: 120 })}</div>{nav("Next: your work")}</>}
    {step === 2 && <><div className="sa-col">
      <label className="rqf"><span>Short bio <small>· shown on your public designer page</small></span><textarea rows={3} maxLength={1500} placeholder="Who you are, how you work, what inspires you." value={f.bio} onChange={(e) => set("bio", e.target.value)} /></label>
      <div className="rqf"><span>How long have you been designing?</span><Radios value={f.years} list={YEARS} onPick={(v) => set("years", v)} /></div>
      <div className="rqf"><span>Your styles <small>· up to 10</small></span><Chips list={defaultStyles} on={f.styles} toggle={(v) => tog("styles", v)} /></div>
      <div className="rqf"><span>How you make your work</span><Chips list={TOOLS} on={f.tools} toggle={(v) => tog("tools", v)} /></div>
      <div className="rqf"><span>Print files you can supply <small>· we print at 250 DPI at full size</small></span><Chips list={FILES} on={f.files} toggle={(v) => tog("files", v)} /></div>
      <div className="rqf"><span>Portfolio links <small>· only the studio sees these</small></span><div className="sa-links">{f.links.map((l, i) => <input key={i} type="url" placeholder="https://" value={l} onChange={(e) => set("links", f.links.map((x, j) => (j === i ? e.target.value : x)))} />)}</div></div>
      <div className="rqf"><span>Or add a few sample images <small>(up to 6)</small></span><label className="up-local sa-up"><input type="file" multiple accept="image/*" onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 6 - f.samples.length); e.target.value = ""; setBusy(true); try { const out: Att[] = []; for (const x of fs) out.push(await attachFile(x)); setF((p) => ({ ...p, samples: [...p.samples, ...out] })); } catch (x: any) { setErr(x.message || "Upload failed"); } setBusy(false); }} /><b>{busy ? "Uploading…" : "+ Add images"}</b><small>{f.samples.length ? `${f.samples.length} added` : "JPG or PNG, any size"}</small></label><div className="sa-thumbs">{f.samples.map((s) => <img key={s.key} src={s.url} alt={s.name} />)}</div></div>
    </div>{nav("Next: custom work")}</>}
    {step === 3 && <><div className="sa-col">
      <div className="rqf"><span>Would you like custom requests from customers?</span><Radios value={f.custom} onPick={(v) => set("custom", v)} list={[["yes", "Yes, send me requests", "New murals, color changes, bigger walls"], ["changes", "Only small changes", "Colors and resizing of my own designs"], ["no", "Not for now", "You can change this any time"]]} /></div>
      {f.custom !== "no" && <><div className="sa-grid">{inp("newFrom", "A new design usually starts from ($)", { type: "number", min: 0, step: 10, placeholder: "e.g. 450" })}{inp("adaptFrom", "Adapting one of your designs ($)", { type: "number", min: 0, step: 5, placeholder: "e.g. 60" })}</div>
        <div className="rqf"><span>Typical turnaround</span><Radios value={f.turnaround} onPick={(v) => set("turnaround", v)} list={[["2-3 days", "2–3 days"], ["1 week", "About a week"], ["2 weeks", "2 weeks"], ["3+ weeks", "3+ weeks"]]} /></div></>}
      <div className="rqf"><span>Can your designs also be sold elsewhere?</span><Radios value={f.exclusive} onPick={(v) => set("exclusive", v)} list={[["no", "Non-exclusive", "You keep selling them anywhere"], ["yes", "Exclusive to Artisan Murals", "Higher placement in the shop"]]} /></div>
    </div>{nav("Next: getting paid")}</>}
    {step === 4 && <><div className="sa-col">
      <div className="rqf"><span>How would you like to be paid?</span><Radios value={f.method} onPick={(v) => set("method", v)} list={[["paypal", "PayPal"], ["wise", "Wise"], ["bank", "Bank transfer"], ["credit", "Store credit", "Buy wallpaper on the site"]]} /></div>
      {f.method === "bank" ? <label className="rqf"><span>Bank name, account holder, IBAN or account number, SWIFT/BIC</span><textarea rows={3} maxLength={800} value={f.bank} onChange={(e) => set("bank", e.target.value)} /></label> : f.method === "credit" ? null : inp("payEmail", `${f.method === "paypal" ? "PayPal" : "Wise"} email for payouts`, { type: "email", autoComplete: "email" })}
      <div className="rqf"><span>How often?</span><Radios value={f.often} onPick={(v) => set("often", v)} list={[["monthly", "Monthly", "On the 5th, for the month before"], ["50", "When I reach $50"], ["request", "Only when I ask", "Cash out from your Earnings page"]]} /></div>
      <div className="sa-grid"><label className="rqf"><span>Currency</span><select value={f.currency} onChange={(e) => set("currency", e.target.value)}>{["USD", "EUR", "GBP", "CAD", "AUD", "ILS"].map((c) => <option key={c}>{c}</option>)}</select></label>{inp("taxCountry", "Country for tax", { autoComplete: "country-name", placeholder: f.country })}</div>
      <label className="sa-check"><input type="checkbox" checked={f.taxForm} onChange={(e) => set("taxForm", e.target.checked)} /><span>I'll provide a tax form (W-9 if I'm in the US, W-8BEN otherwise) before my first payout.</span></label>
      <p className="hint">Only the Artisan Murals owner can see your payout details. Nothing is paid until your first design is approved and sells.</p>
    </div>{nav("Next: review")}</>}
    {step === 5 && <><div className="sa-col"><div>
      {row("Account", session.user.email)}{row("Name", f.name + (f.studio ? ` · ${f.studio}` : ""))}{row("From", [f.city, f.country].filter(Boolean).join(", "))}{row("Experience", YEARS.find((y) => y[0] === f.years)?.[1])}
      {row("Styles", f.styles.join(", "))}{row("Files", f.files.join(", "))}{row("Portfolio", f.links.filter(Boolean).join(", ") || (f.samples.length ? `${f.samples.length} sample images` : ""))}
      {row("Custom work", ({ yes: "Yes", changes: "Small changes only", no: "Not for now" } as Record<string, string>)[f.custom] + (f.custom !== "no" && f.newFrom ? ` · new from $${f.newFrom}` : "") + (f.custom !== "no" ? ` · ${f.turnaround}` : ""))}{row("Exclusive", f.exclusive === "yes" ? "Yes" : "No")}
      {row("Paid by", `${({ paypal: "PayPal", wise: "Wise", bank: "Bank transfer", credit: "Store credit" } as Record<string, string>)[f.method]} · ${({ monthly: "monthly", "50": "at $50", request: "on request" } as Record<string, string>)[f.often]} · ${f.currency}`)}
    </div>
      <label className="sa-check"><input type="checkbox" checked={f.rights} onChange={(e) => set("rights", e.target.checked)} /><span>I own the rights to every design I upload, or have permission to sell it.</span></label>
      <label className="sa-check"><input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} /><span>I agree to the designer terms and will keep all customer chats and payments on Artisan Murals.</span></label>
    </div>{nav("Send application")}</>}
  </>);
}
