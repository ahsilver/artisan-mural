import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat-thread";
import { OfferPanel } from "@/components/offer-panel";
import { MessengerShell, readMark, type MessengerChat } from "@/components/messenger-shell";
import { designBySlug, designerBySlug } from "@/lib/catalog";
import { useSession } from "@/hooks/use-session";
import { deliverProjectProof } from "@/lib/custom-projects.functions";
import { createOffer, listInbox, listOffers, readThread, sendThreadMessage, updateOffer, type InboxItem, type Offer, type ThreadMessage } from "@/lib/studio.functions";
import { plainError } from "@/lib/original-source";

type Filter = "all" | "unread" | "customers" | "studio";

/** Signed-in messenger shared by customers, designers and the studio; row security decides what each sees. */
export function Inbox({ initialId }: { initialId?: string | undefined }) {
  const {session}=useSession();
  const list = useServerFn(listInbox);
  const read = useServerFn(readThread);
  const send = useServerFn(sendThreadMessage);
  const getOffers = useServerFn(listOffers);
  const deliver=useServerFn(deliverProjectProof);
  const makeOffer = useServerFn(createOffer);
  const changeOffer = useServerFn(updateOffer);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [role, setRole] = useState<{ isAdmin: boolean; designerSlug: string | null }>({ isAdmin: false, designerSlug: null });
  const [activeId, setActiveId] = useState(initialId);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [, bump] = useState(0);
  const current = items.find(i => i.id === activeId);

  const loadList = useCallback(async () => { try { const r = await list(); setItems(r.items); setRole({ isAdmin: r.isAdmin, designerSlug: r.designerSlug }); } catch (e) { setError(plainError(e, "Could not load conversations.")); } }, [list]);
  const loadThread = useCallback(async () => {
    if (!current) { setMessages([]); setOffers([]); return; }
    try { const d = { kind: current.kind, id: current.id }; const [m, o] = await Promise.all([read({ data: d }), getOffers({ data: d })]); setMessages(m); setOffers(o); const last = m.at(-1)?.created_at; if (last) { readMark.set(current.id, last); bump(n => n + 1); } }
    catch (e) { setError(plainError(e, "Could not load messages.")); }
  }, [current?.id, current?.kind, read, getOffers]);
  useEffect(() => { void loadList(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void loadList(); }, 15000); return () => window.clearInterval(t); }, [loadList]);
  useEffect(() => { setMessages([]); setOffers([]); void loadThread(); const t = window.setInterval(() => { if (document.visibilityState === "visible") void loadThread(); }, 5000); return () => window.clearInterval(t); }, [loadThread]);

  const me = role.isAdmin ? "studio" : role.designerSlug ? "designer" : "customer";
  const part = current?.customerId === session?.user.id ? "customer" as const : role.isAdmin ? "studio" as const : role.designerSlug && current?.designer === role.designerSlug ? "designer" as const : "customer" as const;
  const isUnread = (i: InboxItem) => !!i.lastBody && !i.lastMine && i.lastAt > readMark.get(i.id) && i.id !== activeId;
  const nameFor = (i: InboxItem) => me === "customer" ? designerBySlug(i.designer)?.name ?? "Designer" : i.customer ?? "Customer";
  const shown = items.filter(i => {
    if (filter === "unread" && !isUnread(i)) return false;
    if (filter === "studio" && i.lastSender !== "studio") return false;
    if (filter === "customers" && i.lastSender === "studio") return false;
    return !query || `${i.title} ${i.customer ?? ""} ${designerBySlug(i.designer)?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });
  const chats: MessengerChat[] = shown.map(i => ({ id: i.id, name: nameFor(i), subtitle: i.title, preview: i.lastBody ? `${i.lastMine ? "You: " : ""}${i.lastBody}` : "No messages yet", at: i.lastAt, unread: isUnread(i), image: me === "customer" ? undefined : (i.design ? designBySlug(i.design)?.image : undefined) }));
  const designer = current ? designerBySlug(current.designer) : undefined;
  const design = current?.design ? designBySlug(current.design) : undefined;
  const chip = (id: Filter, label: string) => <Button key={id} size="sm" variant={filter === id ? "default" : "ghost"} className="h-8 rounded-full px-3 text-xs" onClick={() => setFilter(id)}>{label}</Button>;
  async function onSend(body: string, photo: File | null) {
    if (!current) return;
    const form = new FormData(); form.set("kind", current.kind); form.set("id", current.id); form.set("body", body); if (photo) form.set("photo", photo);
    await send({ data: form }); await Promise.all([loadThread(), loadList()]);
  }
  return <div>
    <p className="mb-4 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />{role.isAdmin ? "Owner view · you see every conversation and can reply as Artisan Mural." : role.designerSlug ? "Your customer chats. The Artisan Mural studio can join to help." : "Your chats with designers and the Artisan Mural studio."} Contact details are blocked so everything stays safe on Artisan Mural.</p>
    <MessengerShell chats={chats} activeId={current?.id} onOpen={setActiveId} onBack={() => setActiveId(undefined)} query={query} onQuery={setQuery}
      filters={<div className="flex flex-wrap gap-1">{chip("all", "All")}{chip("unread", "Unread")}{me !== "customer" && chip("customers", "Customers")}{chip("studio", "Company")}</div>}
      header={design && <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex"><Link to="/design/$slug" params={{ slug: design.slug }}>View design</Link></Button>}
      empty={<>No conversations yet.{me === "customer" && <><br /><Link to="/browse" className="mt-2 inline-block text-primary underline">Find a design you love</Link></>}</>}>
      {current && <>
        {(offers.length > 0 || part !== "customer") && <div className="max-h-[55%] shrink-0 overflow-y-auto border-b border-border px-3"><OfferPanel offers={offers} part={part} onDeliver={async (offer,file,note)=>{const form=new FormData();form.set("offer",offer);form.set("proof",file);form.set("note",note);await deliver({data:form});await loadThread();}} onApproveProof={async offer=>{await changeOffer({data:{kind:current.kind,id:current.id,offer,action:"approveProof"}});await loadThread();}} onCreate={async (amount, description, deliveryDays) => { await makeOffer({ data: { kind: current.kind, id: current.id, amount, description, deliveryDays } }); await loadThread(); }} onAccept={async offer => { await changeOffer({ data: { kind: current.kind, id: current.id, offer, action: "accept" } }); await loadThread(); }} onCancel={async offer => { await changeOffer({ data: { kind: current.kind, id: current.id, offer, action: "cancel" } }); await loadThread(); }} /></div>}
        <ChatThread messages={messages} design={design} names={{ designer: designer?.name, customer: current.customer ?? "Customer" }} onSend={onSend} />
      </>}
    </MessengerShell>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </div>;
}
