import { applyOverride, type Category, type Design, type Designer, type DesignOverride, type ShopData, type MaterialSetting } from "@/lib/catalog";
import { effectiveCategories, parseTaxonomy, canonicalCategories, type Taxonomy } from "./design-taxonomy";
const jsonList = (v: any): string[] => { if (Array.isArray(v)) return v.map(String); if (typeof v === "string" && v) { try { const x = JSON.parse(v); return Array.isArray(x) ? x.map(String) : []; } catch { return []; } } return []; };

// Per-worker short-lived cache. The shared database remains the source of truth.
// Signed URLs expire after 24 hours; cache entries expire after 2 minutes.
const CACHE_MS = 2 * 60 * 1000;
let cached: { value: ShopData; until: number } | undefined;
let inFlight: Promise<ShopData> | undefined;

export function invalidateShopCache() {
  cached = undefined;
  inFlight = undefined;
}

export async function loadShopData(): Promise<ShopData> {
  if (cached && Date.now() < cached.until) return cached.value;
  if (!inFlight) {
    inFlight = fetchShopData().then(value => {
      cached = { value, until: Date.now() + CACHE_MS };
      return value;
    }).finally(() => { inFlight = undefined; });
  }
  return inFlight;
}

/** Load one approved upload without fetching and signing the entire catalog. */
export async function loadSingleDesign(slug: string): Promise<ShopData> {
  if (!/^u-[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(slug)) return { designs: [], designers: [], hidden: [], collections: [] };
  return fetchShopData(slug.slice(2));
}

/** Small card pictures made per design (table design_thumbs, read straight from the database). */
async function loadThumbRows(slug?: string): Promise<{ slug: string; data: string }[]> {
  const DB = (globalThis as any).__AM_ENV?.DB;
  if (!DB) return [];
  try {
    const r = slug ? await DB.prepare("SELECT slug, data FROM design_thumbs WHERE slug = ?").bind(slug).all() : await DB.prepare("SELECT slug, data FROM design_thumbs").all();
    return (r.results ?? []) as any;
  } catch { return []; }
}

function profileExtra(p: any) {
  if (!p) return {};
  const sp = (() => { try { const v = typeof p.specialties === "string" ? JSON.parse(p.specialties) : p.specialties; return Array.isArray(v) && v.length ? v : null; } catch { return null; } })();
  return { ...(sp ? { specialties: sp } : {}), photo: p.photo_key ? `/backend/community/img/${p.photo_key}` : undefined, responseLabel: p.response_label || undefined, turnaroundDays: p.turnaround_days ? Number(p.turnaround_days) : undefined, hidden: !!Number(p.public_hidden), rating: 0, reviews: 0, responseTime: p.response_label || "" };
}

async function fetchShopData(uploadId?: string): Promise<ShopData> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [uploads, listing, accounts, profiles, finishes, overrideRows, reviewRows, collectionRows, thumbRows] = await Promise.all([
    db.from("artwork_uploads").select("id, sku, owner_id, title, kind, categories, repeat_style, width_cm, height_cm, made_for, max_print_width_cm, story, description, tags, palette, varieties, recommended_finish, created_at, artwork_colorways(name, position, artwork_path, swatch, swatch_crop, current_original_id, artwork_mockups(room, image_path))").eq("review_status", "approved").is("deleted_at", null).order("created_at", { ascending: false }).limit(uploadId ? 1 : 200).match(uploadId ? { id: uploadId } : {}),
    db.from("design_listing").select("slug, hidden").eq("hidden", true),
    db.from("designer_accounts").select("slug, user_id"),
    db.from("designer_profiles").select("user_id, full_name, studio_name, country, bio, styles, created_at, status, tagline, photo_key, specialties, response_label, turnaround_days, public_hidden"),
    db.from("material_settings").select("*"),
    uploadId ? db.from("design_overrides").select("*").eq("slug", `u-${uploadId}`) : db.from("design_overrides").select("*"),
    db.from("reviews").select("kind, target, rating, hidden"),
    db.from("designer_collections").select("id, designer_slug, title, description, design_slugs").order("created_at", { ascending: false }),
    loadThumbRows(uploadId ? `u-${uploadId}` : undefined),
  ]);
  const thumbs: Record<string, any> = {};
  for (const r of thumbRows) { try { thumbs[r.slug] = JSON.parse(r.data); } catch {} }
  const overrides = overrideRows.data ?? [];
  const studioPaths = [...new Set(overrides.flatMap(o => [...o.added_photos, ...(o.image_path ? [o.image_path] : [])]))];
  const studioSigned = studioPaths.length ? (await db.storage.from("studio-photos").createSignedUrls(studioPaths, 86400)).data ?? [] : [];
  const studioUrl = new Map(studioSigned.map(i => [i.path, i.signedUrl]));
  const varietyPics = (u: any): string[] => { try { const v = JSON.parse(u.varieties || "[]"); return Array.isArray(v) ? v.map((x: any) => x?.image).filter((x: any) => typeof x === "string" && x) : []; } catch { return []; } };
  const pathsToSign = [...new Set((uploads.data ?? []).flatMap(u => [...u.artwork_colorways.flatMap(c => [c.artwork_path, ...c.artwork_mockups.map(m => m.image_path)]), ...varietyPics(u)]))];
  const signedGroups = await Promise.all(Array.from({ length: Math.ceil(pathsToSign.length / 100) }, (_, i) => pathsToSign.slice(i * 100, (i + 1) * 100)).map(paths => db.storage.from("designer-artwork").createSignedUrls(paths, 86400)));
  const signedByPath = new Map(signedGroups.flatMap(group => group.data ?? []).map(item => [item.path, item.signedUrl]));
  const removedFor = (slug: string) => overrides.find(o => o.slug === slug)?.removed_photos ?? [];
  const slugOf = new Map((accounts.data ?? []).map((a) => [a.user_id, a.slug]));
  const designerMap = new Map<string, Designer>();
  let taxonomy: Taxonomy = parseTaxonomy(null);
  try { const tr = await db.from("site_settings" as any).select("value").eq("key", "taxonomy").maybeSingle(); if (tr.data) taxonomy = parseTaxonomy(JSON.parse((tr.data as any).value)); } catch {}
  const list: Design[] = [];
  for (const u of uploads.data ?? []) {
    const colors = [...u.artwork_colorways].sort((a, b) => a.position - b.position);
    if (!colors.length) continue;
    const byPath = signedByPath;
    const versions = colors.flatMap((c, i) => {
      const image = byPath.get(c.artwork_path);
      const crop = (() => { try { return (c as any).swatch_crop ? JSON.parse((c as any).swatch_crop) : null; } catch { return null; } })();
      return image ? [{ id: `c${i}`, name: c.name, swatch: crop?.mode === "color" && (c as any).swatch ? (c as any).swatch : `url("${image}")`, crop: crop && crop.mode !== "color" ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : undefined, originalId: (c as any).current_original_id ?? undefined, image, mockups: [...c.artwork_mockups].sort((a,b) => a.room-b.room).flatMap(m => { const src = byPath.get(m.image_path); return src && !(i === 0 && removedFor(`u-${u.id}`).includes(m.image_path)) ? [src] : []; }) }] : [];
    });
    const original = versions[0];
    if (!original) continue;
    const dslug = slugOf.get(u.owner_id) ?? `studio-${u.owner_id.slice(0, 8)}`;
    if (!designerMap.has(dslug)) {
      const p = (profiles.data ?? []).find((x) => x.user_id === u.owner_id);
      const name = p?.studio_name || p?.full_name || "Artisan Mural designer";
      designerMap.set(dslug, { slug: dslug, name, location: p?.country ?? "", initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), tagline: p?.tagline || p?.styles?.join(" · ") || "Original wallpaper designs", bio: p?.bio ?? "", since: (p?.created_at ?? u.created_at).slice(0, 4), rating: 5, reviews: 0, customFrom: 400, adaptFee: 75, responseTime: "within a day", specialties: p?.styles ?? [], ...profileExtra(p) });
    }
    const w = Number(u.width_cm) || 100, h = Number(u.height_cm) || 100;
    const mural = u.kind === "mural";
    list.push({
      slug: `u-${u.id}`, title: u.title, designer: dslug, image: original.image, sku: u.sku ?? undefined, mockups: original.mockups, kind: mural ? "mural" : "repeating",
      room: u.made_for, categories: effectiveCategories(u.made_for, u.categories, taxonomy) as Category[], palette: [(u as any).palette, colors.map((c) => c.name).join(", ")].filter(Boolean).join(", "), tags: Array.isArray((u as any).tags) ? (u as any).tags : [],
      repeat: mural ? undefined : u.repeat_style === "horizontal" ? "horizontal" : "both", match: !mural && u.repeat_style === "halfdrop" ? "halfdrop" : undefined,
      repeatCm: mural ? undefined : w, printHeightCm: !mural && u.repeat_style === "horizontal" ? h : undefined,
      maxWidthCm: mural ? Number(u.max_print_width_cm) || w : undefined,
      orientation: w >= h ? "landscape" : "portrait",
      description: (u as any).description || (mural ? "An original mural from one of our designers, printed and cropped to your exact wall." : "An original repeating pattern from one of our designers, printed to any wall size."),
      story: u.story ?? undefined, orders: 0,
      colorways: versions,
      ...(() => { try { const r = JSON.parse((u as any).recommended_finish || "null"); const ids = Array.isArray(r?.ids) ? r.ids.filter((x: any) => typeof x === "string" && x) : []; return { recommendedFinishes: ids.length ? ids : undefined, finishNote: typeof r?.note === "string" && r.note.trim() ? r.note.trim() : undefined }; } catch { return {}; } })(),
      varieties: (() => { try { const v = JSON.parse((u as any).varieties || "[]"); return Array.isArray(v) && v.length ? v.map((x: any) => ({ id: x.id, name: x.name || undefined, image: x.image ? signedByPath.get(x.image) : undefined })) : undefined; } catch { return undefined; } })(),
    } as Design);
  }
  const resolved: DesignOverride[] = overrides.map(o => ({ slug: o.slug, title: o.title ?? undefined, description: o.description ?? undefined, story: o.story ?? undefined, pricePerSqft: o.price_per_sqft == null ? undefined : Number(o.price_per_sqft), image: o.image_path ? studioUrl.get(o.image_path) : undefined, removed: o.slug.startsWith("u-") ? [] : o.removed_photos, added: o.added_photos.flatMap(p => { const u = studioUrl.get(p); return u ? [u] : []; }), categories: jsonList((o as any).categories).length ? canonicalCategories(jsonList((o as any).categories), taxonomy) : undefined, room: jsonList((o as any).rooms).length ? jsonList((o as any).rooms) : undefined }));
  const finalList = list.map(d => applyOverride(d, resolved.find(o => o.slug === d.slug))).map(d => (thumbs[d.slug] ? { ...d, thumbs: thumbs[d.slug] } : d));
  if (!uploadId) for (const p of profiles.data ?? []) {
    if (p.status !== "approved") continue;
    const dslug = slugOf.get(p.user_id) ?? `studio-${p.user_id.slice(0, 8)}`;
    if (designerMap.has(dslug)) continue;
    const name = p.studio_name || p.full_name || "Artisan Mural designer";
    designerMap.set(dslug, { slug: dslug, name, location: p.country ?? "", initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), tagline: p.tagline || p.styles?.join(" · ") || "Original wallpaper designs", bio: p.bio ?? "", since: p.created_at.slice(0, 4), rating: 5, reviews: 0, customFrom: 400, adaptFee: 75, responseTime: "within a day", specialties: p.styles ?? [], ...profileExtra(p) });
  }
  const tally = new Map<string, { sum: number; n: number }>();
  const dtally = new Map<string, { sum: number; n: number }>();
  for (const r of (reviewRows.data ?? []) as any[]) { if (Number(r.hidden)) continue; const m = r.kind === "design" ? dtally : tally; const t = m.get(r.target) ?? { sum: 0, n: 0 }; t.sum += Number(r.rating); t.n += 1; m.set(r.target, t); }
  const ratings = [...tally].map(([slug, t]) => ({ slug, rating: Math.round((t.sum / t.n) * 10) / 10, reviews: t.n }));
  const designRatings = [...dtally].map(([slug, t]) => ({ slug, rating: Math.round((t.sum / t.n) * 10) / 10, reviews: t.n }));
  let defaultRate: number | undefined;
  try { const g = await db.from("site_settings" as any).select("value").eq("key", "general").maybeSingle(); const v = g.data ? JSON.parse((g.data as any).value) : null; if (v?.pricePerSqft > 0) defaultRate = Number(v.pricePerSqft); } catch {}
  return { taxonomy, thumbs, defaultRate, collections: (collectionRows.data ?? []).map(c => ({ id: c.id, designerSlug: c.designer_slug, title: c.title, description: c.description, designs: c.design_slugs })), overrides: resolved, ratings, designRatings, designs: finalList, designers: [...designerMap.values()], hidden: (listing.data ?? []).map((l) => l.slug), materialSettings: (finishes.data ?? []).map((m: any) => ({ id: m.id, name: m.name, blurb: m.blurb, factor: Number(m.factor) || 1, texture: m.texture ?? undefined, active: m.active, priceAdj: m.price_adj == null ? undefined : Number(m.price_adj), sampleIn: m.sample_in == null ? undefined : Number(m.sample_in), standard: m.standard == null ? undefined : !!m.standard })) satisfies MaterialSetting[] };
}
