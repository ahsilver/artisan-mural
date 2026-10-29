import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Paperclip, Send, ShieldCheck, X, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCommunity } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { findContactDetails, CONTACT_NOTE } from "@/lib/contact-guard";
import { ThreadView } from "@/components/messenger";
import { AskDesignerButton, type RequestPrefill } from "@/components/oversize";

export async function papi(path: string, body?: any, method?: string) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const r = await fetch("/backend/" + path, { method: method ?? (body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status})`);
  return j;
}
export type Att = { key: string; name: string; size?: number; url?: string };
export async function attachFile(file: File): Promise<Att> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/backend/projects/attach?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, "content-type": file.type || "application/octet-stream" }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Upload failed");
  return j;
}
export const money = (n: any) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "");
export const when = (s?: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const TONE: Record<string, string> = { requested: "bg-amber-100 text-amber-900", quoted: "bg-sky-100 text-sky-900", approved: "bg-sky-100 text-sky-900", in_progress: "bg-amber-100 text-amber-900", delivered: "bg-emerald-100 text-emerald-900", cancelled: "bg-stone-200 text-stone-700" };
const CUSTOMER_LABEL: Record<string, string> = { requested: "Waiting for the designer's price", quoted: "Price received", approved: "Approved: enter your wall size and pay", in_progress: "Paid: designer is working", delivered: "Design finished: getting ready to print", cancelled: "Cancelled" };
export function StatusPill({ status, label, customer }: { status: string; label?: string; customer?: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status] ?? "bg-stone-100 text-stone-700"}`}>{customer ? CUSTOMER_LABEL[status] ?? label : label ?? status}</span>;
}

export function ContactNote({ className = "" }: { className?: string }) {
  return <p className={`flex items-start gap-1.5 text-xs leading-snug text-muted-foreground ${className}`}><ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />{CONTACT_NOTE}</p>;
}

function AttachButton({ onAdd, disabled }: { onAdd: (a: Att) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return <>
    <input ref={ref} type="file" accept="image/*,application/pdf" multiple hidden onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; setBusy(true); setErr(""); try { for (const f of fs) onAdd(await attachFile(f)); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }} />
    <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Paperclip />}Attach</Button>
    {err && <span className="text-xs text-destructive">{err}</span>}
  </>;
}
function AttList({ items, onRemove }: { items: Att[]; onRemove?: (i: number) => void }) {
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-2">{items.map((a, i) => <span key={a.key ?? i} className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-xs">
    {a.url && /\.(jpe?g|png|webp|gif)$/i.test(a.name) ? <img src={a.url} alt="" className="size-8 rounded object-cover" /> : <Paperclip className="size-3" />}
    {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="truncate underline-offset-2 hover:underline">{a.name}</a> : <span className="truncate">{a.name}</span>}
    {onRemove && <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemove(i)}><X className="size-3" /></button>}
  </span>)}</div>;
}
export { AttList };

/** Chat between the customer and one designer about one request. Contact details are blocked here and on the server. */
export function Chat({ projectId, thread, canWrite = true, designerUid, onSent, compact }: { projectId: string; thread?: any; canWrite?: boolean; designerUid?: string; onSent: () => void; compact?: boolean }) {
  const dname = thread?.designer?.name ?? "Designer";
  const msgs = (thread?.messages ?? []).map((m: any) => ({ id: m.id, mine: canWrite ? m.mine : m.role === "designer", who: m.role === "designer" ? dname : "Customer", role: m.role, body: m.body, at: m.at, files: (m.files ?? []).map((f: any) => ({ name: f.name, url: f.url, image: /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name || "") })) }));
  return <div className="ms" style={{ display: "flex", flexDirection: "column", height: compact ? 380 : 480, minHeight: 0 }} data-testid="request-chat">
    <ThreadView messages={msgs} canWrite={canWrite} guarded showNames={!canWrite} emptyText="No messages yet. Ask anything about the work here."
      readOnlyNote={canWrite ? undefined : "You can read this chat. To write to the customer or the designer, use Messages."}
      onSend={async (text, atts) => { await papi(`projects/${projectId}/messages`, { body: text, attachments: atts, designer: designerUid ?? thread?.designer?.uid }); onSent(); }} />
  </div>;
}

/** The customer's request form: a change to an existing design (edit) or a fully custom design. */
export function RequestForm({ kind, designSlug, designTitle, designerName, designers, initialDesigner, initial, onDone, basedOn }: { kind: "edit" | "custom"; basedOn?: { slug: string; title: string } | null; designSlug?: string; designTitle?: string; designerName?: string; designers?: { slug: string; name: string }[]; initialDesigner?: string; initial?: RequestPrefill; onDone: (id: string) => void }) {
  const [f, setF] = useState({ title: "", brief: initial?.brief ?? "", room: "", wallSize: initial?.wallSize ?? "", budget: "", finish: "", style: "", deadline: "", designer: initialDesigner ?? "open", name: "" });
  const community = useCommunity();
  useEffect(() => { if (!community.requestsEnabled && f.designer === "open" && designers?.length) setF((x) => ({ ...x, designer: designers[0].slug })); }, [community.requestsEnabled]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const warn = findContactDetails(`${f.brief} ${f.title} ${f.room} ${f.wallSize}`);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (warn) { setErr(`Please remove ${warn}. Contact details can't be shared.`); return; }
    setBusy(true);
    try { const r = await papi("projects/create", { kind, designSlug, designerSlug: f.designer, title: f.title, brief: `${f.brief}${f.style.trim() ? `\n\nStyle: ${f.style.trim()}` : ""}${f.finish.trim() ? `\n\nFinish I have in mind: ${f.finish.trim()}` : ""}`, room: f.room, wallSize: f.wallSize, budget: f.budget, deadline: f.deadline, basedOn: basedOn?.slug, attachments: atts, name: f.name }); onDone(r.id); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return <form onSubmit={submit} className="space-y-4">
    {kind === "edit" ? <p className="text-sm text-muted-foreground">Tell {designerName ?? "the designer"} what to change in <b className="font-medium text-foreground">{designTitle}</b>: colors, size, adding or removing something. They reply with a price and how many days it takes.</p>
      : <div><label className="text-sm font-medium" htmlFor="rq-designer">Designer</label><select id="rq-designer" className={inp + " mt-1"} value={f.designer} onChange={(e) => setF({ ...f, designer: e.target.value })}>{community.requestsEnabled && <option value="open">Any designer (open request, all designers can send you an offer)</option>}{(designers ?? []).map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}</select></div>}
    {kind === "custom" && <div><label className="text-sm font-medium" htmlFor="rq-title">What should we make?</label><input id="rq-title" className={inp + " mt-1"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Mural from our logo, a painting of our farm" maxLength={120} /></div>}
    <div><label className="text-sm font-medium" htmlFor="rq-brief">{kind === "edit" ? "What would you like changed?" : "Describe your idea"}</label>
      <textarea id="rq-brief" required minLength={10} rows={5} className={inp + " mt-1"} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} placeholder={kind === "edit" ? "Make the leaves darker green and add a bird on the right…" : "Colors, style, what it shows. Attach your logo, a photo, a sketch or a painting."} /></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="text-sm font-medium" htmlFor="rq-room">Room</label><input id="rq-room" className={inp + " mt-1"} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="Living room" /></div>
      <div><label className="text-sm font-medium" htmlFor="rq-size">Wall size (approx.)</label><input id="rq-size" className={inp + " mt-1"} value={f.wallSize} onChange={(e) => setF({ ...f, wallSize: e.target.value })} placeholder="12 x 9 ft" /></div>
      {kind === "custom" && <div><label className="text-sm font-medium" htmlFor="rq-finish">Finish you have in mind (optional)</label><input id="rq-finish" className={inp + " mt-1"} value={f.finish} onChange={(e) => setF({ ...f, finish: e.target.value })} placeholder="Matte, canvas, grasscloth, not sure" /></div>}
      {kind === "custom" && <div><label className="text-sm font-medium" htmlFor="rq-style">Style (optional)</label><input id="rq-style" className={inp + " mt-1"} value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} placeholder="Botanical, calm, modern" maxLength={80} /></div>}
      {kind === "custom" && <div><label className="text-sm font-medium" htmlFor="rq-budget">Budget for the design</label><select id="rq-budget" className={inp + " mt-1"} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })}><option value="">Not sure yet</option>{["Under $200", "$200 – $500", "$500 – $1,000", "$1,000 – $2,500", "Over $2,500"].map((b) => <option key={b} value={b}>{b}</option>)}</select></div>}
      <div><label className="text-sm font-medium" htmlFor="rq-deadline">Needed by (optional)</label><input id="rq-deadline" type="date" className={inp + " mt-1"} value={f.deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
    </div>
    {basedOn && kind === "custom" && <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground" data-testid="based-on">Based on <b className="font-medium text-foreground">{basedOn.title}</b>. The designer starts from this design.</p>}
    <div className="space-y-2"><p className="text-sm font-medium">Pictures (optional)</p><div className="flex flex-wrap items-center gap-2"><AttachButton onAdd={(a) => setAtts((x) => [...x, a])} /><span className="text-xs text-muted-foreground">Logo, photo, sketch or painting. Up to 25 MB each.</span></div><AttList items={atts} onRemove={(i) => setAtts(atts.filter((_, k) => k !== i))} /></div>
    <ContactNote />
    {(warn || err) && <p className="text-sm text-destructive" role="alert">{warn ? `This looks like ${warn}. Contact details can't be shared. Everything stays on Artisan Mural.` : err}</p>}
    <Button type="submit" disabled={busy || !!warn} className="w-full sm:w-auto">{busy ? <Loader2 className="animate-spin" /> : <Send />}Send request</Button>
    <p className="text-xs text-muted-foreground">Free to ask. You only pay after you approve the designer's price, together with the printing.</p>
  </form>;
}

/** Product page: "Customize this design". Fiverr-style: sign in first (if needed), then straight into a private chat
 *  with this design's designer. The chat opens with a card for the design and a short request form inside it. */
export function RequestChange({ design, designer, open: openProp, onOpenChange, prefill, trigger = true }: { design: { slug: string; title: string; image?: string }; designer: { slug: string; name: string }; open?: boolean; onOpenChange?: (o: boolean) => void; prefill?: RequestPrefill; trigger?: boolean }) {
  const [local, setLocal] = useState(false);
  const open = openProp ?? local; const setOpen = (o: boolean) => { setLocal(o); onOpenChange?.(o); };
  const { session } = useSession();
  const navigate = useNavigate();
  const [err, setErr] = useState(""); const started = useRef(false);
  useEffect(() => {
    if (!open) { started.current = false; setErr(""); return; }
    if (!session || started.current) return;
    started.current = true;
    (async () => {
      try {
        const thumb = typeof design.image === "string" ? (design.image.startsWith("/") || design.image.startsWith("https://") ? design.image : new URL(design.image, window.location.origin).href) : undefined;
        const r = await papi("projects/start-chat", { designSlug: design.slug, title: design.title, sku: (design as any).sku, thumb });
        try { if (prefill) sessionStorage.setItem("am-brief-" + r.id, JSON.stringify(prefill)); } catch {}
        setOpen(false);
        await navigate({ to: "/messages", search: { c: r.key } as any });
      } catch (x: any) { started.current = false; setErr(x.message || "Could not open the chat."); }
    })();
  }, [open, session?.user?.id]);
  return <>
    {trigger && <AskDesignerButton onClick={() => setOpen(true)} />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent data-testid="request-change" className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle className="text-3xl">Customize this design</DialogTitle><DialogDescription>A private chat with {designer.name} about “{design.title}”. Tell them what you'd like changed; they reply with a price and timing.</DialogDescription></DialogHeader>
      {!session ? <div><p className="mb-3 text-sm text-muted-foreground">Sign in or create a free account first. Your chat with the designer opens right after.</p><AuthPanel /></div>
        : err ? <p className="text-sm text-destructive" role="alert">{err}</p>
        : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Opening your chat with {designer.name}…</p>}
    </DialogContent></Dialog>
  </>;
}

/** The request form shown inside a new design chat (customer side) until it's sent. */
export function BriefForm({ projectId, onDone, who }: { projectId: string; onDone: () => void; who?: string }) {
  const pre = (() => { try { return JSON.parse(sessionStorage.getItem("am-brief-" + projectId) || "null"); } catch { return null; } })();
  const [f, setF] = useState({ room: "", change: pre?.brief ?? "", w: "", h: "", unit: "ft", size: pre?.wallSize ?? "", notes: "" });
  const [atts, setAtts] = useState<Att[]>([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const warn = findContactDetails([f.room, f.change, f.notes, f.size].join(" "));
  const inp = "w-full rounded-md border border-[#cfe6f5] bg-white px-3 py-2 text-[16px] sm:text-sm outline-none focus:border-[#8EC6E7] focus:ring-2 focus:ring-[#8EC6E7]/40";
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy || warn) return; setBusy(true); setErr("");
    const wallSize = f.w && f.h ? `${f.w} × ${f.h} ${f.unit}` : f.size;
    try { await papi(`projects/${projectId}/brief`, { room: f.room, change: f.change, wallSize, notes: f.notes, attachments: atts }); try { sessionStorage.removeItem("am-brief-" + projectId); } catch {} onDone(); }
    catch (x: any) { setErr(x.message || "Could not send."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="am-brief" data-testid="brief-form">
    <p className="am-brief-h">Hi! Tell {who ? who.split(" ")[0] : "the designer"} about your wall</p><p className="am-brief-sub">Fill in what you know. It goes into this chat, and you can keep talking after.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[13px] font-medium">Which room<select className={inp + " mt-1"} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })}><option value="">Choose…</option>{["Living room", "Bedroom", "Kids & nursery", "Dining room", "Kitchen", "Bathroom", "Hallway & stairs", "Office", "Commercial space", "Other"].map((r) => <option key={r}>{r}</option>)}</select></label>
      <div className="text-[13px] font-medium">Wall size<div className="mt-1 flex items-center gap-1.5"><input className={inp} inputMode="decimal" placeholder="Width" value={f.w} onChange={(e) => setF({ ...f, w: e.target.value })} aria-label="Wall width" /><span>×</span><input className={inp} inputMode="decimal" placeholder="Height" value={f.h} onChange={(e) => setF({ ...f, h: e.target.value })} aria-label="Wall height" /><select className={inp + " !w-[72px]"} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label="Unit"><option>ft</option><option>in</option><option>cm</option><option>m</option></select></div>{f.size && !(f.w && f.h) ? <span className="text-xs text-muted-foreground">From your selection: {f.size}</span> : null}</div>
    </div>
    <label className="mt-3 block text-[13px] font-medium">What would you like changed?<textarea required minLength={5} rows={3} className={inp + " mt-1"} value={f.change} onChange={(e) => setF({ ...f, change: e.target.value })} placeholder="Make the leaves darker green and leave space for a window on the left." /></label>
    <label className="mt-3 block text-[13px] font-medium">Notes (optional)<textarea rows={2} className={inp + " mt-1"} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Doors, outlets, the date you need it…" /></label>
    <div className="mt-3 flex flex-wrap items-center gap-2"><AttachButton onAdd={(a) => setAtts((x) => [...x, a])} disabled={busy} /><span className="text-xs text-muted-foreground">Optional: a photo of your wall</span></div>
    {atts.length > 0 && <AttList items={atts} onRemove={(i) => setAtts((x) => x.filter((_, k) => k !== i))} />}
    {(warn || err) && <p className="mt-2 text-sm text-destructive" role="alert">{warn ? `This looks like ${warn}. Contact details can't be shared. Everything stays on Artisan Mural.` : err}</p>}
    <button type="submit" disabled={busy || !!warn} className="am-brief-send">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send to {who ? who.split(" ")[0] : "the designer"}</button>
  </form>;
}

/** Bell with unread notifications (price came back, paid, delivered, new messages). */
export function NotificationBell() {
  const { session } = useSession();
  const [data, setData] = useState<{ items: any[]; unread: number }>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const load = async () => { try { setData(await papi("notifications")); } catch {} };
  useEffect(() => { if (!session) return; void load(); const t = setInterval(load, 60000); const f = () => document.visibilityState === "visible" && load(); document.addEventListener("visibilitychange", f); return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); }; }, [session?.user?.id]);
  if (!session) return null;
  return <div className="relative">
    <button type="button" aria-label={`Notifications, ${data.unread} unread`} className="relative flex items-center" onClick={() => { setOpen(!open); if (!open) void load(); }}>
      <Bell className="size-[18px]" />{data.unread > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] text-white">{data.unread}</span>}
    </button>
    {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div className="fixed right-2 top-[64px] z-50 w-[min(360px,calc(100vw-16px))] rounded-md border border-border bg-background shadow-paper sm:absolute sm:right-0 sm:top-8">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><b className="text-sm font-medium">Notifications</b>{data.unread > 0 && <button className="text-xs text-primary" onClick={async () => { await papi("notifications/read", {}); void load(); }}>Mark all read</button>}</div>
        <div className="max-h-[60vh] overflow-y-auto">{data.items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p> : data.items.map((n) => <button key={n.id} className={`block w-full border-b border-border/60 px-4 py-3 text-left hover:bg-muted/50 ${n.read_at ? "" : "bg-accent/40"}`} onClick={async () => { setOpen(false); await papi("notifications/read", { id: n.id }).catch(() => {}); void load(); if (n.link) { if (n.link.startsWith("/admin") || n.link.startsWith("/dashboard")) window.location.href = n.link; else void navigate({ to: n.link as any }); } }}>
          <p className="text-sm font-medium">{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}<p className="mt-1 text-[10px] text-muted-foreground">{when(n.created_at)}</p></button>)}</div>
        <div className="px-4 py-2.5"><Link to="/projects" className="text-xs text-primary" onClick={() => setOpen(false)}>My design requests</Link></div>
      </div></>}
  </div>;
}
export { MessageCircle };

/** Account page: the customer's design requests in short. */
export function MyRequests({ messages }: { messages?: boolean }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { papi("projects/mine").then((r) => setList(r.projects)).catch(() => setList([])); }, []);
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{messages ? "Messages with designers" : "Design requests"}</h2><Link to="/projects" className="text-sm text-primary underline underline-offset-4">Open all</Link></div>
    {messages && <p className="mt-1 text-sm text-muted-foreground">Each request has its own chat with the designer.</p>}
    {!list ? <Loader2 className="my-6 animate-spin" /> : list.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No requests yet. Ask a designer for a change on any design page, or <Link to="/custom-request" className="text-primary underline">start a custom design</Link>.</p> :
      <ul className="mt-4 space-y-2">{list.map((p) => <li key={p.id}><Link to="/projects/$id" params={{ id: p.id }} className="soft-panel flex flex-wrap items-center justify-between gap-2 hover:bg-muted/30"><span className="min-w-0"><span className="block truncate font-medium">{p.title}</span><span className="text-xs text-muted-foreground">{p.kind === "edit" ? "Change request" : "Custom design"} · {day(p.updatedAt)}</span></span><StatusPill status={p.status} customer /></Link></li>)}</ul>}
  </div>;
}
