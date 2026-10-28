import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Collection = { id: string; designerSlug: string; title: string; description: string; designs: string[] };

async function whoAmI(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: acc } = await supabase.from("designer_accounts").select("slug").eq("user_id", userId).maybeSingle();
  const { data: prof } = await supabase.from("designer_profiles").select("status").eq("user_id", userId).maybeSingle();
  const slug = acc?.slug ?? (prof?.status === "approved" ? `studio-${userId.slice(0, 8)}` : null);
  return { isAdmin: isAdmin === true, slug: slug as string | null };
}

/** Collections the caller can manage, plus the designs they can put in them. */
export const getMyCollections = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const me = await whoAmI(context.supabase, context.userId);
  let q = context.supabase.from("designer_collections").select("id, designer_slug, title, description, design_slugs").order("created_at", { ascending: false });
  if (!me.isAdmin) { if (!me.slug) return { ...me, collections: [] as Collection[] }; q = q.eq("designer_slug", me.slug); }
  const { data } = await q;
  return { ...me, collections: (data ?? []).map(c => ({ id: c.id, designerSlug: c.designer_slug, title: c.title, description: c.description, designs: c.design_slugs })) };
});

export const saveCollection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(i => z.object({ id: z.string().uuid().optional(), designerSlug: z.string().min(1).max(80), title: z.string().trim().min(1).max(80), description: z.string().trim().max(500), designs: z.array(z.string().max(100)).min(1).max(48) }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await whoAmI(context.supabase, context.userId);
    if (!me.isAdmin && me.slug !== data.designerSlug) throw new Error("You can only build collections of your own designs.");
    const { loadShopData } = await import("@/lib/shop.server");
    const { designs: samples } = await import("@/lib/catalog");
    const shop = await loadShopData();
    const { data: privateDesigns } = await context.supabase.from("artwork_uploads").select("id").eq("owner_id", context.userId);
    const owned = new Set([...samples, ...shop.designs].filter(d => d.designer === data.designerSlug).map(d => d.slug));
    (privateDesigns ?? []).forEach(d => owned.add(`u-${d.id}`));
    if (!me.isAdmin && (!me.slug || data.designs.some(s => !owned.has(s)))) throw new Error("Some of those designs aren't yours.");
    if (data.id && !me.isAdmin) {
      const { data: existing } = await context.supabase.from("designer_collections").select("owner_id").eq("id", data.id).maybeSingle();
      if (existing?.owner_id !== context.userId) throw new Error("Only the collection owner can edit it.");
    }
    const row = { designer_slug: data.designerSlug, title: data.title, description: data.description, design_slugs: data.designs, updated_at: new Date().toISOString(), ...(me.isAdmin ? {} : { owner_id: context.userId }) };
    const { error } = data.id
      ? await context.supabase.from("designer_collections").update(row).eq("id", data.id)
      : await context.supabase.from("designer_collections").insert(row);
    if (error) throw new Error("Could not save the collection.");
    const { invalidateShopCache } = await import("@/lib/shop.server");
    invalidateShopCache();
    return { ok: true };
  });

export const deleteCollection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(i => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("designer_collections").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete the collection.");
    const { invalidateShopCache } = await import("@/lib/shop.server");
    invalidateShopCache();
    return { ok: true };
  });
