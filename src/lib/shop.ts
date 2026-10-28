import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { liveDesigns, registerShop, type ShopData } from "@/lib/catalog";
import { getShopDesigns } from "@/lib/shop.functions";

export const shopQuery = queryOptions({
  queryKey: ["shop-designs"],
  queryFn: async () => { const d = await getShopDesigns(); registerShop(d); return d; },
  staleTime: 5 * 60 * 1000,
});

/** Loads approved uploads into the catalog registry so designBySlug finds them. */
export async function ensureShop(qc: QueryClient): Promise<ShopData> {
  const d = await qc.ensureQueryData(shopQuery);
  registerShop(d);
  return d;
}

/** Live shop designs for listings; falls back to the sample catalog while loading. */
export function useLiveDesigns() {
  const { data } = useQuery(shopQuery);
  if (data) registerShop(data);
  return liveDesigns(data);
}
