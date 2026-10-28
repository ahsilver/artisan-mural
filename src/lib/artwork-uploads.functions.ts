import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { editImage } from "@/lib/image-gateway.server";
import { categories, roomLabels, effectiveCategories, mockupRooms } from "./design-taxonomy";
import { canSubmitArtwork } from "./designer-workflow";

const idSchema = z.object({ id: z.string().uuid() });

export const listArtworkUploads = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("artwork_uploads").select("*, artwork_colorways(*, artwork_mockups(*))").eq("owner_id", context.userId).order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your designs.");
  const withImages = await Promise.all((data ?? []).map(async upload => ({ ...upload, artwork_colorways: await Promise.all(upload.artwork_colorways.sort((a,b) => a.position-b.position).map(async color => {
    const paths = [color.artwork_path, ...color.artwork_mockups.sort((a,b) => a.room-b.room).map(m => m.image_path)];
    const { data: urls } = await context.supabase.storage.from("designer-artwork").createSignedUrls(paths, 3600);
    const {data:original}=color.current_original_id?await context.supabase.from('print_originals').select('pixel_width,pixel_height,effective_dpi,filename').eq('id',color.current_original_id).maybeSingle():{data:null};
    return { ...color, original, images: (urls ?? []).map(u => u.signedUrl) };
  })) })));
  return withImages;
});

export const createArtworkUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: FormData) => {
  if (!(input instanceof FormData)) throw new Error("Choose your artwork first.");
  const title = z.string().trim().min(2).max(120).parse(input.get("title"));
  const kind = z.enum(["mural", "repeating"]).parse(input.get("kind"));
  const repeat = z.enum(["none", "horizontal", "vertical", "both"]).parse(input.get("repeat") ?? (kind === "mural" ? "none" : "both"));
  const widthCm = z.coerce.number().positive().max(10000).parse(input.get("widthCm"));
  const heightCm = z.coerce.number().positive().max(10000).parse(input.get("heightCm"));
  const madeFor = z.array(z.string().refine(r => roomLabels.some(label => label === r))).min(1).max(9).parse(input.getAll("madeFor"));
  const styles = z.array(z.enum(categories)).max(categories.length).parse(input.getAll("category"));
  const printFileUrls = z.array(z.string().trim().max(1000).refine(u => !u || (u.startsWith("https://") && URL.canParse(u)), "Use a secure link or upload a private original.")).min(1).max(5).parse(input.getAll("printFileUrl"));
  const optNum = (k: string) => { const v = input.get(k); return v === null || v === "" ? null : z.coerce.number().positive().max(100000).parse(v); };
  const maxW = optNum("maxWidthCm"); const maxH = optNum("maxHeightCm");
  const notes = z.string().trim().max(1000).parse(input.get("notes") ?? "") || null;
  const story = z.string().trim().max(3000).parse(input.get("story") ?? "") || null;
  const names = z.array(z.string().trim().min(1).max(40)).min(1).max(5).parse(input.getAll("name"));
  return { title, kind, repeat: kind === "mural" ? "none" as const : repeat, widthCm, heightCm, madeFor, styles: effectiveCategories(madeFor, styles), printFileUrls, maxW, maxH, notes, story, names };
}).handler(async ({ data, context }) => {
  const [{data:admin},{data:profile}] = await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.from('designer_profiles').select('status').eq('user_id',context.userId).maybeSingle()]);
  if(admin!==true && profile?.status!=='approved') throw new Error('Approved designer access required.');
  const {count}=await context.supabase.from('artwork_uploads').select('id',{count:'exact',head:true}).eq('owner_id',context.userId);
  if((count??0)>=30)throw new Error('Your draft limit is 30 designs. Contact the studio.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const id=crypto.randomUUID();
  const saved=await supabaseAdmin.from('artwork_uploads').insert({id,owner_id:context.userId,title:data.title,kind:data.kind,repeat_style:data.repeat,width_cm:data.widthCm,height_cm:data.heightCm,made_for:data.madeFor,categories:data.styles,story:data.story,designer_notes:data.notes,review_status:'pending'});
  if(saved.error)throw new Error('Could not save draft.');
  const colors=data.names.map((name,position)=>({id:crypto.randomUUID(),upload_id:id,position,name,artwork_path:`${context.userId}/${id}/${position}/preview.jpg`,print_file_url:data.printFileUrls[position]||null}));
  const inserted=await supabaseAdmin.from('artwork_colorways').insert(colors);
  if(inserted.error)throw new Error('Could not save colors.');
  return {id,colors:colors.map(c=>({id:c.id,name:c.name}))};
});

// One persisted, locked item per request; the upload action advances at most 15 items.
export const generateNextArtworkRoom = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => idSchema.parse(input)).handler(async ({ data, context }) => {
  const { data: upload } = await context.supabase.from("artwork_uploads").select("*, artwork_colorways(*, artwork_mockups(*))").eq("id", data.id).single();
  if (!upload) throw new Error("Design not found.");
  const { data: paused } = await context.supabase.from("artwork_uploads").select("error").eq("owner_id", context.userId).eq("status", "paused").limit(1);
  if (paused?.length) return { done: false, error: paused[0]?.error ?? "Room generation is paused. Contact the studio." };
  if (upload.status === "ready") return { done: true, error: null };
  const apiKey = process.env["AI_GATEWAY_KEY"];
  if (!apiKey) return { done: true }; // AI room photos run from the designer portal with the shop's own AI key; built-in room scenes stay
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: locked, error: lockError } = await supabaseAdmin.rpc("claim_artwork_mockups", { _id: data.id });
  if (lockError || !locked) return { done: false, error: "These room photos are already being created. Refresh shortly." };
  try {
    const color = upload.artwork_colorways.sort((a,b) => a.position-b.position).find(c => c.artwork_mockups.length < 3);
    if (!color) {
      await supabaseAdmin.from("artwork_uploads").update({ status: "ready", lease_until: null, error: null }).eq("id", data.id);
      return { done: true, error: null };
    }
    const room = [0,1,2].find(r => !color.artwork_mockups.some(m => m.room === r));
    if (room === undefined) throw new Error("Could not choose the next room.");
    const source = await supabaseAdmin.storage.from("designer-artwork").download(color.artwork_path);
    if (source.error || !source.data) throw new Error("Could not read the original artwork.");
    const form = new FormData();
    form.append("image", new File([source.data], "artwork", { type: source.data.type }));
    form.set("stream", "false"); form.set("size", "1536x1024"); form.set("quality", "medium");
    form.set("prompt", `Create one photorealistic wallpaper installation photograph in a ${mockupRooms(upload.made_for, upload.categories)[room]?.scene}. The input image is the exact wallpaper artwork, not a room reference. Preserve its colors, motifs and composition faithfully; do not invent or recolor the design. ${upload.repeat_style === "horizontal" ? "Repeat the input pattern side by side across the wall width only, one repeat filling the full wall height." : upload.repeat_style === "vertical" ? "Repeat the input pattern vertically only, one repeat filling the full wall width." : upload.kind === "repeating" ? "Repeat the input pattern seamlessly across the wall." : "Install the complete input mural once across the wall without repeating it."} Use a straight-on camera, a single flat rectangular feature wall with visible clean corners, bright even daylight, no windows, doors, mirrors, pictures, plants or shelves on that wall. Keep furniture low and below the lower quarter of the wall; at least 75 percent of the wallpaper is clearly visible. The wall must be simple to detect for a later wallpaper preview. Show the full room framing, real floor and ceiling. No collage, lettering, logos or watermark. This is a product mockup, not a claim of a real customer installation.`);
    const upstream = await editImage({ baseURL: (((globalThis as any).process?.env?.["AI_GATEWAY_URL"] as string | undefined) ?? ""), apiKey, model: "openai/gpt-image-2.5-sunburst", format: "openai" }, form);
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
      const message = body?.message ?? body?.error?.message ?? `Room generation stopped (${upstream.status}).`;
      await supabaseAdmin.from("artwork_uploads").update({ status: [429,500,502,503,504].includes(upstream.status) ? "failed" : "paused", error: message, lease_until: null }).eq("id", data.id);
      return { done: false, error: message };
    }
    const output = await upstream.json() as { data?: { b64_json?: string }[]; error?: { message?: string } };
    const base64 = output.data?.[0]?.b64_json;
    if (!base64) {
      const message = output.error?.message ?? "No completed room photo was returned. Generation has stopped.";
      await supabaseAdmin.from("artwork_uploads").update({ status: "paused", error: message, lease_until: null }).eq("id", data.id);
      return { done: false, error: message };
    }
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const path = `${context.userId}/${data.id}/${color.position}/room-${room}.png`;
    const stored = await supabaseAdmin.storage.from("designer-artwork").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (stored.error) throw new Error("Could not save the room photo.");
    const inserted = await supabaseAdmin.from("artwork_mockups").upsert({ colorway_id: color.id, room, image_path: path }, { onConflict: "colorway_id,room" });
    if (inserted.error) throw new Error("Could not save the room photo record.");
    const total = upload.artwork_colorways.reduce((n,c) => n+c.artwork_mockups.length, 0)+1;
    const done = total === upload.artwork_colorways.length*3;
    const updated = await supabaseAdmin.from("artwork_uploads").update({ status: done ? "ready" : "generating", error: null, lease_until: null }).eq("id", data.id);
    if (updated.error) throw new Error("Could not update generation progress.");
    return { done, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not finish the room photo.";
    await supabaseAdmin.from("artwork_uploads").update({ status: "paused", error: message, lease_until: null }).eq("id", data.id);
    return { done: false, error: message };
  }
});

export const submitArtworkForApproval = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => idSchema.parse(i)).handler(async ({ data, context }) => {
  const { data: upload, error } = await context.supabase.from("artwork_uploads").select("*, artwork_colorways(id, current_original_id, artwork_path, artwork_mockups(id))").eq("owner_id", context.userId).eq("id", data.id).maybeSingle();
  if (error || !upload) throw new Error("Design not found.");
  if (upload.submitted_at) return { submitted: true };
  if(upload.artwork_colorways.some(c=>!c.current_original_id))throw new Error("Upload a verified 250-DPI original for every color before submitting.");
  for(const color of upload.artwork_colorways){const {data:preview}=await context.supabase.storage.from('designer-artwork').download(color.artwork_path);if(!preview)throw new Error('Create the website picture from each saved original before submitting.');}
  if (!canSubmitArtwork({ status: upload.status, submitted_at: upload.submitted_at, colors: upload.artwork_colorways.length, mockups: upload.artwork_colorways.reduce((n, c) => n + c.artwork_mockups.length, 0) })) throw new Error("Save at least one color version before submitting.");
  const [{ data: admin }, { data: profile }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.from("designer_profiles").select("status, trusted").eq("user_id", context.userId).maybeSingle(),
  ]);
  if (admin !== true && profile?.status !== "approved") throw new Error("Your designer account must be approved first.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.from("artwork_uploads").update({ submitted_at: new Date().toISOString(), review_status: upload.status === "ready" && (admin === true || profile?.trusted) ? "approved" : "pending" }).eq("id", upload.id).eq("owner_id", context.userId).is("submitted_at", null);
  if (result.error) throw new Error("Could not submit your design.");
  const { invalidateShopCache } = await import("@/lib/shop.server");
  invalidateShopCache();
  return { submitted: true };
});

export const updateArtworkTags = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), rooms: z.array(z.string().refine(r => roomLabels.some(label => label === r))).min(1).max(9), categories: z.array(z.enum(categories)).max(categories.length) }).parse(i)).handler(async ({ data, context }) => {
  const { data: own } = await context.supabase.from("artwork_uploads").select("id").eq("owner_id", context.userId).eq("id", data.id).maybeSingle();
  if (!own) throw new Error("Design not found.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("artwork_uploads").update({ made_for: data.rooms, categories: effectiveCategories(data.rooms, data.categories) }).eq("id", own.id).eq("owner_id", context.userId);
  if (error) throw new Error("Could not save your categories.");
  const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache();
  return { saved: true };
});

export const editOwnArtwork = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: FormData) => {
  if (!(input instanceof FormData)) throw new Error("Design details are required.");
  return {
    id: z.string().uuid().parse(input.get("id")), title: z.string().trim().min(2).max(120).parse(input.get("title")),
    story: z.string().trim().max(3000).parse(input.get("story") ?? ""), notes: z.string().trim().max(1000).parse(input.get("notes") ?? ""),
    colorName: z.string().trim().max(40).parse(input.get("colorName") ?? ""),
    printUrl: z.string().max(1000).parse(input.get("printUrl") ?? ""),
  };
}).handler(async ({ data, context }) => {
  const { data: own } = await context.supabase.from("artwork_uploads").select("*, artwork_colorways(id,position)").eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
  if (!own) throw new Error("Design not found.");
  if (own.lease_until && new Date(own.lease_until).getTime() > Date.now()) throw new Error("Wait for the current room photo to finish before editing.");
  if (data.colorName && own.artwork_colorways.length >= 5) throw new Error("A design can have up to five color versions.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Revoke publication before changing artwork; only the studio can approve the edited version.
  const updated = await supabaseAdmin.from("artwork_uploads").update({ title: data.title, story: data.story || null, designer_notes: data.notes || null, submitted_at: null, review_status: "pending", review_note: null, ...(data.colorName ? { status: "draft", error: null } : {}) }).eq("id", own.id).eq("owner_id", context.userId);
  if (updated.error) throw new Error("Could not save your design.");
  if (data.colorName) {
    const position = Math.max(-1, ...own.artwork_colorways.map(c => c.position)) + 1;
    const colorId=crypto.randomUUID(),path=`${context.userId}/${own.id}/${colorId}/preview.jpg`;
    const added = await supabaseAdmin.from("artwork_colorways").insert({id:colorId,upload_id:own.id,position,name:data.colorName,artwork_path:path,print_file_url:data.printUrl||null});
    if(added.error)throw new Error('Could not save color.');
    const {invalidateShopCache}=await import('./shop.server');invalidateShopCache();return {saved:true,needsRoomPhotos:true,colorwayId:colorId};
  }
  const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache();
  return { saved: true, needsRoomPhotos: false, colorwayId:null };
});