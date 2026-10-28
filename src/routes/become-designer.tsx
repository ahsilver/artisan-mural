import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { applyAsDesigner, getMyDesignerProfile, type DesignerProfile } from "@/lib/designer-profile.functions";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/become-designer")({
  head: () => ({ meta: [{ title: "Become an Artisan Mural designer" }, { name: "description", content: "Apply to sell your wallpaper and mural designs worldwide. Tell us about your work — payment details come later, once a design is approved." }, { property: "og:title", content: "Become an Artisan Mural designer" }, { property: "og:description", content: "Apply to sell your wallpaper designs worldwide and get paid on every order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: BecomeDesigner,
});

const styleOptions = ["Botanical", "Abstract", "Geometric", "Kids", "Landscape", "Art deco", "Minimal", "Vintage", "Japanese", "Watercolor"];
const steps = ["About you", "Your work", "Review"];
const input = "mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm";

function BecomeDesigner() {
  const { session, loading } = useSession();
  const getProfile = useServerFn(getMyDesignerProfile);
  const apply = useServerFn(applyAsDesigner);
  const [profile, setProfile] = useState<DesignerProfile | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ fullName: "", studioName: "", country: "", bio: "", styles: [] as string[], portfolio: ["", "", ""], agree: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!session) return; void getProfile().then(r => setProfile(r.profile)).catch(() => setProfile(null)); }, [session?.user.id]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));
  const valid = [f.fullName.trim().length >= 2 && f.country.trim().length >= 2, f.bio.trim().length >= 20, f.agree];
  async function submit() {
    setBusy(true); setError("");
    try { await apply({ data: { fullName: f.fullName, studioName: f.studioName, country: f.country, bio: f.bio, styles: f.styles, portfolio: f.portfolio.map(p => p.trim()).filter(Boolean) } }); setProfile((await getProfile()).profile); }
    catch (e) { setError(plainError(e, "Could not send your application.")); } finally { setBusy(false); }
  }
  const shell = (children: React.ReactNode) => <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12"><p className="text-eyebrow text-clay">For designers</p><h1 className="mt-2 text-3xl sm:text-5xl">Sell your designs on every wall.</h1><p className="mt-3 text-sm"><Link to="/designers/how-it-works" className="underline underline-offset-4">How it works for designers, with all questions and answers</Link></p>{children}</div>;
  if (loading) return shell(<Loader2 className="mt-8 animate-spin" />);
  if (!session) return shell(<><p className="mt-3 text-sm text-muted-foreground">First create your account. Then we'll ask a few questions about you and your work.</p><div className="mt-8"><AuthPanel /></div></>);
  if (profile === undefined) return shell(<Loader2 className="mt-8 animate-spin" />);
  if (profile) return shell(<div className="soft-panel mt-8">
    {profile.status === "approved" ? <><p className="flex items-center gap-2 text-lg font-medium"><Check className="h-5 w-5 text-primary" />You're approved, {profile.full_name.split(" ")[0]}!</p><p className="mt-2 text-sm text-muted-foreground">Your designs, collections and customer projects are in your studio.</p><Button asChild className="mt-5 h-12"><Link to="/studio">See all your designs & projects<ArrowRight /></Link></Button></>
      : profile.status === "rejected" ? <><p className="text-lg font-medium">Your application wasn't approved this time</p>{profile.review_note && <p className="mt-2 text-sm">“{profile.review_note}”</p>}<p className="mt-2 text-sm text-muted-foreground">You can message the Artisan Mural studio with any questions.</p></>
      : <><p className="flex items-center gap-2 text-lg font-medium"><Clock className="h-5 w-5 text-primary" />Thanks — your application is being reviewed</p><p className="mt-2 text-sm text-muted-foreground">Artisan Mural approves every designer personally. Once you're approved you can upload designs from your studio.</p><Button asChild variant="outline" className="mt-5"><Link to="/studio">Go to your studio</Link></Button></>}
  </div>);
  return shell(<>
    <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Application steps">{steps.map((s, i) => <li key={s}><span className={`block h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} /><span className={`mt-2 block text-[11px] sm:text-xs ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span></li>)}</ol>
    <div className="soft-panel mt-6 space-y-5">
      {step === 0 && <>
        <h2 className="text-2xl">Tell us about you</h2>
        <label className="block text-sm">Full name<input className={input} autoComplete="name" maxLength={100} value={f.fullName} onChange={e => set("fullName", e.target.value)} /></label>
        <label className="block text-sm">Studio or brand name <span className="text-muted-foreground">(optional)</span><input className={input} maxLength={100} value={f.studioName} onChange={e => set("studioName", e.target.value)} /></label>
        <label className="block text-sm">Country you live in<input className={input} autoComplete="country-name" maxLength={60} value={f.country} onChange={e => set("country", e.target.value)} /></label>
      </>}
      {step === 1 && <>
        <h2 className="text-2xl">Your work</h2>
        <label className="block text-sm">Short bio<textarea maxLength={1500} value={f.bio} onChange={e => set("bio", e.target.value)} placeholder="Who you are, how you work, what inspires you (at least 20 characters)." className="mt-2 min-h-32 w-full rounded-md border border-input bg-background p-3 text-base sm:text-sm" /></label>
        <fieldset><legend className="text-sm">Your design styles</legend><div className="mt-2 flex flex-wrap gap-2">{styleOptions.map(s => { const on = f.styles.includes(s); return <Button key={s} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("styles", on ? f.styles.filter(x => x !== s) : [...f.styles, s])}>{s}</Button>; })}</div></fieldset>
        <fieldset><legend className="text-sm">Portfolio links <span className="text-muted-foreground">(only the studio sees these)</span></legend>{f.portfolio.map((p, i) => <input key={i} type="url" placeholder="https://" className={input} value={p} onChange={e => set("portfolio", f.portfolio.map((x, j) => j === i ? e.target.value : x))} />)}</fieldset>
      </>}
      {step === 2 && <>
        <h2 className="text-2xl">Check and send</h2>
        <dl className="space-y-2 text-sm">{[["Name", f.fullName], ["Studio", f.studioName || "—"], ["Country", f.country], ["Styles", f.styles.join(", ") || "—"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">You earn per square foot on every order of your designs, plus 90% of every custom design job. We'll ask how you'd like to be paid (PayPal, Wise or bank transfer) once your first design is approved — never before.</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.agree} onChange={e => set("agree", e.target.checked)} />I own the rights to the designs I upload, and I'll keep all customer chats and payments on Artisan Mural.</label>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3 pt-2">
        {step > 0 && <Button variant="outline" className="h-12" onClick={() => setStep(step - 1)}><ArrowLeft />Back</Button>}
        {step < 2 ? <Button className="h-12 flex-1" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Next<ArrowRight /></Button> : <Button className="h-12 flex-1" disabled={!valid[2] || busy} onClick={() => void submit()}>{busy && <Loader2 className="animate-spin" />}Send application</Button>}
      </div>
    </div>
  </>);
}
