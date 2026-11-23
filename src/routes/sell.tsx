import { createFileRoute, Link } from "@tanstack/react-router";
import { COMMISSION_RATE, ROYALTY_TIERS, allDesigners, liveDesigns, money, registerShop, type Design } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { pic } from "@/lib/pics";
import { loadSite } from "@/lib/site-settings";
import { parseFaq, termsFrom, faqTokens, fillTokens } from "@/lib/designer-faq";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [
    { title: "Design with us: royalties & designer applications | Artisan Mural" },
    { name: "description", content: "Create wallpaper for Artisan Mural. Explore $0.50–$0.60 per square foot royalties, 90% custom design earnings, studio approval and designer applications." },
    { property: "og:title", content: "Design with us | Artisan Mural" },
    { property: "og:description", content: "Your art, made for real walls. Discover designer royalties, custom commissions and how to apply." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context }) => { const [site, shop] = await Promise.all([loadSite(), ensureShop(context.queryClient)]); return { site: site as any, shop }; },
  component: Sell,
});



function Sell() {
  const { site, shop } = Route.useLoaderData();
  registerShop(shop);
  const tk = faqTokens(termsFrom(site?.designerTerms));
  const all = parseFaq(site?.designerFaq?.faq).flatMap((g) => g.items).map((i) => ({ q: fillTokens(i.q, tk), a: fillTokens(i.a, tk) }));
  const faqs = all.slice(0, 6).map((i) => [i.q, i.a.split(/\n\n+/)[0]] as [string, string]);
  const live = liveDesigns(shop);
  const walls = allDesigners().map((x) => ({ x, d: live.find((d) => d.designer === x.slug && d.mockups?.length) })).filter((r) => r.d).slice(0, 4);
  const hero = walls[0]?.d;
  const roomOf = (d: Design, k = 0) => pic(d, d.mockups?.[k] ?? d.image, [1080])?.src ?? d.image;
  return (
    <div className="am">
      <section className="sl-hero">
        <img src={hero ? roomOf(hero, 1) : "/p/img/cover-living-room.webp"} alt="A designer's mural printed on a living room wall" />
        <div className="sl-hero-in pg">
          <span className="k">For artists &amp; wallpaper designers</span>
          <h1>Your art,<br />on real walls.</h1>
          <p>Upload your murals and patterns once. We print every order to the customer's exact wall, ship it, and pay you on every square foot.</p>
          <div className="sl-cta"><Link className="btn btn-wine" to="/become-designer">Start your application</Link><a className="btn sl-ghost" href="#sell-how">How it works</a></div>
        </div>
      </section>
      <section className="pg sl-stats" aria-label="Artisan Murals in numbers">
        <div><b>{allDesigners().length || "New"}</b><span>independent designers</span></div>
        <div><b>{money(ROYALTY_TIERS[0]!.rate)}+</b><span>royalty per sq ft sold</span></div>
        <div><b>{Math.round((1 - COMMISSION_RATE) * 100)}%</b><span>of every custom job</span></div>
        <div><b>Monthly</b><span>payouts, or when you ask</span></div>
      </section>
      {walls.length > 0 && (
        <section className="pg sl-walls" aria-label="Designs from our artists">
          {walls.map(({ x, d }) => <Link key={x.slug} to="/design/$slug" params={{ slug: d!.slug }}><img src={roomOf(d!)} alt="" loading="lazy" /><span>{x.name}</span></Link>)}
        </section>
      )}
      <section className="pg sec" id="sell-how">
        <div className="sl-two">
          <div><span className="k">How it works</span><h2 className="sl-h">From your file to their wall.</h2>
            <ol className="sl-steps">
              <li><b>Apply</b><span>Create your account and tell us about your work. The studio approves every designer personally.</span></li>
              <li><b>Upload</b><span>Paste a Google Drive folder or upload files. We measure the sharpness, check repeats and make room pictures for you.</span></li>
              <li><b>We review</b><span>Each design is checked before it goes live, usually within 2 business days.</span></li>
              <li><b>Customers order</b><span>Printed to their wall in numbered panels. We handle printing, shipping and support.</span></li>
              <li><b>You get paid</b><span>Royalties on every order plus custom work, paid monthly.</span></li>
            </ol></div>
          <div className="sl-earn">
            <div><span className="k">Royalties</span><p>Paid on every square foot ordered of your designs, rising as they sell.</p>
              <div className="sl-lv">{ROYALTY_TIERS.map((t) => <span key={t.label}><b>{money(t.rate)}</b>{t.from === 0 ? "per sq ft from the first sale" : `per sq ft after ${t.from.toLocaleString("en-US")} sq ft`}</span>)}</div></div>
            <div><span className="k">Custom work</span><p>New murals, color changes, extending a design to a bigger wall. You set the price in the chat; you keep {Math.round((1 - COMMISSION_RATE) * 100)}%.</p></div>
            {faqs.length > 0 && <div className="sl-faq faq">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>}
          </div>
        </div>
      </section>
      <section className="pg sec sl-apply-wrap">
        <div className="sl-apply sl-apply-cta">
          <div className="sl-apply-head"><span className="k">Designer application</span><h2 className="sl-h">Apply to sell on Artisan Murals</h2><p>About 6 minutes. Create your account first, then tell us about your work. Your answers are saved as you go.</p></div>
          <Link className="btn btn-wine big" to="/become-designer">Start your application</Link>
          <p className="hint">Already approved? <Link to="/account">Sign in to your studio</Link>.</p>
        </div>
      </section>
    </div>
  );
}
