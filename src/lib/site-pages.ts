/** Owner-built pages and the footer. Pages are made of blocks; the owner edits them in Back office → Pages and
 *  Back office → Footer. Saved in the public "pages" and "footer" settings groups; anything not saved yet uses
 *  the ready-written pages below, so the site never shows an empty page. */

export type Link2 = { label: string; to: string };
export type Block =
  | { type: "hero"; kicker?: string; title: string; text?: string; image?: string; button?: Link2 }
  | { type: "text"; title?: string; text: string }
  | { type: "imageText"; title?: string; text: string; image?: string; side?: "left" | "right"; button?: Link2 }
  | { type: "steps"; title?: string; items: { title: string; text: string; image?: string }[] }
  | { type: "faq"; title?: string; items: { q: string; a: string }[] }
  | { type: "pictures"; title?: string; items: { image: string; caption?: string; to?: string }[] }
  | { type: "button"; button: Link2; second?: Link2 }
  | { type: "trackOrder"; title?: string; text?: string }
  | { type: "contact"; title?: string; text?: string; email?: string; phone?: string; hours?: string };
export type BlockType = Block["type"];
export type SitePage = { slug: string; title: string; description?: string; published: boolean; blocks: Block[]; builtIn?: boolean };

export const BLOCK_TYPES: { type: BlockType; label: string; hint: string }[] = [
  { type: "hero", label: "Big title with picture", hint: "The top of a page: picture, title, a line of text and a button." },
  { type: "text", label: "Text", hint: "A heading and paragraphs. Lines starting with - become a list." },
  { type: "imageText", label: "Picture and text", hint: "A picture beside a block of text, with an optional button." },
  { type: "steps", label: "Steps", hint: "Numbered steps, like how to hang or how ordering works." },
  { type: "faq", label: "Questions and answers", hint: "Questions that open when tapped." },
  { type: "pictures", label: "Pictures", hint: "A row of pictures with captions and links." },
  { type: "button", label: "Buttons", hint: "One or two buttons." },
  { type: "trackOrder", label: "Track an order", hint: "The customer types their order number and email and sees where it is." },
  { type: "contact", label: "Contact details", hint: "Email, phone, hours and a button to message you." },
];

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "hero": return { type, kicker: "", title: "A new page", text: "", image: "", button: { label: "", to: "" } };
    case "text": return { type, title: "", text: "" };
    case "imageText": return { type, title: "", text: "", image: "", side: "left", button: { label: "", to: "" } };
    case "steps": return { type, title: "", items: [{ title: "", text: "" }] };
    case "faq": return { type, title: "Questions", items: [{ q: "", a: "" }] };
    case "pictures": return { type, title: "", items: [{ image: "", caption: "", to: "" }] };
    case "button": return { type, button: { label: "Shop all designs", to: "/browse" } };
    case "trackOrder": return { type, title: "Track your order", text: "" };
    case "contact": return { type, title: "Contact us", text: "", email: "", phone: "", hours: "" };
  }
}

/** Page addresses: lowercase words joined by dashes. These are taken by the site's own pages. */
export const RESERVED = ["browse", "design", "designers", "designer-login", "designer-upload", "account", "admin", "admin-classic", "api", "backend", "auth", "rest", "storage", "cart", "checkout", "collections", "compare", "custom-request", "changes", "dashboard", "materials", "messages", "own", "pro", "projects", "reset-password", "sell", "studio", "studio-demo", "home-sample", "become-designer", "p", "s", "assets"];
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

export const DEFAULT_PAGES: SitePage[] = [
  { slug: "help", title: "Help", builtIn: true, published: true, description: "Answers about ordering, sizes, materials, shipping and hanging your mural or wallpaper.", blocks: [
    { type: "hero", kicker: "Help", title: "How can we help?", text: "Answers to the questions we hear most. Can't find yours? Send us a message and a real person will answer." , image: "/p/img/cover-living-room.webp", button: { label: "Send us a message", to: "/messages" } },
    { type: "pictures", title: "Popular help topics", items: [
      { image: "/p/img/cover-hallway.webp", caption: "Track my order", to: "/track-order" },
      { image: "/p/img/cover-bedroom.webp", caption: "How to hang", to: "/how-to-hang" },
      { image: "/p/img/cover-kitchen.webp", caption: "Shipping", to: "/shipping" },
      { image: "/p/img/cover-dining-room.webp", caption: "Returns", to: "/returns" },
    ] },
    { type: "faq", title: "Ordering", items: [
      { q: "How do I measure my wall?", a: "Measure the width and the height of the wall at the widest and tallest points, in inches or centimeters. Enter those numbers on the design page; we add a little extra for trimming." },
      { q: "Is every order printed to size?", a: "Yes. Every mural and wallpaper is printed to the exact size of your wall, in numbered panels." },
      { q: "Can I see the design on my own wall first?", a: "Yes. On any design page tap \"See it in your room\" and upload a photo of your wall." },
      { q: "Can I change the colors or size of a design?", a: "Yes. Ask for changes to any design and the designer gives you a price in the chat." },
    ] },
    { type: "faq", title: "Materials and hanging", items: [
      { q: "Which material should I choose?", a: "See Our materials for every paper with photos and prices. Ask for free samples if you can't decide." },
      { q: "Is it hard to hang?", a: "No. Most of our papers are paste-the-wall: you roll paste on the wall and hang the panels in order. See How to hang." },
    ] },
    { type: "contact", title: "Still need help?", text: "Write to us any time. We answer within one business day.", email: "", phone: "", hours: "Monday to Friday, 9am to 5pm" },
  ] },
  { slug: "track-order", title: "Track my order", builtIn: true, published: true, description: "See where your order is: in production, printing, shipped or delivered.", blocks: [
    { type: "trackOrder", title: "Track my order", text: "Type the order number from your confirmation email and the email you ordered with." },
    { type: "steps", title: "What happens after you order", items: [
      { title: "Order received", text: "We check your wall size and the print file by hand." },
      { title: "In production", text: "Your mural is printed to the size of your wall, in numbered panels." },
      { title: "Shipped", text: "You get an email with the tracking number as soon as it leaves our press." },
      { title: "Delivered", text: "Hang the panels in their numbered order. See How to hang." },
    ] },
    { type: "button", button: { label: "Go to my account", to: "/account" }, second: { label: "How to hang", to: "/how-to-hang" } },
  ] },
  { slug: "how-to-hang", title: "How to hang", builtIn: true, published: true, description: "Hang your mural or wallpaper step by step: tools, preparing the wall, pasting and trimming.", blocks: [
    { type: "hero", kicker: "Hanging guide", title: "How to hang your mural", text: "Most walls take an afternoon. You need no special skills, only a little patience.", image: "/p/img/cover-bedroom.webp" },
    { type: "text", title: "What you need", text: "- Wallpaper paste (for paste-the-wall papers)\n- A paint roller and tray\n- A smoothing brush or plastic smoother\n- A sharp utility knife and a long straight edge\n- A level or plumb line, a pencil and a tape measure\n- A clean damp sponge" },
    { type: "steps", title: "Step by step", items: [
      { title: "Prepare the wall", text: "The wall must be clean, dry and smooth. Fill holes, sand bumps, and prime fresh plaster or glossy paint." },
      { title: "Lay out the panels", text: "Unroll the panels and lay them in their numbered order. Panel 1 starts on the left of your wall." },
      { title: "Draw a straight line", text: "Measure the width of panel 1 from the left corner, minus 1 inch, and draw a straight vertical line with a level." },
      { title: "Paste the wall", text: "Roll paste on the wall a little wider than one panel. Don't paste the paper (unless your paper says so)." },
      { title: "Hang panel 1", text: "Line the edge of the panel up with your pencil line, leave a little extra at the top and bottom, and smooth out air bubbles from the middle outward." },
      { title: "Hang the next panels", text: "Paste the wall for the next panel and hang it edge to edge with the last one (or with the overlap printed on it), matching the picture." },
      { title: "Trim", text: "When all panels are up, trim the extra at the ceiling and the floor with a sharp knife and a straight edge. Wipe any paste off with a damp sponge." },
    ] },
    { type: "faq", title: "Hanging questions", items: [
      { q: "Can I hang it on textured walls?", a: "A light texture is fine. On heavy texture the paper can't lie flat; sand or skim the wall first." },
      { q: "How do I remove it later?", a: "Most of our papers peel off dry in whole panels. Wet the wall slightly if some paste stays behind." },
    ] },
  ] },
  { slug: "shipping", title: "Shipping", builtIn: true, published: true, description: "When your order ships and how it is packed.", blocks: [
    { type: "text", title: "Shipping", text: "Every order is printed to order and checked by hand before it ships.\n\n- Production: usually 3 to 5 business days\n- Shipping: tracked, with the tracking number emailed to you\n- Packing: rolled on a sturdy tube so the panels arrive without creases" },
    { type: "button", button: { label: "Track my order", to: "/track-order" } },
  ] },
  { slug: "returns", title: "Returns", builtIn: true, published: true, description: "Our returns policy for made-to-measure murals and wallpaper.", blocks: [
    { type: "text", title: "Returns", text: "Because every order is printed to the size of your wall, we can't take back an order you changed your mind about. Order free samples first if you are unsure about a color or a material.\n\nIf your order arrives damaged or misprinted, tell us within 14 days with a photo and we will reprint it at no cost." },
    { type: "contact", title: "Something wrong with your order?", text: "Send us a photo and your order number.", email: "", phone: "", hours: "" },
  ] },
  { slug: "about", title: "About us", builtIn: true, published: true, description: "Murals and wallpaper drawn by independent artists, printed to the size of your wall.", blocks: [
    { type: "hero", kicker: "About us", title: "Art for your walls, by independent artists", text: "Every design on Artisan Murals is drawn by an independent artist, and every order is printed to the exact size of your wall.", image: "/p/img/cover-living-room.webp", button: { label: "Meet the designers", to: "/designers" } },
    { type: "imageText", title: "Made to measure", text: "Tell us the size of your wall and we print the design to fit, in numbered panels that are easy to hang.", image: "/p/img/cover-dining-room.webp", side: "left" },
    { type: "imageText", title: "Artists earn from every order", text: "Designers keep a share of every sale of their work. You can ask them for changes, or for a design made just for you.", image: "/p/img/cover-office.webp", side: "right", button: { label: "Sell your art", to: "/sell" } },
  ] },
  { slug: "contact", title: "Contact", builtIn: true, published: true, description: "Contact Artisan Murals.", blocks: [
    { type: "contact", title: "Contact us", text: "Questions about a design, an order or a project? We answer within one business day.", email: "", phone: "", hours: "Monday to Friday, 9am to 5pm" },
  ] },
  { slug: "privacy", title: "Privacy policy", builtIn: true, published: true, description: "How Artisan Murals handles your information.", blocks: [
    { type: "text", title: "Privacy policy", text: "We use your information only to make and deliver your order, to answer your messages, and, if you sign up, to send you news about new designs.\n\n- We never sell your information.\n- Card details are handled by our payment provider; we never store your full card number.\n- You can ask us to see or delete your information at any time." },
  ] },
];

export type FooterCol = { title: string; links: Link2[] };
export type Footer = { blurb: string; cols: FooterCol[]; subscribe: { on: boolean; title: string; text: string }; social: { instagram: string; pinterest: string; facebook: string; tiktok: string }; base: Link2[] };
export const DEFAULT_FOOTER: Footer = {
  blurb: "Murals and wallpaper drawn by independent artists, printed to the exact size of your wall.",
  cols: [
    { title: "Main menu", links: [{ label: "About us", to: "/about" }, { label: "Contact", to: "/contact" }, { label: "Designers", to: "/designers" }] },
    { title: "Shop", links: [{ label: "All designs", to: "/browse" }, { label: "Murals", to: "/browse?kind=mural" }, { label: "Repeating patterns", to: "/browse?kind=repeating" }, { label: "Our materials", to: "/materials" }] },
    { title: "Services", links: [{ label: "Custom murals", to: "/custom-request" }, { label: "Changes to any design", to: "/changes" }, { label: "Artisan Pro for trade", to: "/pro" }, { label: "Sell your art", to: "/sell" }] },
    { title: "Help", links: [{ label: "My account", to: "/account" }, { label: "Track my order", to: "/track-order" }, { label: "How to hang", to: "/how-to-hang" }, { label: "Shipping", to: "/shipping" }, { label: "Returns", to: "/returns" }, { label: "Help", to: "/help" }] },
  ],
  subscribe: { on: true, title: "Subscribe", text: "Join our list for new designs, artist stories and sample sales." },
  social: { instagram: "", pinterest: "", facebook: "", tiktok: "" },
  base: [{ label: "Search", to: "/browse" }, { label: "Track my order", to: "/track-order" }, { label: "Shipping", to: "/shipping" }, { label: "Returns", to: "/returns" }, { label: "Privacy policy", to: "/privacy" }],
};

/** The owner's saved pages on top of the ready-written ones (a removed ready-written page stays removed). */
export function sitePages(saved: any): SitePage[] {
  const list: SitePage[] = Array.isArray(saved?.items) ? saved.items : [];
  const removed: string[] = Array.isArray(saved?.removed) ? saved.removed : [];
  const bySlug = new Map(list.map((p) => [p.slug, p]));
  const out = DEFAULT_PAGES.filter((p) => !removed.includes(p.slug) && !bySlug.has(p.slug)).concat(list);
  return out;
}
export function siteFooter(saved: any): Footer {
  const f = saved && typeof saved === "object" ? saved : {};
  return { ...DEFAULT_FOOTER, ...f, subscribe: { ...DEFAULT_FOOTER.subscribe, ...(f.subscribe ?? {}) }, social: { ...DEFAULT_FOOTER.social, ...(f.social ?? {}) }, cols: Array.isArray(f.cols) && f.cols.length ? f.cols : DEFAULT_FOOTER.cols, base: Array.isArray(f.base) ? f.base : DEFAULT_FOOTER.base };
}
