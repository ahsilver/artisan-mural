import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { designs, designsByDesigner } from "@/lib/catalog";
import { CONTACT_BLOCKED_MESSAGE, containsContactDetails } from "@/lib/contact-guard";
import { wallSelectionSchema } from "@/lib/wall-selection";
import { quoteDetails, quoteSplit, mayApproveProof } from "./project-rules";
import { summarizeDesignOrders } from "./designer-workflow";

type Ctx = { supabase: any; userId: string };
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "message-photos";

/** Who is signed in: the studio (admin), a designer, or a customer. Roles come only from protected tables. */
async function roleOf({ supabase, userId }: Ctx) {
  const [{ data: isAdmin }, { data: account }, { data: profile }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.from("designer_accounts").select("slug").eq("user_id", userId).maybeSingle(),
    supabase.from("designer_profiles").select("status").eq("user_id", userId).maybeSingle(),
  ]);
  return { isAdmin: isAdmin === true, designerSlug: (account?.slug as string | undefined) ?? (profile?.status === "approved" ? `studio-${userId.slice(0, 8)}` : null) };
}

export const getStudioRole = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => roleOf(context));

/** Square feet ordered per design. Designers see their own designs; the studio sees everything. */
export const getDesignerStats = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await roleOf(context);
  const samples = role.isAdmin ? designs : designs.filter(d => d.designer === role.designerSlug);
  const { data: uploads, error: uploadError } = await context.supabase.from("artwork_uploads").select("id, title, artwork_colorways(position, artwork_path)").eq("owner_id", context.userId);
  if (uploadError) throw new Error("Could not load your designs.");
  const ownUploads = await Promise.all((uploads ?? []).map(async u => {
    const path = [...u.artwork_colorways].sort((a, b) => a.position - b.position)[0]?.artwork_path;
    const signed = path ? await context.supabase.storage.from("designer-artwork").createSignedUrl(path, 3600) : null;
    return { slug: `u-${u.id}`, title: u.title, image: signed?.data?.signedUrl ?? "" };
  }));
  const list = [...samples, ...ownUploads];
  if (!list.length) return { ...role, rows: [] as { slug: string; title: string; image: string; orders: number; sqft: number; printedSqft: number; lastOrder: string | null }[] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("order_requests").select("design_slug, square_feet, created_at, status").in("design_slug", list.map((d) => d.slug));
  if (error) throw new Error("Could not load your order totals.");
  const rows = list.map((d) => {
    const mine = (data ?? []).filter((o) => o.design_slug === d.slug);
    return { slug: d.slug, title: d.title, image: d.image, ...summarizeDesignOrders(mine) };
  });
  return { ...role, rows: rows.sort((a, b) => b.sqft - a.sqft) };
});

export type InboxItem = { kind: "account" | "guest"; id: string; title: string; designer: string; customer: string | null; customerId?: string; design: string | null; created_at: string; lastBody: string | null; lastAt: string; lastSender: "customer" | "designer" | "studio" | null; lastMine: boolean };

/** Every conversation the caller may see (row security decides: customer, assigned designer, or studio). */
export const listInbox = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await roleOf(context);
  const [{ data: a }, { data: g }] = await Promise.all([
    context.supabase.from("conversations").select("id, title, designer_slug, design_slug, customer_id, created_at").order("created_at", { ascending: false }).limit(200),
    context.supabase.from("guest_conversations").select("id, title, designer_slug, design_slug, customer_name, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const me = role.isAdmin ? "studio" : role.designerSlug ? "designer" : "customer";
  const aIds = (a ?? []).map((c: any) => c.id), gIds = (g ?? []).map((c: any) => c.id);
  const [{ data: am }, { data: gm }] = await Promise.all([
    aIds.length ? context.supabase.from("designer_messages").select("conversation_id, body, attachment_path, sender_role, sender_id, created_at").in("conversation_id", aIds).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
    gIds.length ? context.supabase.from("guest_conversation_messages").select("conversation_id, body, attachment_path, sender, created_at").in("conversation_id", gIds).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
  ]);
  const last = new Map<string, any>();
  for (const m of [...(am ?? []), ...(gm ?? [])] as any[]) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
  const summary = (id: string, created: string) => {
    const m = last.get(id);
    if (!m) return { lastBody: null, lastAt: created, lastSender: null, lastMine: false };
    const sender = (m.sender_role ?? m.sender) as InboxItem["lastSender"];
    return { lastBody: m.body || (m.attachment_path ? "📷 Photo" : ""), lastAt: m.created_at, lastSender: sender, lastMine: m.sender_id ? m.sender_id === context.userId : sender === me };
  };
  const items: InboxItem[] = [
    ...(a ?? []).map((c: any) => ({ kind: "account" as const, id: c.id, title: c.title, designer: c.designer_slug, customer: null, customerId:c.customer_id, design: c.design_slug, created_at: c.created_at, ...summary(c.id, c.created_at) })),
    ...(g ?? []).map((c: any) => ({ kind: "guest" as const, id: c.id, title: c.title, designer: c.designer_slug, customer: c.customer_name, design: c.design_slug, created_at: c.created_at, ...summary(c.id, c.created_at) })),
  ].sort((x, y) => y.lastAt.localeCompare(x.lastAt));
  return { ...role, items };
});

export type ThreadMessage = { id: string; sender: "customer" | "designer" | "studio"; mine: boolean; body: string; selection: z.infer<typeof wallSelectionSchema> | null; photo: string | null; created_at: string };

async function signPaths(paths: (string | null)[]) {
  const real = paths.filter((p): p is string => !!p);
  if (!real.length) return new Map<string, string>();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(real, 3600);
  return new Map((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));
}
const threadInput = z.object({ kind: z.enum(["account", "guest"]), id: z.string().uuid() });

export const readThread = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i) => threadInput.parse(i)).handler(async ({ data, context }) => {
  const role = await roleOf(context);
  const me = role.isAdmin ? "studio" : role.designerSlug ? "designer" : "customer";
  const table = data.kind === "account" ? "designer_messages" : "guest_conversation_messages";
  const { data: rows, error } = await context.supabase.from(table).select("*").eq("conversation_id", data.id).order("created_at");
  if (error) throw new Error("Could not load this conversation.");
  const urls = await signPaths((rows ?? []).map((r: any) => r.attachment_path));
  return (rows ?? []).map((r: any): ThreadMessage => {
    const sender = (data.kind === "account" ? r.sender_role : r.sender) as ThreadMessage["sender"];
    const s = sender === "designer" || sender === "studio" ? sender : "customer";
    return { id: r.id, sender: s, mine: data.kind === "account" ? r.sender_id === context.userId : s === me, body: r.body, selection: wallSelectionSchema.safeParse(r.selection).data ?? null, photo: r.attachment_path ? urls.get(r.attachment_path) ?? null : null, created_at: r.created_at };
  });
});

function parseMessageForm(input: unknown) {
  if (!(input instanceof FormData)) throw new Error("Write a message or add a photo.");
  const body = z.string().max(3000).parse(input.get("body") ?? "").trim();
  const photo = input.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && (file.size > 10 * 1024 * 1024 || !PHOTO_TYPES.includes(file.type))) throw new Error("Photos must be JPEG, PNG or WebP under 10 MB.");
  if (!body && !file) throw new Error("Write a message or add a photo.");
  if (containsContactDetails(body)) throw new Error(CONTACT_BLOCKED_MESSAGE);
  const sel = input.get("selection");
  const selection = typeof sel === "string" && sel ? wallSelectionSchema.parse(JSON.parse(sel)) : null;
  return { body, file, selection, kind: z.enum(["account", "guest"]).parse(input.get("kind")), id: z.string().uuid().parse(input.get("id")), token: typeof input.get("token") === "string" ? (input.get("token") as string) : "" };
}

async function uploadPhoto(prefix: string, file: File) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error("Could not upload the photo.");
  return path;
}

/** Signed-in sender (customer, designer or studio). Access is checked through row security before writing. */
export const sendThreadMessage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(parseMessageForm).handler(async ({ data, context }) => {
  const role = await roleOf(context);
  const table = data.kind === "account" ? "conversations" : "guest_conversations";
  const { data: conv } = await context.supabase.from(table).select("id, designer_slug").eq("id", data.id).maybeSingle();
  if (!conv) throw new Error("Conversation not found.");
  const sender = role.isAdmin ? "studio" : role.designerSlug === conv.designer_slug ? "designer" : "customer";
  if (data.kind === "guest" && sender === "customer") throw new Error("Conversation not found.");
  const path = data.file ? await uploadPhoto(`${data.kind}/${data.id}`, data.file) : null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = data.kind === "account"
    ? await supabaseAdmin.from("designer_messages").insert({ conversation_id: data.id, sender_id: context.userId, sender_role: sender, body: data.body, selection: data.selection, attachment_path: path })
    : await supabaseAdmin.from("guest_conversation_messages").insert({ conversation_id: data.id, sender, body: data.body, selection: data.selection, attachment_path: path });
  if (error) throw new Error("Your message could not be sent.");
  return { success: true };
});

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Guests (no account): the browser-held key unlocks their own conversation only. */
export const sendGuestThreadMessage = createServerFn({ method: "POST" }).inputValidator(parseMessageForm).handler(async ({ data }) => {
  if (data.kind !== "guest" || data.token.length < 32 || data.token.length > 128) throw new Error("Conversation not found.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await hashToken(data.token);
  const { data: ok } = await supabaseAdmin.from("guest_conversations").select("id").eq("id", data.id).eq("token_hash", hash).maybeSingle();
  if (!ok) throw new Error("Conversation not found.");
  const path = data.file ? await uploadPhoto(`guest/${data.id}`, data.file) : null;
  const { data: sent } = await supabaseAdmin.rpc("send_guest_conversation_message_v2", { _id: data.id, _token_hash: hash, _body: data.body, _selection: data.selection, _attachment: path as string });
  if (sent !== true) throw new Error("Your message could not be sent.");
  return { success: true };
});

export const readGuestThread = createServerFn({ method: "POST" }).inputValidator((i) => z.object({ token: z.string().min(32).max(128), id: z.string().uuid() }).parse(i)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("read_guest_conversation_v2", { _id: data.id, _token_hash: await hashToken(data.token) });
  if (error) throw new Error("Could not load this conversation.");
  const urls = await signPaths((rows ?? []).map((r) => r.attachment_path));
  return (rows ?? []).map((r): ThreadMessage & { design_slug: string | null } => {
    const s = r.sender === "designer" || r.sender === "studio" ? r.sender : "customer";
    return { id: r.id, sender: s, mine: s === "customer", body: r.body, selection: wallSelectionSchema.safeParse(r.selection).data ?? null, photo: r.attachment_path ? urls.get(r.attachment_path) ?? null : null, created_at: r.created_at, design_slug: r.design_slug };
  });
});

export type Offer = { id: string; amount: number; description: string; status: "sent" | "accepted" | "paid" | "cancelled"; created_at: string; commission: number; designerPayout: number; deliveryDays: number | null; proofStatus: string; proof: string | null; proofNote: string | null };
const toOffer = (r: any): Offer => ({ id: r.id, amount: Number(r.amount), description: r.description, status: r.status, created_at: r.created_at, ...quoteSplit(Number(r.amount)), deliveryDays:r.delivery_days??null,proofStatus:r.proof_status??"awaiting",proof:null,proofNote:r.proof_note??null });
async function withProof(r:any):Promise<Offer>{const o=toOffer(r);if(r.proof_path){const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data}=await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.proof_path,900);o.proof=data?.signedUrl??null;}return o;}

/** Returns the conversation and the caller's part in it, checked through row security. */
async function accessFor(context: Ctx, kind: "account" | "guest", id: string) {
  const role = await roleOf(context);
  const { data: conv } = await context.supabase.from(kind === "account" ? "conversations" : "guest_conversations").select(kind === "account" ? "id, designer_slug, customer_id" : "id, designer_slug").eq("id", id).maybeSingle();
  if (!conv) throw new Error("Conversation not found.");
  const part = (conv as any).customer_id===context.userId ? "customer" : role.isAdmin ? "studio" : role.designerSlug === conv.designer_slug ? "designer" : "customer";
  return { conv, part };
}
async function guestAccess(token: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("guest_conversations").select("id").eq("id", id).eq("token_hash", await hashToken(token)).maybeSingle();
  if (!data) throw new Error("Conversation not found.");
  return supabaseAdmin;
}

export const listOffers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i) => threadInput.parse(i)).handler(async ({ data, context }) => {
  await accessFor(context, data.kind, data.id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin.from("design_offers").select("*").eq("conversation_kind", data.kind).eq("conversation_id", data.id).order("created_at");
  return Promise.all((rows ?? []).map(withProof));
});

export const createOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i) => threadInput.merge(quoteDetails).parse(i)).handler(async ({ data, context }) => {
  const { conv, part } = await accessFor(context, data.kind, data.id);
  if (part === "customer") throw new Error("Only the designer or studio can send a price offer.");
  if (containsContactDetails(data.description)) throw new Error(CONTACT_BLOCKED_MESSAGE);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("design_offers").insert({ conversation_kind: data.kind, conversation_id: data.id, designer_slug: conv.designer_slug, created_by: context.userId, amount: Math.round(data.amount * 100) / 100, description: data.description, delivery_days:data.deliveryDays });
  if (error) throw new Error("Could not send the offer.");
  return { success: true };
});

const offerAction = z.object({ offer: z.string().uuid(), action: z.enum(["accept", "cancel", "approveProof"]) });
export const updateOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((i) => threadInput.merge(offerAction).parse(i)).handler(async ({ data, context }) => {
  const { part } = await accessFor(context, data.kind, data.id);
  if ((data.action === "accept" || data.action === "approveProof") && part !== "customer") throw new Error("Only the customer can accept.");
  if (data.action === "cancel" && part === "customer") throw new Error("Only the designer or studio can cancel.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {data:offer}=await supabaseAdmin.from("design_offers").select("*").eq("id",data.offer).eq("conversation_id",data.id).eq("conversation_kind",data.kind).single();
  if(!offer)throw new Error("Offer not found.");
  if(data.action==="accept" && data.kind==="account"){
    const {data:accepted,error}=await supabaseAdmin.rpc("accept_project_quote",{_offer:offer.id,_customer:context.userId});
    if(error||!accepted)throw new Error("This request already has an accepted quote or the quote has changed.");return {success:true};
  }
  const proof=data.action==="approveProof";
  if(proof&&!mayApproveProof(offer.status,offer.proof_status))throw new Error("A delivered proof is required before approval.");
  const update=proof?{proof_status:"approved",proof_approved_at:new Date().toISOString()}:data.action==="accept"?{status:"accepted",accepted_at:new Date().toISOString()}:{status:"cancelled"};
  const {data:changed,error}=await supabaseAdmin.from("design_offers").update(update).eq("id",offer.id).eq("status",proof?"accepted":"sent").select("id");
  if(error||!changed?.length)throw new Error("This offer has already changed. Refresh and try again.");
  return { success: true };
});

const guestInput = z.object({ token: z.string().min(32).max(128), id: z.string().uuid() });
export const listGuestOffers = createServerFn({ method: "POST" }).inputValidator((i) => guestInput.parse(i)).handler(async ({ data }) => {
  const admin = await guestAccess(data.token, data.id);
  const { data: rows } = await admin.from("design_offers").select("*").eq("conversation_kind", "guest").eq("conversation_id", data.id).order("created_at");
  return Promise.all((rows ?? []).map(withProof));
});
export const acceptGuestOffer = createServerFn({ method: "POST" }).inputValidator((i) => guestInput.extend({ offer: z.string().uuid() }).parse(i)).handler(async ({ data }) => {
  const admin = await guestAccess(data.token, data.id);
  const { error } = await admin.from("design_offers").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", data.offer).eq("conversation_id", data.id).eq("conversation_kind", "guest").eq("status", "sent");
  if (error) throw new Error("Could not accept the offer.");
  return { success: true };
});

/** Studio overview of every offer (admin only). */
export const listAllOffers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await roleOf(context);
  if (!role.isAdmin && !role.designerSlug) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("design_offers").select("*").order("created_at", { ascending: false }).limit(200);
  if (!role.isAdmin && role.designerSlug) q = q.eq("designer_slug", role.designerSlug);
  const { data } = await q;
  return (data ?? []).map((r) => ({ ...toOffer(r), designer: r.designer_slug }));
});
