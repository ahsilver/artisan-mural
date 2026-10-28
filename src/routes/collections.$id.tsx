import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DesignCard } from "@/components/design-card";
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
    if (!loaderData) return { meta: [{ title: "Collection not found — Artisan Mural" }, { name: "description", content: "This Artisan Mural wallpaper collection is unavailable." }, { property: "og:title", content: "Collection not found — Artisan Mural" }, { property: "og:description", content: "This wallpaper collection is unavailable." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
    const { collection, designer } = loaderData;
    const title = `${collection.title}${designer ? ` by ${designer.name}` : ""} — Artisan Mural`;
    const description = collection.description || `A wallpaper collection${designer ? ` by ${designer.name}` : ""}, printed to your exact wall.`;
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { shop, collection, items, designer } = Route.useLoaderData();
  registerShop(shop); // designer names on the cards match between server and browser
  return (
    <div className="collection-backdrop"><div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="text-eyebrow text-clay">Collection</p>
      <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">{collection.title}</h1>
      {designer && <p className="mt-3 text-sm text-muted-foreground">by <Link to="/designers/$slug" params={{ slug: designer.slug }} className="text-foreground underline underline-offset-4">{designer.name}</Link></p>}
      {collection.description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{collection.description}</p>}
      <p className="mt-10 text-xs text-muted-foreground">{items.length} {items.length === 1 ? "design" : "designs"}</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 pb-24 sm:gap-7 lg:grid-cols-3">
        {items.map(d => <DesignCard key={d.slug} design={d} />)}
      </div>
    </div></div>
  );
}
