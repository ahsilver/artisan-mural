/** Editable words on the site's own pages (Back office → Page texts). Each page lists its fields with the
 *  ready-written text; the owner's text replaces it, an empty field brings the ready-written text back.
 *  {name}, {pct} and {days} are filled in from the Artisan Pro settings. Lists are one item per line, with
 *  " | " between the parts (for example "Title | text"). */
export type TextField = { k: string; label: string; def: string; kind?: "line" | "area" | "list" | "image"; hint?: string };
export type TextPage = { label: string; path: string; note?: string; fields: TextField[] };

export const PAGE_TEXTS: Record<string, TextPage> = {
  pro: { label: "Artisan Pro page", path: "/pro", note: "You can use {name} (the program name), {pct} (the discount) and {days} (approval time) anywhere.", fields: [
    { k: "heroImage", label: "Big picture at the top", def: "/p/img/cover-hotel.webp", kind: "image" },
    { k: "heroKicker", label: "Small line above the title", def: "{name} · for design professionals" },
    { k: "heroTitle", label: "Title", def: "For the people who" },
    { k: "heroAccent", label: "Title, second part (in italics)", def: "design the room." },
    { k: "heroText", label: "Text under the title", def: "Interior designers, architects and hospitality teams get trade pricing, free samples and one specialist for every project.", kind: "area" },
    { k: "heroNote", label: "Small line under the buttons", def: "Free to join · no minimum order · approval in {days}" },
    { k: "benefits", label: "Benefits", hint: "One per line: Title | text", kind: "list", def: [
      "{pct}% off every order | Your professional price is applied automatically in the cart and at checkout, on every design and finish.",
      "Free samples | Order printed samples of any design and finish at no cost, so clients can feel the material before they decide.",
      "Priority production | Pro orders move to the front of the print queue, with tracked shipping on every order.",
      "A dedicated specialist | One person who knows your projects: sizing, panel layouts, finishes and timelines.",
      "Project quotes | Multi-room, multi-wall and commercial jobs quoted in one place, with custom sizes and colorways.",
      "Made to measure | Every wall printed to its exact size, in numbered panels, with print files checked by hand.",
    ].join("\n") },
    { k: "howTitle", label: "How it works: title", def: "Three steps to trade pricing" },
    { k: "steps", label: "How it works: steps", hint: "One per line: Step | text", kind: "list", def: [
      "Apply | Tell us about your business. About three minutes.",
      "Get approved | We review it by hand, usually within {days}.",
      "Order at your price | Sign in and your discount applies to every order and sample.",
    ].join("\n") },
    { k: "faqTitle", label: "Questions: title", def: "Questions" },
    { k: "faq", label: "Questions and answers", hint: "One per line: Question | answer", kind: "list", def: [
      "Who can apply? | Interior designers, architects, contractors and installers, home stagers, developers and property managers, and buyers for hotels, restaurants, offices, senior living and healthcare.",
      "What does it cost? | Nothing. {name} is free to join and there is no minimum order.",
      "How long does approval take? | We review every application by hand, usually within {days}. You'll get an email as soon as you're approved.",
      "What do I need to apply? | Your business name, your role, a website, Instagram or portfolio, and your business address and phone. A resale certificate or tax ID is optional but speeds things up.",
      "How does the discount work? | Once approved, sign in with the same account. Your discount shows in the cart and is applied at checkout automatically.",
      "Can I order for a client's address? | Yes. Ship to any address, and save several addresses in your account for different projects.",
      "Do you handle commercial projects? | Yes. Offices, hallways, lobbies, hotels, senior living and healthcare spaces. Ask your specialist about commercial-grade finishes and project quotes.",
    ].join("\n") },
    { k: "applyTitle", label: "Apply box: title", def: "Apply to {name}" },
    { k: "applyText", label: "Apply box: text", def: "About three minutes. We confirm by email, usually within {days}.", kind: "area" },
    { k: "applyNeed", label: "Apply box: what they need", hint: "One per line", kind: "list", def: "Your business name and role\nA website, Instagram or portfolio\nBusiness address and phone\nResale certificate or tax ID (optional, speeds things up)" },
  ] },
};

/** The text for one field: the owner's words, or the ready-written ones; {name}/{pct}/{days} filled in. */
export function pageText(saved: any, page: string, k: string, vars: Record<string, string | number> = {}): string {
  const f = PAGE_TEXTS[page]?.fields.find((x) => x.k === k);
  const own = saved?.[page]?.[k];
  const t = typeof own === "string" && own.trim() ? own : f?.def ?? "";
  return t.replace(/\{(\w+)\}/g, (m, v) => (vars[v] != null ? String(vars[v]) : m));
}
/** A list field split into lines and " | " parts. */
export function pageList(saved: any, page: string, k: string, vars: Record<string, string | number> = {}): string[][] {
  return pageText(saved, page, k, vars).split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
}
