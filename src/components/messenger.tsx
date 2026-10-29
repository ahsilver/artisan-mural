import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Send, ShieldCheck, X, Loader2, Plus, Search, FileText } from "lucide-react";
import { papi, attachFile, BriefForm, type Att } from "@/components/projects";
import { findContactDetails, CONTACT_NOTE } from "@/lib/contact-guard";
import "./messenger.css";

export type Conv = { key: string; kind: "project" | "store"; store?: boolean; name: string; initials: string; sub: string; preview: string; at: string; unread: boolean; role?: string };
export type Msg = { id: string; mine: boolean; who: string; role?: string; body: string; at: string; files?: { name: string; url: string | null; image?: boolean }[] };

const ini = (n: string) => { const w = String(n || "?").replace(/\(.*?\)/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "?") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };
const listTime = (iso: string) => { if (!iso) return ""; const d = new Date(iso), n = new Date(); if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); if (n.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString("en-US", { weekday: "short" }); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const dayLabel = (iso: string) => { const d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return "Today"; if (d.toDateString() === y.toDateString()) return "Yesterday"; return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function Avatar({ name, store }: { name: string; store?: boolean }) { return <span className={`ms-av${store ? " store" : ""}`} aria-hidden="true">{ini(name)}</span>; }

/** Unread conversation count for tab labels. */
export function useUnreadMessages(enabled = true) {
  const [n, setN] = useState(0);
  useEffect(() => { if (!enabled) return; let on = true; const go = () => papi("inbox/unread").then((r) => on && setN(r.count ?? 0)).catch(() => {}); go(); const t = setInterval(go, 30000); return () => { on = false; clearInterval(t); }; }, [enabled]);
  return n;
}

/** Bubbles + slim composer. Used by the inbox and by the chat inside a design request. */
/** Starter card (design name + picture + link) and the sent request form, inside a design chat. */
function SpecialBody({ body }: { body: string }) {
  let d: any = null; try { d = JSON.parse(body.slice(7)); } catch { return <div className="ms-bub">{body}</div>; }
  if (body.startsWith("::card ")) return <a className="am-card am-card-big" href={d.link} target="_blank" rel="noreferrer" data-testid="starter-card">
    {d.thumb ? <img src={d.thumb} alt={d.title} loading="lazy" /> : <span className="am-card-ph" />}
    <span className="am-card-t"><span className="am-card-k">About this wallpaper</span><b>{d.title}</b>{d.sku ? <span className="am-card-sku" data-testid="starter-sku">SKU {d.sku}</span> : null}<span className="am-card-l">See the design ›</span></span></a>;
  return <div className="am-formcard" data-testid="request-details"><b>Request details</b>
    {d.room ? <div><span>Room</span>{d.room}</div> : null}{d.wallSize ? <div><span>Wall size</span>{d.wallSize}</div> : null}
    <div><span>Change</span>{d.change}</div>{d.notes ? <div><span>Notes</span>{d.notes}</div> : null}</div>;
}

export function ThreadView({ messages, canWrite = true, guarded, onSend, readOnlyNote, emptyText, showNames, after }: { after?: React.ReactNode; messages: Msg[]; canWrite?: boolean; guarded?: boolean; onSend: (text: string, atts: Att[]) => Promise<void>; readOnlyNote?: string; emptyText?: string; showNames?: boolean }) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  useEffect(() => { const el = body.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = "32px"; el.style.height = Math.min(120, el.scrollHeight + 2) + "px"; }, [text]);
  const warn = guarded && text ? findContactDetails(text) : null;
  async function send(e?: React.FormEvent) {
    e?.preventDefault(); if (busy || warn || (!text.trim() && !atts.length)) return;
    setBusy(true); setErr("");
    try { await onSend(text.trim(), atts); setText(""); setAtts([]); } catch (x: any) { setErr(x.message || "Could not send."); } finally { setBusy(false); }
  }
  return <>
    <div className="ms-body" ref={body} aria-live="polite">
      {messages.length === 0 && <div className="ms-empty">{emptyText ?? "No messages yet."}</div>}
      {messages.map((m, i) => {
        const prev = messages[i - 1]; const next = messages[i + 1];
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
        const first = newDay || !prev || prev.mine !== m.mine || prev.who !== m.who;
        const last = !next || next.mine !== m.mine || next.who !== m.who || new Date(next.at).toDateString() !== new Date(m.at).toDateString() || new Date(next.at).getTime() - new Date(m.at).getTime() > 5 * 60000;
        return <div key={m.id} style={{ display: "contents" }}>
          {newDay && <div className="ms-day">{dayLabel(m.at)}</div>}
          <div className={`ms-msg${m.mine ? " me" : ""}${m.role === "store" ? " store" : ""}${first && !newDay ? " gap" : ""}`} data-testid="ms-msg">
            {first && (showNames || !m.mine) && <div className="ms-who">{m.who}</div>}
            {m.body && (m.body.startsWith("::card ") || m.body.startsWith("::form ")) ? <SpecialBody body={m.body} /> : m.body && <div className="ms-bub">{m.body}</div>}
            {!!m.files?.length && <div className="ms-files">{m.files.map((f, k) => f.image && f.url ? <a key={k} href={f.url} target="_blank" rel="noreferrer" title={f.name}><img className="ms-thumb" src={f.url} alt={f.name} loading="lazy" /></a> : <a key={k} className="ms-file" href={f.url ?? undefined} target="_blank" rel="noreferrer"><FileText size={14} /><span>{f.name}</span></a>)}</div>}
            {last && <div className="ms-at">{clock(m.at)}</div>}
          </div>
        </div>;
      })}
      {after}
    </div>
    {canWrite ? <form className="ms-comp" onSubmit={send}>
      {atts.length > 0 && <div className="ms-pending">{atts.map((a, i) => <span key={a.key} className="ms-file">{a.url && /\.(jpe?g|png|webp|gif)$/i.test(a.name) ? <img src={a.url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }} /> : <Paperclip size={13} />}<span>{a.name}</span><button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAtts(atts.filter((_, k) => k !== i))}><X size={13} /></button></span>)}</div>}
      <div className="ms-comp-row">
        <input ref={fileIn} type="file" hidden multiple accept="image/*,application/pdf" onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; setUpl(true); setErr(""); try { for (const f of fs) { const a = await attachFile(f); setAtts((x) => [...x, a]); } } catch (x: any) { setErr(x.message || "Upload failed"); } finally { setUpl(false); } }} />
        <button type="button" className="ms-btn ms-icon" aria-label="Attach a file" title="Attach" disabled={upl || busy} onClick={() => fileIn.current?.click()}>{upl ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}</button>
        <textarea ref={ta} className={`ms-ta${warn ? " bad" : ""}`} rows={1} maxLength={3000} value={text} placeholder="Write a message" aria-label="Message" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); void send(); } }} />
        <button type="submit" className="ms-btn pri ms-icon" aria-label="Send" disabled={busy || !!warn || (!text.trim() && !atts.length)}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
      </div>
      {warn && <div className="ms-warn" role="alert">This looks like {warn}. Contact details can't be shared here. Keep talking on Artisan Mural.</div>}
      {err && !warn && <div className="ms-warn" role="alert">{err}</div>}
      {guarded && <div className="ms-note"><ShieldCheck size={13} style={{ flex: "none", marginTop: 1 }} />{CONTACT_NOTE}</div>}
    </form> : readOnlyNote ? <div className="ms-ro">{readOnlyNote}</div> : null}
  </>;
}

type Person = { userId: string | null; email: string | null; name: string; role: string; orders?: number };
function NewChat({ onStarted, onCancel, preset }: { onStarted: (key: string) => void; onCancel: () => void; preset?: { orderId?: string; name?: string; body?: string } }) {
  const [q, setQ] = useState(""); const [people, setPeople] = useState<Person[]>([]); const [who, setWho] = useState<Person | null>(null);
  const [subject, setSubject] = useState(""); const [text, setText] = useState(preset?.body ?? ""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (who || preset?.orderId) return; const t = setTimeout(() => { papi("inbox/people?q=" + encodeURIComponent(q)).then((r) => setPeople(r.people ?? [])).catch(() => setPeople([])); }, 200); return () => clearTimeout(t); }, [q, who]);
  async function start() { setBusy(true); setErr(""); try { const r = await papi("inbox/start", { userId: who?.userId, email: who?.email, orderId: preset?.orderId, subject, body: text }); onStarted(r.key); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }
  return <div className="ms-thread">
    <div className="ms-head"><button type="button" className="ms-btn ms-icon ms-back" aria-label="Back" onClick={onCancel}><ArrowLeft size={16} /></button><div className="ms-head-main"><div className="ms-head-name">New message</div><div className="ms-sub">Writes as the store. They get a notification and an email.</div></div><button type="button" className="ms-btn ms-icon" aria-label="Close" onClick={onCancel}><X size={15} /></button></div>
    <div className="ms-new">
      <div><label>To</label>
        {preset?.orderId ? <span className="ms-chip">{preset.name ?? "Customer"}</span> : who ? <span className="ms-chip">{who.name}<span className="ms-tag">{who.role}</span><button type="button" aria-label="Change" onClick={() => setWho(null)}><X size={13} /></button></span> : <div className="ms-pick">
          <div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9CA3AF" }} /><input className="ms-in" style={{ paddingLeft: 28 }} autoFocus placeholder="Search customers and designers by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" /></div>
          <div className="ms-people">{people.length === 0 ? <div className="ms-empty" style={{ padding: 12 }}>No one found.</div> : people.map((p) => <button type="button" key={(p.userId ?? "") + (p.email ?? "")} className="ms-person" onClick={() => setWho(p)}><Avatar name={p.name} /><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", fontWeight: 500 }}>{p.name}</span><span className="ms-sub" style={{ display: "block" }}>{p.email}{p.orders ? ` · ${p.orders} order${p.orders > 1 ? "s" : ""}` : ""}{!p.userId ? " · no account yet" : ""}</span></span><span className="ms-tag">{p.role}</span></button>)}</div>
        </div>}
      </div>
      {!preset?.orderId && <div><label htmlFor="ms-subj">Subject (optional)</label><input id="ms-subj" className="ms-in" placeholder="e.g. Wall measurements" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
      <div><label htmlFor="ms-first">Message</label><textarea id="ms-first" className="ms-ta" style={{ width: "100%", height: 110, maxHeight: 220, resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your message" /></div>
      {err && <div className="ms-warn">{err}</div>}
      <div style={{ display: "flex", gap: 6 }}><button type="button" className="ms-btn pri" disabled={busy || (!who && !preset?.orderId) || !text.trim()} onClick={start}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Send</button><button type="button" className="ms-btn" onClick={onCancel}>Cancel</button></div>
    </div>
  </div>;
}

/** The inbox: conversation list on the left (desktop) or list then thread (phone). */
export function Messenger({ admin, initialKey, urlMode, emptyText }: { admin?: boolean; initialKey?: string | null; urlMode?: "search" | "hash"; emptyText?: string }) {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [key, setKey] = useState<string | null>(initialKey ?? null);
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "store" | "project">("all");
  const [composing, setComposing] = useState(false);
  const loadList = useCallback(() => papi("inbox").then((r) => setConvs(r.conversations ?? [])).catch((x) => { setErr(x.message); setConvs([]); }), []);
  const loadThread = useCallback((k: string) => papi("inbox/thread?key=" + encodeURIComponent(k)).then((r) => { setT(r); setConvs((cs) => cs?.map((c) => c.key === k ? { ...c, unread: false } : c) ?? cs); }).catch((x) => { setT({ error: x.message, key: k }); }), []);
  useEffect(() => { void loadList(); const i = setInterval(loadList, 20000); return () => clearInterval(i); }, [loadList]);
  useEffect(() => { if (!key) { setT(null); return; } setT((x: any) => (x?.key === key ? x : null)); void loadThread(key); const i = setInterval(() => loadThread(key), 8000); return () => clearInterval(i); }, [key, loadThread]);
  useEffect(() => {
    if (!urlMode || typeof window === "undefined") return;
    if (urlMode === "hash") { window.history.replaceState(null, "", "#messages" + (key ? ":" + key : "")); return; }
    const u = new URL(window.location.href); if (key) u.searchParams.set("c", key); else u.searchParams.delete("c"); window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  }, [key, urlMode]);
  useEffect(() => { if (urlMode !== "hash") return; const on = () => { const h = window.location.hash; if (h.startsWith("#messages:")) { setComposing(false); setKey(decodeURIComponent(h.slice(10))); } }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, [urlMode]);
  const shown = useMemo(() => (convs ?? []).filter((c) => (filter === "all" || c.kind === filter) && (!q || (c.name + " " + c.sub + " " + c.preview).toLowerCase().includes(q.toLowerCase()))), [convs, q, filter]);
  const open = (k: string) => { setComposing(false); setKey(k); };
  const send = async (text: string, atts: Att[]) => { await papi("inbox/send", { key, body: text, attachments: atts }); await loadThread(key!); void loadList(); };
  const active = convs?.find((c) => c.key === key);
  return <div className={`ms${admin ? " ms-wide" : ""}${key || composing ? " has-open" : ""}`} data-testid="messenger">
    <aside className="ms-list" aria-label="Conversations">
      <div className="ms-list-top">
        <div style={{ position: "relative", flex: 1 }}><Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#9CA3AF" }} /><input className="ms-in" style={{ paddingLeft: 28 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" /></div>
        {admin && <button type="button" className="ms-btn pri" onClick={() => { setKey(null); setComposing(true); }} data-testid="ms-new"><Plus size={15} />New</button>}
      </div>
      {admin && <div className="ms-tabs" role="tablist">{([["all", "All"], ["store", "With the store"], ["project", "Designer chats"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>}
      <div className="ms-items">
        {convs === null ? <div className="ms-empty"><Loader2 size={16} className="animate-spin" /></div> : shown.length === 0 ? <div className="ms-empty">{err || (q ? "No conversations match." : emptyText ?? "No conversations yet.")}</div> :
          shown.map((c) => <button key={c.key} type="button" className={`ms-item${c.key === key ? " on" : ""}${c.unread ? " unread" : ""}`} onClick={() => open(c.key)} data-testid="ms-item">
            <Avatar name={c.initials} store={c.store} />
            <span className="ms-item-main">
              <span className="ms-row"><span className="ms-name">{c.name}</span><span className="ms-time">{listTime(c.at)}</span></span>
              <span className="ms-sub" style={{ display: "block" }}>{c.sub}</span>
              <span className="ms-row" style={{ alignItems: "center" }}><span className="ms-prev">{c.preview}</span>{c.unread && <span className="ms-dot" aria-label="Unread" />}</span>
            </span>
          </button>)}
      </div>
    </aside>
    {composing ? <NewChat onCancel={() => setComposing(false)} onStarted={(k) => { setComposing(false); void loadList(); setKey(k); }} /> :
    <section className="ms-thread" aria-label="Conversation">
      {!key ? <div className="ms-empty" style={{ margin: "auto" }}>{admin ? "Pick a conversation, or start a new one." : "Pick a conversation."}</div> : !t ? <div className="ms-empty" style={{ margin: "auto" }}><Loader2 size={16} className="animate-spin" /></div> : t.error ? <div className="ms-empty" style={{ margin: "auto" }}>{t.error}<div style={{ marginTop: 8 }}><button type="button" className="ms-btn" onClick={() => setKey(null)}>Back</button></div></div> : <>
        <div className="ms-head">
          <button type="button" className="ms-btn ms-icon ms-back" aria-label="Back to conversations" onClick={() => setKey(null)}><ArrowLeft size={16} /></button>
          <Avatar name={t.initials ?? t.name} store={t.store} />
          <div className="ms-head-main"><div className="ms-head-name" data-testid="ms-head-name">{t.name}</div><div className="ms-sub">{t.sub}{t.link ? <> · <a className="ms-link" href={t.link.href}>{t.link.label}</a></> : null}</div></div>
          {admin && t.kind === "store" && /test/i.test((t.sub ?? "") + (active?.sub ?? "")) && <button type="button" className="ms-btn" style={{ height: 26, fontSize: 12 }} onClick={async () => { if (!confirm("Delete this test chat?")) return; await papi("inbox/delete", { key }); setKey(null); void loadList(); }}>Delete</button>}
        </div>
        <ThreadView key={key} messages={t.messages ?? []} after={t.needsBrief && t.projectId ? <BriefForm who={t.name} projectId={t.projectId} onDone={() => { void loadThread(key!); void loadList(); }} /> : null} canWrite={t.canWrite} guarded={t.guarded} showNames={t.readOnly} onSend={send}
          readOnlyNote={t.readOnly ? "You can read this chat between the designer and the customer. To write to one of them, start a new message." : undefined}
          emptyText={t.kind === "store" && !t.store ? "Write the first message." : "No messages yet. Say hello."} />
        {t.noAccount && <div className="ms-ro" style={{ borderTop: 0 }}>{t.email} has no account yet. They get the email (test mode) and see this chat once they sign up with that email.</div>}
      </>}
    </section>}
  </div>;
}

/** Owner: write to the customer of one order (opens the store chat linked to that order). */
export function MessageCustomer({ orderId, name }: { orderId: string; name: string }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState<string | null>(null); const [err, setErr] = useState("");
  const first = String(name || "").split(" ")[0];
  if (!open) return <button type="button" className="ms-btn" style={{ height: 26, fontSize: 12.5 }} data-testid="message-customer" onClick={() => { setOpen(true); setText(`Hi ${first}, a quick question about the wall measurements for your order #${orderId.slice(0, 8).toUpperCase()}: `); }}>Message customer</button>;
  return <div className="ms" style={{ display: "block", height: "auto", minHeight: 0, padding: 10, marginTop: 10 }}>
    {done ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span>Sent to {name}. They get a notification and a test email.</span><a className="ms-btn" style={{ height: 26, fontSize: 12.5 }} href={`/admin#messages:${done}`}>Open the chat</a><button type="button" className="ms-btn" style={{ height: 26, fontSize: 12.5 }} onClick={() => { setDone(null); setText(""); }}>Write more</button></div> : <>
      <div className="ms-sub" style={{ marginBottom: 6 }}>To {name} · as Artisan Mural</div>
      <textarea className="ms-ta" style={{ width: "100%", height: 84, maxHeight: 200, resize: "vertical" }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to the customer" />
      {err && <div className="ms-warn">{err}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}><button type="button" className="ms-btn pri" disabled={busy || !text.trim()} onClick={async () => { setBusy(true); setErr(""); try { const r = await papi("inbox/start", { orderId, body: text }); setDone(r.key); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Send</button><button type="button" className="ms-btn" onClick={() => setOpen(false)}>Cancel</button></div>
    </>}
  </div>;
}
