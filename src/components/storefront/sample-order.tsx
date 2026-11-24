import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSite } from "@/lib/site-settings";
import { useProMe, useProSettings } from "@/lib/pro";
import { money } from "@/lib/catalog";

/** "Order a sample" on the design page. The server sets the price (free for approved Pro members). */
export function SampleOrder({ design, title, finish, finishName, color, colorName }: { design: string; title: string; finish: string; finishName: string; color?: string | undefined; colorName?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState<any>(null);
  const { me } = useProMe(); const pro = useProSettings();
  const freePro = me?.status === "approved" && pro.freeSamples !== false;
  useEffect(() => { loadSite().then((s: any) => setPrice(Number(s?.shipping?.samplePrice ?? 5))).catch(() => setPrice(5)); supabase.auth.getSession().then(({ data }) => { if (data.session?.user?.email) setEmail(data.session.user.email); }); }, []);
  const label = freePro ? `Free with ${pro.name}` : price != null ? (price > 0 ? money(price) : "Free") : "";
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "");
    setBusy(true); setErr("");
    try {
      const { data } = await supabase.auth.getSession(); const t = data.session?.access_token;
      const r = await fetch("/backend/samples", { method: "POST", headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ design, finish, color, colorName, name: v("name"), email, phone: v("phone"), address: [v("address"), v("city"), v("postal"), v("country")].filter(Boolean).join(", ") }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Your sample could not be ordered.");
      setDone(j);
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  };
  return <div className="so">
    {!open ? <button type="button" className="so-open" onClick={() => setOpen(true)}>Order a sample of {finishName}{label && <span> · {label}</span>}</button>
      : done ? <div className="so-done" role="status"><b>Sample ordered · {done.order}</b><p>{done.free ? `Free with your ${pro.name} account. We'll email you when it ships.` : `${money(done.price)}. We'll email you a payment link, then it ships.`}</p></div>
      : <form className="so-form" onSubmit={submit}>
        <div className="so-h"><b>A sample of {title}</b><span>{finishName}{colorName ? ` · ${colorName}` : ""} · {label}</span><button type="button" className="so-x" aria-label="Close" onClick={() => setOpen(false)}>✕</button></div>
        <label className="rqf"><span>Name</span><input name="name" required maxLength={100} autoComplete="name" /></label>
        <label className="rqf"><span>Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="rqf"><span>Street address</span><input name="address" required maxLength={300} autoComplete="street-address" /></label>
        <div className="so-2"><label className="rqf"><span>City</span><input name="city" required maxLength={100} autoComplete="address-level2" /></label><label className="rqf"><span>ZIP / postal code</span><input name="postal" required maxLength={20} autoComplete="postal-code" /></label></div>
        <div className="so-2"><label className="rqf"><span>Country</span><input name="country" defaultValue="United States" maxLength={60} autoComplete="country-name" /></label><label className="rqf"><span>Phone (optional)</span><input name="phone" maxLength={40} autoComplete="tel" /></label></div>
        <button className="btn btn-wine" disabled={busy}>{busy ? "Ordering…" : freePro ? "Order my free sample" : `Order sample${price ? ` · ${money(price)}` : ""}`}</button>
        {!freePro && <small className="so-pro">Free for {pro.name} members.</small>}
        {err && <p className="rq-ok err" role="alert">{err}</p>}
      </form>}
  </div>;
}
