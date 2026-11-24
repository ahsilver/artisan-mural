import { Fragment, useState, type ReactNode } from "react";
import type { Block, Link2 } from "@/lib/site-pages";

/** Owner text → paragraphs and lists. Lines starting with "- " are a list, a blank line starts a new paragraph,
 *  **bold** is bold and [words](link) is a link. Built from React elements, never raw HTML. */
export function Rich({ text }: { text: string }) {
  const inline = (s: string, key: string): ReactNode[] => {
    const out: ReactNode[] = []; const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0, m: RegExpExecArray | null, i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1]) out.push(<b key={key + i++}>{m[1]}</b>);
      else { const href = /^(https?:\/\/|\/|mailto:|tel:)/.test(m[3]!) ? m[3]! : "#"; out.push(<a key={key + i++} href={href} {...(/^https?:/.test(href) ? { target: "_blank", rel: "noreferrer" } : {})}>{m[2]}</a>); }
      last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  const parts = String(text ?? "").replace(/\r/g, "").split(/\n{2,}/);
  return <>{parts.map((p, k) => {
    const lines = p.split("\n").filter((l) => l.trim());
    if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) return <ul key={k}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${k}-${j}-`)}</li>)}</ul>;
    return <p key={k}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${k}-${j}-`)}</Fragment>)}</p>;
  })}</>;
}

const Btn = ({ l, ghost }: { l?: Link2 | undefined; ghost?: boolean }) => l?.label && l.to ? <a className={ghost ? "btn optline" : "btn btn-wine"} href={l.to} {...(/^https?:/.test(l.to) ? { target: "_blank", rel: "noreferrer" } : {})}>{l.label}</a> : null;

function TrackOrder({ title, text }: { title?: string | undefined; text?: string | undefined }) {
  const [order, setOrder] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null); const [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch("/backend/public/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order, email }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
      setRes(j);
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  };
  return <div className="pb-track">
    {title && <h2 className="sl-h">{title}</h2>}{text && <div className="pb-rich"><Rich text={text} /></div>}
    <form onSubmit={go} className="pb-trackf">
      <label className="rqf"><span>Order number</span><input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="For example 2F67A0D3" required autoComplete="off" /></label>
      <label className="rqf"><span>Email you ordered with</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <button className="btn btn-wine" disabled={busy}>{busy ? "Looking…" : "Track my order"}</button>
    </form>
    {err && <p className="rq-ok err" role="alert">{err}</p>}
    {res && <div className="pb-trackr" role="status">
      <span className="k">Order {res.order}</span><h3>{res.label}</h3>
      <ol className="pb-tsteps">{res.steps.map((s: any) => <li key={s.key} className={s.done ? "done" : s.now ? "now" : ""}>{s.label}</li>)}</ol>
      {res.tracking && <p>{res.carrier} tracking number <b>{res.tracking}</b>{res.trackingLink && <> · <a href={res.trackingLink} target="_blank" rel="noreferrer">Track the package</a></>}</p>}
      {res.updated && <small>Last update {new Date(res.updated).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</small>}
    </div>}
  </div>;
}

export function PageBlocks({ blocks, contact }: { blocks: Block[]; contact?: { email?: string; phone?: string } }) {
  return <>{blocks.map((b, i) => {
    switch (b.type) {
      case "hero": return <section key={i} className={"pb-hero" + (b.image ? "" : " plain")}>
        {b.image && <img src={b.image} alt="" />}
        <div className="pb-hero-in pg">{b.kicker && <span className="k">{b.kicker}</span>}<h1>{b.title}</h1>{b.text && <p>{b.text}</p>}{b.button?.label && <div className="sl-cta"><Btn l={b.button} /></div>}</div>
      </section>;
      case "text": return <section key={i} className="pg pb-sec pb-text">{b.title && <h2 className="sl-h">{b.title}</h2>}<div className="pb-rich"><Rich text={b.text} /></div></section>;
      case "imageText": return <section key={i} className={"pg pb-sec pb-it" + (b.side === "right" ? " r" : "")}>
        {b.image ? <img src={b.image} alt="" loading="lazy" /> : <span />}
        <div>{b.title && <h2 className="sl-h">{b.title}</h2>}<div className="pb-rich"><Rich text={b.text} /></div>{b.button?.label && <div className="sl-cta"><Btn l={b.button} /></div>}</div>
      </section>;
      case "steps": return <section key={i} className="pg pb-sec">{b.title && <h2 className="sl-h">{b.title}</h2>}
        <ol className="pb-steps">{b.items.filter((s) => s.title || s.text).map((s, k) => <li key={k}>{s.image && <img src={s.image} alt="" loading="lazy" />}<span className="pb-n">{k + 1}</span><b>{s.title}</b>{s.text && <div className="pb-rich"><Rich text={s.text} /></div>}</li>)}</ol></section>;
      case "faq": return <section key={i} className="pg pb-sec">{b.title && <h2 className="sl-h">{b.title}</h2>}
        <div className="faq">{b.items.filter((q) => q.q).map((q, k) => <details key={k}><summary>{q.q}</summary><div className="pb-rich"><Rich text={q.a} /></div></details>)}</div></section>;
      case "pictures": return <section key={i} className="pg pb-sec">{b.title && <h2 className="sl-h">{b.title}</h2>}
        <div className="pb-pics">{b.items.filter((p) => p.image).map((p, k) => { const inner = <><img src={p.image} alt="" loading="lazy" />{p.caption && <span>{p.caption}</span>}</>; return p.to ? <a key={k} href={p.to}>{inner}</a> : <div key={k}>{inner}</div>; })}</div></section>;
      case "button": return <section key={i} className="pg pb-sec pb-btns"><Btn l={b.button} /><Btn l={b.second} ghost /></section>;
      case "trackOrder": return <section key={i} className="pg pb-sec"><TrackOrder title={b.title} text={b.text} /></section>;
      case "contact": { const email = b.email || contact?.email, phone = b.phone || contact?.phone;
        return <section key={i} className="pg pb-sec pb-contact">{b.title && <h2 className="sl-h">{b.title}</h2>}{b.text && <div className="pb-rich"><Rich text={b.text} /></div>}
          <div className="pb-cgrid">{email && <a href={`mailto:${email}`}><span className="k">Email</span><b>{email}</b></a>}{phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><span className="k">Phone</span><b>{phone}</b></a>}{b.hours && <div><span className="k">Hours</span><b>{b.hours}</b></div>}<a href="/messages"><span className="k">Message</span><b>Send us a message →</b></a></div></section>; }
      default: return null;
    }
  })}</>;
}
