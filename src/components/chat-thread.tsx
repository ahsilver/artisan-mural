import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ImagePlus, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuralFramer } from "@/components/mural-framer";
import { CONTACT_BLOCKED_MESSAGE, containsContactDetails } from "@/lib/contact-guard";
import type { Design } from "@/lib/catalog";
import type { ThreadMessage } from "@/lib/studio.functions";
import { plainError } from "@/lib/original-source";

const senderLabel = { customer: "Customer", designer: "Designer", studio: "Artisan Mural studio" } as const;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const dayLabel = (iso: string) => {
  const d = new Date(iso), today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** One conversation in messenger style: bubbles, day dividers, photos, wall selections, and a composer bar. */
export function ChatThread({ messages, design, names, onSend, emptyHint, seenAt }: {
  messages: ThreadMessage[];
  design?: Design | undefined;
  names?: Partial<Record<ThreadMessage["sender"], string | undefined>>;
  onSend: (body: string, photo: File | null) => Promise<void>;
  emptyHint?: string;
  /** Latest time the other side replied; your earlier messages show as seen. */
  seenAt?: string | undefined;
}) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!photo) { setPreview(""); return; } const u = URL.createObjectURL(photo); setPreview(u); return () => URL.revokeObjectURL(u); }, [photo]);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || (!body.trim() && !photo)) return;
    if (containsContactDetails(body)) { setError(CONTACT_BLOCKED_MESSAGE); return; }
    setBusy(true); setError("");
    try { await onSend(body, photo); setBody(""); setPhoto(null); }
    catch (err) { setError(plainError(err, "Could not send message")); }
    finally { setBusy(false); }
  }
  const seen = seenAt ?? [...messages].reverse().find(m => !m.mine)?.created_at;
  return <div className="flex h-full min-h-0 flex-col">
    <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 px-3 py-5 sm:px-6">
      {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{emptyHint ?? "No messages yet. Say hello!"}</p>}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
        const grouped = prev && !newDay && prev.mine === m.mine && prev.sender === m.sender;
        return <div key={m.id}>
          {newDay && <p className="my-4 text-center"><span className="rounded-full bg-background px-3 py-1 text-[11px] text-muted-foreground shadow-sm">{dayLabel(m.created_at)}</span></p>}
          <div className={`flex ${m.mine ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-3"}`}>
            <article className={`max-w-[85%] px-3.5 py-2.5 sm:max-w-md ${m.mine ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground" : `rounded-2xl rounded-bl-md border ${m.sender === "studio" ? "border-primary/40 bg-accent" : "border-border bg-card"}`}`}>
              {!m.mine && !grouped && <p className="mb-1 text-[11px] font-semibold opacity-80">{names?.[m.sender] ?? senderLabel[m.sender]}{m.sender === "studio" && " · Studio"}</p>}
              {m.photo && <a href={m.photo} target="_blank" rel="noreferrer" className="mb-1.5 block"><img src={m.photo} alt="Shared photo" className="max-h-72 w-full rounded-xl object-cover" /></a>}
              {m.selection && design && <div className="mb-1.5 w-64 max-w-full overflow-hidden rounded-xl bg-background p-1.5 text-foreground"><MuralFramer design={design} selection={m.selection} compact /><p className="px-1 pt-1.5 text-[11px]">Wall part · {m.selection.width} × {m.selection.height} {m.selection.unit}</p></div>}
              {m.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>}
              <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{time(m.created_at)}{m.mine && (seen && seen > m.created_at ? <CheckCheck className="h-3 w-3" aria-label="Seen" /> : <Check className="h-3 w-3" aria-label="Sent" />)}</p>
            </article>
          </div>
        </div>;
      })}
    </div>
    <form onSubmit={submit} className="border-t border-border bg-card p-2.5 sm:p-3">
      {preview && <div className="relative mb-2 inline-block"><img src={preview} alt="Photo to send" className="h-20 rounded-lg border border-border object-cover" /><Button type="button" size="icon" variant="secondary" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 h-6 w-6 rounded-full"><X className="h-3.5 w-3.5" /></Button></div>}
      <div className="flex items-end gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full"><label className="cursor-pointer" aria-label="Add photo"><ImagePlus /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 10 * 1024 * 1024 || !PHOTO_TYPES.includes(f.type)) { setError("Photos must be JPEG, PNG or WebP under 10 MB."); return; } setError(""); setPhoto(f); }} /></label></Button>
        <label className="min-w-0 flex-1"><span className="sr-only">Message</span><textarea rows={1} maxLength={3000} value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} placeholder="Write a message…" className="max-h-32 min-h-11 w-full resize-none rounded-3xl border border-input bg-background px-4 py-2.5 text-sm" /></label>
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || (!body.trim() && !photo)} className="h-11 w-11 shrink-0 rounded-full">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </div>
      {error && <p role="alert" className="mt-2 px-2 text-sm text-destructive">{error}</p>}
    </form>
  </div>;
}
