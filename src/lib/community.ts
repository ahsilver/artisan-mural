import { useEffect, useState } from "react";
import { loadSite } from "@/lib/site-settings";
export { backend } from "@/lib/pro";

export const COMMUNITY_DEFAULTS = { promoEnabled: true, promoEvery: 12, promoTitle: "Can't find what you like?", promoText: "Get it custom. Tell a designer what you have in mind.", promoCta: "Get it custom", productLineEnabled: true, requestsEnabled: true, reviewsEnabled: true, contactEnabled: true };
export type CommunitySettings = typeof COMMUNITY_DEFAULTS;
/** Owner switches for promo cards, open requests, reviews and contact (public settings). */
export function useCommunity(): CommunitySettings {
  const [s, set] = useState<CommunitySettings>(COMMUNITY_DEFAULTS);
  useEffect(() => { loadSite().then((v: any) => v?.community && set({ ...COMMUNITY_DEFAULTS, ...v.community })).catch(() => {}); }, []);
  return s;
}
export const turnaroundText = (d?: number | null) => (d ? `${d} day${d === 1 ? "" : "s"}` : "");
