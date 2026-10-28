export type PublicSite = { general?: any; homepage?: any; ai?: any } | null;
let cache: { v: PublicSite; t: number } | null = null;
export async function loadSite(): Promise<PublicSite> {
  if (typeof window !== "undefined" && cache && Date.now() - cache.t < 30000) return cache.v;
  const base = typeof window !== "undefined" ? "" : ((typeof process !== "undefined" && process.env.SUPABASE_URL) || "");
  try {
    const r = await fetch(base + "/backend/public/settings");
    const v = r.ok ? await r.json() : null;
    if (typeof window !== "undefined") cache = { v, t: Date.now() };
    return v;
  } catch { return null; }
}
