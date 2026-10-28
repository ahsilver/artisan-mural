import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MuralFramer } from "@/components/mural-framer";
import { useSession } from "@/hooks/use-session";
import { startDesignerConversation, startGuestConversation } from "@/lib/designer-messages.functions";
import { CONTACT_BLOCKED_MESSAGE, containsContactDetails } from "@/lib/contact-guard";
import { newGuestToken, saveGuestChat } from "@/lib/guest-chats";
import { money, type Design, type Designer } from "@/lib/catalog";
import type { WallSelection } from "@/lib/wall-selection";
import { plainError } from "@/lib/original-source";

export function DesignerContact({ design, designer, selection, onSelectionChange, open: openProp, onOpenChange, compact }: { design: Design; designer: Designer; selection: WallSelection; onSelectionChange: (s: WallSelection) => void; open?: boolean; onOpenChange?: (o: boolean) => void; compact?: boolean }) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp ?? openLocal;
  const setOpen = (o: boolean) => { setOpenLocal(o); onOpenChange?.(o); };
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const { session } = useSession();
  const start = useServerFn(startDesignerConversation);
  const startGuest = useServerFn(startGuestConversation);
  const navigate = useNavigate();
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (containsContactDetails(body)) { setError(CONTACT_BLOCKED_MESSAGE); return; }
    setBusy(true); setError("");
    try {
      if (!session) {
        const token = newGuestToken();
        const result = await startGuest({ data: { token, designer: designer.slug, design: design.slug, name, body, selection } });
        saveGuestChat({ id: result.id, token, title: result.title, designer: result.designer });
        setOpen(false); await navigate({ to: "/messages", search: { conversation: result.id } });
      }
      else { const result = await start({ data: { designer: designer.slug, design: design.slug, body, selection } }); setOpen(false); await navigate({ to: "/messages", search: { conversation: result.id } }); }
    }
    catch (err) { setError(plainError(err, "Your message could not be sent.")); }
    finally { setBusy(false); }
  }
  const first = designer.name.split(" ")[0];
  const card = compact ? <section className="soft-panel flex flex-wrap items-center gap-3 sm:flex-nowrap">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-primary">{designer.initials}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Want changes? Chat with {first}</p><p className="mt-0.5 text-xs text-muted-foreground">Move things, change colours, fit any wall · from {money(designer.adaptFee)}</p></div>
      <Button className="h-11 w-full sm:w-auto" onClick={() => { setError(""); setOpen(true); }}><MessageCircle />Chat with the designer</Button>
    </section> : null;
  return <>
    {card ?? <section className="soft-panel">
      <p className="text-eyebrow text-primary">Made for your wall, with the artist</p>
      <div className="mt-4 flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-primary">{designer.initials}</span><div><Link to="/designers/$slug" params={{ slug: designer.slug }} className="text-sm font-semibold">{designer.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">The artist behind {design.title}</p></div></div>
      <h3 className="mt-4 text-xl leading-snug">Love the design? Let's make it fit.</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Move a tree, change a colour, work around a window. Tell the original designer what your wall needs.</p>
      <Button className="mt-5 h-12 w-full" onClick={() => { setError(""); setOpen(true); }}><MessageCircle />Chat with {designer.name.split(" ")[0]}</Button>
      <p className="mt-3 text-xs text-muted-foreground">Chat is free · Design changes from {money(designer.adaptFee)} · Agree the scope with the designer on Artisan Mural</p>
    </section>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Chat with {designer.name}</DialogTitle><DialogDescription>{design.title} · Your selected artwork and measurements travel with your message.</DialogDescription></DialogHeader>
      <Button asChild variant="outline"><Link to="/custom-request" search={{designer:designer.slug,design:design.slug,selection:JSON.stringify(selection)}}>Request a customization quote</Link></Button>
      <form onSubmit={send} className="space-y-4"><MuralFramer design={design} selection={selection} onChange={onSelectionChange} /><p className="text-sm font-medium">{selection.width} × {selection.height} {selection.unit}</p>{!session && <div><label className="block text-sm">Your name<input required autoComplete="given-name" maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3" /></label><p className="mt-2 text-xs text-muted-foreground">No account or email needed. Your chat stays here on Artisan Mural under Messages.</p></div>}<label className="block text-sm">Message<textarea required autoFocus maxLength={3000} value={body} onChange={e => setBody(e.target.value)} placeholder="I love this part. Could you move the tree away from my window and make it fit my wall?" className="mt-2 min-h-28 w-full rounded-md border border-input bg-background p-3" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} type="submit" className="h-11 w-full"><Send />{busy ? "Sending…" : "Send message with this selection"}</Button><p className="text-xs text-muted-foreground">For your protection, all chat, design work and payment stay on Artisan Mural.</p></form>
    </DialogContent></Dialog>
  </>;
}
