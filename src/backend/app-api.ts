// Owner back office + designer dashboard + public settings API.
import type { Who } from "./policies";
import { signUrl } from "./storage";
import { imageDims } from "@/lib/image-dims";
import { DEFAULT_DESIGNER_FAQ } from "@/lib/designer-faq";
import { defaultTaxonomy, parseTaxonomy, canonicalCategories, canonicalRooms } from "@/lib/design-taxonomy";
type Env = any;
const j = (body: any, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const bad = (msg: string, status = 400) => j({ error: msg }, status);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const nowIso = () => new Date().toISOString();
const parseJ = (v: any, d: any = null) => { if (v == null) return d; try { return JSON.parse(v); } catch { return d; } };

export const ORDER_FLOW = ["awaiting_payment", "paid", "waiting_on_designer", "ready_to_print", "processing", "printing", "shipped", "delivered", "cancelled", "refunded"];
export const DEFAULT_SETTINGS: Record<string, any> = {
  pro: { enabled: true, name: "Artisan Pro", discountPct: 20, freeSamples: true, approvalDays: "1–2 business days", notifyEmail: "" },
  popup: { enabled: true, pct: 10, headline: "10% off your first order", text: "Join our list for new designs and get a one-time code for your first order.", delaySec: 8, exitIntent: true, hideDays: 14 },
  general: { siteName: "Artisan Mural", contactEmail: "", contactPhone: "", currency: "USD", pricePerSqft: 4.5, fitServiceFee: 45, commissionRate: 10, units: "ft", timezone: "America/New_York" },
  homepage: {
    banner: { enabled: false, text: "", link: "" },
    hero: { title: "", subtitle: "", ctaText: "", ctaLink: "/browse", image: "" },
    sections: { featured: true, howItWorks: true, designers: true, showcase: true, rooms: true, sell: true },
    featuredSlugs: [],
  },
  designerRules: { targetDpi: 200, minDpi: 150, maxUploadGb: 20, autoApproveTrusted: true, requireMockups: 1, royaltyStarter: 50, royaltyStudio: 55, royaltyAtelier: 60 },
  payments: { provider: "sola", mode: "test", solaKey: "", solaPin: "", acceptCards: true, acceptPayPal: false, manualPayments: true },
  payouts: { provider: "paypal", mode: "test", clientId: "", clientSecret: "", minimumPayout: 25, schedule: "monthly" },
  emails: { mode: "test", fromName: "Artisan Mural", fromEmail: "", replyTo: "", orderConfirmation: true, shippingUpdate: true, designerApproved: true },
  tax: { enabled: false, rate: 0, states: "", label: "Sales tax", shippingTaxable: false, tradeExempt: true },
  ai: { roomRenderEnabled: false, mockupsEnabled: true, provider: "google", apiKey: "", model: "gemini-3.1-flash-image", dailyLimit: 10, freeOverlayEnabled: true, wallDetectEnabled: true, autoTagEnabled: true, visionModel: "gemini-3.8-flash" },
  shipping: { flatRate: 0, freeOver: 0, processingDays: 5, countries: "US, CA" },
  invoices: { businessName: "", address: "", phone: "", email: "", website: "", logoUrl: "", prefix: "INV-", startNumber: 1001, dueDays: 30, taxRate: 0, ratePerSqft: "", footer: "", notes: "Thank you for your business.", estPrefix: "EST-", estStartNumber: 1001, estValidDays: 30, estTerms: "This estimate is valid until the date shown. Final price is confirmed once wall measurements are checked.", estNotes: "" },
  designerFaq: { intro: "", reviewTime: "", faq: DEFAULT_DESIGNER_FAQ },
  taxonomy: { styles: defaultTaxonomy.styles.join("\n"), themes: defaultTaxonomy.themes.join("\n"), rooms: defaultTaxonomy.rooms.join("\n") },
  community: { promoEnabled: true, promoEvery: 12, promoTitle: "Can't find what you like?", promoText: "Get it custom. Tell a designer what you have in mind.", promoCta: "Get it custom", productLineEnabled: true, requestsEnabled: true, reviewsEnabled: true, contactEnabled: true },
};
const SECRET_FIELDS: Record<string, string[]> = { payments: ["solaKey", "solaPin"], payouts: ["clientSecret"], ai: ["apiKey"] };
const PUBLIC_KEYS = ["general", "homepage", "ai", "taxonomy", "pro", "popup", "community"];

export async function getSettings(env: Env): Promise<Record<string, any>> {
  const r = await env.DB.prepare(`SELECT key, value FROM site_settings`).all();
  const out: Record<string, any> = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const row of r.results ?? []) {
    const v = parseJ(row.value, {});
    out[row.key] = typeof DEFAULT_SETTINGS[row.key] === "object" && !Array.isArray(DEFAULT_SETTINGS[row.key]) ? deepMerge(out[row.key] ?? {}, v) : v;
  }
  return out;
}
function deepMerge(a: any, b: any): any {
  if (typeof a !== "object" || a === null || Array.isArray(a) || typeof b !== "object" || b === null || Array.isArray(b)) return b === undefined ? a : b;
  const o: any = { ...a };
  for (const k of Object.keys(b)) o[k] = deepMerge(a[k], b[k]);
  return o;
}
function maskSecrets(s: Record<string, any>) {
  const o = JSON.parse(JSON.stringify(s));
  for (const [k, fields] of Object.entries(SECRET_FIELDS)) for (const f of fields) if (o[k]?.[f]) o[k][f] = "••••" + String(o[k][f]).slice(-4);
  return o;
}
async function emailUsers(env: Env): Promise<Map<string, any>> {
  const r = await env.DB.prepare(`SELECT id, email, created_at, last_sign_in_at, banned, user_metadata FROM auth_users`).all();
  return new Map((r.results ?? []).map((u: any) => [u.id, u]));
}
export async function queueEmail(env: Env, to: string, subject: string, text: string, kind: string) {
  await env.DB.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), to, subject, `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`, text, kind).run();
}
async function addEvent(env: Env, orderId: string, kind: string, message: string, actor: string | null) {
  await env.DB.prepare(`INSERT INTO order_events (id, order_id, kind, message, actor) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), orderId, kind, message, actor).run();
}
export const STATUS_LABEL: Record<string, string> = { awaiting_payment: "New (awaiting payment)", paid: "New (paid)", waiting_on_designer: "Waiting on designer", ready_to_print: "Ready to print", processing: "In production", printing: "Printing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
export function trackingUrl(carrier: string | null, num: string | null): string | null {
  if (!num) return null;
  const n = encodeURIComponent(num);
  switch ((carrier ?? "").toLowerCase()) {
    case "ups": return `https://www.ups.com/track?tracknum=${n}`;
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "dhl": return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`;
    default: return null;
  }
}

// slug -> designer user id
async function designOwners(env: Env): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const up = await env.DB.prepare(`SELECT id, owner_id FROM artwork_uploads`).all();
  for (const u of up.results ?? []) m.set(`u-${u.id}`, u.owner_id);
  const acc = await env.DB.prepare(`SELECT slug, user_id FROM designer_accounts`).all();
  const accMap = new Map((acc.results ?? []).map((a: any) => [a.slug, a.user_id]));
  try {
    const { designs } = await import("@/lib/catalog");
    for (const d of designs as any[]) { const uid = accMap.get(d.designer); if (uid) m.set(d.slug, uid as string); }
  } catch {}
  return m;
}
const COUNTED = new Set(["paid", "waiting_on_designer", "ready_to_print", "processing", "printing", "shipped", "delivered"]);
async function earnings(env: Env, settings: any) {
  const owners = await designOwners(env);
  const orders = (await env.DB.prepare(`SELECT id, design_slug, square_feet, estimated_total, status, created_at FROM order_requests`).all()).results ?? [];
  const offers = (await env.DB.prepare(`SELECT designer_slug, amount, status FROM design_offers WHERE status IN ('accepted','paid')`).all()).results ?? [];
  const pays = (await env.DB.prepare(`SELECT designer_user_id, amount, status FROM designer_payouts`).all()).results ?? [];
  const accs = (await env.DB.prepare(`SELECT slug, user_id FROM designer_accounts`).all()).results ?? [];
  const rules = settings.designerRules;
  const rate = (sqft: number) => (sqft >= 5000 ? rules.royaltyAtelier : sqft >= 2500 ? rules.royaltyStudio : rules.royaltyStarter) / 100;
  const per = new Map<string, { sqft: number; sales: number; orders: number; jobs: number; paid: number; requested?: number; items: Map<string, { sqft: number; orders: number; sales: number }> }>();
  const get = (uid: string) => { if (!per.has(uid)) per.set(uid, { sqft: 0, sales: 0, orders: 0, jobs: 0, paid: 0, items: new Map() }); return per.get(uid)!; };
  for (const o of orders) {
    if (!COUNTED.has(o.status)) continue;
    const uid = owners.get(o.design_slug); if (!uid) continue;
    const p = get(uid); p.sqft += Number(o.square_feet); p.sales += Number(o.estimated_total); p.orders++;
    const it = p.items.get(o.design_slug) ?? { sqft: 0, orders: 0, sales: 0 }; it.sqft += Number(o.square_feet); it.orders++; it.sales += Number(o.estimated_total); p.items.set(o.design_slug, it);
  }
  const accBySlug = new Map(accs.map((a: any) => [a.slug, a.user_id]));
  for (const f of offers) { const uid = accBySlug.get(f.designer_slug); if (uid) get(uid as string).jobs += Number(f.amount) * (1 - settings.general.commissionRate / 100); }
  // design requests: the designer's fee (less the studio commission) counts once the final file is delivered
  const projs = (await env.DB.prepare(`SELECT designer_user_id, fee, commission_pct FROM projects WHERE status = 'delivered' AND designer_user_id IS NOT NULL`).all()).results ?? [];
  for (const pj of projs as any[]) get(pj.designer_user_id).jobs += Number(pj.fee || 0) * (1 - Number(pj.commission_pct ?? settings.general.commissionRate) / 100);
  for (const p of pays as any[]) { const g = get(p.designer_user_id); if (p.status === "requested") g.requested = (g.requested ?? 0) + Number(p.amount); else g.paid += Number(p.amount); }
  const out = new Map<string, any>();
  for (const [uid, p] of per) {
    const royalties = p.sqft * rate(p.sqft);
    out.set(uid, { sqft: r2(p.sqft), sales: r2(p.sales), orders: p.orders, royalties: r2(royalties), jobs: r2(p.jobs), earned: r2(royalties + p.jobs), paid: r2(p.paid), requested: r2(p.requested ?? 0), owed: r2(royalties + p.jobs - p.paid), items: Object.fromEntries([...p.items].map(([k, v]) => [k, { ...v, sqft: r2(v.sqft), sales: r2(v.sales) }])) });
  }
  return out;
}
async function signAll(env: Env, bucket: string, paths: string[], ttl = 3600) {
  const out: Record<string, string> = {};
  for (const p of paths) if (p) out[p] = env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, bucket, p, ttl));
  return out;
}
function csvCell(v: any) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export async function designInfo(env: Env, slugs: string[]): Promise<Record<string, { title: string; thumb: string | null; designer?: string | null }>> {
  const out: Record<string, any> = {};
  const ups = [...new Set(slugs.filter((s) => String(s).startsWith("u-")).map((s) => s.slice(2)))];
  const ov = new Map(((await env.DB.prepare(`SELECT slug, title FROM design_overrides`).all()).results ?? []).map((x: any) => [x.slug, x.title]));
  for (let i = 0; i < ups.length; i += 80) {
    const ch = ups.slice(i, i + 80);
    const r = await env.DB.prepare(`SELECT u.id, u.title, (SELECT artwork_path FROM artwork_colorways c WHERE c.upload_id = u.id ORDER BY position LIMIT 1) path FROM artwork_uploads u WHERE u.id IN (${ch.map(() => "?").join(",")})`).bind(...ch).all();
    for (const x of r.results ?? []) out["u-" + x.id] = { title: ov.get("u-" + x.id) || x.title, thumb: x.path ? env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "designer-artwork", x.path, 3600)) : null };
  }
  try { const { designs } = await import("@/lib/catalog"); for (const d of designs as any[]) if (slugs.includes(d.slug)) out[d.slug] = { title: ov.get(d.slug) || d.title, thumb: d.image }; } catch {}
  return out;
}

async function orderList(env: Env, sp: URLSearchParams) {
  const where: string[] = []; const params: any[] = [];
  const st = sp.get("status");
  if (st && st !== "all") { if (st === "open") where.push(`status IN ('awaiting_payment','paid','waiting_on_designer','ready_to_print','processing','printing')`); else { where.push(`status = ?`); params.push(st); } }
  const q = (sp.get("q") ?? "").trim();
  if (q) { where.push(`(customer_name LIKE ? OR customer_email LIKE ? OR design_slug LIKE ? OR id LIKE ? OR tracking_number LIKE ? OR phone LIKE ?)`); for (let i = 0; i < 6; i++) params.push(`%${q}%`); }
  if (sp.get("from")) { where.push(`created_at >= ?`); params.push(sp.get("from")); }
  if (sp.get("to")) { where.push(`created_at <= ?`); params.push(sp.get("to") + "T23:59:59Z"); }
  const r = await env.DB.prepare(`SELECT * FROM order_requests ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 1000`).bind(...params).all();
  const rows = (r.results ?? []).map((o: any) => ({ ...o, selection: parseJ(o.selection, {}), print_design_snapshot: parseJ(o.print_design_snapshot) }));
  const info = await designInfo(env, rows.map((o: any) => o.design_slug));
  const pids = rows.filter((o: any) => o.project_id).map((o: any) => o.project_id);
  const ptitle = new Map<string, string>();
  for (let i = 0; i < pids.length; i += 80) { const ch = pids.slice(i, i + 80); for (const x of ((await env.DB.prepare(`SELECT id, title, kind FROM projects WHERE id IN (${ch.map(() => "?").join(",")})`).bind(...ch).all()).results ?? []) as any[]) ptitle.set(x.id, x.kind === "custom" ? `Custom: ${x.title}` : x.title); }
  return rows.map((o: any) => ({ ...o, design_title: (o.project_id && !info[o.design_slug] ? ptitle.get(o.project_id) : null) ?? info[o.design_slug]?.title ?? o.design_slug, thumb: info[o.design_slug]?.thumb ?? null }));
}

export async function handleApp(req: Request, env: Env, who: Who, origin: string): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname.replace(/^\/backend\/?/, "");
  const m = req.method;
  const rawBody = /^(designer\/files\/(put|part)|admin\/files\/part|thumbs\/put|projects\/attach|rooms\/put|community\/me\/(photo|portfolio))$/.test(p);
  const body: any = m === "GET" || m === "HEAD" || rawBody ? {} : await req.json().catch(() => ({}));
  try {
    // ---------- public ----------
    if (p === "public/settings") {
      const s = await getSettings(env);
      const out: any = {};
      for (const k of PUBLIC_KEYS) out[k] = s[k];
      out.taxonomy = parseTaxonomy(s.taxonomy);
      out.designerFaq = { intro: s.designerFaq?.intro ?? "", faq: s.designerFaq?.faq ?? "" };
      out.designerTerms = { royaltyStarter: s.designerRules.royaltyStarter, royaltyStudio: s.designerRules.royaltyStudio, royaltyAtelier: s.designerRules.royaltyAtelier, commissionRate: s.general.commissionRate, minimumPayout: s.payouts?.minimumPayout, payoutSchedule: s.payouts?.schedule, targetDpi: s.designerRules.targetDpi, minDpi: s.designerRules.minDpi, maxUploadGb: s.designerRules.maxUploadGb, processingDays: s.shipping?.processingDays, reviewTime: s.designerFaq?.reviewTime ?? "" };
      out.ai = { roomRenderEnabled: !!(s.ai.roomRenderEnabled && s.ai.apiKey), mockups: !!(s.ai.apiKey && s.ai.mockupsEnabled !== false), keySet: !!s.ai.apiKey, freeOverlayEnabled: s.ai.freeOverlayEnabled };
      return j(out, 200, { "cache-control": "public, max-age=30" });
    }
    if (p.startsWith("img/") && (m === "GET" || m === "HEAD")) {
      // Small card/gallery pictures, pre-made and kept in storage. Names change when the picture changes, so they cache for a year.
      const key = "thumbs/" + p.slice(4).replace(/\.\.+/g, "");
      const cache = (globalThis as any).caches?.default;
      const ck = new Request(url.href);
      if (cache && m === "GET") { const hit = await cache.match(ck).catch(() => null); if (hit) return hit; }
      const obj = await env.FILES.get(key);
      if (!obj) return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
      const h = new Headers(); obj.writeHttpMetadata(h);
      h.set("etag", obj.httpEtag); h.set("cache-control", "public, max-age=31536000, immutable"); h.set("content-length", String(obj.size));
      const res = new Response(obj.body, { headers: h });
      if (cache && m === "GET") { try { await cache.put(ck, res.clone()); } catch {} }
      return res;
    }
    if (p === "thumbs/put" || p === "thumbs/save") {
      const slug = (p === "thumbs/put" ? url.searchParams.get("slug") : body.slug) ?? "";
      if (!/^[a-z0-9-]{1,80}$/i.test(slug)) return bad("bad design", 400);
      let ok = who.admin;
      if (!ok && who.uid && slug.startsWith("u-")) ok = !!(await env.DB.prepare(`SELECT 1 FROM artwork_uploads WHERE id = ? AND owner_id = ?`).bind(slug.slice(2), who.uid).first());
      if (!ok) return bad("Only the owner or the design's designer can do this.", 403);
      if (p === "thumbs/put") {
        const file = url.searchParams.get("file") ?? "";
        if (!/^[a-z0-9-]{1,60}$/i.test(file)) return bad("bad file", 400);
        const buf = await req.arrayBuffer();
        if (buf.byteLength > 3_000_000) return bad("too big", 413);
        await env.FILES.put(`thumbs/${slug}/${file}`, buf, { httpMetadata: { contentType: req.headers.get("content-type") || "image/webp", cacheControl: "public, max-age=31536000, immutable" } });
        return j({ ok: true, size: buf.byteLength });
      }
      const data = JSON.stringify(body.data ?? {});
      if (data.length > 200_000) return bad("too big", 413);
      await env.DB.prepare(`INSERT INTO design_thumbs (slug, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(slug, data, new Date().toISOString()).run();
      try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
      return j({ ok: true });
    }
    if (p.startsWith("admin/")) {
      if (!who.admin) return bad("Only the owner can open this.", 403);
      return await adminRoutes(req, env, who, p.slice(6), m, body, url);
    }
    if (p === "rooms" || p.startsWith("rooms/")) {
      const { roomRoutes } = await import("./rooms-api");
      return await roomRoutes(req, env, who, p === "rooms" ? "" : p.slice(6), m, body, url);
    }
    if (p.startsWith("pro/")) {
      const { proRoutes } = await import("./pro-api");
      return await proRoutes(req, env, who, p.slice(4), m, body, url);
    }
    if (p.startsWith("account/")) {
      const { accountRoutes } = await import("./account-api");
      return await accountRoutes(req, env, who, p.slice(8), m, body);
    }
    if (p.startsWith("ai/")) {
      const { aiRoutes } = await import("./ai");
      return await aiRoutes(req, env, { ...who, role: who.admin ? "admin" : "user" }, p.slice(3), body);
    }
    if (p.startsWith("community/")) {
      const { communityRoutes } = await import("./community-api");
      return await communityRoutes(req, env, who, p.slice(10), m, body, url);
    }
    if (p.startsWith("projects/")) {
      const { projectRoutes } = await import("./projects-api");
      return await projectRoutes(req, env, who, p.slice(9), m, body, url);
    }
    if (p === "inbox" || p.startsWith("inbox/")) {
      const { inboxRoutes } = await import("./messages-api");
      return await inboxRoutes(req, env, who, p === "inbox" ? "" : p.slice(6), m, body, url);
    }
    if (p === "notifications" || p.startsWith("notifications/")) {
      const { notificationRoutes } = await import("./projects-api");
      return await notificationRoutes(env, who, p.slice(14), m, body);
    }
    if (p === "collections" || p.startsWith("collections/")) {
      const { collectionRoutes } = await import("./projects-api");
      return await collectionRoutes(env, who, p.slice(12), m, body);
    }
    if (p.startsWith("designer/")) {
      if (!who.uid) return bad("Please sign in.", 401);
      const { designerRoutes } = await import("./designer-api");
      return await designerRoutes(req, env, who, p.slice(9), m, body, url);
    }
    return bad("not found", 404);
  } catch (e: any) {
    console.error("[app]", e);
    return bad(String(e?.message ?? e), 500);
  }
}

async function adminRoutes(req: Request, env: Env, who: Who, p: string, m: string, body: any, url: URL): Promise<Response> {
  const DB = env.DB;
  const sp = url.searchParams;
  if (p === "estimates" || p.startsWith("estimates/")) {
    const { estimateRoutes } = await import("./estimates-api");
    return await estimateRoutes(env, who, p, m, body, sp);
  }
  if (p.startsWith("crm/") || p === "invoices" || p.startsWith("invoices/")) {
    const { billingRoutes } = await import("./invoices-api");
    return await billingRoutes(env, who, p, m, body, sp);
  }
  if (p === "overview") {
    const settings = await getSettings(env);
    const counts = (await DB.prepare(`SELECT status, COUNT(*) n, SUM(estimated_total) t FROM order_requests GROUP BY status`).all()).results ?? [];
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const month = await DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(estimated_total),0) t FROM order_requests WHERE created_at >= ? AND status NOT IN ('cancelled','refunded','awaiting_payment')`).bind(since).first();
    const pendingDesigns = await DB.prepare(`SELECT COUNT(*) n FROM artwork_uploads WHERE review_status = 'pending' AND submitted_at IS NOT NULL AND deleted_at IS NULL`).first();
    const pendingDesigners = await DB.prepare(`SELECT COUNT(*) n FROM designer_profiles WHERE status = 'pending'`).first();
    const customers = await DB.prepare(`SELECT COUNT(*) n FROM auth_users`).first();
    const earn = await earnings(env, settings);
    const owed = [...earn.values()].reduce((n, e) => n + Math.max(0, e.owed), 0);
    const recent = (await DB.prepare(`SELECT id, design_slug, COALESCE((SELECT a.title FROM artwork_uploads a WHERE 'u-' || a.id = order_requests.design_slug), (SELECT d.title FROM design_overrides d WHERE d.slug = order_requests.design_slug), json_extract(print_design_snapshot, '$.title')) design_title, customer_name, estimated_total, status, created_at FROM order_requests ORDER BY created_at DESC LIMIT 8`).all()).results ?? [];
    const requests = await DB.prepare(`SELECT COUNT(*) n FROM custom_requests WHERE status = 'new'`).first();
    return j({ counts, month, pendingDesigns: pendingDesigns?.n ?? 0, pendingDesigners: pendingDesigners?.n ?? 0, customers: customers?.n ?? 0, owed: r2(owed), recent, newRequests: requests?.n ?? 0 });
  }
  // ----- orders -----
  if (p === "orders" && m === "GET") return j({ orders: await orderList(env, sp), statuses: ORDER_FLOW, labels: STATUS_LABEL });
  if (p === "orders.csv") {
    const rows = await orderList(env, sp);
    const cols = ["id", "created_at", "status", "customer_name", "customer_email", "phone", "shipping_address", "design_slug", "finish", "square_feet", "estimated_total", "payment_method", "carrier", "tracking_number", "source", "notes"];
    const csv = [cols.join(","), ...rows.map((r: any) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  if (p === "orders" && m === "POST") {
    const b = body;
    if (!b.customer) return bad("Customer name is needed.");
    const id = crypto.randomUUID();
    const pay = ["paid", "unpaid", "invoice"].includes(b.paymentStatus) ? b.paymentStatus : null;
    const status = pay === "paid" ? "paid" : pay ? "awaiting_payment" : "processing";
    const method = pay === "invoice" ? "Invoice" : pay === "paid" ? String(b.paidBy || "Other").slice(0, 40) : null;
    const sel = b.selection && typeof b.selection === "object" ? JSON.stringify(b.selection).slice(0, 4000) : "{}";
    const uid = typeof b.userId === "string" && /^[0-9a-f-]{36}$/.test(b.userId) ? b.userId : null;
    let poId: string | null = null;
    if (String(b.design || "").startsWith("u-")) {
      const cols: any[] = (await DB.prepare(`SELECT name, current_original_id FROM artwork_colorways WHERE upload_id = ? ORDER BY position`).bind(String(b.design).slice(2)).all()).results ?? [];
      const cn = b.selection?.colorName; const c = (cn && cols.find((x) => x.name === cn)) || cols[0];
      poId = c?.current_original_id ?? null;
    }
    await DB.prepare(`INSERT INTO order_requests (id, design_slug, finish, selection, square_feet, estimated_total, customer_name, customer_email, phone, shipping_address, notes, status, source, delivery_date, payment_method, user_id, print_original_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'outside', ?, ?, ?, ?)`).bind(id, String(b.design || "custom").slice(0, 60), String(b.finish || "outside order").slice(0, 60), sel, Number(b.sqft) || 1, Number(b.total) || 0, String(b.customer).slice(0, 120), b.email || "", b.phone || null, b.address || "", b.notes || null, status, b.deliveryDate || null, method, uid, poId).run();
    await addEvent(env, id, "created", `Order added by owner (outside the website)${pay ? `, payment: ${pay}` : ""}`, who.uid);
    return j({ id });
  }
  let mm = p.match(/^orders\/([0-9a-f-]{36})$/);
  if (mm && m === "GET") {
    const o: any = await DB.prepare(`SELECT * FROM order_requests WHERE id = ?`).bind(mm[1]).first();
    if (!o) return bad("Order not found", 404);
    const events = (await DB.prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC`).bind(o.id).all()).results ?? [];
    // print-ready file(s)
    const files: { label: string; url: string }[] = [];
    if (o.print_original_id) {
      const po: any = await DB.prepare(`SELECT storage_path, filename FROM print_originals WHERE id = ?`).bind(o.print_original_id).first();
      if (po) files.push({ label: `Print original${parseJ(o.selection, {})?.colorName ? ` (color ${parseJ(o.selection, {}).colorName})` : ""}: ${po.filename}`, url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "print-originals", po.storage_path, 3600)) + "&download=" + encodeURIComponent(po.filename) });
    }
    if (String(o.design_slug).startsWith("u-")) {
      const cols = (await DB.prepare(`SELECT name, position, artwork_path, print_file_url FROM artwork_colorways WHERE upload_id = ? ORDER BY position`).bind(String(o.design_slug).slice(2)).all()).results ?? [];
      const sel = parseJ(o.selection, {});
      const pos = /^c\d+$/.test(sel?.color ?? "") ? Number(sel.color.slice(1)) : 0;
      const c: any = (sel?.colorName && cols.find((x: any) => x.name === sel.colorName)) || cols[pos] || cols[0];
      if (c?.print_file_url) files.push({ label: `Print file (${c.name})`, url: c.print_file_url });
      if (c?.artwork_path) files.push({ label: `Artwork (${c.name})`, url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "designer-artwork", c.artwork_path, 3600)) + "&download=" });
      const up: any = await DB.prepare(`SELECT print_file_url FROM artwork_uploads WHERE id = ?`).bind(String(o.design_slug).slice(2)).first();
      if (up?.print_file_url && !files.some((f) => f.url === up.print_file_url)) files.push({ label: "Print file", url: up.print_file_url });
    }
    const pf: any = await DB.prepare(`SELECT value FROM site_settings WHERE key = ?`).bind("printfile:" + o.design_slug).first();
    if (pf) { const v = parseJ(pf.value, {}); if (v.path) files.push({ label: v.label || "Print file", url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, v.bucket || "print-files", v.path, 3600)) + "&download=" }); }
    const crops = (await DB.prepare(`SELECT * FROM order_files WHERE order_id = ? ORDER BY created_at DESC`).bind(o.id).all()).results ?? [];
    for (const c of crops as any[]) files.push({ label: `${c.label}${c.width ? ` (${c.width}×${c.height}px)` : ""}`, url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, c.bucket, c.path, 3600)) + "&download=" });
    let project: any = null;
    if (o.project_id) {
      const pj: any = await DB.prepare(`SELECT id, kind, title, brief, status, fee, days, due_at, delivered_at, final_link, final_note, final_name, designer_user_id, commission_pct FROM projects WHERE id = ?`).bind(o.project_id).first();
      if (pj) {
        const dp: any = pj.designer_user_id ? await DB.prepare(`SELECT full_name, studio_name FROM designer_profiles WHERE user_id = ?`).bind(pj.designer_user_id).first() : null;
        project = { id: pj.id, kind: pj.kind, title: pj.title, brief: pj.brief, status: pj.status, fee: pj.fee, days: pj.days, dueAt: pj.due_at, deliveredAt: pj.delivered_at, finalNote: pj.final_note, designer: dp ? dp.studio_name || dp.full_name : null };
        if (pj.final_link) files.unshift({ label: "Final file from designer (Google Drive)", url: pj.final_link });
        // the designer's final file is what gets printed; the design's own files are only the "before"
        const fin = files.filter((f) => f.label.startsWith("Final file")), rest = files.filter((f) => !f.label.startsWith("Final file")).map((f) => ({ ...f, label: "Before changes: " + f.label }));
        files.splice(0, files.length, ...fin, ...(pj.kind === "edit" ? rest : []));
      }
    }
    // high-res artwork for preview / crop
    let art: any = null;
    const custFile: any = (crops as any[]).find((c) => String(c.label).startsWith("Customer file"));
    if (custFile && !String(o.design_slug).startsWith("u-")) art = { name: custFile.label, url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, custFile.bucket, custFile.path, 3600)) };
    else if (String(o.design_slug).startsWith("u-")) {
      const cols = (await DB.prepare(`SELECT c.name, c.artwork_path, p.storage_path, p.filename, p.mime_type, p.byte_size, p.pixel_width, p.pixel_height FROM artwork_colorways c LEFT JOIN print_originals p ON p.id = c.current_original_id WHERE c.upload_id = ? ORDER BY c.position`).bind(String(o.design_slug).slice(2)).all()).results ?? [];
      const sel = parseJ(o.selection, {}); const pos = /^c\d+$/.test(sel?.color ?? "") ? Number(sel.color.slice(1)) : 0;
      const c: any = (sel?.colorName && cols.find((x: any) => x.name === sel.colorName)) || cols[pos] || cols[0];
      if (c) art = { name: c.name, url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "designer-artwork", c.artwork_path, 3600)), original: c.storage_path ? { url: env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "print-originals", c.storage_path, 6 * 3600)), filename: c.filename, mime: c.mime_type, size: c.byte_size, width: c.pixel_width, height: c.pixel_height } : null };
    } else { const info = await designInfo(env, [o.design_slug]); if (info[o.design_slug]?.thumb) art = { name: info[o.design_slug].title, url: info[o.design_slug].thumb }; }
    let title = o.design_slug === "outside-file" ? "Customer file (outside order)" : (await designInfo(env, [o.design_slug]))[o.design_slug]?.title ?? o.design_slug;
    if (o.project_id && String(o.design_slug).startsWith("project-")) { const pt: any = await DB.prepare(`SELECT title FROM projects WHERE id = ?`).bind(o.project_id).first(); if (pt) title = `Custom: ${pt.title}`; }
    const others = o.cart_id ? ((await DB.prepare(`SELECT id, design_slug, estimated_total, status FROM order_requests WHERE cart_id = ? AND id <> ?`).bind(o.cart_id, o.id).all()).results ?? []) : [];
    return j({ order: { ...o, design_title: title, selection: parseJ(o.selection, {}), print_design_snapshot: parseJ(o.print_design_snapshot) }, art, events, files, project, cartSiblings: others, trackingUrl: trackingUrl(o.carrier, o.tracking_number) });
  }
  if (mm && m === "POST") {
    const o: any = await DB.prepare(`SELECT * FROM order_requests WHERE id = ?`).bind(mm[1]).first();
    if (!o) return bad("Order not found", 404);
    const sets: string[] = []; const vals: any[] = []; const log: string[] = [];
    if (body.status && body.status !== o.status) {
      if (!ORDER_FLOW.includes(body.status)) return bad("Unknown status");
      sets.push("status = ?", "status_updated_at = ?"); vals.push(body.status, nowIso()); log.push(`Status: ${STATUS_LABEL[o.status] ?? o.status} → ${STATUS_LABEL[body.status]}`);
    }
    if (body.carrier !== undefined && body.carrier !== o.carrier) { sets.push("carrier = ?"); vals.push(body.carrier || null); log.push(`Carrier: ${body.carrier || "none"}`); }
    if (body.tracking !== undefined && body.tracking !== o.tracking_number) { sets.push("tracking_number = ?"); vals.push(body.tracking || null); log.push(`Tracking: ${body.tracking || "none"}`); }
    if (body.paymentMethod !== undefined && body.paymentMethod !== o.payment_method) { sets.push("payment_method = ?"); vals.push(body.paymentMethod || null); log.push(`Payment: ${body.paymentMethod || "none"}`); }
    if (body.deliveryDate !== undefined && body.deliveryDate !== o.delivery_date) { sets.push("delivery_date = ?"); vals.push(body.deliveryDate || null); log.push(`Delivery date: ${body.deliveryDate || "none"}`); }
    if (sets.length) await DB.prepare(`UPDATE order_requests SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, o.id).run();
    for (const l of log) await addEvent(env, o.id, "update", l, who.uid);
    if (body.note) await addEvent(env, o.id, "note", String(body.note).slice(0, 2000), who.uid);
    if (body.notify && log.length && o.customer_email) {
      const n: any = await DB.prepare(`SELECT * FROM order_requests WHERE id = ?`).bind(o.id).first();
      const tl = trackingUrl(n.carrier, n.tracking_number);
      await queueEmail(env, o.customer_email, `Your Artisan Mural order: ${STATUS_LABEL[n.status]}`, `Hello ${o.customer_name},\n\nYour order (${o.design_slug}) is now: ${STATUS_LABEL[n.status]}.${n.tracking_number ? `\nTracking: ${n.carrier ?? ""} ${n.tracking_number}${tl ? `\n${tl}` : ""}` : ""}\n\nThank you,\nArtisan Mural`, "order_update");
      await addEvent(env, o.id, "email", `Customer email queued (test mode, not sent) to ${o.customer_email}`, who.uid);
    }
    return j({ ok: true });
  }
  if (p === "files/start" && m === "POST") {
    if (!/^[0-9a-f-]{36}$/.test(body.orderId || "")) return bad("Bad order");
    const key = `print-files/${body.orderId}/crop-${Date.now()}.${body.ext === "tif" ? "tif" : "jpg"}`;
    const mp = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: body.ext === "tif" ? "image/tiff" : "image/jpeg" } });
    return j({ key, uploadId: mp.uploadId, path: key.slice("print-files/".length) });
  }
  if (p === "files/part" && (m === "PUT" || m === "POST")) {
    const key = url.searchParams.get("key") ?? "";
    if (!key.startsWith("print-files/")) return bad("Bad key");
    const r = await env.FILES.resumeMultipartUpload(key, url.searchParams.get("uploadId") ?? "").uploadPart(Number(url.searchParams.get("part")), req.body);
    return j({ partNumber: r.partNumber, etag: r.etag });
  }
  if (p === "files/complete" && m === "POST") {
    if (!String(body.key).startsWith("print-files/")) return bad("Bad key");
    const obj = await env.FILES.resumeMultipartUpload(body.key, body.uploadId).complete(body.parts);
    const nm = String(body.key).slice("print-files/".length);
    await env.DB.prepare(`INSERT INTO storage_objects (bucket, name, size, mime, owner, updated_at) VALUES ('print-files', ?, ?, ?, ?, ?) ON CONFLICT(bucket, name) DO UPDATE SET size = excluded.size`).bind(nm, obj.size, body.mime || "image/tiff", who.uid, nowIso()).run();
    return j({ ok: true, size: obj.size });
  }
  mm = p.match(/^orders\/([0-9a-f-]{36})\/crop-url$/);
  if (mm && m === "POST") {
    const name = `${mm[1]}/crop-${Date.now()}.${body.ext === "png" ? "png" : "jpg"}`;
    const { signJwt } = await import("./auth");
    const token = await signJwt({ upload: `print-files/${name}`, owner: who.uid, exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET);
    return j({ uploadUrl: `/storage/v1/object/upload/sign/print-files/${name}?token=${token}`, path: name });
  }
  mm = p.match(/^orders\/([0-9a-f-]{36})\/files$/);
  if (mm && m === "POST") {
    if (!String(body.path || "").startsWith(mm[1] + "/")) return bad("Bad file path");
    await DB.prepare(`INSERT INTO order_files (id, order_id, bucket, path, label, width, height, created_by) VALUES (?, ?, 'print-files', ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), mm[1], body.path, String(body.label || "Cropped print file").slice(0, 120), body.width ?? null, body.height ?? null, who.uid).run();
    await addEvent(env, mm[1], "file", `New print file saved: ${body.label || "cropped"}${body.width ? ` (${body.width}×${body.height}px)` : ""}. Original kept.`, who.uid);
    return j({ ok: true });
  }
  // ----- designs -----
  if (p === "designs" && m === "GET") {
    const users = await emailUsers(env);
    const settings = await getSettings(env);
    const earn = await earnings(env, settings);
    const ups = (await DB.prepare(`SELECT * FROM artwork_uploads WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500`).all()).results ?? [];
    const cols = (await DB.prepare(`SELECT * FROM artwork_colorways`).all()).results ?? [];
    // room mockups made automatically at upload, so the owner sees them while reviewing
    const mockRows = (await DB.prepare(`SELECT colorway_id, room, image_path FROM artwork_mockups WHERE deleted_at IS NULL ORDER BY room`).all().catch(() => ({ results: [] }))).results ?? [];
    const listing = new Map(((await DB.prepare(`SELECT slug, hidden FROM design_listing`).all()).results ?? []).map((x: any) => [x.slug, !!x.hidden]));
    const ov = new Map(((await DB.prepare(`SELECT * FROM design_overrides`).all()).results ?? []).map((x: any) => [x.slug, x]));
    const profiles = new Map(((await DB.prepare(`SELECT user_id, full_name FROM designer_profiles`).all()).results ?? []).map((x: any) => [x.user_id, x.full_name]));
    const paths: string[] = [];
    const list = ups.map((u: any) => {
      const cs = cols.filter((c: any) => c.upload_id === u.id).sort((a: any, b: any) => a.position - b.position);
      const thumb = cs[0]?.artwork_path ?? null; for (const c of cs) if (c.artwork_path) paths.push(c.artwork_path);
      const cids = new Set(cs.map((c: any) => c.id));
      const mockPaths = (mockRows as any[]).filter((x) => cids.has(x.colorway_id)).slice(0, 6).map((x) => x.image_path as string); paths.push(...mockPaths);
      const slug = `u-${u.id}`; const o: any = ov.get(slug);
      const e = earn.get(u.owner_id)?.items?.[slug];
      return { id: u.id, slug, categories: canonicalCategories(parseJ(u.categories, [])), title: o?.title || u.title, sku: u.sku, kind: u.kind, repeat: u.repeat_style, widthCm: u.width_cm, heightCm: u.height_cm, status: u.status, review: u.review_status, reviewNote: u.review_note, submittedAt: u.submitted_at, createdAt: u.created_at, owner: users.get(u.owner_id)?.email ?? "", ownerName: profiles.get(u.owner_id) ?? null, colors: cs.map((c: any) => ({ id: c.id, name: c.name, swatch: c.swatch, path: c.artwork_path, hasOriginal: !!c.current_original_id })), thumbPath: thumb, mockPaths, meta: parseJ(u.error, null), recommendedFinish: parseJ(u.recommended_finish, null), description: o?.description ?? u.description ?? null, designerDescription: u.description ?? null, notes: u.designer_notes ?? null, tags: parseJ(u.tags, []), palette: u.palette ?? null, madeFor: parseJ(u.made_for, []), hidden: listing.get(slug) ?? false, pricePerSqft: o?.price_per_sqft ?? null, suggestedPrice: parseJ(u.error, {})?.suggestedPrice ?? null, story: o?.story ?? u.story, printFile: u.print_file_url, sales: e ?? null };
    });
    const signed = await signAll(env, "designer-artwork", paths);
    // built-in catalog designs too
    let builtIn: any[] = [];
    try { const { designs } = await import("@/lib/catalog"); builtIn = (designs as any[]).map((d) => ({ slug: d.slug, categories: parseJ((ov.get(d.slug) as any)?.categories, null) ?? d.categories, madeFor: parseJ((ov.get(d.slug) as any)?.rooms, null) ?? d.room, title: (ov.get(d.slug) as any)?.title || d.title, designer: d.designer, image: d.image, hidden: listing.get(d.slug) ?? false, pricePerSqft: (ov.get(d.slug) as any)?.price_per_sqft ?? null, builtIn: true })); } catch {}
    return j({ uploads: list.map((x: any) => ({ ...x, thumb: x.thumbPath ? signed[x.thumbPath] : null, mockups: (x.mockPaths ?? []).map((k: string) => signed[k]).filter(Boolean), colors: x.colors.map((c: any) => ({ ...c, thumb: c.path ? signed[c.path] ?? null : null })) })), builtIn, featured: settings.homepage.featuredSlugs ?? [] });
  }
  mm = p.match(/^colorways\/([0-9a-f-]{36})$/);
  if (mm && (m === "POST" || m === "DELETE")) {
    const c: any = await DB.prepare(`SELECT * FROM artwork_colorways WHERE id = ?`).bind(mm[1]).first();
    if (!c) return bad("Color not found", 404);
    const { colorwayEdit } = await import("./designer-api");
    const r = await colorwayEdit(DB, c, m, body);
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return r;
  }
  mm = p.match(/^designs\/([0-9a-f-]{36})\/review$/);
  if (mm && m === "POST") {
    const action = body.action;
    if (!["approved", "rejected", "pending"].includes(action)) return bad("Unknown action");
    const u: any = await DB.prepare(`SELECT owner_id, title, submitted_at FROM artwork_uploads WHERE id = ?`).bind(mm[1]).first();
    if (!u) return bad("Design not found", 404);
    await DB.prepare(`UPDATE artwork_uploads SET review_status = ?, review_note = ? WHERE id = ?`).bind(action, body.note || null, mm[1]).run();
    const users = await emailUsers(env); const to = users.get(u.owner_id)?.email;
    if (to && action !== "pending") await queueEmail(env, to, `Your design "${u.title}" was ${action}`, `Hello,\n\nYour design "${u.title}" was ${action}.${body.note ? `\nNote from the studio: ${body.note}` : ""}\n\nArtisan Mural`, "design_review");
    return j({ ok: true });
  }
  mm = p.match(/^designs\/u-([0-9a-f-]{36})\/originals$/);
  if (mm && m === "GET") { // owner: where every full-resolution original is stored, with a working link
    const rows = ((await DB.prepare(`SELECT c.id, c.name, c.position, p.storage_path, p.filename, p.mime_type, p.byte_size, p.pixel_width, p.pixel_height, p.effective_dpi, p.created_at FROM artwork_colorways c LEFT JOIN print_originals p ON p.id = c.current_original_id WHERE c.upload_id = ? ORDER BY c.position`).bind(mm[1]).all()).results ?? []) as any[];
    const jobs = ((await DB.prepare(`SELECT src, file_key FROM import_jobs WHERE upload_id = ? AND status = 'done'`).bind(mm[1]).all()).results ?? []) as any[];
    const ttl = 7 * 24 * 3600; const out: any[] = [];
    for (const r of rows) {
      const key = r.storage_path ? `print-originals/${r.storage_path}` : null;
      if (key && !r.effective_dpi && /tiff|png|jpeg|photoshop/.test(r.mime_type || "")) { // backfill the DPI saved in the file (older uploads)
        try { const ob = await env.FILES.get(key, { range: { offset: 0, length: 4 * 1024 * 1024 } }); const dd = ob ? imageDims(new Uint8Array(await ob.arrayBuffer())) : null;
          if (dd?.dpi) { r.effective_dpi = dd.dpi; await DB.prepare(`UPDATE print_originals SET effective_dpi = ? WHERE storage_path = ?`).bind(dd.dpi, r.storage_path).run(); } } catch {}
      }
      const job = key ? jobs.find((x) => x.file_key === key) : null;
      out.push({ color: r.name, filename: r.filename, mime: r.mime_type, size: r.byte_size, width: r.pixel_width, height: r.pixel_height, dpi: r.effective_dpi, uploadedAt: r.created_at,
        storage: key ? `Artisan Mural file storage › ${key}` : null,
        url: key ? env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, "print-originals", r.storage_path, ttl)) + "&download=" + encodeURIComponent(r.filename || "original") : null, urlDays: 7,
        drive: job?.src && /^[\w-]{10,}$/.test(job.src) ? `https://drive.google.com/file/d/${job.src}/view` : null });
    }
    return j({ originals: out });
  }
  mm = p.match(/^designs\/([a-z0-9-]{1,80})\/listing$/);
  if (mm && m === "POST") {
    await DB.prepare(`INSERT INTO design_listing (slug, hidden, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET hidden = excluded.hidden, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(mm[1], body.hidden ? 1 : 0, nowIso(), who.uid).run();
    return j({ ok: true });
  }
  mm = p.match(/^designs\/([a-z0-9-]{1,80})\/override$/);
  if (mm && m === "POST") {
    const price = body.pricePerSqft === "" || body.pricePerSqft == null ? null : Number(body.pricePerSqft);
    if (price !== null && !(price > 0 && price < 1000)) return bad("Price per sq ft must be between 0 and 1000.");
    { const prevO: any = await DB.prepare(`SELECT price_per_sqft FROM design_overrides WHERE slug = ?`).bind(mm[1]).first(); const before = prevO?.price_per_sqft ?? null; if ((before ?? null) !== (price ?? null)) await DB.prepare(`INSERT INTO price_history (id, kind, ref, before, after, by_user) VALUES (?, 'design', ?, ?, ?, ?)`).bind(crypto.randomUUID(), mm[1], JSON.stringify({ price: before }), JSON.stringify({ price }), who.uid).run(); }
    await DB.prepare(`INSERT INTO design_overrides (slug, title, description, story, price_per_sqft, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, description = excluded.description, story = excluded.story, price_per_sqft = excluded.price_per_sqft, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(mm[1], body.title || null, body.description || null, body.story || null, price, nowIso(), who.uid).run();
    if (Array.isArray(body.categories) || Array.isArray(body.rooms)) {
      const cats = Array.isArray(body.categories) ? JSON.stringify(canonicalCategories(body.categories.slice(0, 40).map(String))) : null;
      const rooms = Array.isArray(body.rooms) ? JSON.stringify(canonicalRooms(body.rooms.slice(0, 20).map(String))) : null;
      if (mm[1].startsWith("u-")) {
        if (cats) await DB.prepare(`UPDATE artwork_uploads SET categories = ? WHERE id = ?`).bind(cats, mm[1].slice(2)).run();
        if (rooms) await DB.prepare(`UPDATE artwork_uploads SET made_for = ? WHERE id = ?`).bind(rooms, mm[1].slice(2)).run();
      } else {
        if (cats) await DB.prepare(`UPDATE design_overrides SET categories = ? WHERE slug = ?`).bind(cats, mm[1]).run();
        if (rooms) await DB.prepare(`UPDATE design_overrides SET rooms = ? WHERE slug = ?`).bind(rooms, mm[1]).run();
      }
    }
    return j({ ok: true });
  }
  // ----- archive: what designers removed (nothing is really deleted until the owner says so) -----
  if (p === "archive" && m === "GET") {
    const users = await emailUsers(env);
    const profiles = new Map(((await DB.prepare(`SELECT user_id, full_name FROM designer_profiles`).all()).results ?? []).map((x: any) => [x.user_id, x.full_name]));
    const ups = ((await DB.prepare(`SELECT * FROM artwork_uploads WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`).all()).results ?? []) as any[];
    const upIds = ups.map((u) => u.id);
    const cols = upIds.length ? (((await DB.prepare(`SELECT c.*, p.storage_path, p.filename, p.byte_size FROM artwork_colorways c LEFT JOIN print_originals p ON p.id = c.current_original_id WHERE c.upload_id IN (${upIds.map(() => "?").join(",")}) ORDER BY c.position`).bind(...upIds).all()).results ?? []) as any[]) : [];
    const acols = ((await DB.prepare(`SELECT c.*, p.storage_path, p.filename, p.byte_size, u.title, u.owner_id FROM artwork_colorways c LEFT JOIN print_originals p ON p.id = c.current_original_id LEFT JOIN artwork_uploads u ON u.id = c.archived_from WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC LIMIT 200`).all()).results ?? []) as any[];
    const amocks = ((await DB.prepare(`SELECT m.*, c.name cname, u.title FROM artwork_mockups m LEFT JOIN artwork_colorways c ON c.id = m.archived_from LEFT JOIN artwork_uploads u ON u.id = c.upload_id WHERE m.deleted_at IS NOT NULL ORDER BY m.deleted_at DESC LIMIT 200`).all()).results ?? []) as any[];
    const sign = async (bucket: string, path: string | null, name = "") => (path ? env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, bucket, path, 3600)) + "&download=" + encodeURIComponent(name) : null);
    const who2 = (uid: string) => profiles.get(uid) || users.get(uid)?.email || "";
    const colorOut = async (c: any) => ({ id: c.id, name: c.name, thumb: c.artwork_path ? await sign("designer-artwork", c.artwork_path) : null, file: c.filename ? { name: c.filename, size: c.byte_size, url: await sign("print-originals", c.storage_path, c.filename) } : null });
    return j({
      designs: await Promise.all(ups.map(async (u) => ({ id: u.id, title: u.title, sku: u.sku, designer: who2(u.owner_id), deletedAt: u.deleted_at, wasLive: u.review_status === "approved", colors: await Promise.all(cols.filter((c) => c.upload_id === u.id).map(colorOut)) }))),
      colors: await Promise.all(acols.map(async (c) => ({ ...(await colorOut(c)), design: c.title, designer: who2(c.owner_id), deletedAt: c.deleted_at }))),
      pictures: await Promise.all(amocks.map(async (x) => ({ id: x.id, design: x.title, color: x.cname, deletedAt: x.deleted_at, url: await sign("designer-artwork", x.image_path) }))),
    });
  }
  if (p === "archive/restore" && m === "POST") {
    const id = String(body.id || "");
    if (body.kind === "design") await DB.prepare(`UPDATE artwork_uploads SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`).bind(id).run();
    else if (body.kind === "color") {
      const c: any = await DB.prepare(`SELECT * FROM artwork_colorways WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).first(); if (!c) return bad("Not found", 404);
      const mx: any = await DB.prepare(`SELECT COALESCE(MAX(position), -1) mx FROM artwork_colorways WHERE upload_id = ?`).bind(c.archived_from).first();
      await DB.prepare(`UPDATE artwork_colorways SET upload_id = archived_from, position = ?, deleted_at = NULL, archived_from = NULL WHERE id = ?`).bind(Number(mx?.mx ?? -1) + 1, id).run();
    } else if (body.kind === "picture") {
      const x: any = await DB.prepare(`SELECT * FROM artwork_mockups WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).first(); if (!x) return bad("Not found", 404);
      const mx: any = await DB.prepare(`SELECT COALESCE(MAX(room), -1) mx FROM artwork_mockups WHERE colorway_id = ?`).bind(x.archived_from).first();
      await DB.prepare(`UPDATE artwork_mockups SET colorway_id = archived_from, room = ?, deleted_at = NULL, archived_from = NULL WHERE id = ?`).bind(Number(mx?.mx ?? -1) + 1, id).run();
    } else return bad("Unknown item");
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true });
  }
  if (p === "archive/purge" && m === "POST") {
    // owner only, after a confirm in the UI: rows go, files are removed from storage (unless storage protection still holds them)
    if (body.confirm !== "DELETE") return bad("Type DELETE to confirm.");
    const id = String(body.id || ""); const keys: string[] = []; const kept: string[] = [];
    const colorRows = async (where: string, arg: string) => ((await DB.prepare(`SELECT c.id, c.artwork_path, c.current_original_id FROM artwork_colorways c WHERE ${where}`).bind(arg).all()).results ?? []) as any[];
    let cs: any[] = [];
    if (body.kind === "design") { const u: any = await DB.prepare(`SELECT id FROM artwork_uploads WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).first(); if (!u) return bad("Only archived designs can be deleted for good.", 404); cs = await colorRows("c.upload_id = ?", id); }
    else if (body.kind === "color") cs = await colorRows("c.id = ? AND c.deleted_at IS NOT NULL", id);
    else if (body.kind === "picture") { const x: any = await DB.prepare(`SELECT * FROM artwork_mockups WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).first(); if (!x) return bad("Not found", 404); keys.push("designer-artwork/" + x.image_path); await DB.prepare(`DELETE FROM artwork_mockups WHERE id = ?`).bind(id).run(); }
    else return bad("Unknown item");
    for (const c of cs) {
      if (c.artwork_path) keys.push("designer-artwork/" + c.artwork_path);
      for (const mk of (((await DB.prepare(`SELECT image_path FROM artwork_mockups WHERE colorway_id = ? OR archived_from = ?`).bind(c.id, c.id).all()).results ?? []) as any[])) keys.push("designer-artwork/" + mk.image_path);
      for (const po of (((await DB.prepare(`SELECT storage_path FROM print_originals WHERE colorway_id = ? OR id = ?`).bind(c.id, c.current_original_id ?? "").all()).results ?? []) as any[])) {
        const used: any = await DB.prepare(`SELECT COUNT(*) n FROM print_originals p JOIN artwork_colorways c2 ON c2.current_original_id = p.id WHERE p.storage_path = ? AND c2.id <> ? AND c2.deleted_at IS NULL`).bind(po.storage_path, c.id).first();
        if (Number(used?.n ?? 0) === 0) keys.push("print-originals/" + po.storage_path); else kept.push(po.storage_path);
      }
      await DB.prepare(`DELETE FROM artwork_mockups WHERE colorway_id = ? OR archived_from = ?`).bind(c.id, c.id).run();
      await DB.prepare(`UPDATE print_originals SET colorway_id = NULL WHERE colorway_id = ?`).bind(c.id).run();
      await DB.prepare(`DELETE FROM artwork_colorways WHERE id = ?`).bind(c.id).run();
    }
    if (body.kind === "design") await DB.prepare(`DELETE FROM artwork_uploads WHERE id = ?`).bind(id).run();
    let removed = 0; const locked: string[] = [];
    for (const k of [...new Set(keys)]) { try { await env.FILES.delete(k); removed++; } catch { locked.push(k); } }
    return j({ ok: true, filesRemoved: removed, filesProtected: locked.length, sharedKept: kept.length });
  }
  // ----- designers -----
  if (p === "designers" && m === "GET") {
    const users = await emailUsers(env);
    const settings = await getSettings(env);
    const earn = await earnings(env, settings);
    const prof = (await DB.prepare(`SELECT * FROM designer_profiles ORDER BY created_at DESC`).all()).results ?? [];
    const accs = new Map(((await DB.prepare(`SELECT slug, user_id FROM designer_accounts`).all()).results ?? []).map((a: any) => [a.user_id, a.slug]));
    const counts = new Map(((await DB.prepare(`SELECT owner_id, COUNT(*) n, SUM(review_status = 'approved') a FROM artwork_uploads GROUP BY owner_id`).all()).results ?? []).map((x: any) => [x.owner_id, x]));
    return j({ designers: prof.map((d: any) => ({ userId: d.user_id, name: d.full_name, studio: d.studio_name, country: d.country, bio: d.bio, styles: parseJ(d.styles, []), portfolio: parseJ(d.portfolio_links, []), status: d.status, trusted: !!d.trusted, note: d.review_note, payoutMethod: d.payout_method, payoutDetails: d.payout_details, createdAt: d.created_at, email: users.get(d.user_id)?.email ?? "", slug: accs.get(d.user_id) ?? null, designs: (counts.get(d.user_id) as any)?.n ?? 0, approvedDesigns: (counts.get(d.user_id) as any)?.a ?? 0, earnings: earn.get(d.user_id) ?? null })) });
  }
  mm = p.match(/^designers\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") {
    const d: any = await DB.prepare(`SELECT * FROM designer_profiles WHERE user_id = ?`).bind(mm[1]).first();
    if (!d) return bad("Designer not found", 404);
    if (body.status) {
      if (!["approved", "rejected", "pending", "paused"].includes(body.status)) return bad("Unknown status");
      await DB.prepare(`UPDATE designer_profiles SET status = ?, review_note = ?, reviewed_at = ? WHERE user_id = ?`).bind(body.status, body.note ?? d.review_note ?? null, nowIso(), mm[1]).run();
      const users = await emailUsers(env); const to = users.get(mm[1])?.email;
      if (to && (body.status === "approved" || body.status === "rejected")) await queueEmail(env, to, `Your designer application was ${body.status}`, `Hello ${d.full_name},\n\nYour Artisan Mural designer application was ${body.status}.${body.note ? `\n${body.note}` : ""}\n\nArtisan Mural`, "designer_review");
    }
    if (body.trusted !== undefined) await DB.prepare(`UPDATE designer_profiles SET trusted = ? WHERE user_id = ?`).bind(body.trusted ? 1 : 0, mm[1]).run();
    return j({ ok: true });
  }
  // ----- payouts -----
  if (p === "payouts" && m === "GET") {
    const users = await emailUsers(env);
    const settings = await getSettings(env);
    const earn = await earnings(env, settings);
    const prof = (await DB.prepare(`SELECT user_id, full_name, payout_method, payout_details, status FROM designer_profiles`).all()).results ?? [];
    const ids = new Set<string>([...prof.map((x: any) => x.user_id), ...earn.keys()]);
    const history = (await DB.prepare(`SELECT * FROM designer_payouts ORDER BY paid_at DESC LIMIT 500`).all()).results ?? [];
    const credits = new Map(((await DB.prepare(`SELECT user_id, COALESCE(SUM(amount),0) t FROM store_credit GROUP BY user_id`).all()).results ?? []).map((x: any) => [x.user_id, r2(x.t)]));
    const rows = [...ids].map((uid) => { const pr: any = prof.find((x: any) => x.user_id === uid); const e = earn.get(uid) ?? { sqft: 0, sales: 0, orders: 0, royalties: 0, jobs: 0, earned: 0, paid: 0, owed: 0 }; return { userId: uid, name: pr?.full_name ?? users.get(uid)?.email ?? "Designer", email: users.get(uid)?.email ?? "", method: pr?.payout_method ?? null, details: pr?.payout_details ?? null, ...e, credit: credits.get(uid) ?? 0, items: undefined }; });
    return j({ rows, history: history.map((h: any) => ({ ...h, name: (prof.find((x: any) => x.user_id === h.designer_user_id) as any)?.full_name ?? users.get(h.designer_user_id)?.email ?? "" })), mode: settings.payouts.mode, minimum: settings.payouts.minimumPayout });
  }
  if (p === "payouts" && m === "POST") {
    const amount = r2(Number(body.amount));
    if (!body.userId || !(amount > 0)) return bad("Choose a designer and an amount.");
    const settings = await getSettings(env);
    const method = body.method || "PayPal";
    const ref = method === "PayPal" ? `TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}` : "";
    const note = [method === "PayPal" ? `PayPal (${settings.payouts.mode === "live" ? "live" : "test mode, no money sent"}) ${ref}` : method, body.note].filter(Boolean).join(" · ");
    // a cash-out the designer requested is settled by this payment
    await DB.prepare(`DELETE FROM designer_payouts WHERE designer_user_id = ? AND status = 'requested'`).bind(body.userId).run();
    await DB.prepare(`INSERT INTO designer_payouts (id, designer_user_id, amount, note, paid_at, created_by, method, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')`).bind(crypto.randomUUID(), body.userId, amount, note, nowIso(), who.uid, method).run();
    return j({ ok: true, reference: ref });
  }
  // ----- coupons -----
  if (p === "coupons" && m === "GET") {
    const rows = (await DB.prepare(`SELECT c.*, (SELECT COALESCE(SUM(amount),0) FROM coupon_uses u WHERE u.code = c.code) given FROM coupons c ORDER BY created_at DESC`).all()).results ?? [];
    return j({ coupons: rows });
  }
  if (p === "coupons" && m === "POST") {
    const c = body; const code = String(c.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!code) return bad("Give the code a name, e.g. WELCOME10.");
    if (!(Number(c.value) > 0)) return bad("Enter the discount amount.");
    if (c.kind === "percent" && Number(c.value) > 90) return bad("Percent must be 90 or less.");
    await DB.prepare(`INSERT INTO coupons (code, kind, value, min_order, expires_at, max_uses, per_customer, active, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET kind = excluded.kind, value = excluded.value, min_order = excluded.min_order, expires_at = excluded.expires_at, max_uses = excluded.max_uses, per_customer = excluded.per_customer, active = excluded.active, note = excluded.note`).bind(code, c.kind === "fixed" ? "fixed" : "percent", Number(c.value), Number(c.minOrder) || 0, c.expiresAt || null, Number(c.maxUses) || null, c.perCustomer === "" || c.perCustomer == null ? 1 : Number(c.perCustomer) || null, c.active === false ? 0 : 1, c.note || null).run();
    return j({ ok: true, code });
  }
  // ----- customers -----
  if (p === "customers" && m === "GET") {
    const us = (await DB.prepare(`SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned, u.user_metadata, (SELECT COUNT(*) FROM order_requests o WHERE o.user_id = u.id) orders, (SELECT COALESCE(SUM(estimated_total),0) FROM order_requests o WHERE o.user_id = u.id AND o.status NOT IN ('cancelled','refunded','awaiting_payment')) spent, (SELECT status FROM designer_profiles p WHERE p.user_id = u.id) designer, (SELECT COUNT(*) FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') admin, (SELECT COALESCE(SUM(amount),0) FROM store_credit c WHERE c.user_id = u.id) credit, t.trade_status, t.company, t.discount_pct, t.net_terms, t.website, t.note trade_note FROM auth_users u LEFT JOIN customer_terms t ON t.user_id = u.id ORDER BY u.created_at DESC LIMIT 2000`).all()).results ?? [];
    return j({ customers: us.map((u: any) => ({ ...u, banned: !!u.banned, admin: !!u.admin, net_terms: !!u.net_terms, credit: r2(u.credit), name: parseJ(u.user_metadata, {})?.full_name ?? "" })) });
  }
  mm = p.match(/^customers\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") {
    if (mm[1] === who.uid) return bad("You can't change your own owner account here.");
    if (body.terms) {
      const t = body.terms;
      await DB.prepare(`INSERT INTO customer_terms (user_id, discount_pct, trade, trade_status, company, net_terms, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET discount_pct = excluded.discount_pct, trade = excluded.trade, trade_status = excluded.trade_status, company = COALESCE(excluded.company, customer_terms.company), net_terms = excluded.net_terms, updated_at = excluded.updated_at`).bind(mm[1], Math.max(0, Math.min(80, Number(t.discountPct) || 0)), t.tradeStatus ? 1 : 0, t.tradeStatus || null, t.company || null, t.netTerms ? 1 : 0, t.note || null, nowIso()).run();
    }
    if (body.creditAdjust) {
      const amt = r2(Number(body.creditAdjust));
      if (amt) await DB.prepare(`INSERT INTO store_credit (id, user_id, amount, kind, note) VALUES (?, ?, ?, 'adjust', ?)`).bind(crypto.randomUUID(), mm[1], amt, body.creditNote || "Adjusted by the studio").run();
    }
    if (body.banned !== undefined) { await DB.prepare(`UPDATE auth_users SET banned = ? WHERE id = ?`).bind(body.banned ? 1 : 0, mm[1]).run(); if (body.banned) await DB.prepare(`UPDATE auth_refresh SET revoked = 1 WHERE user_id = ?`).bind(mm[1]).run(); }
    if (body.admin !== undefined) { if (body.admin) await DB.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')`).bind(crypto.randomUUID(), mm[1]).run(); else await DB.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role = 'admin'`).bind(mm[1]).run(); }
    return j({ ok: true });
  }
  // ----- custom requests -----
  if (p === "requests" && m === "GET") {
    const rs = (await DB.prepare(`SELECT * FROM custom_requests ORDER BY created_at DESC LIMIT 300`).all()).results ?? [];
    return j({ requests: rs.map((r: any) => ({ ...r, photo_paths: parseJ(r.photo_paths, []), selection: parseJ(r.selection) })) });
  }
  mm = p.match(/^requests\/([0-9a-f-]{36})$/);
  if (mm && m === "POST") { await DB.prepare(`UPDATE custom_requests SET status = ? WHERE id = ?`).bind(String(body.status || "new"), mm[1]).run(); return j({ ok: true }); }
  // ----- settings -----
  if (p === "settings" && m === "GET") return j({ settings: maskSecrets(await getSettings(env)), defaults: DEFAULT_SETTINGS });
  mm = p.match(/^settings\/([a-zA-Z]+)$/);
  if (mm && m === "POST") {
    const key = mm[1];
    if (!(key in DEFAULT_SETTINGS)) return bad("Unknown settings group");
    const cur = (await getSettings(env))[key];
    const next = deepMerge(cur, body.value ?? {});
    for (const f of SECRET_FIELDS[key] ?? []) if (typeof body.value?.[f] === "string" && body.value[f].startsWith("••••")) next[f] = cur[f];
    if (key === "payments" || key === "payouts" || key === "emails") next.mode = body.value?.mode === "live" ? "test" : next.mode; // live stays off in this preview
    if (key === "general" && Number(cur.pricePerSqft) !== Number(next.pricePerSqft)) await DB.prepare(`INSERT INTO price_history (id, kind, ref, before, after, by_user) VALUES (?, 'setting', 'pricePerSqft', ?, ?, ?)`).bind(crypto.randomUUID(), JSON.stringify({ price: cur.pricePerSqft }), JSON.stringify({ price: next.pricePerSqft }), who.uid).run();
    await DB.prepare(`INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(key, JSON.stringify(next), nowIso(), who.uid).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true, settings: maskSecrets(await getSettings(env)) });
  }
  if (p === "materials" && m === "GET") {
    const { defaultMaterials } = await import("@/lib/catalog");
    const rows = (await DB.prepare(`SELECT * FROM material_settings`).all()).results ?? [];
    const all = new Map((defaultMaterials as any[]).map((x) => [x.id, { ...x, active: true }]));
    for (const r of rows as any[]) { const d: any = all.get(r.id) ?? {}; all.set(r.id, { id: r.id, name: r.name, blurb: r.blurb, factor: Number(r.factor) || 1, texture: r.texture ?? undefined, active: !!r.active, priceAdj: r.price_adj == null ? d.priceAdj ?? 0 : Number(r.price_adj), sampleIn: r.sample_in == null ? d.sampleIn ?? 2 : Number(r.sample_in), standard: r.standard == null ? !!d.standard : !!r.standard }); }
    return j({ materials: [...all.values()] });
  }
  if (p === "materials" && m === "POST") {
    const b = body;
    if (!/^[a-z0-9-]{1,60}$/.test(b.id || "")) return bad("Finish id: lowercase letters, numbers and dashes.");
    const adj = Number(b.priceAdj) || 0; const sample = Number(b.sampleIn) || 2;
    if (Math.abs(adj) > 50) return bad("Price change per sq ft must be between −50 and +50.");
    if (b.standard) await DB.prepare(`UPDATE material_settings SET standard = 0, price_adj = CASE WHEN id = ? THEN 0 ELSE price_adj END`).bind(b.id).run();
    // undo: keep the previous values
    const prev: any = await DB.prepare(`SELECT * FROM material_settings WHERE id = ?`).bind(b.id).first();
    await DB.prepare(`INSERT INTO material_settings (id, name, blurb, factor, texture, active, price_adj, sample_in, standard, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, blurb = excluded.blurb, factor = 1, texture = excluded.texture, active = excluded.active, price_adj = excluded.price_adj, sample_in = excluded.sample_in, standard = excluded.standard, updated_at = excluded.updated_at`).bind(b.id, b.name || b.id, b.blurb || "", b.texture || null, b.active ? 1 : 0, b.standard ? 0 : adj, sample, b.standard ? 1 : 0, nowIso()).run();
    if (prev) await DB.prepare(`INSERT INTO price_history (id, kind, ref, before, after, by_user) VALUES (?, 'finish', ?, ?, ?, ?)`).bind(crypto.randomUUID(), b.id, JSON.stringify({ priceAdj: prev.price_adj, standard: prev.standard, name: prev.name, blurb: prev.blurb, texture: prev.texture, active: prev.active, sampleIn: prev.sample_in }), JSON.stringify({ priceAdj: adj, standard: !!b.standard }), who.uid).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true });
  }
  if (p === "price-history" && m === "GET") {
    const rows = ((await DB.prepare(`SELECT * FROM price_history ORDER BY created_at DESC LIMIT 30`).all()).results ?? []) as any[];
    const info = await designInfo(env, rows.filter((r) => r.kind === "design").map((r) => r.ref));
    return j({ items: rows.map((r) => { const b = parseJ(r.before, {}), a2 = parseJ(r.after, {}); const label = r.kind === "finish" ? `Finish ${r.ref}: ${b.standard ? "standard" : (b.priceAdj ?? 0) + " $/sq ft"} → ${a2.standard ? "standard" : a2.priceAdj + " $/sq ft"}` : r.kind === "design" ? `${info[r.ref]?.title ?? r.ref}: ${b.price ?? "default"} → ${a2.price ?? "default"} $/sq ft` : `Default price: ${b.price} → ${a2.price} $/sq ft`; return { ...r, label }; }) });
  }
  mm = p.match(/^price-history\/([0-9a-f-]{36})\/undo$/);
  if (mm && m === "POST") {
    const r: any = await DB.prepare(`SELECT * FROM price_history WHERE id = ?`).bind(mm[1]).first();
    if (!r || r.undone) return bad("Nothing to undo");
    const b = parseJ(r.before, {});
    if (r.kind === "finish") await DB.prepare(`UPDATE material_settings SET price_adj = ?, standard = ? WHERE id = ?`).bind(b.priceAdj ?? null, b.standard ?? 0, r.ref).run();
    else if (r.kind === "design") await DB.prepare(`UPDATE design_overrides SET price_per_sqft = ? WHERE slug = ?`).bind(b.price ?? null, r.ref).run();
    else if (r.kind === "setting") { const s = await getSettings(env); s.general.pricePerSqft = b.price; await DB.prepare(`UPDATE site_settings SET value = ? WHERE key = 'general'`).bind(JSON.stringify(s.general)).run(); }
    await DB.prepare(`UPDATE price_history SET undone = 1 WHERE id = ?`).bind(r.id).run();
    try { const { invalidateShopCache } = await import("@/lib/shop.server"); invalidateShopCache(); } catch {}
    return j({ ok: true });
  }
  if (p === "outbox") {
    const r = (await DB.prepare(`SELECT id, to_addr, subject, text, kind, status, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 200`).all()).results ?? [];
    return j({ emails: r });
  }
  if (p === "upload-url" && m === "POST") {
    // owner image upload for homepage/banner: returns a signed upload target in a public bucket
    const name = `owner/${Date.now()}-${String(body.filename || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`;
    const { signJwt } = await import("./auth");
    const token = await signJwt({ upload: `site-assets/${name}`, owner: who.uid, exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET);
    return j({ uploadUrl: `/storage/v1/object/upload/sign/site-assets/${name}?token=${token}`, publicUrl: `/storage/v1/object/public/site-assets/${name}` });
  }
  return bad("not found", 404);
}
