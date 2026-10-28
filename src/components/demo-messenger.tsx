import { useState } from "react";
import { ArrowLeft, ImagePlus, Search, Send, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_BLOCKED_MESSAGE, containsContactDetails } from "@/lib/contact-guard";

type Msg = { mine: boolean; text: string; time: string };
type Chat = { id: string; name: string; kind: "studio" | "client"; about: string; unread: number; messages: Msg[] };

const seed: Chat[] = [
  { id: "studio", name: "Artisan Mural studio", kind: "studio", about: "Your company support", unread: 1, messages: [
    { mine: false, text: "Print file received for Deco Arches. Colors look great, approved for the shop.", time: "09:02" },
    { mine: true, text: "Thank you! When is the next payout?", time: "09:10" },
    { mine: false, text: "Payouts go out on the 1st — yours is $9,913.90.", time: "09:14" },
  ] },
  { id: "sarah", name: "Sarah M.", kind: "client", about: "Cranes at Dusk · 14 × 9 ft", unread: 2, messages: [
    { mine: false, text: "Hi! My wall is 14 ft wide — can Cranes at Dusk work without losing the birds?", time: "10:24" },
    { mine: true, text: "Yes — I can adapt the layout so the cranes stay centered. I'll send a price offer here.", time: "10:31" },
    { mine: false, text: "Amazing, here's a photo of the wall with the window.", time: "10:40" },
  ] },
  { id: "david", name: "David K.", kind: "client", about: "Custom bedroom mural", unread: 0, messages: [
    { mine: false, text: "Could you design something calm with mountains for my son's bedroom?", time: "Yesterday" },
    { mine: true, text: "Love that idea. I sent you an offer for $540 — 12 × 8 ft.", time: "Yesterday" },
  ] },
  { id: "lena", name: "Lena R.", kind: "client", about: "Deco Arches · colour change", unread: 0, messages: [
    { mine: false, text: "Is there a sage green version of Deco Arches?", time: "Mon" },
  ] },
  { id: "omar", name: "Omar S.", kind: "client", about: "Soft Rain · hallway", unread: 0, messages: [
    { mine: true, text: "The repeat will run all 22 ft without any seams showing.", time: "Sun" },
    { mine: false, text: "Perfect, ordering today!", time: "Sun" },
  ] },
];

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2);

/** Demo messenger: company chat pinned on top, many client chats, live-feeling local sending. */
export function DemoMessenger() {
  const [chats, setChats] = useState(seed);
  const [activeId, setActiveId] = useState<string | null>("sarah");
  const [filter, setFilter] = useState<"all" | "client" | "studio">("all");
  const [q, setQ] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const active = chats.find(c => c.id === activeId);
  const shown = chats.filter(c => (filter === "all" || c.kind === filter) && `${c.name} ${c.about}`.toLowerCase().includes(q.toLowerCase()));
  function open(id: string) { setActiveId(id); setChats(cs => cs.map(c => c.id === id ? { ...c, unread: 0 } : c)); }
  function send() {
    const text = body.trim(); if (!text || !active) return;
    if (containsContactDetails(text)) { setError(CONTACT_BLOCKED_MESSAGE); return; }
    setError(""); setBody("");
    setChats(cs => cs.map(c => c.id === active.id ? { ...c, messages: [...c.messages, { mine: true, text, time: "Now" }] } : c));
  }
  const chip = (id: typeof filter, label: string) => <Button key={id} size="sm" variant={filter === id ? "default" : "ghost"} className="h-8 rounded-full px-3 text-xs" onClick={() => setFilter(id)}>{label}</Button>;
  const avatar = (c: Chat) => <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium ${c.kind === "studio" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{c.kind === "studio" ? <Store className="h-5 w-5" /> : initials(c.name)}</span>;

  return <div className="overflow-hidden rounded-2xl border border-border bg-card">
    <div className="grid h-[620px] md:grid-cols-[320px_1fr]">
      <aside className={`flex min-h-0 flex-col border-border md:border-r ${active ? "hidden md:flex" : "flex"}`}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-3 text-sm" /></div>
          <div className="flex gap-1">{chip("all", "All")}{chip("client", "Clients")}{chip("studio", "Company")}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{shown.map(c => { const last = c.messages[c.messages.length - 1]; return <button key={c.id} type="button" onClick={() => open(c.id)} className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors ${c.id === activeId ? "bg-muted" : "hover:bg-muted/50"}`}>
          {avatar(c)}
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{c.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{last?.time}</span></span>
            <span className="block truncate text-xs text-muted-foreground">{c.about}</span>
            <span className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{last?.mine ? "You: " : ""}{last?.text}</span>{c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{c.unread}</span>}</span></span>
        </button>; })}</div>
      </aside>
      <section className={`min-h-0 flex-col ${active ? "flex" : "hidden md:flex"}`}>{active ? <>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Button size="icon" variant="ghost" className="md:hidden" aria-label="Back to chats" onClick={() => setActiveId(null)}><ArrowLeft /></Button>
          {avatar(active)}<div className="min-w-0"><p className="truncate font-medium">{active.name}</p><p className="truncate text-xs text-muted-foreground">{active.about}</p></div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/60 p-4">{active.messages.map((m, i) => <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${m.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"}`}>{m.text}<p className="mt-1 text-right text-[10px] opacity-60">{m.time}</p></div></div>)}</div>
        <div className="border-t border-border p-3">
          {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label="Add photo"><ImagePlus /></Button><input value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} aria-label="Message" placeholder={`Message ${active.name}…`} className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm" /><Button size="icon" className="rounded-full" aria-label="Send" onClick={send}><Send /></Button></div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Emails, phone numbers and outside links are blocked so everything stays on Artisan Mural.</p>
        </div>
      </> : <p className="m-auto text-sm text-muted-foreground">Pick a chat</p>}</section>
    </div>
  </div>;
}
