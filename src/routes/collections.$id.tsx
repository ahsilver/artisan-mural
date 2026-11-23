import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { StoreCard } from "@/components/storefront/card";
import { designerBySlug, liveDesigns, registerShop, type Designer } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";

export const Route = createFileRoute("/collections/$id")({
  loader: async ({ params, context }) => {
    const shop = await ensureShop(context.queryClient);
    const collection = (shop.collections ?? []).find(c => c.id === params.id);
    if (!collection) throw notFound();
    const all = liveDesigns(shop);
    const items = collection.designs.flatMap(s => all.filter(d => d.slug === s));
    const designer = shop.designers.find(d => d.slug === collection.designerSlug) ?? designerBySlug(collection.designerSlug) ?? null;
    return { shop, collection, items, designer: designer as Designer | null };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Collection not found — Artisan Murals" }, { name: "description", content: "This Artisan Murals wallpaper collection is unavailable." }, { property: "og:title", content: "Collection not found — Artisan Murals" }, { property: "og:description", content: "This wallpaper collection is unavailable." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
    const { collection, designer } = loaderData;
    const title = `${collection.title}${designer ? ` by ${designer.name}` : ""} — Artisan Murals`;
    const description = collection.description || `A wallpaper collection${designer ? ` by ${designer.name}` : ""}, printed to your exact wall.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: CollectionPage,
});

/** The approved preview's collection page: three room pictures, the name and story, then every design as a shop card. */
function CollectionPage() {
  const { shop, collection, items, designer } = Route.useLoaderData();
  registerShop(shop); // designer names on the cards match between server and browser
  const strip = [...items, ...items].slice(0, 3).map((d) => d.mockups?.[0] ?? d.image);
  return (
    <div className="am">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/designers">Designers</Link><span>/</span>{designer ? <><Link to="/designers/$slug" params={{ slug: designer.slug }}>{designer.name}</Link><span>/</span></> : null}<b>{collection.title}</b></nav></div>
      <section className="pg">
        <div className="cl-hero">
          <div className="cl-strip">{strip.map((u, i) => <img key={i} src={u} alt="" loading={i ? "lazy" : undefined} />)}</div>
          <div className="cl-copy"><span className="k">Collection</span><h1>{collection.title}</h1>{collection.description && <p>{collection.description}</p>}<p className="cl-by">{designer ? <>by <Link to="/designers/$slug" params={{ slug: designer.slug }}>{designer.name}</Link> · </> : null}<span>{items.length} {items.length === 1 ? "design" : "designs"}</span></p></div>
        </div>
        <div className="g-prod shopgrid">{items.map((d) => <StoreCard key={d.slug} d={d} />)}</div>
      </section>
    </div>
  );
}
