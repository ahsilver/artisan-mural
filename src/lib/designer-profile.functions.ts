import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DesignerProfile = { full_name: string; studio_name: string | null; country: string; bio: string; styles: string[]; portfolio_links: string[]; payout_method: string | null; payout_details: string | null; status: "pending" | "approved" | "rejected"; review_note: string | null; created_at: string };

/** The caller's own designer application (or null), whether they are the studio owner, and whether a design of theirs is approved. */
export const getMyDesignerProfile = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [{ data: isAdmin }, { data }, { count }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.from("designer_profiles").select("full_name, studio_name, country, bio, styles, portfolio_links, payout_method, payout_details, status, review_note, created_at").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("artwork_uploads").select("id", { count: "exact", head: true }).eq("owner_id", context.userId).eq("review_status", "approved"),
  ]);
  return { isAdmin: isAdmin === true, profile: (data as DesignerProfile | null) ?? null, hasApprovedDesign: (count ?? 0) > 0 };
});

const applySchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  studioName: z.string().trim().max(100),
  country: z.string().trim().min(2).max(60),
  bio: z.string().trim().min(20).max(1500),
  styles: z.array(z.string().trim().min(1).max(40)).max(10),
  portfolio: z.array(z.string().trim().url().max(500)).max(5),
});

/** Sends a designer application; it always starts as pending until the studio approves it. Payout details are asked later, once a design is approved. */
export const applyAsDesigner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => applySchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("designer_profiles").insert({ user_id: context.userId, full_name: data.fullName, studio_name: data.studioName || null, country: data.country, bio: data.bio, styles: data.styles, portfolio_links: data.portfolio, status: "pending" });
  if (error) throw new Error(error.code === "23505" ? "You have already applied." : "Could not send your application.");
  return { success: true };
});

const payoutSchema = z.object({
  payoutMethod: z.enum(["paypal", "bank", "wise"]),
  payoutDetails: z.string().trim().min(4).max(800),
});

/** Saves the caller's own payout details. Only allowed once at least one of their designs is approved. */
export const savePayoutDetails = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => payoutSchema.parse(i)).handler(async ({ data, context }) => {
  const { count } = await context.supabase.from("artwork_uploads").select("id", { count: "exact", head: true }).eq("owner_id", context.userId).eq("review_status", "approved");
  if (!count) throw new Error("You can add payout details once one of your designs is approved.");
  const { error } = await context.supabase.from("designer_profiles").update({ payout_method: data.payoutMethod, payout_details: data.payoutDetails }).eq("user_id", context.userId);
  if (error) throw new Error("Could not save your payout details.");
  return { success: true };
});
