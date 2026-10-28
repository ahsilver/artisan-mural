import { useEffect, useState } from "react";
import { useProSettings } from "@/lib/pro";
import { Button } from "@/components/ui/button";
import { api } from "@/components/bo/common";
import { money } from "@/lib/catalog";

export function useAccountExtras() {
  const [d, setD] = useState<any>(null);
  const load = () => api("account/me").then(setD).catch(() => setD({ credit: 0, ledger: [], addresses: [] }));
  useEffect(() => { void load(); }, []);
  return { d, reload: load };
}

export function StoreCredit({ d }: { d: any }) {
  return <div><h2 className="text-2xl">Store credit</h2>
    <p className="mt-2 text-sm text-muted-foreground">Use it at checkout on any wallpaper.</p>
    <p className="mt-4 text-4xl font-semibold">{money(d?.credit ?? 0)}</p>
    {(d?.ledger ?? []).length > 0 && <div className="mt-5 divide-y divide-border border-y border-border text-sm">{d.ledger.map((x: any, i: number) => <div key={i} className="flex justify-between py-2"><span>{x.note ?? x.kind} <span className="text-xs text-muted-foreground">· {new Date(x.created_at).toLocaleDateString()}</span></span><span className={x.amount < 0 ? "text-muted-foreground" : "font-medium"}>{x.amount < 0 ? "−" : "+"}{money(Math.abs(x.amount))}</span></div>)}</div>}
  </div>;
}

const empty = { label: "Home", name: "", phone: "", address: "", city: "", state: "", postal: "", country: "United States" };
export function Addresses({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState<any>(null); const [err, setErr] = useState("");
  const field = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <div><div className="flex items-center justify-between"><h2 className="text-2xl">Saved addresses</h2>{!f && <Button variant="outline" onClick={() => setF({ ...empty })}>Add address</Button>}</div>
    {f && <form className="soft-panel mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); try { await api("account/addresses", { body: f }); setF(null); reload(); } catch (x: any) { setErr(x.message); } }}>
      {[["label", "Label (Home, Office…)"], ["name", "Full name"], ["phone", "Phone"], ["address", "Street address"], ["city", "City"], ["state", "State"], ["postal", "ZIP / postal code"], ["country", "Country"]].map(([k, l]) => <label key={k} className="text-sm">{l}<input className={field} value={f[k] ?? ""} required={k === "address"} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}
      {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button type="submit">Save address</Button><Button type="button" variant="ghost" onClick={() => setF(null)}>Cancel</Button></div>
    </form>}
    <div className="mt-4 space-y-3">{(d?.addresses ?? []).map((a: any) => <div key={a.id} className="soft-panel flex flex-wrap items-start justify-between gap-3 text-sm"><div><p className="font-medium">{a.label}</p><p className="text-muted-foreground">{[a.name, a.address, a.city, a.state, a.postal, a.country].filter(Boolean).join(", ")}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setF(a)}>Edit</Button><Button size="sm" variant="ghost" onClick={async () => { await api(`account/addresses/${a.id}`, { method: "DELETE" }); reload(); }}>Remove</Button></div></div>)}
      {!(d?.addresses ?? []).length && !f && <p className="text-sm text-muted-foreground">No saved addresses yet. They fill in checkout for you.</p>}</div>
  </div>;
}

export function TradeAccount({ d }: { d: any; reload?: () => void }) {
  const pro = useProSettings();
  const t = d?.trade;
  return <div><h2 className="text-2xl">{pro.name}</h2>
    <p className="mt-2 text-sm text-muted-foreground">For interior designers, architects, contractors, stagers and hospitality and healthcare buyers: professional pricing, free samples and a dedicated specialist.</p>
    {t?.status === "approved" ? <div className="soft-panel mt-4 text-sm"><p className="flex items-center gap-2 font-medium"><span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background" data-pro-badge>Pro</span>Member{t.company ? ` · ${t.company}` : ""}</p><p className="mt-2 text-muted-foreground">{t.discountPct ? `${t.discountPct}% off every order, applied automatically.` : "Professional pricing active."}{pro.freeSamples ? " Samples are free." : ""}{t.netTerms ? " You can pay by invoice (net terms)." : ""}</p></div>
      : t?.status === "pending" ? <div className="soft-panel mt-4 text-sm"><p className="font-medium">Application received</p><p className="mt-1 text-muted-foreground">We review every application by hand, usually within {pro.approvalDays}. We'll email you when you're approved.</p></div>
      : <div className="mt-4">{t?.status === "rejected" && <p className="mb-3 text-sm text-muted-foreground">Your last application wasn't approved. You're welcome to apply again with more details.</p>}<Button asChild><a href="/pro/apply">Apply to {pro.name}</a></Button> <Button asChild variant="ghost"><a href="/pro">Learn more</a></Button></div>}
  </div>;
}
