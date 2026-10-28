import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { designerBySlug, designBySlug, registerShop } from "@/lib/catalog";
import { wallSelectionSchema } from "@/lib/wall-selection";
import { CONTACT_BLOCKED_MESSAGE, containsContactDetails } from "@/lib/contact-guard";

const chatBody = z.string().trim().min(1).max(3000);
function guardBody(body: string) {
  if (containsContactDetails(body)) throw new Error(CONTACT_BLOCKED_MESSAGE);
}

/** Calls the backend with the public key; private data is only reachable through token-checked database functions. */
async function publicRest(path: string, body: unknown) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Chat is not configured yet.");
  return fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, ...(!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const guestToken = z.string().min(32).max(128);

/** Sample requests go to the studio (not the designer) and need a delivery contact. */
export const sendGuestDesignerRequest = createServerFn({ method: "POST" })
  .validator((input) => z.object({ designer: z.string().max(60), design: z.string().max(60), name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255), body: chatBody, selection: wallSelectionSchema }).parse(input))
  .handler(async ({ data }) => {
    const { loadShopData } = await import("@/lib/shop.server");
    registerShop(await loadShopData());
    const design = designBySlug(data.design);
    if (!design || design.designer !== data.designer) throw new Error("Design not found for this designer");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Requests are not configured yet.");
    const response = await fetch(`${url}/rest/v1/guest_designer_requests`, {
      method: "POST",
      headers: { apikey: key, ...(!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ designer_slug: data.designer, design_slug: data.design, customer_name: data.name, customer_email: data.email, body: data.body, selection: data.selection }),
    });
    if (!response.ok) throw new Error("Your request could not be saved. Please try again.");
    return { success: true };
  });

/** Guest chat: no email. The browser keeps a private key that unlocks the conversation on Artisan Mural. */
export const startGuestConversation = createServerFn({ method: "POST" })
  .validator((input) => z.object({ token: guestToken, designer: z.string().max(60), design: z.string().max(60), name: z.string().trim().min(1).max(100), body: chatBody, selection: wallSelectionSchema }).parse(input))
  .handler(async ({ data }) => {
    guardBody(data.body);
    const { loadShopData } = await import("@/lib/shop.server");
    registerShop(await loadShopData());
    const design = designBySlug(data.design);
    const designer = designerBySlug(data.designer);
    if (!design || !designer || design.designer !== designer.slug) throw new Error("Design not found for this designer");
    const response = await publicRest("rpc/start_guest_conversation", { _token_hash: await hashToken(data.token), _designer: designer.slug, _design: design.slug, _name: data.name, _title: `${design.title} · Your wall`, _body: data.body, _selection: data.selection });
    if (!response.ok) throw new Error("Your message could not be sent. Please try again.");
    return { id: (await response.json()) as string, title: `${design.title} · Your wall`, designer: designer.slug };
  });

export const sendGuestMessage = createServerFn({ method: "POST" })
  .validator((input) => z.object({ token: guestToken, conversation: z.string().uuid(), body: chatBody, selection: wallSelectionSchema.nullable() }).parse(input))
  .handler(async ({ data }) => {
    guardBody(data.body);
    const response = await publicRest("rpc/send_guest_conversation_message", { _id: data.conversation, _token_hash: await hashToken(data.token), _body: data.body, _selection: data.selection });
    if (!response.ok || (await response.json()) !== true) throw new Error("Your message could not be sent. Please try again.");
    return { success: true };
  });

export const readGuestConversation = createServerFn({ method: "POST" })
  .validator((input) => z.object({ token: guestToken, conversation: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const response = await publicRest("rpc/read_guest_conversation", { _id: data.conversation, _token_hash: await hashToken(data.token) });
    if (!response.ok) throw new Error("Could not load this conversation.");
    const rows = (await response.json()) as { id: string; sender: string; body: string; selection: unknown; created_at: string; designer_slug: string; design_slug: string | null; title: string }[];
    return rows.map((r) => ({ id: r.id, sender: r.sender === "designer" ? "designer" as const : "customer" as const, body: r.body, selection: wallSelectionSchema.safeParse(r.selection).data ?? null, created_at: r.created_at, designer_slug: r.designer_slug, design_slug: r.design_slug, title: r.title }));
  });

export const startDesignerConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ designer: z.string().max(60), design: z.string().max(60).optional(), body: chatBody, selection: wallSelectionSchema.optional() }).parse(input))
  .handler(async ({ data, context }) => {
    guardBody(data.body);
    const { loadShopData } = await import("@/lib/shop.server");
    registerShop(await loadShopData());
    const designer = designerBySlug(data.designer);
    if (!designer) throw new Error("Designer not found");
    const design = data.design ? designBySlug(data.design) : undefined;
    if (data.design && (!design || design.designer !== designer.slug)) throw new Error("Design not found for this designer");
    const { data: conversation, error } = await context.supabase.from("conversations").insert({ customer_id: context.userId, designer_slug: designer.slug, design_slug: design?.slug ?? null, title: design ? `${design.title} · Your wall` : `Custom design · ${designer.name}` }).select("id").single();
    if (error || !conversation) throw new Error(error?.message ?? "Could not start conversation");
    const { error: messageError } = await context.supabase.from("designer_messages").insert({ conversation_id: conversation.id, sender_id: context.userId, body: data.body, selection: data.selection ?? null });
    if (messageError) throw new Error(messageError.message);
    return { id: conversation.id };
  });

export const sendDesignerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ conversation: z.string().uuid(), body: chatBody, selection: wallSelectionSchema.optional() }).parse(input))
  .handler(async ({ data, context }) => {
    guardBody(data.body);
    const { error } = await context.supabase.from("designer_messages").insert({ conversation_id: data.conversation, sender_id: context.userId, body: data.body, selection: data.selection ?? null });
    if (error) throw new Error(error.message);
    return { success: true };
  });
