import { useState } from "react";
import { BadgeDollarSign, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Offer } from "@/lib/studio.functions";
import { plainError } from "@/lib/original-source";

const statusText = { sent: "Waiting for the customer", accepted: "Quote accepted", paid: "Paid", cancelled: "Cancelled" } as const;

/** Fiverr-style price offers inside a conversation. Payment opens once card payments are connected. */
export function OfferPanel({ offers, part, onCreate, onAccept, onCancel, onDeliver, onApproveProof }: {
  offers: Offer[];
  part: "customer" | "designer" | "studio";
  onCreate?: (amount: number, description: string, deliveryDays: number) => Promise<void>;
  onAccept?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onDeliver?: (id:string, file:File, note:string)=>Promise<void>;
  onApproveProof?: (id:string)=>Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [days,setDays]=useState("5");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key); setError("");
    try { await fn(); } catch (e) { setError(plainError(e, "Something went wrong.")); } finally { setBusy(""); }
  }
  if (!offers.length && part === "customer") return null;
  return <div className="my-4 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><BadgeDollarSign className="h-4 w-4 text-primary" />Price offers</h3>{part !== "customer" && onCreate && <Button size="sm" variant="outline" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Send a price offer"}</Button>}</div>
    {open && onCreate && <form className="mt-3 grid gap-3 sm:grid-cols-[120px_100px_1fr_auto]" onSubmit={e => { e.preventDefault(); void act("new", async () => { await onCreate(Number(amount), description, Number(days)); setAmount(""); setDescription(""); setOpen(false); }); }}>
      <label className="text-xs">Price (USD)<input required type="number" min="1" max="100000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
      <label className="text-xs">Delivery days<input required type="number" min="1" max="365" step="1" value={days} onChange={e=>setDays(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
      <label className="text-xs">What's included<input required minLength={3} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Adapt design to 18 × 9 ft wall, 2 revisions" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /></label>
      <Button type="submit" className="self-end" disabled={busy === "new"}>{busy === "new" && <Loader2 className="animate-spin" />}Send offer</Button>
    </form>}
    <div className="mt-3 space-y-2">{offers.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
      <div><p className="text-lg font-medium">${o.amount.toFixed(2)}</p><p className="text-sm">{o.description}</p><p className="text-xs text-muted-foreground">{o.deliveryDays ? `${o.deliveryDays} days from quote acceptance` : "Delivery time not specified"} · Design fee only</p>{o.proof && <a href={o.proof} target="_blank" rel="noreferrer"><img src={o.proof} alt="Delivered design proof" className="mt-3 max-h-48 max-w-full object-contain" /></a>}{o.proofNote && <p className="text-sm">{o.proofNote}</p>}<p className="mt-1 text-xs text-muted-foreground">{statusText[o.status]}{part !== "customer" && ` · Designer gets $${o.designerPayout.toFixed(2)} · Artisan Mural 10% $${o.commission.toFixed(2)}`}</p></div>
      <div className="flex gap-2">
        {o.status === "sent" && part === "customer" && onAccept && <Button size="sm" disabled={!!busy} onClick={() => void act(o.id, () => onAccept(o.id))}><Check />Accept offer</Button>}
        {o.status === "accepted" && part === "customer" && o.proofStatus === "delivered" && onApproveProof && <Button size="sm" disabled={!!busy} onClick={()=>void act(o.id,()=>onApproveProof(o.id))}><Check />Approve finished design</Button>}
        {o.status === "accepted" && o.proofStatus === "approved" && <p className="text-xs text-muted-foreground">Design approved · payment not connected</p>}
        {o.status === "accepted" && o.proofStatus === "awaiting" && part === "customer" && <p className="text-xs text-muted-foreground">Designer is preparing your proof</p>}
        {o.status === "accepted" && part !== "customer" && o.proofStatus !== "approved" && onDeliver && <label className="text-xs">Deliver proof<input aria-label="Deliver design proof" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} className="mt-1 block max-w-52" onChange={e=>{const file=e.target.files?.[0];if(file)void act(o.id,()=>onDeliver(o.id,file,o.description));}} /></label>}
        {o.status === "sent" && part !== "customer" && onCancel && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(o.id, () => onCancel(o.id))}>Cancel</Button>}
      </div>
    </div>)}</div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}
