import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSite } from "@/lib/site-settings";

export const PRO_DEFAULTS = { enabled: true, name: "Artisan Pro", discountPct: 20, freeSamples: true, approvalDays: "1–2 business days" };
export async function backend(path: string, body?: any) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const r = await fetch("/backend/" + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
/** Program settings (public) — the name is one owner setting. */
export function useProSettings() {
  const [s, set] = useState<any>(PRO_DEFAULTS);
  useEffect(() => { loadSite().then((v: any) => v?.pro && set({ ...PRO_DEFAULTS, ...v.pro })).catch(() => {}); }, []);
  return s;
}
/** The signed-in customer's program status (null while loading or signed out). */
export function useProMe() {
  const [me, set] = useState<any>(null);
  const load = () => backend("pro/me").then(set).catch(() => set({ signedIn: false }));
  useEffect(() => { load(); const { data } = supabase.auth.onAuthStateChange(() => { load(); }); return () => data.subscription.unsubscribe(); }, []);
  return { me, reload: load };
}
