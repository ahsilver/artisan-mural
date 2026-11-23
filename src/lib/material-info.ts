/** Customer-facing facts for the shop's four materials (from the approved preview). Warranty is intentionally not shown. */
export type MatFacts = { look: string; best: string; tough: string; safe: string; remove?: string; tex: string };
const VINYL = { best: "Homes, offices, restaurants", tough: "Wipe or scrub it clean", safe: "Top fire rating · mold resistant · low odor", remove: "Peels off in full strips" };
export const MAT_FACTS: Record<string, MatFacts> = {
  canvas: { look: "Woven, like an artist’s canvas", ...VINYL, tex: "canvas" },
  linen: { look: "Fine, fabric-like weave", best: "Busy spaces: hallways, kids’ rooms, hotels", tough: "Extra heavy-duty: almost twice as thick, resists bumps and scuffs · wipe or scrub clean", safe: "Top fire rating · mold resistant · free of phthalates, formaldehyde and heavy metals", tex: "linen" },
  grasscloth: { look: "Pronounced natural weave", ...VINYL, tex: "grass" },
  suede: { look: "Soft, embossed grain", ...VINYL, tex: "suede" },
};
export const MAT_ROWS: [keyof MatFacts, string][] = [["look", "Look & feel"], ["best", "Best for"], ["tough", "Easy care"], ["safe", "Safe for every room"], ["remove", "Removable"]];
export const MAT_TECH = [
  "Linen: 35 oz Type III high-impact vinyl (793 g/m²), embossed vinyl face on a woven poly-cotton backing, 0.030–0.040 in thick. ASTM E84 Class A, ASTM D5420 impact resistance (74 in-lb), ASTM G21 mold score zero, WA-101 Type III washable and scrubbable. No plasticizers, phthalates, formaldehyde, chlorine or heavy metals; low-VOC, CA-1350 certified.",
  "Canvas, Grasscloth and Suede: 20 oz Type II commercial vinyl (457 g/m²), embossed vinyl face on a fabric backing, 0.017–0.027 in thick. ASTM E84 Class A, EU EN 15102 B-s2, ASTM G21 mold and mildew resistance, WA-101 Type II washable and scrubbable. Low-VOC, phthalate-free, CA-1350, NSF/ANSI 342 Silver, contributes to LEED v4. Hang with heavy-duty clear vinyl adhesive applied to the back.",
];
