import { createFileRoute, Link } from "@tanstack/react-router";
import { loadSite } from "@/lib/site-settings";
import { PRO_DEFAULTS, useProMe } from "@/lib/pro";

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
  const benefits: [string, string][] = [
    [`${pro.discountPct}% off every order`, "Your professional price is applied automatically in the cart and at checkout, on every design and finish."],
    ...(pro.freeSamples ? [["Free samples", "Order printed samples of any design and finish at no cost, so clients can feel the material before they decide."] as [string, string]] : []),
    ["Priority production", "Pro orders move to the front of the print queue, with tracked shipping on every order."],
    ["A dedicated specialist", "One person who knows your projects: sizing, panel layouts, finishes and timelines."],
    ["Project quotes", "Multi-room, multi-wall and commercial jobs quoted in one place, with custom sizes and colorways."],
    ["Made to measure", "Every wall printed to its exact size, in numbered panels, with print files checked by hand."],
  ];
  const faq: [string, string][] = [
    ["Who can apply?", "Interior designers, architects, contractors and installers, home stagers, developers and property managers, and buyers for hotels, restaurants, offices, senior living and healthcare."],
    ["What does it cost?", `Nothing. ${pro.name} is free to join and there is no minimum order.`],
    ["How long does approval take?", `We review every application by hand, usually within ${pro.approvalDays}. You'll get an email as soon as you're approved.`],
    ["What do I need to apply?", "Your business name, your role, a website, Instagram or portfolio, and your business address and phone. A resale certificate or tax ID is optional but speeds things up."],
    ["How does the discount work?", "Once approved, sign in with the same account. Your discount shows in the cart and is applied at checkout automatically."],
    ["Can I order for a client's address?", "Yes. Ship to any address, and save several addresses in your account for different projects."],
    ["Do you handle commercial projects?", "Yes. Offices, hallways, lobbies, hotels, senior living and healthcare spaces. Ask your specialist about commercial-grade finishes and project quotes."],
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const ic = (d: string) => <span className="pb-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></span>;
  const icons = ["M20 12l-8 8-8-8V4h8z M8 8h.01", "M4 4h16v16H4z M4 10h16", "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6", "M4 6h16 M4 12h16 M4 18h10", "M3 7h18v13H3z M8 7V4h8v3"];
  const cta = approved ? <Link className="btn btn-wine" to="/browse">Shop with your {pro.discountPct}% price</Link>
    : pending ? <Link className="btn sl-ghost" to="/account">Application received · view status</Link>
    : <Link className="btn btn-wine" to="/pro/apply">Apply now</Link>;
  return (
    <div className="am">
      <section className="pro-hero">
        <img src="/p/img/cover-hotel.webp" alt="A designer mural in a hotel lobby" />
        <div className="pro-hero-in pg"><span className="k">{pro.name} · for design professionals</span><h1>For the people who <span>design the room.</span></h1>
          <p>Interior designers, architects and hospitality teams get trade pricing, free samples and one specialist for every project.</p>
          <div className="sl-cta">{cta}<a className="btn sl-ghost" href="#pro-how">How it works</a></div>
          <small>Free to join · no minimum order · approval in {pro.approvalDays}</small></div>
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
        <div className="pro-how" id="pro-how"><span className="k">How it works</span><h2 className="sl-h">Three steps to trade pricing</h2>
          <ol className="pro-steps"><li><b>Apply</b><span>Tell us about your business. About three minutes.</span></li><li><b>Get approved</b><span>We review it by hand, usually within {pro.approvalDays}.</span></li><li><b>Order at your price</b><span>Sign in and your discount applies to every order and sample.</span></li></ol></div>
        <div className="pro-bottom">
          <div className="pro-faqw" id="faq"><h2 className="sl-h">Questions</h2><div className="faq">{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>
          {!approved && (
            <div className="apply-form pro-applycard"><div className="pro-fh"><span className="k">Free to join</span><h2>Apply to {pro.name}</h2><p>About three minutes. We confirm by email, usually within {pro.approvalDays}.</p></div>
              <ul className="pro-need"><li>Your business name and role</li><li>A website, Instagram or portfolio</li><li>Business address and phone</li><li>Resale certificate or tax ID (optional, speeds things up)</li></ul>
              {pending ? <Link className="btn btn-wine big" to="/account">View your application</Link> : <Link className="btn btn-wine big" to="/pro/apply">Start your application</Link>}</div>
          )}
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
