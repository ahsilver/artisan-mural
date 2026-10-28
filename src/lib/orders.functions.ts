import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unitPrice, designBySlug, isHidden, registerShop, materials, designRate } from "@/lib/catalog";
import { orderSqft, repeatStyle, sizeIssue, wallSelectionSchema } from "@/lib/wall-selection";

/** Saves every cart item as an order awaiting payment for the signed-in customer. Prices are recomputed from the catalog. */
export const createCartOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    items: z.array(z.object({ design: z.string().max(60), finish: z.string().max(60), selection: wallSelectionSchema, name: z.string().trim().max(40).optional() })).min(1).max(30),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(40),
    address: z.string().trim().min(5).max(600),
    notes: z.string().trim().max(1000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    const cartId = crypto.randomUUID();
    const { loadShopData } = await import("@/lib/shop.server");
    registerShop(await loadShopData());
    const rows = data.items.map((item) => {
      const design = designBySlug(item.design);
      const material = materials.find((m) => m.id === item.finish);
      if (!design || !material || isHidden(design.slug)) throw new Error("One wallpaper or finish in your cart is no longer available.");
      if (repeatStyle(design) === "none" && sizeIssue(design, item.selection)) throw new Error(`Your wall is bigger than ${design.title} was made for. Don't worry, we can fix it: ask the designer to make it fit from the design page.`);
      const sqft = orderSqft(item.selection);
      // the chosen color travels with the order by name, and its own print file is the one that gets printed
      const cw = design.colorways?.find((c) => c.id === item.selection.color) ?? (design.colorways && design.colorways.length > 1 ? design.colorways[0] : undefined);
      const selection0 = cw ? { ...item.selection, color: cw.id, colorName: cw.name } : item.selection;
      const selection = item.name ? { ...selection0, wallName: item.name } : selection0;
      return { user_id: context.userId, cart_id: cartId, design_slug: design.slug, finish: material.id, selection, ...(cw?.originalId ? { print_original_id: cw.originalId } : {}), square_feet: Math.round(sqft * 100) / 100, estimated_total: Math.round(sqft * unitPrice(design, material) * 100) / 100, customer_name: data.name, customer_email: email, phone: data.phone || null, shipping_address: data.address, notes: data.notes || null, status: "awaiting_payment" };
    });
    const { error } = await context.supabase.from("order_requests").insert(rows);
    if (error) { console.error(error); throw new Error("Your order could not be saved. Please try again."); }
    return { total: Math.round(rows.reduce((n, r) => n + r.estimated_total, 0) * 100) / 100, email, cartId };
  });

/** The signed-in customer's own orders and custom requests (row security limits to their rows). */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [orders, requests] = await Promise.all([
      context.supabase.from("order_requests").select("id, design_slug, finish, square_feet, estimated_total, status, carrier, tracking_number, created_at, selection").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("custom_requests").select("id, room, brief, status, photo_paths, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      orders: (orders.data ?? []).map((o) => ({ id: o.id, design: o.design_slug, finish: o.finish, sqft: Number(o.square_feet), total: Number(o.estimated_total), status: o.status, carrier: o.carrier, tracking: o.tracking_number, created_at: o.created_at, color: ((o as any).selection?.colorName as string | undefined) ?? null })),
      requests: (requests.data ?? []).map((r) => ({ id: r.id, room: r.room, brief: r.brief, status: r.status, photos: r.photo_paths.length, created_at: r.created_at })),
    };
  });

/** Saves a custom design request; photos were already uploaded into the customer's own private folder. */
export const createCustomRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    name: z.string().trim().min(1).max(100), room: z.string().trim().min(1).max(80), size: z.string().trim().min(1).max(80),
    budget: z.string().trim().max(60), brief: z.string().trim().min(20).max(1500), material: z.string().max(60), designer: z.string().max(60),
    photos: z.array(z.string().max(300)).max(6),
    design:z.string().max(60).optional(),selection:wallSelectionSchema.optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.photos.some((p) => !p.startsWith(`${context.userId}/`))) throw new Error("Photo upload was not recognised.");
    if(data.design){const {loadShopData}=await import("./shop.server");registerShop(await loadShopData());const d=designBySlug(data.design);if(!d||d.designer!==data.designer)throw new Error("Choose the original designer for customization.");}
    const email = (context.claims as { email?: string }).email ?? "";
    const { error } = await context.supabase.from("custom_requests").insert({ user_id: context.userId, customer_name: data.name, customer_email: email, room: data.room, wall_size: data.size, budget: data.budget || null, brief: data.brief, material: data.material, designer_slug: data.designer, photo_paths: data.photos,design_slug:data.design??null,selection:data.selection??null });
    if (error) { console.error(error); throw new Error("Your request could not be saved. Please try again."); }
    return { email };
  });
