// Designer "How it works" page: default FAQ text, parser and {token} filling.
// The FAQ is editable in Back office > Settings > Designer FAQ (site_settings key "designerFaq").
// Format: "## Group heading" lines, then "Q: question" / "A: answer" pairs separated by blank lines.

export const DEFAULT_DESIGNER_FAQ = `## Getting started
Q: Who can join as a designer?
A: Artists, illustrators and wallpaper designers with original work. Joining is free: there is no fee to sign up or to list your designs.

Q: What do I need to sign up?
A: Your name, an email and a password to create your designer account. Then one short profile form: full name, studio name (optional), country, the styles you work in, a short bio, a portfolio link and the PayPal email where you want your payouts. You can start uploading drafts while the studio looks at your profile.

Q: How long does the review take?
A: The studio reviews every designer and every design by hand.{review_time_sentence} You can follow the status of each design in your dashboard: Draft, In review, Live in the shop, or Changes needed with a note from the studio.

## Your designs
Q: What kinds of designs can I upload?
A: Two types. A mural is one picture made for a whole wall. A repeating pattern is a tile that repeats across the wall: straight repeat (all sides), half-drop, or left-right only. You choose the type when you start a design.

Q: Which file formats can I upload?
A: High-resolution JPG, PNG, TIFF, PSD or PDF files. Each file can be up to {max_upload_gb} GB. Big files upload in parts, and you can also bring files in straight from a Google Drive link instead of uploading from your computer. We keep your file as the print-ready original and make the small shop picture automatically.

Q: How many pixels does my file need?
A: We print at {target_dpi} DPI, so your file decides how big a wall it can cover: the size is your pixels divided by {target_dpi}. For example, a mural 10 ft wide (120 in) needs about {example_px} pixels across. After you upload, the size step shows exactly how big your file prints sharp. The studio never lets a design go below {min_dpi} DPI.

Q: Can one design come in several colors?
A: Yes, up to 6 colors per design. Each color has its own full-resolution print file, so every color prints just as sharp. Customers switch between your colors on the design page.

Q: What is the seamless repeat check?
A: For repeating patterns we check the edges automatically with plain pixel math: the left edge against the right edge, and the top against the bottom. For half-drop, the right edge is compared with the left edge moved down half the tile height. We look at colour and at thin lines, and show 4 tiles together with any seam that does not join marked in red. If the edges clearly don't connect, the design can't be sold as a repeat: upload it as a mural, or fix the tile edges. If they almost match, look at the 2×2 picture and tick "I checked the 2×2 picture" to confirm.

Q: What is the difference between Straight and Half-drop?
A: Straight: the tile repeats side by side at the same height. Half-drop: the tile is drawn so the next column is moved down exactly half the tile height, so the right edge must connect to the left edge shifted half down. Upload the full repeat as one tile (its height is the full repeat); we shift every second column by exactly 50% automatically. Half-drop only works for a tile that repeats on all sides and was drawn as a half-drop; customers can't change the match.

Q: How do I choose the category, style and rooms?
A: In the first step of every design you pick the style, the theme or subject, and the rooms it suits, from the same lists the shop filters use. That decides where customers find your design. The site can also suggest them for you; you check them and save.

Q: Do I need room pictures?
A: They are recommended. We place your design in a few rooms at its real size automatically. Keep the ones you like, try other rooms, or upload your own photos.

Q: When does my design appear in the shop?
A: When you press "Send to the studio" and the studio approves it, it goes live in the shop with its own page, in the categories you picked, and on your designer page. Designers the studio marks as trusted can go live without waiting for review.

Q: Can I remove a design later?
A: Yes. "Remove design" takes it out of the shop and out of your list. The studio keeps a copy, including the print file, so orders already placed can still be finished, and it can bring the design back if you ask.

## Customers and orders
Q: How do customers preview and order my wallpaper?
A: On your design page they enter their wall size and see it at true scale, with the panel lines, a person for scale and a ruler. They can upload a photo of their own wall to see your design on it, pick a color and a finish, order a sample, and then order the wallpaper made to their wall size.

Q: What size are the panels?
A: Wallpaper is printed in panels 52 in wide. Each panel overlaps the next by 3 in, so the first panel covers 52 in and every next panel adds 49 in. The preview shows customers exactly where the panels go.

Q: Which finishes are offered?
A: The studio sets the finishes and their prices; right now they are Canvas, Linen, Grasscloth and Suede. You upload one print file per color and it works on every finish.

Q: What if a customer's wall is bigger than my mural?
A: Murals are sold at the size you made them or smaller. If a wall is bigger, the customer is asked to contact you, and you can do the adaptation as paid custom work.

Q: Can customers ask me for changes or a custom design?
A: Yes. On every design page there is a "Need changes? Ask the designer" button, and customers can also request a new custom design. You reply in your dashboard with a price offer (your fee, how many days, and a note). When the customer accepts and pays, you deliver the final file through the site by the due date, and the studio prints it.

Q: Can I share my email or phone number with customers?
A: No. All chats, offers and payments stay on Artisan Mural. Messages with phone numbers, emails, links or social handles are blocked, which protects you and the customer.

Q: Who prints and ships the wallpaper?
A: Artisan Mural prints and ships every order. Production takes about {production_days} days before shipping. You only create the design, and the custom work you agree to.

## Earnings and payouts
Q: How much do I earn when my wallpaper sells?
A: A royalty for every square foot of your designs ordered: {royalty_starter} per sq ft to start, {royalty_studio} per sq ft once 2,500 sq ft of your designs have sold, and {royalty_atelier} per sq ft from 5,000 sq ft. Example: a 10 x 10 ft wall is 100 sq ft, so {example_royalty} at the starting rate. This is an example, not a promise of sales.

Q: How much do I keep from custom work?
A: You keep {designer_share} of the design fee you agree with the customer. Artisan Mural keeps {studio_commission}. Your share counts as earned when you deliver the final file.

Q: How and when do I get paid?
A: Your Earnings page shows what you have earned, what was paid, and what you can take now. Request a cash-out to your PayPal (minimum {minimum_payout}), and the studio pays requests {payout_schedule}. You can also turn your earnings into store credit and spend it on wallpaper on this site.

Q: Where do I see my sales?
A: In your designer dashboard: an overview, requests and custom jobs, orders of your designs with square feet, your designs, collections, earnings and payout history, and your profile.

## Your rights
Q: Who owns my designs?
A: You do. You confirm that you own the rights to everything you upload. Artisan Mural shows your designs in the shop and prints them for the orders customers place.

Q: Can I sell my designs somewhere else too?
A: Artisan Mural does not ask you for exclusive rights when you sign up. Keep in mind that chats and payments with customers you meet here stay on Artisan Mural.
`;

export type FaqItem = { q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export function parseFaq(text: string | null | undefined): FaqGroup[] {
  const src = (text ?? "").trim() ? String(text) : DEFAULT_DESIGNER_FAQ;
  const groups: FaqGroup[] = [];
  let g: FaqGroup | null = null;
  let cur: FaqItem | null = null;
  let mode: "q" | "a" | null = null;
  const push = () => { if (cur && cur.q.trim()) { if (!g) { g = { title: "", items: [] }; groups.push(g); } g.items.push({ q: cur.q.trim(), a: cur.a.trim() }); } cur = null; mode = null; };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (/^##\s*/.test(line)) { push(); g = { title: line.replace(/^##\s*/, "").trim(), items: [] }; groups.push(g); continue; }
    const mq = line.match(/^\s*Q[:.]\s*(.*)$/i);
    if (mq) { push(); cur = { q: mq[1], a: "" }; mode = "q"; continue; }
    const ma = line.match(/^\s*A[:.]\s*(.*)$/i);
    if (ma && cur) { cur.a = ma[1]; mode = "a"; continue; }
    if (!line.trim()) { if (mode === "a") cur!.a += "\n\n"; continue; }
    if (cur && mode === "a") cur.a += (cur.a && !cur.a.endsWith("\n\n") ? " " : "") + line.trim();
    else if (cur && mode === "q") cur.q += " " + line.trim();
  }
  push();
  const out = groups.filter((x) => x.items.length);
  return out.length ? out : (src === DEFAULT_DESIGNER_FAQ ? [] : parseFaq(DEFAULT_DESIGNER_FAQ));
}

export type DesignerTerms = {
  royaltyStarter: number; royaltyStudio: number; royaltyAtelier: number; commissionRate: number;
  minimumPayout: number; payoutSchedule: string; targetDpi: number; minDpi: number; maxUploadGb: number;
  processingDays: number; reviewTime: string;
};
export const DEFAULT_TERMS: DesignerTerms = { royaltyStarter: 50, royaltyStudio: 55, royaltyAtelier: 60, commissionRate: 10, minimumPayout: 25, payoutSchedule: "monthly", targetDpi: 250, minDpi: 150, maxUploadGb: 20, processingDays: 5, reviewTime: "" };

const usd = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const num = (v: any, d: number) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : d);

export function termsFrom(t: Partial<DesignerTerms> | null | undefined): DesignerTerms {
  const x: any = t ?? {};
  const o: any = {};
  for (const [k, d] of Object.entries(DEFAULT_TERMS)) o[k] = typeof d === "number" ? num(x[k], d) : String(x[k] ?? d);
  return o as DesignerTerms;
}

export function faqTokens(t: DesignerTerms): Record<string, string> {
  const sched: Record<string, string> = { monthly: "once a month", "twice a month": "twice a month", weekly: "every week", manual: "as they come in" };
  const rt = t.reviewTime.trim().replace(/\.$/, "");
  return {
    royalty_starter: usd(t.royaltyStarter / 100), royalty_studio: usd(t.royaltyStudio / 100), royalty_atelier: usd(t.royaltyAtelier / 100),
    example_royalty: usd(100 * t.royaltyStarter / 100),
    designer_share: `${Math.round(100 - t.commissionRate)}%`, studio_commission: `${Math.round(t.commissionRate)}%`,
    minimum_payout: usd(t.minimumPayout), payout_schedule: sched[t.payoutSchedule] ?? t.payoutSchedule,
    target_dpi: String(t.targetDpi), min_dpi: String(t.minDpi), max_upload_gb: String(t.maxUploadGb),
    example_px: (Math.round((120 * t.targetDpi) / 1000) * 1000).toLocaleString("en-US"),
    production_days: String(t.processingDays),
    review_time: rt,
    review_time_sentence: rt ? ` Most reviews are done within ${rt}.` : "",
  };
}

export function fillTokens(s: string, tokens: Record<string, string>): string {
  return s.replace(/\{([a-z_]+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
}
