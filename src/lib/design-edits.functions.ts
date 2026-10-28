import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { designs as sampleDesigns, PRICE_PER_SQFT } from "@/lib/catalog";

async function adminDb(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (isAdmin !== true) throw new Error("Only the Artisan Mural owner can edit designs.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const slugSchema = z.string().min(1).max(100);
const pathSchema = z.string().min(3).max(300).regex(/^[a-zA-Z0-9/_.-]+$/);

export type EditorPhoto = { key: string; url: string; added: boolean; removed: boolean };
export type DesignEditorData = { slug: string; title: string; description: string; story: string; pricePerSqft: number | null; standardPrice: number; artwork: string; artworkReplaced: boolean; imagePath: string | null; photos: EditorPhoto[] };

/** Owner: everything needed to edit one design (current text, price, and every photo with its removal key). */
export const getDesignEditor = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ slug: slugSchema }).parse(i))
  .handler(async ({ data, context }): Promise<DesignEditorData> => {
    const db = await adminDb(context);
    const { data: o } = await db.from("design_overrides").select("*").eq("slug", data.slug).maybeSingle();
    const removed = o?.removed_photos ?? [];
    const studioPaths = [...(o?.added_photos ?? []), ...(o?.image_path ? [o.image_path] : [])];
    const signed = studioPaths.length ? (await db.storage.from("studio-photos").createSignedUrls(studioPaths, 3600)).data ?? [] : [];
    const studioUrl = new Map(signed.map((s) => [s.path, s.signedUrl]));
    let title = "", description = "", story = "", artwork = "", base: { key: string; url: string }[] = [];
    if (data.slug.startsWith("u-")) {
      const { data: u } = await db.from("artwork_uploads").select("title, story, kind, artwork_colorways(position, artwork_path, artwork_mockups(room, image_path))").eq("id", data.slug.slice(2)).maybeSingle();
      if (!u) throw new Error("Design not found.");
      const first = [...u.artwork_colorways].sort((a, b) => a.position - b.position)[0];
      const paths = first ? [first.artwork_path, ...[...first.artwork_mockups].sort((a, b) => a.room - b.room).map((m) => m.image_path)] : [];
      const s = paths.length ? (await db.storage.from("designer-artwork").createSignedUrls(paths, 3600)).data ?? [] : [];
      const url = new Map(s.map((x) => [x.path, x.signedUrl]));
      title = u.title; story = u.story ?? "";
      description = u.kind === "mural" ? "An original mural from one of our designers, printed and cropped to your exact wall." : "An original repeating pattern from one of our designers, printed to any wall size.";
      artwork = first ? url.get(first.artwork_path) ?? "" : "";
      base = paths.slice(1).map((p) => ({ key: p, url: url.get(p) ?? "" }));
    } else {
      const d = sampleDesigns.find((x) => x.slug === data.slug);
      if (!d) throw new Error("Design not found.");
      title = d.title; description = d.description; story = d.story ?? ""; artwork = d.image;
      base = (d.mockups ?? []).map((m) => ({ key: m, url: m }));
    }
    return {
      slug: data.slug,
      title: o?.title || title, description: o?.description || description, story: o?.story || story,
      pricePerSqft: o?.price_per_sqft == null ? null : Number(o.price_per_sqft), standardPrice: PRICE_PER_SQFT,
      artwork: (o?.image_path && studioUrl.get(o.image_path)) || artwork, artworkReplaced: !!o?.image_path, imagePath: o?.image_path ?? null,
      photos: [
        ...base.map((b) => ({ ...b, added: false, removed: removed.includes(b.key) })),
        ...(o?.added_photos ?? []).map((p) => ({ key: p, url: studioUrl.get(p) ?? "", added: true, removed: false })),
      ],
    };
  });

/** Owner: save edits for one design. Prices apply everywhere, including server-side order totals. */
export const saveDesignOverride = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    slug: slugSchema,
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    story: z.string().trim().max(4000),
    pricePerSqft: z.number().positive().max(999).nullable(),
    imagePath: pathSchema.nullable(),
    removed: z.array(z.string().max(400)).max(50),
    added: z.array(pathSchema).max(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const own = (p: string) => p.startsWith(`${data.slug}/`);
    if ((data.imagePath && !own(data.imagePath)) || !data.added.every(own)) throw new Error("Photos must be uploaded for this design.");
    const { error } = await db.from("design_overrides").upsert({
      slug: data.slug, title: data.title, description: data.description || null, story: data.story || null,
      price_per_sqft: data.pricePerSqft, image_path: data.imagePath, removed_photos: data.removed, added_photos: data.added,
      updated_at: new Date().toISOString(), updated_by: context.userId,
    });
    if (error) throw new Error("Could not save this design.");
    const { invalidateShopCache } = await import("@/lib/shop.server");
    invalidateShopCache();
    return { success: true };
  });
