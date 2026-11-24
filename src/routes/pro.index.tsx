import { createFileRoute, Link } from "@tanstack/react-router";
import { loadSite } from "@/lib/site-settings";
import { PRO_DEFAULTS, useProMe } from "@/lib/pro";
import { pageText, pageList } from "@/lib/page-texts";

export const Route = createFileRoute("/pro/")({
  head: () => ({ meta: [
    { title: "For design professionals | Artisan Mural" },
    { name: "description", content: "A free program for interior designers, architects, contractors, stagers and hospitality and healthcare buyers: professional pricing, free samples, priority production and a dedicated specialist." },
    { property: "og:title", content: "For design professionals | Artisan Mural" },
    { property: "og:description", content: "Professional pricing, free samples, priority production and project quotes for the trade." },
    { property: "og:type", content: "website" },
  ] }),
  loader: async () => ({ site: (await loadSite()) as any }),
  component: ProPage,
});

function ProPage() {
  const { site } = Route.useLoaderData();
  const pro = { ...PRO_DEFAULTS, ...(site?.pro ?? {}) };
  const { me } = useProMe();
  const approved = me?.status === "approved", pending = me?.status === "pending";
  // every text on this page can be changed in Back office → Page texts
  const vars = { name: pro.name, pct: pro.discountPct, days: pro.approvalDays };
  const T = (k: string) => pageText(site?.texts, "pro", k, vars), L = (k: string) => pageList(site?.texts, "pro", k, vars);
  const benefits = L("benefits").filter(([t]) => pro.freeSamples || !/^free samples/i.test(t!)).map(([t, d]) => [t!, d ?? ""] as [string, string]);
  const faq = L("faq").map(([q, a]) => [q!, a ?? ""] as [string, string]);
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const ic = (d: string) => <span className="pb-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></span>;
  const icons = ["M20 12l-8 8-8-8V4h8z M8 8h.01", "M4 4h16v16H4z M4 10h16", "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6", "M4 6h16 M4 12h16 M4 18h10", "M3 7h18v13H3z M8 7V4h8v3"];
  const cta = approved ? <Link className="btn btn-wine" to="/browse">Shop with your {pro.discountPct}% price</Link>
    : pending ? <Link className="btn sl-ghost" to="/account">Application received · view status</Link>
    : <Link className="btn btn-wine" to="/pro/apply">Apply now</Link>;
  return (
    <div className="am">
      <section className="pro-hero">
        <img src={T("heroImage")} alt="A designer mural in a hotel lobby" />
        <div className="pro-hero-in pg"><span className="k">{T("heroKicker")}</span><h1>{T("heroTitle")} <span>{T("heroAccent")}</span></h1>
          <p>{T("heroText")}</p>
          <div className="sl-cta">{cta}<a className="btn sl-ghost" href="#pro-how">How it works</a></div>
          <small>{T("heroNote")}</small></div>
      </section>
      <section className="pg pro-strip" aria-label="Member benefits at a glance">
        <div><b>{pro.discountPct}%</b><span>off every order</span></div>{pro.freeSamples && <div><b>Free</b><span>samples, any finish</span></div>}<div><b>1</b><span>dedicated specialist</span></div><div><b>Priority</b><span>production</span></div>
      </section>
      <section className="pg sec pro-wrap">
        <div className="pro-ben">{benefits.map(([t, d], k) => <div key={t}>{ic(icons[k % icons.length]!)}<b>{t}</b><p>{d}</p></div>)}</div>
        <div className="pro-spaces">
          <Link to="/browse" search={{ room: "Commercial" }}><img src="/p/img/cover-restaurant.webp" alt="" loading="lazy" /><span>Hotels &amp; restaurants</span></Link>
          <Link to="/browse" search={{ room: "Office & study" }}><img src="/p/img/cover-office.webp" alt="" loading="lazy" /><span>Offices</span></Link>
          <Link to="/browse" search={{ room: "Living room" }}><img src="/p/img/cover-living-room.webp" alt="" loading="lazy" /><span>Residential projects</span></Link>
        </div>
        <div className="pro-how" id="pro-how"><span className="k">How it works</span><h2 className="sl-h">{T("howTitle")}</h2>
          <ol className="pro-steps">{L("steps").map(([t, d], k) => <li key={k}><b>{t}</b><span>{d}</span></li>)}</ol></div>
        <div className="pro-bottom">
          <div className="pro-faqw" id="faq"><h2 className="sl-h">{T("faqTitle")}</h2><div className="faq">{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>
          {!approved && (
            <div className="apply-form pro-applycard"><div className="pro-fh"><span className="k">Free to join</span><h2>{T("applyTitle")}</h2><p>{T("applyText")}</p></div>
              <ul className="pro-need">{L("applyNeed").map(([t], k) => <li key={k}>{t}</li>)}</ul>
              {pending ? <Link className="btn btn-wine big" to="/account">View your application</Link> : <Link className="btn btn-wine big" to="/pro/apply">Start your application</Link>}</div>
          )}
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
