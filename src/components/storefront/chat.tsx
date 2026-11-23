import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachFile, papi, type Att } from "@/components/projects";
import { findContactDetails } from "@/lib/contact-guard";
import type { Conv, Msg } from "@/components/messenger";

/** Customer / designer chat in the approved preview's design (#view-chat): thread list beside the chat on computers,
 *  list then chat on phones (back arrow), photo attachments, ✓ sent / ✓✓ read ticks, the "what should change" form
 *  at the start of a change request. Same inbox API as before. */
const ini = (n: string) => { const w = String(n || "?").replace(/\(.*?\)/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "?") + (w.length > 1 ? w[w.length - 1]![0] : "")).toUpperCase(); };
const listTime = (iso: string) => { if (!iso) return ""; const d = new Date(iso), n = new Date(); if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); if (n.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString("en-US", { weekday: "short" }); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => { const d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); return d.toDateString() === t.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
const AV_COLORS = ["#5E7A55", "#3F4F63", "#9C7A45", "#5B2130", "#D2654F", "#2B1A1F", "#71508C"];
const avColor = (s: string) => AV_COLORS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % AV_COLORS.length];

function Special({ body }: { body: string }) {
  let d: any = null; try { d = JSON.parse(body.slice(7)); } catch { return <div className="bub">{body}</div>; }
  if (body.startsWith("::card ")) return <a className="bub card" href={d.link}>{d.thumb ? <img src={d.thumb} alt={d.title} /> : null}<span className="cbody"><b>{d.title}</b><small>{d.sku ? `Item # ${d.sku} · ` : ""}See the design ›</small></span></a>;
  return <div className="bub chg-sum"><b>Request details</b>{d.room && <small>Room: {d.room}</small>}{d.wallSize && <small>Wall: {d.wallSize}</small>}<span>{d.change}</span>{d.notes && <small>{d.notes}</small>}</div>;
}

function ChangeForm({ projectId, who, onDone, onSkip }: { projectId: string; who: string; onDone: () => void; onSkip: () => void }) {
  const [text, setText] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState("");
  const [atts, setAtts] = useState<Att[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const warn = findContactDetails(text);
  return (
    <form className="ct-req" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      if (text.trim().length < 5) { setErr("Tell the designer what to change."); return; }
      if (warn) { setErr(`Please remove ${warn}. Contact details can't be shared.`); return; }
      setBusy(true);
      try { await papi(`projects/${projectId}/brief`, { room: "", change: text.trim(), wallSize: w && h ? `${w} x ${h} ft` : "", notes: "", attachments: atts }); onDone(); } catch (x: any) { setErr(x.message || "Could not send."); }
      setBusy(false);
    }}>
      <button type="button" className="ct-req-x" aria-label="Close the form and just write a message" onClick={onSkip}>✕</button>
      <b className="ct-req-h">What should {who.split(" ")[0]} change?</b>
      <div className="qchips" role="group" aria-label="Quick requests">
        {[["Remove something", "Please remove "], ["Change colors", "Could you change the colors to "], ["Resize", "Please make bigger: "], ["Add something", "Could you add "]].map(([l, t]) => <button key={l} type="button" onClick={() => setText((x) => (x ? x : t!))}>{l}</button>)}
      </div>
      <div className="chg-row"><input type="number" min={2} max={60} step={0.5} placeholder="Wall width (ft)" aria-label="Wall width in feet" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /><input type="number" min={2} max={20} step={0.5} placeholder="Wall height (ft)" aria-label="Wall height in feet" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></div>
      <label className="chg-photo"><input type="file" accept="image/*" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; try { for (const f of fs) { const a = await attachFile(f); setAtts((x) => [...x, a]); } } catch (x: any) { setErr(x.message); } }} /><span>{atts.length ? `${atts.length} photo${atts.length > 1 ? "s" : ""} added` : "Photos"}</span></label>
      <label className="sr" htmlFor="chMsg">What would you like changed?</label>
      <textarea id="chMsg" rows={2} placeholder="E.g. remove the hippo, warmer sky" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="ct-req-foot"><button className="btn btn-wine" type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>{err && <div className="ch-ok" role="alert">{err}</div>}</div>
    </form>
  );
}

/** Price inside the chat. Designer: "Send a price" (amount, days, note). Customer: the price as an offer card with
 *  Approve / Decline; once approved, a Pay button (the request's pay page: wall size, paper, design + print together). */
function PricePanel({ projectId, onChange }: { projectId: string; onChange: () => void }) {
  const [pr, setPr] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [fee, setFee] = useState(""); const [days, setDays] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = useCallback(() => papi(`projects/${projectId}`).then(setPr).catch(() => setPr(null)), [projectId]);
  useEffect(() => { void load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  if (!pr) return null;
  const money = (n: any) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const act = async (path: string, body: any) => { setBusy(true); setErr(""); try { await papi(`projects/${projectId}/${path}`, body); setOpen(false); setFee(""); setDays(""); setNote(""); await load(); onChange(); } catch (x: any) { setErr(x.message || "Something went wrong."); } setBusy(false); };
  const quotes: any[] = pr.quotes ?? [];
  const sent = quotes.filter((q) => q.status === "sent");
  const accepted = quotes.find((q) => q.status === "accepted");
  const designer = pr.myRole === "designer";
  const canQuote = designer && ["requested", "quoted"].includes(pr.status);
  return (
    <div className="ct-price">
      {pr.status === "approved" && accepted && (designer
        ? <div className="offer"><span className="ot">Price approved</span><span className="op">{money(accepted.fee)}</span><p>The customer approved your price. Work starts when they pay; you'll get a notification and an email.</p></div>
        : <div className="offer"><span className="ot">Price approved</span><span className="op">{money(accepted.fee)}</span><p>Next: enter your wall size and paper, then pay the design and the print together. The designer starts as soon as you pay.</p><div className="ob"><a className="btn btn-wine btn-sm" href={`/projects/${projectId}/pay`}>Pay {money(accepted.fee)} + print</a></div></div>)}
      {pr.status === "in_progress" && <div className="offer"><span className="ot">Paid ✓</span><p>{designer ? `Deliver the final file${pr.order?.dueAt ? ` by ${new Date(pr.order.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.` : "The designer is working on it. You'll get a notification when it's ready."}</p></div>}
      {pr.status === "delivered" && <div className="offer"><span className="ot">Finished ✓</span><p>{designer ? "Delivered. The studio prepares it for printing." : "Your design is finished. We're getting it ready to print."}</p></div>}
      {(pr.status === "requested" || pr.status === "quoted") && sent.map((q) => (
        <div key={q.id} className="offer">
          <span className="ot">{designer ? "Your price · waiting for the customer" : `Price offer from ${q.designer}`}</span>
          <span className="op">{money(q.fee)}</span>
          <p>Ready in {q.days} day{Number(q.days) === 1 ? "" : "s"}.{q.note ? ` ${q.note}` : ""} Printing is priced separately by your wall size.</p>
          {!designer && <div className="ob"><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={() => void act("approve", { quote: q.id })}>Approve price</button><button type="button" className="btn btn-sm optline" disabled={busy} onClick={() => void act("decline", { quote: q.id })}>Decline</button></div>}
        </div>
      ))}
      {canQuote && (open ? (
        <form className="offer ct-quote" onSubmit={(e) => { e.preventDefault(); const f = Number(fee), d = Number(days); if (!(f > 0)) { setErr("Enter your price."); return; } if (!(d >= 1)) { setErr("How many days will it take?"); return; } void act("quote", { fee: f, days: Math.round(d), note: note.trim() }); }}>
          <span className="ot">{sent.length ? "Send a new price" : "Send a price"}</span>
          <div className="chg-row"><label><span className="sr">Price in dollars</span><input type="number" min={1} step={1} inputMode="decimal" placeholder="Price ($)" value={fee} onChange={(e) => setFee(e.target.value)} /></label><label><span className="sr">Days</span><input type="number" min={1} max={120} step={1} inputMode="numeric" placeholder="Ready in (days)" value={days} onChange={(e) => setDays(e.target.value)} /></label></div>
          <label><span className="sr">What's included</span><textarea rows={2} maxLength={600} placeholder="What's included (optional), e.g. one sketch, two rounds of changes" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {pr.commissionPct != null && Number(fee) > 0 && <p>You receive {money(Number(fee) * (1 - pr.commissionPct / 100))} after the {pr.commissionPct}% commission.</p>}
          <div className="ob"><button className="btn btn-wine btn-sm" type="submit" disabled={busy}>{busy ? "Sending…" : "Send price to the customer"}</button><button type="button" className="btn btn-sm optline" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      ) : <button type="button" className="btn btn-wine btn-sm ct-quote-btn" onClick={() => setOpen(true)}>{sent.length ? "Change my price" : "Send a price"}</button>)}
      {err && <p className="ct-note err" role="alert">{err}</p>}
    </div>
  );
}

export function StoreChat({ initialKey, emptyText = "No messages yet. Chats with designers and with Artisan Murals show up here." }: { initialKey?: string | null; emptyText?: string }) {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [key, setKey] = useState<string | null>(initialKey ?? null);
  const [listMode, setListMode] = useState(!initialKey);
  const [t, setT] = useState<any>(null);
  const [text, setText] = useState(""); const [atts, setAtts] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [skip, setSkip] = useState<Record<string, boolean>>({});
  const msgsRef = useRef<HTMLDivElement>(null);
  const loadList = useCallback(() => papi("inbox").then((r) => { const cs: Conv[] = r.conversations ?? []; setConvs(cs); setKey((k) => k ?? (typeof window !== "undefined" && innerWidth > 860 ? cs[0]?.key ?? null : null)); }).catch(() => setConvs([])), []);
  const loadThread = useCallback((k: string) => papi("inbox/thread?key=" + encodeURIComponent(k)).then((r) => { setT(r); setConvs((cs) => cs?.map((c) => (c.key === k ? { ...c, unread: false } : c)) ?? cs); }).catch((x) => setT({ error: x.message, key: k })), []);
  useEffect(() => { void loadList(); const i = setInterval(loadList, 20000); return () => clearInterval(i); }, [loadList]);
  useEffect(() => { if (!key) { setT(null); return; } setT((x: any) => (x?.key === key ? x : null)); void loadThread(key); const i = setInterval(() => loadThread(key), 8000); return () => clearInterval(i); }, [key, loadThread]);
  useEffect(() => { if (typeof window === "undefined") return; const u = new URL(window.location.href); if (key) u.searchParams.set("c", key); else u.searchParams.delete("c"); window.history.replaceState(null, "", u.pathname + u.search + u.hash); }, [key]);
  useEffect(() => { const el = msgsRef.current; if (el) el.scrollTop = el.scrollHeight; }, [t?.messages?.length, key]);
  const msgs: Msg[] = t?.messages ?? [];
  const lastOther = useMemo(() => { let i = -1; msgs.forEach((m, k) => { if (!m.mine) i = k; }); return i; }, [msgs]);
  const warn = text ? findContactDetails(text) : null;
  async function send(e?: React.FormEvent) {
    e?.preventDefault(); if (!key || busy || (!text.trim() && !atts.length)) return;
    if (t?.guarded && warn) { setErr(`This looks like ${warn}. Contact details can't be shared here.`); return; }
    setBusy(true); setErr("");
    try { await papi("inbox/send", { key, body: text.trim(), attachments: atts }); setText(""); setAtts([]); await loadThread(key); void loadList(); } catch (x: any) { setErr(x.message || "Could not send."); }
    setBusy(false);
  }
  const open = (k: string) => { setKey(k); setListMode(false); setSkip((s) => s); };
  const conv = convs?.find((c) => c.key === key);
  return (
    <div className={"chat" + (listMode ? " list-mode" : "")} id="ctChat">
      <aside className="inbox" aria-label="Your conversations">
        <div className="inbox-h"><b>Messages</b><a href="/projects">My requests</a></div>
        <div id="ctThreads">
          {convs === null ? <p className="ct-empty">Loading…</p> : convs.length === 0 ? <p className="ct-empty">{emptyText}</p> :
            convs.map((c) => (
              <button key={c.key} type="button" className={"thread" + (c.unread ? " unread" : "")} aria-current={c.key === key} onClick={() => open(c.key)}>
                <span className="av" style={{ background: c.store ? "#201D1D" : avColor(c.initials || c.name) }}>{ini(c.initials || c.name)}</span>
                <span><b>{c.name}</b><small>{c.sub}{c.preview ? ` · ${c.preview}` : ""}</small></span>
                <time>{listTime(c.at)}</time>
              </button>
            ))}
        </div>
      </aside>
      <div className="ct-main">
        {!key ? <div className="ct-empty big">Pick a conversation.</div> : !t ? <div className="ct-empty big">Loading…</div> : t.error ? <div className="ct-empty big">{t.error}</div> : (
          <>
            <header className="ct-head">
              <button type="button" className="ct-back" aria-label="All chats" onClick={() => setListMode(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
              <span className="av" style={{ background: t.store ? "#201D1D" : avColor(t.initials ?? t.name) }}>{ini(t.initials ?? t.name)}</span>
              <div><b>{t.name}</b><small>{t.sub}{t.link ? <> · <a href={t.link.href}>{t.link.label}</a></> : null}</small></div>
              {t.projectId && <div className="ct-reqs"><a className="ct-reqs-btn" href={`/projects/${t.projectId}`}>Request &amp; price</a></div>}
            </header>
            <div className="ct-msgs" ref={msgsRef} aria-live="polite">
              {msgs.length === 0 && <p className="ct-note">{t.kind === "store" ? "Write the first message." : "No messages yet. Say hello."}</p>}
              {msgs.map((m, i) => {
                const prev = msgs[i - 1]; const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
                const tick = m.mine ? (i < lastOther ? " read" : lastOther >= 0 ? " dlv" : "") : "";
                return (
                  <div key={m.id} style={{ display: "contents" }}>
                    {newDay && <div className="ct-day">{dayLabel(m.at)}</div>}
                    <div className={"msg" + (m.mine ? " me" + tick : "")}>
                      {m.body && (m.body.startsWith("::card ") || m.body.startsWith("::form ")) ? <Special body={m.body} /> : m.body ? <div className="bub">{m.body}</div> : null}
                      {!!m.files?.length && <div className={`bub pics pics-${Math.min(4, m.files.length)}`}>{m.files.map((f, k) => f.image && f.url ? <a key={k} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} /></a> : <a key={k} className="ct-file" href={f.url ?? undefined} target="_blank" rel="noreferrer">{f.name}</a>)}</div>}
                      <time>{clock(m.at)}</time>
                    </div>
                  </div>
                );
              })}
            </div>
            {t.projectId && !(t.needsBrief && !skip[key]) && <PricePanel projectId={t.projectId} onChange={() => { void loadThread(key); void loadList(); }} />}
            {t.needsBrief && t.projectId && !skip[key] ? (
              <ChangeForm projectId={t.projectId} who={t.name} onDone={() => { void loadThread(key); void loadList(); }} onSkip={() => setSkip((s) => ({ ...s, [key]: true }))} />
            ) : t.canWrite ? (
              <form className="ct-compose" onSubmit={send}>
                <label className="ct-att" title="Add photos"><input type="file" accept="image/*,application/pdf" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; try { for (const f of fs) { const a = await attachFile(f); setAtts((x) => [...x, a]); } } catch (x: any) { setErr(x.message); } }} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5 12.6 19.9a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg><span className="sr">Add photos</span></label>
                <label htmlFor="ctInput" className="sr">Write a message</label>
                <textarea id="ctInput" rows={1} placeholder={atts.length ? `${atts.length} photo${atts.length > 1 ? "s" : ""} ready · add a message…` : "Write a message…"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(min-width: 768px)").matches) { e.preventDefault(); void send(); } }} />
                <button className="btn btn-wine" type="submit" disabled={busy || (!text.trim() && !atts.length)}>{busy ? "…" : "Send"}</button>
              </form>
            ) : <p className="ct-note">This conversation is closed.</p>}
            {(err || (t.guarded && warn)) && <p className="ct-note err" role="alert">{err || `This looks like ${warn}. Contact details can't be shared here.`}</p>}
            {t.guarded && <p className="ct-note">Phone numbers and emails are hidden to keep you protected.</p>}
            {conv?.unread && null}
          </>
        )}
      </div>
    </div>
  );
}
