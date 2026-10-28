import { ArrowLeft, MessageCircle, Search, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type MessengerChat = { id: string; name: string; subtitle: string; preview: string; at: string; unread: boolean; studio?: boolean; image?: string | undefined };

const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Browser-local read marks so unread dots clear once a chat is opened on this device. */
export const readMark = {
  get: (id: string) => (typeof window === "undefined" ? "" : window.localStorage.getItem(`am-read:${id}`) ?? ""),
  set: (id: string, at: string) => { if (typeof window !== "undefined") window.localStorage.setItem(`am-read:${id}`, at); },
};

/** Two-pane messenger: chat list (search + filters) and the open chat; on phones the chat opens full screen with a back arrow. */
export function MessengerShell({ chats, activeId, onOpen, onBack, query, onQuery, filters, header, children, empty }: {
  chats: MessengerChat[]; activeId: string | undefined; onOpen: (id: string) => void; onBack: () => void;
  query: string; onQuery: (q: string) => void; filters?: ReactNode; header?: ReactNode; children?: ReactNode; empty?: ReactNode;
}) {
  const avatar = (c: MessengerChat, size = "h-12 w-12") => c.image ? <img src={c.image} alt="" className={`${size} shrink-0 rounded-full object-cover`} /> : <span className={`flex ${size} shrink-0 items-center justify-center rounded-full text-sm font-semibold ${c.studio ? "bg-primary text-primary-foreground" : "bg-accent text-primary"}`}>{c.studio ? <Store className="h-5 w-5" /> : initials(c.name)}</span>;
  const active = chats.find(c => c.id === activeId);
  return <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="grid h-[calc(100dvh-180px)] min-h-[520px] md:h-[680px] md:grid-cols-[340px_1fr]">
      <aside className={`min-h-0 flex-col border-border md:flex md:border-r ${active ? "hidden" : "flex"}`}>
        <div className="space-y-3 border-b border-border p-3 sm:p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={e => onQuery(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-3 text-sm" /></div>
          {filters}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><MessageCircle className="mx-auto mb-3 h-7 w-7" />{empty ?? "No conversations yet."}</div> : chats.map(c => <button key={c.id} type="button" onClick={() => onOpen(c.id)} className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition sm:px-4 ${c.id === activeId ? "bg-accent/60" : "hover:bg-muted/50"}`}>
            {avatar(c)}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2"><span className={`truncate text-sm ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span><span className={`shrink-0 text-[11px] ${c.unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>{when(c.at)}</span></span>
              <span className="block truncate text-[11px] text-muted-foreground">{c.subtitle}</span>
              <span className="mt-0.5 flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-xs ${c.unread ? "text-foreground" : "text-muted-foreground"}`}>{c.preview}</span>{c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</span>
            </span>
          </button>)}
        </div>
      </aside>
      <section className={`min-h-0 flex-col md:flex ${active ? "flex" : "hidden"}`}>
        {active ? <>
          <div className="flex items-center gap-3 border-b border-border px-2 py-2.5 sm:px-4">
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Back to chats" onClick={onBack}><ArrowLeft /></Button>
            {avatar(active, "h-10 w-10")}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{active.name}</p><p className="truncate text-xs text-muted-foreground">{active.subtitle}</p></div>
            {header}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground"><MessageCircle className="mb-3 h-8 w-8" />Pick a conversation to start chatting.</div>}
      </section>
    </div>
  </div>;
}
