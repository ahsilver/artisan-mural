import { createFileRoute } from "@tanstack/react-router";
import { ensureShop } from "@/lib/shop";
import { loadSite } from "@/lib/site-settings";
import { CategoryPage } from "@/components/storefront/category-grid";

export const Route = createFileRoute("/rooms")({
  loader: async ({ context }) => { const [shop, site] = await Promise.all([ensureShop(context.queryClient), loadSite()]); return { shop, site }; },
  head: () => ({ meta: [{ title: "Shop by room | Artisan Murals" }, { name: "description", content: "Murals and wallpaper by independent artists, for every room. Printed to your exact wall size." }] }),
  component: Page,
});
function Page() { const { shop, site } = Route.useLoaderData(); return <CategoryPage shop={shop} home={(site as any)?.homepage ?? {}} kind="rooms" />; }
