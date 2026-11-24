import { createFileRoute } from "@tanstack/react-router";
import { loadSite } from "@/lib/site-settings";
import { sitePages } from "@/lib/site-pages";
import { PageBlocks } from "@/components/storefront/page-blocks";

/** Pages the owner builds in Back office → Pages (Help, Track my order, How to hang, About, and any new page).
 *  The site's own pages (shop, account, …) have their own addresses and always come first. */
export const Route = createFileRoute("/$page")({
  loader: async ({ params }) => {
    const site: any = await loadSite();
    const page = sitePages(site?.pages).find((p) => p.slug === params.page && p.published) ?? null;
    return { page, contact: { email: site?.general?.contactEmail || "", phone: site?.general?.contactPhone || "" } };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.page;
    if (!p) return { meta: [{ title: "Page not found | Artisan Murals" }, { name: "robots", content: "noindex" }] };
    return { meta: [{ title: `${p.title} | Artisan Murals` }, ...(p.description ? [{ name: "description", content: p.description }, { property: "og:description", content: p.description }] : []), { property: "og:title", content: p.title }] };
  },
  component: SitePageView,
});

function SitePageView() {
  const { page, contact } = Route.useLoaderData();
  if (!page) return <div className="am"><section className="pg sec pb-404"><span className="k">Page not found</span><h1>We couldn't find that page.</h1><p>It may have moved. Try the shop or our help page.</p><div className="sl-cta"><a className="btn btn-wine" href="/browse">Shop all designs</a><a className="btn optline" href="/help">Help</a></div></section></div>;
  const startsWithHero = page.blocks[0]?.type === "hero";
  return <div className="am pb-page">
    <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><b>{page.title}</b></nav></div>
    {!startsWithHero && <section className="pg pb-head"><h1 className="pb-title">{page.title}</h1></section>}
    {/* the first block's own heading would repeat the page title */}
    <PageBlocks blocks={startsWithHero ? page.blocks : page.blocks.map((b: any, i: number) => (i === 0 && b.title === page.title ? { ...b, title: "" } : b))} contact={contact} />
  </div>;
}
