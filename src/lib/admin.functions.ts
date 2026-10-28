import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canApproveArtwork } from "./designer-workflow";
import { COMMISSION_RATE, designsByDesigner, royaltyRateFor, defaultMaterials } from "@/lib/catalog";

/** Every owner function checks the caller's admin role through row-secure has_role before using privileged access. */
async function adminClient(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (isAdmin !== true) throw new Error("Only the Artisan Mural owner can open this.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await adminClient(context);
  const [profiles, uploads, orders, offers, payouts, accounts, users, convs, guests] = await Promise.all([
    db.from("designer_profiles").select("*").order("created_at", { ascending: false }),
    db.from("artwork_uploads").select("*, artwork_colorways(name, position, artwork_path, print_file_url, artwork_mockups(room, image_path))").order("created_at", { ascending: false }).limit(200),
    db.from("order_requests").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("design_offers").select("*"),
    db.from("designer_payouts").select("*").order("paid_at", { ascending: false }),
    db.from("designer_accounts").select("slug, user_id"),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("conversations").select("id", { count: "exact", head: true }),
    db.from("guest_conversations").select("id", { count: "exact", head: true }),
  ]);
  const emails = new Map((users.data?.users ?? []).map(u => [u.id, u.email ?? ""]));
  const slugOf = new Map((accounts.data ?? []).map(a => [a.user_id, a.slug]));

  const designUploads = await Promise.all((uploads.data ?? []).map(async (u: any) => {
    const colors = [...u.artwork_colorways].sort((a: any, b: any) => a.position - b.position);
    const paths = colors.flatMap((c: any) => [c.artwork_path, ...[...c.artwork_mockups].sort((a: any, b: any) => a.room - b.room).map((m: any) => m.image_path)]).slice(0, 8);
    const { data: urls } = paths.length ? await db.storage.from("designer-artwork").createSignedUrls(paths, 3600) : { data: [] };
    return { id: u.id as string, title: u.title as string, sku: u.sku as string, colorFiles: colors.map((c: any) => ({ name: c.name as string, url: c.print_file_url as string | null })), kind: u.kind as string, story: u.story as string | null, notes: u.designer_notes as string | null, printFile: u.print_file_url as string | null, widthCm: u.width_cm as number | null, heightCm: u.height_cm as number | null, status: u.status as string, submittedAt: u.submitted_at as string | null, review: u.review_status as string, reviewNote: u.review_note as string | null, created_at: u.created_at as string, owner: emails.get(u.owner_id) ?? "", ownerName: (profiles.data ?? []).find((p: any) => p.user_id === u.owner_id)?.full_name ?? null, colors: colors.map((c: any) => c.name as string), images: (urls ?? []).map((x: any) => x.signedUrl as string) };
  }));

  const orderRows = (orders.data ?? []).map((o: any) => ({ id: o.id, design: o.design_slug, finish: o.finish, sqft: Number(o.square_feet), total: Number(o.estimated_total), customer: o.customer_name, email: o.customer_email, address: o.shipping_address, status: o.status, created_at: o.created_at, carrier: o.carrier as string | null, tracking: o.tracking_number as string | null, source: o.source as string, deliveryDate: o.delivery_date as string | null, phone: o.phone as string | null, notes: o.notes as string | null, selection: o.selection, cartId: o.cart_id as string | null, paymentMethod: o.payment_method as string | null, statusUpdatedAt: o.status_updated_at as string }));

  // Earnings: per-sq-ft royalties on catalog designs + 90% of accepted/paid custom jobs.
  const earners = new Set<string>([...(profiles.data ?? []).map((p: any) => p.user_id), ...(accounts.data ?? []).map(a => a.user_id)]);
  const payoutRows = [...earners].map(uid => {
    const slug = slugOf.get(uid);
    const mine = slug ? designsByDesigner(slug).map(d => d.slug) : [];
    const sqft = orderRows.filter(o => mine.includes(o.design)).reduce((n, o) => n + o.sqft, 0);
    const royalties = sqft * royaltyRateFor(sqft);
    const jobs = (offers.data ?? []).filter((o: any) => slug && o.designer_slug === slug && (o.status === "accepted" || o.status === "paid")).reduce((n: number, o: any) => n + Number(o.amount) * (1 - COMMISSION_RATE), 0);
    const paid = (payouts.data ?? []).filter((p: any) => p.designer_user_id === uid).reduce((n: number, p: any) => n + Number(p.amount), 0);
    const profile = (profiles.data ?? []).find((p: any) => p.user_id === uid);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return { userId: uid, name: profile?.full_name ?? emails.get(uid) ?? "Designer", email: emails.get(uid) ?? "", method: profile?.payout_method ?? null, details: profile?.payout_details ?? null, sqft: r2(sqft), royalties: r2(royalties), jobs: r2(jobs), earned: r2(royalties + jobs), paid: r2(paid), owed: r2(royalties + jobs - paid) };
  });

  return {
    materials: await (async () => { const { data, error } = await db.from("material_settings").select("*"); if (error) throw new Error("Could not load materials."); const all = new Map(defaultMaterials.map(m => [m.id, { ...m, active: true }])); (data ?? []).forEach(m => all.set(m.id, { id: m.id, name: m.name, blurb: m.blurb, factor: Number(m.factor), texture: m.texture ?? undefined, active: m.active })); return [...all.values()]; })(),
    designers: (profiles.data ?? []).map((p: any) => ({ userId: p.user_id, name: p.full_name, studio: p.studio_name, country: p.country, bio: p.bio, styles: p.styles, portfolio: p.portfolio_links, method: p.payout_method, details: p.payout_details, status: p.status, trusted: !!p.trusted, note: p.review_note, email: emails.get(p.user_id) ?? "", created_at: p.created_at })),
    designs: designUploads,
    orders: orderRows,
    payouts: payoutRows,
    payoutHistory: (payouts.data ?? []).map((p: any) => ({ id: p.id, userId: p.designer_user_id, amount: Number(p.amount), note: p.note, paid_at: p.paid_at })),
    users: (users.data?.users ?? []).map(u => ({ id: u.id, email: u.email ?? "", created_at: u.created_at, lastSignIn: u.last_sign_in_at ?? null, designer: (profiles.data ?? []).find((p: any) => p.user_id === u.id)?.status ?? null })),
    conversationCount: (convs.count ?? 0) + (guests.count ?? 0),
    requests: await Promise.all(((await db.from("custom_requests").select("*").order("created_at", { ascending: false }).limit(200)).data ?? []).map(async (r: any) => {
      const { data: urls } = r.photo_paths.length ? await db.storage.from("custom-request-photos").createSignedUrls(r.photo_paths, 3600) : { data: [] };
      return { id: r.id as string, name: r.customer_name as string, email: r.customer_email as string, room: r.room as string, size: r.wall_size as string, budget: r.budget as string | null, brief: r.brief as string, material: r.material as string, designer: r.designer_slug as string, status: r.status as string, created_at: r.created_at as string, photos: (urls ?? []).map((u: any) => u.signedUrl as string) };
    })),
  };
});

const review = z.object({ id: z.string().uuid(), action: z.enum(["approved", "rejected"]), note: z.string().trim().max(500).default("") });

export const reviewDesigner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => review.parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { error } = await db.from("designer_profiles").update({ status: data.action, review_note: data.note || null, reviewed_at: new Date().toISOString() }).eq("user_id", data.id);
  if (error) throw new Error("Could not update this designer.");
  return { success: true };
});

export const reviewDesign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => review.parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { data: upload } = await db.from("artwork_uploads").select("status, submitted_at").eq("id", data.id).maybeSingle();
  if (!upload) throw new Error("Design not found.");
  if (data.action === "approved" && !canApproveArtwork(upload)) throw new Error("The designer must finish the photos and submit this design before approval.");
  const { error } = await db.from("artwork_uploads").update({ review_status: data.action, review_note: data.note || null }).eq("id", data.id);
  if (error) throw new Error("Could not update this design.");
  const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache();
  return { success: true };
});

export const ORDER_STATUSES = ["awaiting_payment", "processing", "printing", "shipped", "delivered", "cancelled"] as const;
export const updateOrderStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES), carrier: z.enum(["UPS", "USPS", "FedEx", "DHL", "Other"]).nullable().optional(), tracking: z.string().trim().max(60).nullable().optional() }).parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const patch: { status: string; status_updated_at: string; carrier?: string | null; tracking_number?: string | null } = { status: data.status, status_updated_at: new Date().toISOString() };
  if (data.carrier !== undefined) patch.carrier = data.carrier;
  if (data.tracking !== undefined) patch.tracking_number = data.tracking || null;
  const { error } = await db.from("order_requests").update(patch).eq("id", data.id);
  if (error) throw new Error("Could not update the order.");
  return { success: true };
});

export const setOrderPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), method: z.string().trim().max(60) }).parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { error } = await db.from("order_requests").update({ payment_method: data.method || null }).eq("id", data.id);
  if (error) throw new Error("Could not save the payment method.");
  return { success: true };
});

export const recordPayout = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ userId: z.string().uuid(), amount: z.number().positive().max(1000000), note: z.string().trim().max(300).default("") }).parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { error } = await db.from("designer_payouts").insert({ designer_user_id: data.userId, amount: Math.round(data.amount * 100) / 100, note: data.note || null, created_by: context.userId });
  if (error) throw new Error("Could not record the payout.");
  return { success: true };
});

export const setDesignerTrusted = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), trusted: z.boolean() }).parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { error } = await db.from("designer_profiles").update({ trusted: data.trusted }).eq("user_id", data.id);
  if (error) throw new Error("Could not update this designer.");
  return { success: true };
});

const manualOrder = z.object({
  design: z.string().trim().min(1).max(120), customer: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200).or(z.literal("")),
  phone: z.string().trim().max(40).default(""), address: z.string().trim().min(1).max(500), sqft: z.number().min(0).max(100000), total: z.number().min(0).max(10000000),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), notes: z.string().trim().max(1000).default(""),
});
/** Orders the owner received outside the website (phone, showroom, email). */
export const addManualOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => manualOrder.parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  const { error } = await db.from("order_requests").insert({ design_slug: data.design, finish: "outside order", selection: {}, square_feet: data.sqft, estimated_total: data.total, customer_name: data.customer, customer_email: data.email || "", phone: data.phone || null, shipping_address: data.address, notes: data.notes || null, status: "processing", source: "outside", delivery_date: data.deliveryDate || null });
  if (error) throw new Error("Could not add the order.");
  return { success: true };
});

export const saveMaterial = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().regex(/^[a-z0-9-]{1,60}$/), name: z.string().trim().min(1).max(80), blurb: z.string().trim().max(500), factor: z.number().positive().max(10), texture: z.string().url().refine(u => u.startsWith("https://")).or(z.literal("")), active: z.boolean() }).parse(i)).handler(async ({ data, context }) => {
  const db = await adminClient(context);
  if (!data.active) {
    const { data: settings } = await db.from("material_settings").select("*");
    const merged = new Map(defaultMaterials.map(m => [m.id, true]));
    (settings ?? []).forEach(m => merged.set(m.id, m.active)); merged.set(data.id, false);
    if (![...merged.values()].some(Boolean)) throw new Error("Keep at least one material available.");
  }
  const { error } = await db.from("material_settings").upsert({ ...data, texture: data.texture || null, updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save this material.");
  return { success: true };
});
