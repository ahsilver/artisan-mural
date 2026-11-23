import { createFileRoute, Link } from "@tanstack/react-router";
import { loadSite } from "@/lib/site-settings";
import { parseFaq, termsFrom, faqTokens, fillTokens } from "@/lib/designer-faq";

export const Route = createFileRoute("/designers/how-it-works")({
  head: () => ({ meta: [
    { title: "How it works for designers: questions and answers | Artisan Murals" },
    { name: "description", content: "How selling wallpaper and murals on Artisan Murals works: signing up, uploading print files, studio review, how customers order, royalties, custom work and payouts." },
    { property: "og:title", content: "How it works for designers | Artisan Murals" },
    { property: "og:description", content: "Everything a designer needs to know: uploads, review, orders, royalties and payouts." },
    { property: "og:type", content: "website" },
  ] }),
  loader: async () => ({ site: (await loadSite()) as any }),
  component: HowItWorks,
});

const DEFAULT_INTRO = "You create the design. We print it to the exact size of each customer's wall, ship it, and pay you for every square foot sold. Here is every step, and the answers to the questions designers ask us most.";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function HowItWorks() {
  const { site } = Route.useLoaderData();
  const terms = termsFrom(site?.designerTerms);
  const tk = faqTokens(terms);
  const groups = parseFaq(site?.designerFaq?.faq).map((g) => ({ ...g, items: g.items.map((i) => ({ q: fillTokens(i.q, tk), a: fillTokens(i.a, tk) })) }));
  const intro = (site?.designerFaq?.intro ?? "").trim() || DEFAULT_INTRO;
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const steps: [string, string][] = [
    ["Create your account", "Sign up with your name, email and a password, then fill in one short profile: country, styles, a short bio, a portfolio link and your PayPal email for payouts."],
    ["Upload your design", `Choose mural or repeating pattern, upload the full-resolution print file for each color (up to 6), set the size, and pick the style, theme and rooms it suits.`],
    ["Check it and send it", "Repeating patterns get a seamless edge check. We place your design in rooms at real size, then you send it to the studio."],
    ["Studio review", `The studio looks at every design by hand.${tk.review_time ? ` Most reviews are done within ${tk.review_time}.` : ""} Approved designs go live with their own page and appear in the shop categories you picked.`],
    ["Customers order", "Customers enter their wall size, see your design at true scale in 52 in panels, try it on a photo of their own wall, pick a color and finish, and order."],
    ["You get paid", `You earn ${tk.royalty_starter} to ${tk.royalty_atelier} per sq ft sold, plus ${tk.designer_share} of any custom work. Cash out to PayPal or take store credit.`],
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: groups.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } }))) };
  return (
    <div className="am">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/sell">Sell your art</Link><span>/</span><b>How it works</b></nav></div>
      <section className="pg sec">
        <div className="dir-head"><div><span className="k">For designers</span><h1>How it works for designers</h1><p>{intro}</p></div><div className="up-row"><Link className="btn btn-wine" to="/become-designer">Start your application</Link><Link className="btn optline" to="/studio">Sign in to your studio</Link></div></div>
      </section>
      <section className="pg sec"><div className="sl-two"><div><span className="k">Step by step</span><h2 className="sl-h">From your file to their wall.</h2>
        <ol className="sl-steps">{steps.map(([t, b]) => <li key={t}><b>{t}</b><span>{b}</span></li>)}</ol></div>
        <div className="hiw-side">
          <div className="st-card"><b>Mural</b><p className="hint">One picture made for a whole wall. Sold at the size you made it for; a designer can adapt it for a bigger wall.</p></div>
          <div className="st-card"><b>Repeating pattern</b><p className="hint">A tile that repeats across the wall, straight or half-drop. Covers any wall size.</p></div>
          <div className="st-card"><b>Print files</b><ul className="hiw-list">{[`JPG, PNG, TIFF, PSD or PDF, up to ${tk.max_upload_gb} GB each`, `Printed at ${tk.target_dpi} DPI: wall size = pixels ÷ ${tk.target_dpi}`, "Up to 6 colors, one file per color", "Upload, or bring files in from a shared Google Drive folder"].map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div></div></section>
      <section className="pg sec"><span className="k">How you earn</span><h2 className="sl-h">Royalties on every square foot.</h2>
        <div className="stats">{[["Starter", tk.royalty_starter, "From your first square foot sold"], ["Studio", tk.royalty_studio, "Once 2,500 sq ft of your designs have sold"], ["Atelier", tk.royalty_atelier, "From 5,000 sq ft sold"], ["Custom work", tk.designer_share, "Of every custom job is yours"]].map(([n, v, s]) => <div key={n} className="stat"><b>{v}</b><small>{n} · {s}</small></div>)}</div>
        <p className="hint">Example: a 10 × 10 ft wall is 100 sq ft, so {tk.example_royalty} at the starting rate. An example, not a promise of sales. Cash out to PayPal from your Earnings page, or take store credit.</p>
      </section>
      <section className="pg sec" id="faq"><span className="k">Questions and answers</span><h2 className="sl-h">Designer FAQ <small className="hint">({count})</small></h2>
        {groups.length > 1 && <nav className="frow" aria-label="FAQ topics">{groups.map((g) => g.title && <a key={g.title} className="fchip" href={`#${slug(g.title)}`}>{g.title}</a>)}</nav>}
        {groups.map((g, gi) => <div key={gi} id={g.title ? slug(g.title) : undefined} className="hiw-group">{g.title && <h3>{g.title}</h3>}<div className="faq">{g.items.map((it, i) => <details key={i}><summary>{it.q}</summary><p>{it.a}</p></details>)}</div></div>)}
        <p className="hint">Still have a question? {site?.general?.contactEmail ? <>Write to us at <a href={`mailto:${site.general.contactEmail}`}>{site.general.contactEmail}</a>.</> : <Link to="/messages">Send us a message</Link>}</p>
      </section>
      <section className="pg sec"><div className="dir-cta"><div><b>Ready to put your art on walls?</b><span>Create your account in a minute; upload your first design once you're approved.</span></div><Link className="btn btn-wine" to="/become-designer">Start your application</Link></div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </div>
  );
}
