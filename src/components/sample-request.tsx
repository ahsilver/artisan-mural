import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Package, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { materials, type Design } from "@/lib/catalog";
import type { WallSelection } from "@/lib/wall-selection";
import { sendGuestDesignerRequest } from "@/lib/designer-messages.functions";
import { useProMe, useProSettings } from "@/lib/pro";
import { plainError } from "@/lib/original-source";

export function SampleRequest({ design, selection }: { design: Design; selection: WallSelection }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = useServerFn(sendGuestDesignerRequest);
  const { me } = useProMe(); const pro = useProSettings();
  const freePro = me?.status === "approved" && pro.freeSamples;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      await send({ data: { designer: design.designer, design: design.slug, name: String(form.get("name")), email: String(form.get("email")), body: freePro ? `SAMPLE REQUEST (${pro.name} member, free sample, $0) — ${design.title}\nFinish: ${form.get("finish")}\nDelivery address: ${form.get("address")}` : `SAMPLE REQUEST — ${design.title}\nFinish: ${form.get("finish")}\nDelivery address: ${form.get("address")}\nPlease confirm sample price and shipping before payment.`, selection } });
      setSent(true);
    } catch (err) { setError(plainError(err, "Your sample request could not be saved.")); }
    finally { setBusy(false); }
  }
  const field = "mt-2 w-full rounded-sm border border-input bg-background px-3 py-3 text-sm";
  return <>
    <Button variant="outline" onClick={() => { setSent(false); setError(""); setOpen(true); }}><Package />Order sample</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{sent ? "Sample request saved" : `A sample of ${design.title}`}</DialogTitle><DialogDescription>{sent ? (freePro ? `Your free ${pro.name} sample is on the list. Nothing to pay.` : "Your request is saved with your contact details. No payment has been taken.") : (freePro ? `Free for ${pro.name} members. We ship it to the address below at no cost.` : "Request a printed sample. Price and delivery will need confirmation before you pay.")}</DialogDescription></DialogHeader>
      {sent ? <Button onClick={() => setOpen(false)}>Done</Button> : <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Your name<input name="name" required maxLength={100} autoComplete="name" className={field} /></label><label className="text-sm">Email<input name="email" type="email" required maxLength={255} autoComplete="email" className={field} /></label></div><label className="block text-sm">Finish<select name="finish" className={field}>{materials.map(m => <option key={m.id}>{m.name}</option>)}</select></label><label className="block text-sm">Delivery address<textarea name="address" required maxLength={1000} autoComplete="street-address" className={`${field} min-h-24`} /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="h-12 w-full" disabled={busy}><Send />{busy ? "Saving…" : "Request sample"}</Button></form>}
    </DialogContent></Dialog>
  </>;
}