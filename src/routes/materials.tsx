import { createFileRoute, Link } from "@tanstack/react-router";
import { liveDesigns, materials, money, registerShop, unitPrice } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { pic } from "@/lib/pics";
import { MAT_FACTS, MAT_ROWS, MAT_TECH } from "@/lib/material-info";
import { StorefrontSprite } from "@/components/storefront/icons";

export const Route = createFileRoute("/materials")({
  loader: async ({ context }) => ({ shop: await ensureShop(context.queryClient) }),
  head: () => ({ meta: [{ title: "Our materials | Artisan Murals" }, { name: "description", content: "Canvas, Linen, Grasscloth and Suede: four commercial-grade wallpaper finishes, wipe-clean and top fire rated." }] }),
  component: Materials,
});

function Materials() {
  const { shop } = Route.useLoaderData();
  registerShop(shop);
  const all = liveDesigns(shop);
  const sample = all.find((d) => d.categories.some((c) => /tropical|animals|botanical|floral/i.test(c))) ?? all.find((d) => d.kind === "mural") ?? all[0];
  const printed = sample ? pic(sample, sample.image, [720])?.src ?? sample.image : "";
  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Our materials</b></nav></div>
      <section className="pg mats">
        <div className="mats-head"><span className="k">Our materials</span><h1>Four finishes, <span>made to last.</span></h1><p>Every design can be printed on any of them. All are commercial-grade, wipe clean and carry the top fire rating.</p></div>
        <div className="mats-list">
          {materials.map((m) => { const f = MAT_FACTS[m.id]; const tex = f?.tex ?? m.id; return (
            <article key={m.id} className="mat-row" id={`mat-${m.id}`}>
              <div className="mr-pics">
                <span className="mr-raw" style={{ backgroundImage: `url(/p/tex/${tex}-unprinted.webp)` }}><em>Unprinted</em></span>
                <span className="mr-on" style={{ backgroundImage: `url(/p/tex/${tex}-grain.webp)${printed ? `,url(${printed})` : ""}` }}><em>Printed · real size</em></span>
              </div>
              <div className="mr-txt">
                <h2>{m.name}</h2><p className="mr-price">{money(unitPrice(undefined, m))} / sq ft</p><p>{m.blurb}</p>
                {f && <ul>{MAT_ROWS.map(([k, n]) => f[k] ? <li key={k}><span>{n}</span>{f[k]}</li> : null)}</ul>}
              </div>
            </article>
          ); })}
        </div>
        <div className="mats-foot">
          <div className="mc-hang"><b>Easy to hang</b><p>Any wallpaper hanger can install it. Panels arrive numbered with step-by-step instructions: paste the back, hang panel 1, line up the next, trim top and bottom.</p></div>
          <div className="mc-hang"><b>Not sure which one?</b><p>Order samples of all four from any design page, and feel them on your own wall.</p></div>
        </div>
        <details className="mc-tech"><summary>Technical specs for architects &amp; designers</summary><p>{MAT_TECH.map((t, i) => <span key={i}>{t}{i < MAT_TECH.length - 1 && <><br /><br /></>}</span>)}</p></details>
      </section>
    </div>
  );
}
