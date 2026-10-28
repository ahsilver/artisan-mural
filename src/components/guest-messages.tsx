import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat-thread";
import { OfferPanel } from "@/components/offer-panel";
import { MessengerShell, type MessengerChat } from "@/components/messenger-shell";
import { acceptGuestOffer, listGuestOffers, readGuestThread, sendGuestThreadMessage, type Offer, type ThreadMessage } from "@/lib/studio.functions";
import { guestChats, type GuestChat } from "@/lib/guest-chats";
import { designBySlug, designerBySlug } from "@/lib/catalog";
import { plainError } from "@/lib/original-source";

/** Conversations started without an account, unlocked by keys kept in this browser. */
export function GuestMessages({ activeId, onSignIn }: { activeId: string | undefined; onSignIn: () => void }) {
  const [chats, setChats] = useState<GuestChat[]>([]);
  const [messages, setMessages] = useState<(ThreadMessage & { design_slug: string | null })[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const read = useServerFn(readGuestThread);
  const send = useServerFn(sendGuestThreadMessage);
  const getOffers = useServerFn(listGuestOffers);
  const accept = useServerFn(acceptGuestOffer);
  const navigate = useNavigate();
  useEffect(() => { setChats(guestChats()); }, []);
  const current = chats.find(c => c.id === activeId);
  const refresh = useCallback(async () => {
    if (!current) { setMessages([]); setOffers([]); return; }
    try { const d = { token: current.token, id: current.id }; const [m, o] = await Promise.all([read({ data: d }), getOffers({ data: d })]); setMessages(m); setOffers(o); }
    catch (err) { setError(plainError(err, "Could not load messages.")); }
  }, [current, read, getOffers]);
  useEffect(() => { void refresh(); const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000); return () => window.clearInterval(poll); }, [refresh]);
  async function onSend(body: string, photo: File | null) {
    if (!current) return;
    const form = new FormData(); form.set("kind", "guest"); form.set("id", current.id); form.set("token", current.token); form.set("body", body); if (photo) form.set("photo", photo);
    await send({ data: form }); await refresh();
  }
  const designer = current ? designerBySlug(current.designer) : undefined;
  const designSlug = messages.find(m => m.design_slug)?.design_slug;
  const design = designSlug ? designBySlug(designSlug) : undefined;
  const list: MessengerChat[] = chats.filter(c => !query || `${c.title} ${designerBySlug(c.designer)?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())).map(c => ({ id: c.id, name: designerBySlug(c.designer)?.name ?? "Designer", subtitle: c.title, preview: c.id === activeId && messages.at(-1) ? messages.at(-1)!.body || "📷 Photo" : "Tap to open", at: c.id === activeId && messages.at(-1) ? messages.at(-1)!.created_at : new Date().toISOString(), unread: false }));
  return <div className="mx-auto max-w-7xl px-3 py-6 sm:px-8 sm:py-10">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2 sm:px-0"><h1 className="text-3xl sm:text-4xl">Messages</h1><Button variant="outline" size="sm" onClick={onSignIn}>Sign in to see chats on every device</Button></div>
    <p className="mb-4 flex items-start gap-2 px-2 text-xs text-muted-foreground sm:px-0"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />All chat, design work and payment stay on Artisan Mural for your protection. Emails, phone numbers and links are blocked.</p>
    <MessengerShell chats={list} activeId={current?.id} onOpen={id => void navigate({ to: "/messages", search: { conversation: id } })} onBack={() => void navigate({ to: "/messages", search: {} })} query={query} onQuery={setQuery}
      empty={<>No conversations yet.<br /><Link to="/browse" className="mt-2 inline-block text-primary underline">Find a design you love</Link></>}>
      {current && <>
        {offers.length > 0 && <div className="max-h-[40%] overflow-y-auto border-b border-border px-3"><OfferPanel offers={offers} part="customer" onAccept={async offer => { await accept({ data: { token: current.token, id: current.id, offer } }); await refresh(); }} /></div>}
        <ChatThread messages={messages} design={design} names={{ designer: designer?.name }} onSend={onSend} emptyHint={`${designer?.name.split(" ")[0] ?? "The designer"} will reply here. Keep this browser, or sign in, to see the reply.`} />
      </>}
    </MessengerShell>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </div>;
}
