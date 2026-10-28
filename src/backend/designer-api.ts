// Designer dashboard API: profile, designs, big uploads (R2 multipart), Google Drive import.
import type { Who } from "./policies";
import { signUrl } from "./storage";
import { getSettings } from "./app-api";
import { imageDims } from "@/lib/image-dims";
import { defaultMaterials } from "@/lib/catalog";
import { canonicalCategories } from "@/lib/design-taxonomy";
type Env = any;
const j = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const bad = (msg: string, status = 400) => j({ error: msg }, status);
const parseJ = (v: any, d: any = null) => { if (v == null) return d; try { return JSON.parse(v); } catch { return d; } };
const nowIso = () => new Date().toISOString();
const r2n = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const PART = 32 * 1024 * 1024; // all parts the same size except the last (R2 rule)

/** Swatch crop: a square piece of the colorway picture (fractions of its width/height), or mode "color" for a flat color ball. */
function cleanCrop(v: any): string | null {
  if (!v || typeof v !== "object") return null;
  const n = (x: any, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(x) || 0));
  const w = n(v.w, 0.02, 1), h = n(v.h, 0.02, 1);
  return JSON.stringify({ x: n(v.x, 0, 1 - w), y: n(v.y, 0, 1 - h), w, h, ...(v.mode === "color" ? { mode: "color" } : {}) });
}
async function ownUpload(env: Env, who: Who, id: string) {
  // the studio owner (admin) may work on any designer's upload, e.g. re-make its room mockups from the review screen
  const u: any = who.admin && who.uid
    ? await env.DB.prepare(`SELECT * FROM artwork_uploads WHERE id = ? AND deleted_at IS NULL`).bind(id).first()
    : await env.DB.prepare(`SELECT * FROM artwork_uploads WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`).bind(id, who.uid).first();
  return u;
}
function keyFor(who: Who, bucket: string, uploadId: string, name: string) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
  return `${bucket}/${who.uid}/${uploadId}/${Date.now()}-${safe}`;
}
function ownsKey(who: Who, key: string) {
  const [bucket, uid] = key.split("/");
  return ["print-originals", "designer-artwork", "project-files"].includes(bucket) && uid === who.uid && !key.includes("..");
}
/** A paid design request this designer delivers files for (uploads land in project-files/<uid>/<projectId>/). */
async function ownProject(env: Env, who: Who, id: string) {
  const p: any = await env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND designer_user_id = ? AND status IN ('in_progress','delivered')`).bind(id, who.uid).first();
  return p ? { id: p.id, project: true } : null;
}
async function recordObject(env: Env, key: string, size: number, mime: string, owner: string | null) {
  const i = key.indexOf("/"); const bucket = key.slice(0, i), name = key.slice(i + 1);
  await env.DB.prepare(`INSERT INTO storage_objects (bucket, name, size, mime, owner, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(bucket, name) DO UPDATE SET size = excluded.size, mime = excluded.mime, updated_at = excluded.updated_at`).bind(bucket, name, size, mime, owner, nowIso()).run();
}
const signed = async (env: Env, key: string | null, ttl = 3600) => { if (!key) return null; const i = key.indexOf("/"); return env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, key.slice(0, i), key.slice(i + 1), ttl)); };

async function dimsFromR2(env: Env, key: string) {
  const o = await env.FILES.get(key, { range: { offset: 0, length: 4 * 1024 * 1024 } });
  if (!o) return null;
  return imageDims(new Uint8Array(await o.arrayBuffer()));
}
const MIME: Record<string, string> = { tif: "image/tiff", tiff: "image/tiff", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", psd: "image/vnd.adobe.photoshop", pdf: "application/pdf" };
function mimeOf(name: string, ct: string) { const ext = name.split(".").pop()?.toLowerCase() ?? ""; return MIME[ext] ?? (ct && !ct.includes("octet") ? ct : "application/octet-stream"); }
function driveId(link: string): string | null {
  const m = link.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || link.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}
export async function colorwayEdit(DB: any, c: any, m: string, body: any): Promise<Response> {
  const all = ((await DB.prepare(`SELECT id, position FROM artwork_colorways WHERE upload_id = ? ORDER BY position`).bind(c.upload_id).all()).results ?? []) as any[];
  if (m === "DELETE") {
    if (all.length <= 1) return bad("A design needs at least one color.");
    // archived, not deleted: the row moves out of the design (upload_id 'archived-…') with its print file and pictures kept
    await DB.prepare(`UPDATE artwork_colorways SET archived_from = upload_id, upload_id = 'archived-' || upload_id, position = ?, deleted_at = ? WHERE id = ?`).bind(-Date.now() % 1000000000, new Date().toISOString(), c.id).run();
    const rest = all.filter((x) => x.id !== c.id);
    for (let i = 0; i < rest.length; i++) await DB.prepare(`UPDATE artwork_colorways SET position = ? WHERE id = ?`).bind(-1000 - i, rest[i].id).run();
    for (let i = 0; i < rest.length; i++) await DB.prepare(`UPDATE artwork_colorways SET position = ? WHERE id = ?`).bind(i, rest[i].id).run();
    return j({ ok: true, archived: true });
  }
  if (body.name !== undefined) { const n = String(body.name || "").trim().slice(0, 40); if (!n) return bad("Give the color a name."); await DB.prepare(`UPDATE artwork_colorways SET name = ? WHERE id = ?`).bind(n, c.id).run(); }
  if (body.swatch !== undefined) await DB.prepare(`UPDATE artwork_colorways SET swatch = ? WHERE id = ?`).bind(cleanSwatch(body.swatch), c.id).run();
  if (body.swatchCrop !== undefined) await DB.prepare(`UPDATE artwork_colorways SET swatch_crop = ? WHERE id = ?`).bind(cleanCrop(body.swatchCrop), c.id).run();
  if (body.move === -1 || body.move === 1 || body.first) {
    const order = all.map((x) => x.id); const i = order.indexOf(c.id);
    const to = body.first ? 0 : i + body.move;
    if (i >= 0 && to >= 0 && to < order.length && to !== i) {
      order.splice(i, 1); order.splice(to, 0, c.id);
      for (let k = 0; k < order.length; k++) await DB.prepare(`UPDATE artwork_colorways SET position = ? WHERE id = ?`).bind(-1000 - k, order[k]).run();
      for (let k = 0; k < order.length; k++) await DB.prepare(`UPDATE artwork_colorways SET position = ? WHERE id = ?`).bind(k, order[k]).run();
    }
  }
  return j({ ok: true });
}
const cleanSwatch = (v: any) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);
const driveUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

export async function designerRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  const DB = env.DB;
  if (p === "me") {
    const prof: any = await DB.prepare(`SELECT * FROM designer_profiles WHERE user_id = ?`).bind(who.uid).first();
    const acc: any = await DB.prepare(`SELECT slug FROM designer_accounts WHERE user_id = ?`).bind(who.uid).first();
    const settings = await getSettings(env);
    const ups = (await DB.prepare(`SELECT * FROM artwork_uploads WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`).bind(who.uid).all()).results ?? [];
    const ids = ups.map((u: any) => u.id);
    const cols = ids.length ? ((await DB.prepare(`SELECT c.*, p.filename, p.byte_size, p.pixel_width, p.pixel_height, p.effective_dpi FROM artwork_colorways c LEFT JOIN print_originals p ON p.id = c.current_original_id WHERE c.upload_id IN (${ids.map(() => "?").join(",")}) ORDER BY c.position`).bind(...ids).all()).results ?? []) : [];
    const cids = cols.map((c: any) => c.id);
    const mocks = cids.length ? ((await DB.prepare(`SELECT * FROM artwork_mockups WHERE colorway_id IN (${cids.map(() => "?").join(",")}) ORDER BY room`).bind(...cids).all()).results ?? []) : [];
    const orders = ids.length ? ((await DB.prepare(`SELECT design_slug, square_feet, estimated_total, status, created_at FROM order_requests WHERE design_slug IN (${ids.map(() => "?").join(",")}) AND status IN ('paid','waiting_on_designer','ready_to_print','processing','printing','shipped','delivered')`).bind(...ids.map((i: string) => "u-" + i)).all()).results ?? []) : [];
    const paid = await DB.prepare(`SELECT COALESCE(SUM(CASE WHEN status = 'requested' THEN 0 ELSE amount END),0) t, COALESCE(SUM(CASE WHEN status = 'requested' THEN amount ELSE 0 END),0) rq FROM designer_payouts WHERE designer_user_id = ?`).bind(who.uid).first();
    const credit: any = await DB.prepare(`SELECT COALESCE(SUM(amount),0) t FROM store_credit WHERE user_id = ?`).bind(who.uid).first();
    const payHist = (await DB.prepare(`SELECT amount, method, status, note, paid_at FROM designer_payouts WHERE designer_user_id = ? ORDER BY paid_at DESC LIMIT 20`).bind(who.uid).all()).results ?? [];
    const rules = settings.designerRules;
    const totalSqft = orders.reduce((n: number, o: any) => n + Number(o.square_feet), 0);
    const rate = (totalSqft >= 5000 ? rules.royaltyAtelier : totalSqft >= 2500 ? rules.royaltyStudio : rules.royaltyStarter) / 100;
    const designs = [];
    for (const u of ups as any[]) {
      const cs = cols.filter((c: any) => c.upload_id === u.id);
      const os = orders.filter((o: any) => o.design_slug === "u-" + u.id);
      const sqft = os.reduce((n: number, o: any) => n + Number(o.square_feet), 0);
      const colors = [];
      for (const c of cs as any[]) colors.push({ id: c.id, name: c.name, position: c.position, swatch: c.swatch, swatchCrop: parseJ(c.swatch_crop, null), sourceName: c.source_name, preview: await signed(env, "designer-artwork/" + c.artwork_path), previewPath: c.artwork_path, original: c.filename ? { filename: c.filename, size: c.byte_size, width: c.pixel_width, height: c.pixel_height, dpi: c.effective_dpi } : null, mockups: await Promise.all(mocks.filter((x: any) => x.colorway_id === c.id).map(async (x: any) => ({ id: x.id, room: x.room, url: await signed(env, "designer-artwork/" + x.image_path) }))) });
      designs.push({ id: u.id, slug: "u-" + u.id, title: u.title, sku: u.sku, kind: u.kind, repeat: u.repeat_style, widthCm: u.width_cm, heightCm: u.height_cm, maxWidthCm: u.max_print_width_cm, maxHeightCm: u.max_print_height_cm, categories: parseJ(u.categories, []), madeFor: parseJ(u.made_for, []), story: u.story, notes: u.designer_notes, description: u.description, tags: parseJ(u.tags, []), palette: u.palette, recommendedFinish: parseJ(u.recommended_finish, null), varieties: await Promise.all((parseJ(u.varieties, []) as any[]).map(async (v: any) => ({ ...v, imageUrl: v.image ? await signed(env, "designer-artwork/" + v.image) : undefined }))), driveFolder: u.drive_folder, review: u.review_status, reviewNote: u.review_note, submittedAt: u.submitted_at, createdAt: u.created_at, meta: parseJ(u.error, null), colors, sales: { orders: os.length, sqft: r2n(sqft), revenue: r2n(os.reduce((n: number, o: any) => n + Number(o.estimated_total), 0)), royalty: r2n(sqft * rate) } });
    }
    const royalties = designs.reduce((n, d) => n + d.sales.royalty, 0);
    const comm = Number(settings.general?.commissionRate ?? 10);
    const projs = ((await DB.prepare(`SELECT id, title, status, fee, commission_pct, paid_at, delivered_at, due_at FROM projects WHERE designer_user_id = ? AND status IN ('in_progress','delivered')`).bind(who.uid).all()).results ?? []) as any[];
    const net = (x: any) => r2n(Number(x.fee || 0) * (1 - Number(x.commission_pct ?? comm) / 100));
    const jobsEarned = projs.filter((x) => x.status === "delivered").reduce((n, x) => n + net(x), 0);
    const jobsPending = projs.filter((x) => x.status === "in_progress").reduce((n, x) => n + net(x), 0);
    const earned = royalties + jobsEarned;
    const orderRows = ids.length ? ((await DB.prepare(`SELECT id, design_slug, finish, square_feet, status, created_at, project_id, due_at, selection FROM order_requests WHERE design_slug IN (${ids.map(() => "?").join(",")}) AND status NOT IN ('awaiting_payment','cancelled','refunded') ORDER BY created_at DESC LIMIT 100`).bind(...ids.map((i: string) => "u-" + i)).all()).results ?? []) as any[] : [];
    const jobOrders = ((await DB.prepare(`SELECT o.id, o.design_slug, o.finish, o.square_feet, o.status, o.created_at, o.project_id, o.due_at, o.selection FROM order_requests o JOIN projects p ON p.id = o.project_id WHERE p.designer_user_id = ? ORDER BY o.created_at DESC LIMIT 100`).bind(who.uid).all()).results ?? []) as any[];
    const finNames = new Map<string, string>(defaultMaterials.map((x: any) => [x.id, x.name])); for (const r of (((await DB.prepare(`SELECT id, name FROM material_settings`).all()).results ?? []) as any[])) if (r.name) finNames.set(r.id, r.name);
    const seen = new Set<string>(); const titleOf = new Map(designs.map((x: any) => [x.slug, x.title]));
    const myOrders = [...jobOrders, ...orderRows].filter((o) => !seen.has(o.id) && seen.add(o.id)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((o) => ({ id: o.id, design: titleOf.get(o.design_slug) ?? (o.project_id ? projs.find((x) => x.id === o.project_id)?.title ?? "Custom design" : o.design_slug), finish: finNames.get(o.finish) ?? o.finish, color: parseJ(o.selection, {})?.colorName ?? null, sqft: o.square_feet, status: o.status, at: o.created_at, projectId: o.project_id, dueAt: o.due_at, royalty: o.design_slug.startsWith("u-") && titleOf.has(o.design_slug) ? r2n(Number(o.square_feet) * rate) : 0, fee: o.project_id ? net(projs.find((x) => x.id === o.project_id) ?? {}) : 0 }));
    return j({ email: who.email, profile: prof ? { ...prof, styles: parseJ(prof.styles, []), portfolio_links: parseJ(prof.portfolio_links, []), trusted: !!prof.trusted } : null, slug: acc?.slug ?? null, designs, totals: { live: designs.filter((d) => d.review === "approved").length, pending: designs.filter((d) => d.review === "pending" && d.submittedAt).length, drafts: designs.filter((d) => !d.submittedAt).length, sqft: r2n(totalSqft), earned: r2n(earned), royalties: r2n(royalties), jobsEarned: r2n(jobsEarned), jobsPending: r2n(jobsPending), commission: comm, paid: r2n(Number(paid?.t ?? 0)), owed: r2n(earned - Number(paid?.t ?? 0) - Number((paid as any)?.rq ?? 0)), requested: r2n(Number((paid as any)?.rq ?? 0)), credit: r2n(Number(credit?.t ?? 0)), rate: Math.round(rate * 100) }, payouts: payHist, orders: myOrders, rules: { targetDpi: rules.targetDpi, minDpi: rules.minDpi, maxUploadGb: rules.maxUploadGb } });
  }
  if (p === "cashout" && m === "POST") {
    const amount = r2n(Number(body.amount));
    const me = await (await designerRoutes(req, env, who, "me", "GET", {}, url)).json() as any;
    if (!(amount > 0) || amount > me.totals.owed + 0.001) return bad(`You can take up to $${me.totals.owed.toFixed(2)}.`);
    if (body.method === "credit") {
      await DB.prepare(`INSERT INTO designer_payouts (id, designer_user_id, amount, note, paid_at, created_by, method, status) VALUES (?, ?, ?, ?, ?, ?, 'Store credit', 'paid')`).bind(crypto.randomUUID(), who.uid, amount, "Converted to store credit", nowIso(), who.uid).run();
      await DB.prepare(`INSERT INTO store_credit (id, user_id, amount, kind, note) VALUES (?, ?, ?, 'earnings', ?)`).bind(crypto.randomUUID(), who.uid, amount, "From design earnings").run();
      return j({ ok: true, credit: true });
    }
    const s = await getSettings(env);
    const min = Number(s.payouts?.minimumPayout) || 0;
    if (amount < min) return bad(`The minimum cash-out is $${min.toFixed(2)}.`);
    await DB.prepare(`INSERT INTO designer_payouts (id, designer_user_id, amount, note, paid_at, created_by, method, status) VALUES (?, ?, ?, ?, ?, ?, 'PayPal', 'requested')`).bind(crypto.randomUUID(), who.uid, amount, "Cash-out requested (PayPal, test mode)", nowIso(), who.uid).run();
    return j({ ok: true, requested: true });
  }
  if (p === "profile" && m === "POST") {
    const b = body;
    if (!b.full_name || !b.country) return bad("Name and country are needed.");
    const cur: any = await DB.prepare(`SELECT status FROM designer_profiles WHERE user_id = ?`).bind(who.uid).first();
    const vals = [String(b.full_name).slice(0, 100), b.studio_name ? String(b.studio_name).slice(0, 100) : null, String(b.country).slice(0, 60), String(b.bio ?? "").slice(0, 2000), JSON.stringify((b.styles ?? []).slice(0, 12)), JSON.stringify((b.portfolio_links ?? []).filter(Boolean).slice(0, 6)), b.payout_method || null, b.payout_details || null];
    if (cur) await DB.prepare(`UPDATE designer_profiles SET full_name = ?, studio_name = ?, country = ?, bio = ?, styles = ?, portfolio_links = ?, payout_method = ?, payout_details = ? WHERE user_id = ?`).bind(...vals, who.uid).run();
    else await DB.prepare(`INSERT INTO designer_profiles (full_name, studio_name, country, bio, styles, portfolio_links, payout_method, payout_details, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).bind(...vals, who.uid).run();
    return j({ ok: true });
  }
  if (p === "uploads" && m === "POST") {
    const b = body;
    if (!b.title) return bad("Give the design a name.");
    const id = crypto.randomUUID();
    const kind = b.kind === "mural" ? "mural" : "repeating";
    const repeat = kind === "mural" ? "none" : b.repeat === "horizontal" ? "horizontal" : b.repeat === "halfdrop" ? "halfdrop" : "both";
    await DB.prepare(`INSERT INTO artwork_uploads (id, owner_id, title, kind, repeat_style, categories, made_for, story, designer_notes, description, drive_folder, status, review_status, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', ?)`).bind(id, who.uid, String(b.title).slice(0, 120), kind, repeat, JSON.stringify(b.categories ?? []), JSON.stringify(b.madeFor ?? []), b.story || null, b.notes || null, b.description || null, b.driveFolder || null, "AM-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10)).run();
    return j({ id });
  }
  let mm = p.match(/^uploads\/([0-9a-f-]{36})$/);
  if (mm) {
    const u = await ownUpload(env, who, mm[1]); if (!u) return bad("Design not found", 404);
    if (m === "DELETE") {
      // never a real delete: hidden from the shop and from the designer's list; rows and files stay for the studio (Archive)
      await DB.prepare(`UPDATE artwork_uploads SET deleted_at = ?, deleted_by = ? WHERE id = ?`).bind(new Date().toISOString(), who.uid, u.id).run();
      try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
      return j({ ok: true, archived: true });
    }
    if (m === "POST") {
      const b = body; const sets: string[] = []; const vals: any[] = [];
      const f = (col: string, v: any) => { sets.push(`${col} = ?`); vals.push(v); };
      if (b.title !== undefined) f("title", String(b.title).slice(0, 120));
      if (b.story !== undefined) f("story", b.story || null);
      if (b.notes !== undefined) f("designer_notes", b.notes || null);
      if (b.description !== undefined) f("description", String(b.description || "").slice(0, 600) || null);
      if (b.tags !== undefined) f("tags", JSON.stringify((Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map((x: any) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 20)));
      if (b.palette !== undefined) f("palette", String(b.palette || "").slice(0, 200) || null);
      if (b.driveFolder !== undefined) f("drive_folder", b.driveFolder ? String(b.driveFolder).slice(0, 300) : null);
      if (b.categories !== undefined) f("categories", JSON.stringify(canonicalCategories(Array.isArray(b.categories) ? b.categories.slice(0, 40).map(String) : [])));
      if (b.madeFor !== undefined) f("made_for", JSON.stringify(b.madeFor));
      if (b.kind !== undefined) f("kind", b.kind === "mural" ? "mural" : "repeating");
      if (b.varieties !== undefined) f("varieties", JSON.stringify((Array.isArray(b.varieties) ? b.varieties : []).slice(0, 12).map((v: any) => ({ id: String(v?.id || "").slice(0, 40), name: v?.name ? String(v.name).slice(0, 40) : undefined, image: v?.image ? String(v.image).slice(0, 300) : undefined })).filter((v: any) => v.id)));
      if (b.recommendedFinish !== undefined) { // designer's recommended finish(es) + short note; null when none
        const rf = b.recommendedFinish || {};
        const ids = [...new Set((Array.isArray(rf.ids) ? rf.ids : []).map((x: any) => String(x || "").slice(0, 40)).filter(Boolean))].slice(0, 12);
        const note = String(rf.note || "").replace(/\s+/g, " ").trim().slice(0, 120);
        f("recommended_finish", ids.length || note ? JSON.stringify({ ids, note }) : null);
      }
      if (b.repeat !== undefined || b.kind !== undefined) { // the match belongs to the design: half-drop only for a tile that repeats on all sides; murals have no repeat
        const k = b.kind !== undefined ? (b.kind === "mural" ? "mural" : "repeating") : u.kind;
        const r = b.repeat !== undefined ? b.repeat : u.repeat_style;
        f("repeat_style", k === "mural" ? "none" : ["both", "horizontal", "halfdrop"].includes(r) ? r : "both");
      }
      for (const [k, col] of [["widthCm", "width_cm"], ["heightCm", "height_cm"], ["maxWidthCm", "max_print_width_cm"], ["maxHeightCm", "max_print_height_cm"]] as const) if (b[k] !== undefined) f(col, b[k] === null || b[k] === "" ? null : Number(b[k]));
      if (b.meta !== undefined || b.mockupRooms !== undefined) { // designer-side metadata (original size, repeat check, mockup rooms)
        const meta = b.meta !== undefined ? { ...(b.meta || {}) } : parseJ(u.error, {}) || {};
        if (b.mockupRooms !== undefined) meta.mockupRooms = (Array.isArray(b.mockupRooms) ? b.mockupRooms : []).map((x: any) => String(x).slice(0, 40)).slice(0, 5);
        f("error", JSON.stringify(meta));
      }
      if (sets.length) await DB.prepare(`UPDATE artwork_uploads SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, u.id).run();
      return j({ ok: true });
    }
  }
  mm = p.match(/^uploads\/([0-9a-f-]{36})\/submit$/);
  if (mm && m === "POST") {
    const u = await ownUpload(env, who, mm[1]); if (!u) return bad("Design not found", 404);
    const cs = (await DB.prepare(`SELECT c.id, c.current_original_id FROM artwork_colorways c WHERE upload_id = ?`).bind(u.id).all()).results ?? [];
    if (!cs.length) return bad("Add the artwork first.");
    if (cs.some((c: any) => !c.current_original_id)) return bad("Each color needs its print file.");
    if (!u.width_cm) return bad("Set the design size first.");
    const meta = parseJ(u.error, {});
    if (u.kind === "repeating" && !meta?.repeatCheck?.confirmed) return bad("Run the repeat check and confirm it first.");
    if (u.kind === "repeating" && meta?.repeatCheck?.verdict === "bad") return bad("The edges don't connect, so this can't be sold as a repeat. Upload it as a mural, or fix the tile edges.");
    if (u.kind === "repeating" && meta?.repeatCheck?.style && meta.repeatCheck.style !== (u.repeat_style === "horizontal" ? "horizontal" : u.repeat_style === "halfdrop" ? "halfdrop" : "both")) return bad("The match changed since the repeat check. Run the repeat check again.");
    const prof: any = await DB.prepare(`SELECT status, trusted FROM designer_profiles WHERE user_id = ?`).bind(who.uid).first();
    const settings = await getSettings(env);
    const auto = prof?.trusted && prof?.status === "approved" && settings.designerRules.autoApproveTrusted;
    await DB.prepare(`UPDATE artwork_uploads SET submitted_at = ?, status = 'ready', review_status = ? WHERE id = ?`).bind(nowIso(), auto ? "approved" : "pending", u.id).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true, approved: !!auto });
  }
  // ---- files ----
  if (p === "files/start" && m === "POST") {
    const u: any = (await ownUpload(env, who, body.uploadId)) ?? (await ownProject(env, who, body.uploadId)); if (!u) return bad("Design not found", 404);
    const settings = await getSettings(env);
    if (Number(body.size) > settings.designerRules.maxUploadGb * 1024 ** 3) return bad(`Files up to ${settings.designerRules.maxUploadGb} GB.`);
    const bucket = u.project ? "project-files" : body.purpose === "original" ? "print-originals" : "designer-artwork";
    const key = keyFor(who, bucket, u.id, body.filename || "file");
    const mime = body.type || "application/octet-stream";
    if (Number(body.size) <= 90 * 1024 * 1024) return j({ key, single: true });
    const mp = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: mime } });
    return j({ key, uploadId: mp.uploadId, partSize: PART });
  }
  if (p === "files/put" && (m === "PUT" || m === "POST")) {
    const key = url.searchParams.get("key") ?? "";
    if (!ownsKey(who, key)) return bad("Not your file", 403);
    if (/^(print-originals|project-files)\//.test(key) && (await env.FILES.head(key))) return bad("This file is kept and can't be replaced.", 409);
    const mime = req.headers.get("content-type") || "application/octet-stream";
    const obj = await env.FILES.put(key, req.body, { httpMetadata: { contentType: mime } });
    await recordObject(env, key, obj.size, mime, who.uid);
    let dims = null; try { dims = await dimsFromR2(env, key); } catch {}
    return j({ key, size: obj.size, dims });
  }
  if (p === "files/part" && (m === "PUT" || m === "POST")) {
    const key = url.searchParams.get("key") ?? ""; const uploadId = url.searchParams.get("uploadId") ?? ""; const part = Number(url.searchParams.get("part"));
    if (!ownsKey(who, key)) return bad("Not your file", 403);
    const mp = env.FILES.resumeMultipartUpload(key, uploadId);
    const r = await mp.uploadPart(part, req.body);
    return j({ partNumber: r.partNumber, etag: r.etag });
  }
  if (p === "files/complete" && m === "POST") {
    const key = body.key; if (!ownsKey(who, key)) return bad("Not your file", 403);
    const mp = env.FILES.resumeMultipartUpload(key, body.uploadId);
    const obj = await mp.complete(body.parts);
    await recordObject(env, key, obj.size, body.type || "application/octet-stream", who.uid);
    let dims = null; try { dims = await dimsFromR2(env, key); } catch {}
    return j({ key, size: obj.size, dims });
  }
  if (p === "files/ranges" && m === "POST") {
    // many small byte ranges of one stored file in one round trip (for previews of huge TIFFs)
    if (!ownsKey(who, body.key) && !who.admin) return bad("Not your file", 403);
    const rs: [number, number][] = (body.ranges ?? []).slice(0, 60);
    const parts = await Promise.all(rs.map(async ([o, l]) => { const ob = await env.FILES.get(body.key, { range: { offset: o, length: l } }); return ob ? new Uint8Array(await ob.arrayBuffer()) : new Uint8Array(0); }));
    const total = parts.reduce((n, x) => n + x.length + 4, 0); const out = new Uint8Array(total); const dv = new DataView(out.buffer); let o = 0;
    for (const x of parts) { dv.setUint32(o, x.length); o += 4; out.set(x, o); o += x.length; }
    return new Response(out, { headers: { "content-type": "application/octet-stream" } });
  }
  if (p === "files/url" && m === "POST") {
    if (!ownsKey(who, body.key)) return bad("Not your file", 403);
    return j({ url: await signed(env, body.key, 3600) });
  }
  // ---- Google Drive import (client-driven steps, server does the copying) ----
  if (p === "drive/start" && m === "POST") {
    const u: any = (await ownUpload(env, who, body.uploadId)) ?? (await ownProject(env, who, body.uploadId)); if (!u) return bad("Design not found", 404);
    const id = driveId(String(body.link || ""));
    if (!id) return bad("That doesn't look like a Google Drive file link.");
    if (!u.project) {
      // the same Drive file was already copied for this designer (e.g. one folder used for several designs): reuse it, no second copy
      const prev: any = await DB.prepare(`SELECT * FROM import_jobs WHERE owner_id = ? AND src = ? AND status = 'done' AND file_key LIKE 'print-originals/%' ORDER BY created_at DESC LIMIT 1`).bind(who.uid, id).first();
      if (prev) { const ob = await env.FILES.head(prev.file_key); if (ob && Number(ob.size) === Number(prev.total)) return j({ job: prev.id, reused: true, filename: prev.filename, total: Number(prev.total), key: prev.file_key, mime: prev.mime, partSize: PART, parts: 0 }); }
    }
    const head = await fetch(driveUrl(id), { headers: { range: "bytes=0-0" }, redirect: "follow" });
    const ct = head.headers.get("content-type") ?? "";
    const cr = head.headers.get("content-range") ?? "";
    const total = Number(cr.split("/")[1] || head.headers.get("content-length") || 0);
    if (ct.includes("text/html") || !total) return bad("Google Drive didn't share the file. In Drive, set sharing to 'Anyone with the link', then try again.");
    const cd = head.headers.get("content-disposition") ?? "";
    let fname = cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)![1]) : (cd.match(/filename="?([^";]+)"?/i)?.[1] ?? `drive-${id}`);
    try { if (/[\u0080-\u00ff]/.test(fname)) { const t = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(fname, (c) => c.charCodeAt(0) & 255)); fname = t; } } catch {}
    fname = fname.replace(/\uFFFD/g, "x");
    try { await head.body?.cancel(); } catch {}
    const settings = await getSettings(env);
    if (total > settings.designerRules.maxUploadGb * 1024 ** 3) return bad(`Files up to ${settings.designerRules.maxUploadGb} GB.`);
    const key = keyFor(who, u.project ? "project-files" : "print-originals", u.id, fname);
    const mime = mimeOf(fname, ct);
    const mp = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: mime } });
    const job = crypto.randomUUID();
    await DB.prepare(`INSERT INTO import_jobs (id, owner_id, upload_id, src, file_key, r2_upload_id, filename, mime, total, done, parts, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', 'running')`).bind(job, who.uid, u.id, id, key, mp.uploadId, fname, mime, total).run();
    return j({ job, filename: fname, total, key, mime, partSize: PART, parts: Math.ceil(total / PART) });
  }
  if (p === "drive/list" && m === "POST") {
    // one folder link -> every file in it (and its sub-folders), names + type; sizes come from drive/info
    const fm = String(body.link || "").match(/folders\/([a-zA-Z0-9_-]{10,})/) || String(body.link || "").match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (!fm) return bad("That isn't a Google Drive folder link. It should look like drive.google.com/drive/folders/…");
    const dec = (x: string) => x.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const out: any[] = [];
    let folderName = "";
    try {
      const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${fm[1]}`, { headers: { "accept-language": "en-US,en" } });
      const html = await r.text();
      folderName = dec(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
      const re = /<div class="flip-entry" id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>[\s\S]*?<div class="flip-entry-last-modified"><div>([^<]*)<\/div>/g; let x: any;
      while ((x = re.exec(html))) {
        const seg = x[0]; const isFolder = /\/drive\/folders\//.test(seg) || /type\/application\/vnd\.google-apps\.folder/.test(seg);
        const type = seg.match(/\/type\/([a-z0-9.+-]+\/[a-z0-9.+-]+)/i)?.[1] ?? "";
        out.push({ id: x[1], name: dec(x[2]), modified: x[3], folder: isFolder, type: isFolder ? "folder" : type, link: isFolder ? `https://drive.google.com/drive/folders/${x[1]}` : `https://drive.google.com/file/d/${x[1]}/view` });
      }
    } catch {}
    if (!out.length) {
      const r = await fetch(`https://drive.google.com/drive/folders/${fm[1]}`);
      const html = await r.text(); const seen = new Set<string>();
      const re = /data-id="([a-zA-Z0-9_-]{20,})"/g; let x: any;
      while ((x = re.exec(html))) { if (seen.has(x[1])) continue; seen.add(x[1]); const near = html.slice(x.index, x.index + 3000); const nm = near.match(/aria-label="([^"]+?) (Image|Shared|PDF|Unknown|File)/)?.[1] ?? near.match(/data-tooltip="([^"]+)"/)?.[1] ?? x[1]; out.push({ id: x[1], name: dec(nm), folder: false, type: "", link: `https://drive.google.com/file/d/${x[1]}/view` }); }
    }
    if (!out.length) return bad("No files found. In Google Drive, share the folder with 'Anyone with the link', then try again.");
    const ids = out.filter((f) => !f.folder).map((f) => f.id);
    const used = ids.length ? (((await DB.prepare(`SELECT j.src, j.total, j.status, u.title FROM import_jobs j LEFT JOIN artwork_uploads u ON u.id = j.upload_id WHERE j.owner_id = ? AND j.src IN (${ids.map(() => "?").join(",")}) AND j.status = 'done'`).bind(who.uid, ...ids).all()).results ?? []) as any[]) : [];
    for (const f of out) { const u = used.filter((x) => x.src === f.id); if (u.length) { f.copied = true; f.size = Number(u[0].total); f.usedIn = [...new Set(u.map((x) => x.title).filter(Boolean))]; } }
    out.sort((p1, p2) => (p1.folder === p2.folder ? p1.name.localeCompare(p2.name, undefined, { numeric: true }) : p1.folder ? -1 : 1));
    return j({ folderId: fm[1], name: folderName, files: out });
  }
  if (p === "drive/info" && m === "POST") {
    // size / real name / type of a few Drive files (one tiny range read each)
    const ids: string[] = (body.ids ?? []).filter((x: any) => /^[a-zA-Z0-9_-]{10,}$/.test(String(x))).slice(0, 12);
    const info = await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(driveUrl(id), { headers: { range: "bytes=0-0" }, redirect: "follow" });
        const ct = r.headers.get("content-type") ?? ""; const cr = r.headers.get("content-range") ?? "";
        const total = Number(cr.split("/")[1] || r.headers.get("content-length") || 0);
        try { await r.body?.cancel(); } catch {}
        if (ct.includes("text/html") || !total) return { id, ok: false };
        const cd = r.headers.get("content-disposition") ?? "";
        let fname = cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)![1]) : (cd.match(/filename="?([^";]+)"?/i)?.[1] ?? "");
        try { if (/[\u0080-\u00ff]/.test(fname)) fname = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(fname, (c) => c.charCodeAt(0) & 255)); } catch {}
        return { id, ok: true, size: total, name: fname.replace(/\uFFFD/g, "x"), mime: mimeOf(fname, ct) };
      } catch { return { id, ok: false }; }
    }));
    return j({ info });
  }
  if (p === "drive/ranges" && m === "POST") {
    // byte ranges straight from a shared Drive file (picture previews of big TIFFs before anything is copied)
    const id = String(body.id || ""); if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) return bad("Bad file");
    const rs: [number, number][] = (body.ranges ?? []).slice(0, 24).map((x: any) => [Math.max(0, Number(x[0]) || 0), Math.min(8 * 1024 * 1024, Math.max(1, Number(x[1]) || 1))]);
    const parts = await Promise.all(rs.map(async ([o, l]) => { for (let a = 0; a < 2; a++) { try { const r = await fetch(driveUrl(id), { headers: { range: `bytes=${o}-${o + l - 1}` } }); if (r.status === 206 || r.status === 200) { const b = new Uint8Array(await r.arrayBuffer()); return b.length > l ? b.subarray(0, l) : b; } try { await r.body?.cancel(); } catch {} } catch {} } return new Uint8Array(0); }));
    const total = parts.reduce((n, x) => n + x.length + 4, 0); const buf = new Uint8Array(total); const dv = new DataView(buf.buffer); let o = 0;
    for (const x of parts) { dv.setUint32(o, x.length); o += 4; buf.set(x, o); o += x.length; }
    return new Response(buf, { headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=600" } });
  }
  if (p === "drive/part" && m === "POST") {
    const jb: any = await DB.prepare(`SELECT * FROM import_jobs WHERE id = ? AND owner_id = ?`).bind(body.job, who.uid).first();
    if (!jb) return bad("Import not found", 404);
    const part = Number(body.part); const total = Number(jb.total);
    const start = (part - 1) * PART; const end = Math.min(total, start + PART) - 1;
    if (!(part >= 1) || start >= total) return bad("Bad part");
    const have: any = await DB.prepare(`SELECT etag FROM import_parts WHERE job_id = ? AND part = ?`).bind(jb.id, part).first();
    if (have) return j({ part, etag: have.etag, cached: true });
    const r = await fetch(driveUrl(jb.src), { headers: { range: `bytes=${start}-${end}` } });
    const len = Number(r.headers.get("content-length") || 0);
    if ((r.status !== 206 && !(r.status === 200 && start === 0 && end === total - 1)) || len !== end - start + 1) { try { await r.body?.cancel(); } catch {} return bad(`Google Drive answered ${r.status}; retrying`, 502); }
    const fl = new (globalThis as any).FixedLengthStream(len);
    const pipe = r.body!.pipeTo(fl.writable);
    const mp = env.FILES.resumeMultipartUpload(jb.file_key, jb.r2_upload_id);
    const up = await mp.uploadPart(part, fl.readable);
    await pipe;
    await DB.prepare(`INSERT OR REPLACE INTO import_parts (job_id, part, etag, bytes) VALUES (?, ?, ?, ?)`).bind(jb.id, part, up.etag, len).run();
    return j({ part, etag: up.etag });
  }
  if (p === "drive/finish" && m === "POST") {
    const jb: any = await DB.prepare(`SELECT * FROM import_jobs WHERE id = ? AND owner_id = ?`).bind(body.job, who.uid).first();
    if (!jb) return bad("Import not found", 404);
    if (jb.status === "done") return j({ status: "done", key: jb.file_key, filename: jb.filename, mime: jb.mime, total: jb.total, dims: parseJ(jb.dims) });
    const parts = ((await DB.prepare(`SELECT part, etag, bytes FROM import_parts WHERE job_id = ? ORDER BY part`).bind(jb.id).all()).results ?? []) as any[];
    const need = Math.ceil(Number(jb.total) / PART);
    if (parts.length !== need) return bad(`Only ${parts.length} of ${need} pieces arrived. Try again.`);
    const mp = env.FILES.resumeMultipartUpload(jb.file_key, jb.r2_upload_id);
    await mp.complete(parts.map((x) => ({ partNumber: x.part, etag: x.etag })));
    await recordObject(env, jb.file_key, Number(jb.total), jb.mime || "application/octet-stream", who.uid);
    let dims = null; try { dims = await dimsFromR2(env, jb.file_key); } catch {}
    await DB.prepare(`UPDATE import_jobs SET done = total, status = 'done', dims = ? WHERE id = ?`).bind(JSON.stringify(dims), jb.id).run();
    await DB.prepare(`DELETE FROM import_parts WHERE job_id = ?`).bind(jb.id).run();
    return j({ status: "done", key: jb.file_key, filename: jb.filename, mime: jb.mime, total: jb.total, dims });
  }
  // ---- attach files to a design ----
  mm = p.match(/^uploads\/([0-9a-f-]{36})\/colorways$/);
  if (mm && m === "POST") {
    const u = await ownUpload(env, who, mm[1]); if (!u) return bad("Design not found", 404);
    const b = body;
    if (!ownsKey(who, b.previewKey) || (b.originalKey && !ownsKey(who, b.originalKey))) return bad("Not your file", 403);
    const existing = (await DB.prepare(`SELECT id, position FROM artwork_colorways WHERE upload_id = ? ORDER BY position`).bind(u.id).all()).results ?? [];
    let cid = b.colorwayId; let pos = existing.length;
    const previewPath = b.previewKey.slice("designer-artwork/".length);
    if (cid) {
      const c: any = existing.find((x: any) => x.id === cid); if (!c) return bad("Color not found", 404);
      await DB.prepare(`UPDATE artwork_colorways SET name = ?, artwork_path = ?, swatch = COALESCE(?, swatch), source_name = COALESCE(?, source_name) WHERE id = ?`).bind(b.name || "Original", previewPath, cleanSwatch(b.swatch), b.sourceName || null, cid).run();
    } else {
      if (existing.length >= 6) return bad("Up to 6 colors per design.");
      cid = crypto.randomUUID();
      pos = existing.length ? Math.max(...existing.map((x: any) => Number(x.position))) + 1 : 0;
      await DB.prepare(`INSERT INTO artwork_colorways (id, upload_id, name, position, artwork_path, swatch, source_name) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(cid, u.id, String(b.name || (pos === 0 ? "Original" : `Color ${pos + 1}`)).slice(0, 40), pos, previewPath, cleanSwatch(b.swatch), b.sourceName || null).run();
    }
    if (b.originalKey) {
      let po = crypto.randomUUID();
      const path = b.originalKey.slice("print-originals/".length);
      // the same stored file used again (e.g. one Drive folder, several designs): share its record instead of a second copy
      const same: any = await DB.prepare(`SELECT id FROM print_originals WHERE storage_path = ? AND owner_id = ?`).bind(path, who.uid).first();
      if (same) { await DB.prepare(`UPDATE artwork_colorways SET current_original_id = ? WHERE id = ?`).bind(same.id, cid).run(); return j({ ok: true, colorwayId: cid, sharedOriginal: true }); }
      await DB.prepare(`INSERT INTO print_originals (id, owner_id, colorway_id, storage_path, filename, mime_type, byte_size, pixel_width, pixel_height, validation_status, effective_dpi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?)`).bind(po, who.uid, cid, path, String(b.filename || "original").slice(0, 200), b.mime || "application/octet-stream", Number(b.size) || 0, b.width || null, b.height || null, b.dpi || null).run();
      await DB.prepare(`UPDATE artwork_colorways SET current_original_id = ? WHERE id = ?`).bind(po, cid).run();
    }
    return j({ ok: true, colorwayId: cid });
  }
  mm = p.match(/^colorways\/([0-9a-f-]{36})$/);
  if (mm && (m === "POST" || m === "DELETE")) {
    const c: any = await DB.prepare(`SELECT c.* FROM artwork_colorways c JOIN artwork_uploads u ON u.id = c.upload_id WHERE c.id = ? AND u.owner_id = ?`).bind(mm[1], who.uid).first();
    if (!c) return bad("Color not found", 404);
    return colorwayEdit(DB, c, m, body);
  }
  mm = p.match(/^colorways\/([0-9a-f-]{36})\/mockups$/);
  if (mm && m === "POST") {
    const c: any = await DB.prepare(`SELECT c.id FROM artwork_colorways c JOIN artwork_uploads u ON u.id = c.upload_id WHERE c.id = ? AND (u.owner_id = ? OR ? = 1)`).bind(mm[1], who.uid, who.admin ? 1 : 0).first();
    if (!c) return bad("Color not found", 404);
    if (body.replace) await DB.prepare(`UPDATE artwork_mockups SET archived_from = colorway_id, colorway_id = 'archived-' || colorway_id, deleted_at = ? WHERE colorway_id = ?`).bind(new Date().toISOString(), c.id).run();
    const keys: string[] = body.keys ?? [];
    for (const k of keys) if (!ownsKey(who, k) || !k.startsWith("designer-artwork/")) return bad("Not your file", 403);
    const have = (await DB.prepare(`SELECT COALESCE(MAX(room), -1) mx FROM artwork_mockups WHERE colorway_id = ?`).bind(c.id).first()) as any;
    let room = Number(have?.mx ?? -1) + 1;
    for (const k of keys) await DB.prepare(`INSERT INTO artwork_mockups (id, colorway_id, room, image_path) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), c.id, room++, k.slice("designer-artwork/".length)).run();
    return j({ ok: true });
  }
  mm = p.match(/^mockups\/([0-9a-f-]{36})$/);
  if (mm && m === "DELETE") {
    const x: any = await DB.prepare(`SELECT m.id FROM artwork_mockups m JOIN artwork_colorways c ON c.id = m.colorway_id JOIN artwork_uploads u ON u.id = c.upload_id WHERE m.id = ? AND u.owner_id = ?`).bind(mm[1], who.uid).first();
    if (!x) return bad("Not found", 404);
    await DB.prepare(`UPDATE artwork_mockups SET archived_from = colorway_id, colorway_id = 'archived-' || colorway_id, deleted_at = ? WHERE id = ?`).bind(new Date().toISOString(), x.id).run();
    return j({ ok: true, archived: true });
  }
  return bad("not found", 404);
}
