import { useEffect, useState } from "react";
import { loadSite } from "@/lib/site-settings";
import { siteFooter, type Footer } from "@/lib/site-pages";
import { backend } from "@/lib/pro";
import { BrandLogo } from "@/components/brand-logo";

/** The approved preview's footer. Columns, links, the sign-up box, social links and the bottom row are all
 *  edited in Back office → Footer; until then the ready-written footer shows. */
const SOCIAL: [keyof Footer["social"], string, string][] = [
  ["instagram", "Instagram", "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M17.5 6.5h.01"],
  ["pinterest", "Pinterest", "M12 3a9 9 0 0 0-3.3 17.4c-.1-.8-.1-1.9 0-2.7l1.1-4.6s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.3 0 .8-.5 2-.8 3.1-.2 1 .5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.2 0 .8.3 1.7.7 2.2l.1.4-.3 1c0 .2-.2.2-.4.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.1-5.1 6.1-1 0-1.9-.5-2.2-1.1l-.6 2.3c-.2.8-.8 1.9-1.2 2.6A9 9 0 1 0 12 3z"],
  ["facebook", "Facebook", "M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1z"],
  ["tiktok", "TikTok", "M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5 M14 3c.4 2.5 2.2 4.3 5 4.5"],
];

function Sub({ f }: { f: Footer }) {
  const [email, setEmail] = useState(""); const [done, setDone] = useState(""); const [busy, setBusy] = useState(false);
  return <div className="sub"><h4>{f.subscribe.title}</h4><p>{f.subscribe.text}</p>
    {done ? <p role="status"><b>{done}</b></p> : <form className="fsub" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { const r = await backend("pro/first-order", { email, page: typeof location !== "undefined" ? location.pathname : "/", source: "footer" }); setDone(r?.code ? `You're on the list. Your first-order code: ${r.code}` : "You're on the list."); }
      catch (x: any) { setDone(x.message || "Thanks, you're on the list."); }
      setBusy(false);
    }}><label htmlFor="fem"><span className="sr">Email address</span><input id="fem" type="email" required placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="btn btn-wine" disabled={busy}>{busy ? "…" : "Sign up"}</button></form>}
  </div>;
}

export function SiteFooter() {
  const [f, setF] = useState<Footer>(() => siteFooter(null));
  useEffect(() => { loadSite().then((s: any) => setF(siteFooter(s?.footer))).catch(() => {}); }, []);
  const social = SOCIAL.filter(([k]) => f.social[k]);
  return (
    <div className="am">
      <footer>
        <div className="pg">
          <div className="fcols">
            {f.cols.map((c, i) => <div key={i}><h4>{c.title}</h4><ul>{c.links.filter((l) => l.label && l.to).map((l, k) => <li key={k}><a href={l.to}>{l.label}</a></li>)}</ul></div>)}
            {f.subscribe.on && <Sub f={f} />}
          </div>
        </div>
        {social.length > 0 && <div className="social pg">{social.map(([k, label, d]) => <a key={k} href={f.social[k]} target="_blank" rel="noreferrer" aria-label={label}><svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg></a>)}</div>}
        <div className="fbase pg">
          <div className="l"><BrandLogo showWord={false} monoClass="h-[30px] w-[30px]" />© {new Date().getFullYear()} Artisan Murals. All rights reserved.</div>
          <ul>{f.base.filter((l) => l.label && l.to).map((l, k) => <li key={k}><a href={l.to}>{l.label}</a></li>)}</ul>
        </div>
      </footer>
    </div>
  );
}
