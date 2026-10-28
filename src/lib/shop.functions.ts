import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ShopData } from "@/lib/catalog";

/** Public: approved designer uploads shaped as shop designs (safe fields only), plus slugs the studio removed. */
export const getShopDesigns = createServerFn({ method: "GET" }).handler(async (): Promise<ShopData> => {
  const { loadShopData } = await import("@/lib/shop.server");
  return loadShopData();
});

/** Studio only: take a design off the site or put it back. */
export const setDesignListing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(80), hidden: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Only the studio can change this.");
    const { error } = await context.supabase.from("design_listing").upsert({ slug: data.slug, hidden: data.hidden, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error("Could not update this design.");
    const { invalidateShopCache } = await import("@/lib/shop.server");
    invalidateShopCache();
    return { success: true };
  });

/** Public: fetch one approved uploaded wallpaper, without loading the whole catalog. */
export const getShopDesign = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().max(100) }).parse(input))
  .handler(async ({ data }): Promise<ShopData> => {
    const { loadSingleDesign } = await import("@/lib/shop.server");
    return loadSingleDesign(data.slug);
  });
