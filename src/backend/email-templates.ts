/** Every email the website sends, ready-written. The owner can edit any subject or text in Back office → Email templates;
 *  an empty field keeps the text below. {{name}}-style words are filled in for each email. The first link in the text
 *  becomes the button. */
export type Tpl = { group: string; label: string; when: string; subject: string; body: string; vars: string[] };

export const EMAIL_TEMPLATES: Record<string, Tpl> = {
  welcome: { group: "Customers", label: "Welcome (new account)", when: "Someone creates an account", vars: ["name", "link"],
    subject: "Welcome to Artisan Murals",
    body: "Hello {{name}},\n\nWelcome to Artisan Murals. Every design here is drawn by an independent artist and printed to the exact size of your wall.\n\nA few things you can do now:\n• Browse murals and wallpaper, and see any design on your own wall\n• Ask a designer to change a color, remove a detail or make it bigger\n• Order free samples of our papers\n\nWe're glad you're here.\n\nStart browsing: {{link}}" },
  order_placed: { group: "Orders", label: "Order received", when: "A customer places an order", vars: ["name", "order", "items", "total", "link"],
    subject: "We received your order {{order}}",
    body: "Hello {{name}},\n\nThank you for your order {{order}}.\n\n{{items}}\nTotal: {{total}}\n\nWhat happens next: we prepare a print proof of your exact wall and send it to you with a secure payment link. Printing starts as soon as you approve and pay.\n\nYou can follow your order anytime in your account.\n\nSee your order: {{link}}" },
  order_paid: { group: "Orders", label: "Payment received", when: "An order is marked Paid", vars: ["name", "order", "total", "link"],
    subject: "Payment received for order {{order}}",
    body: "Hello {{name}},\n\nWe received your payment of {{total}} for order {{order}}. Thank you!\n\nYour wallpaper goes into production next. We'll email you when it's printing and again when it ships.\n\nSee your order: {{link}}" },
  order_waiting_on_designer: { group: "Orders", label: "Designer is working on it", when: "An order waits for the designer's final file", vars: ["name", "order", "link"],
    subject: "Your designer is working on order {{order}}",
    body: "Hello {{name}},\n\nYour designer is preparing the final design for order {{order}}. As soon as it's ready, we print it.\n\nSee your order: {{link}}" },
  order_ready_to_print: { group: "Orders", label: "Ready to print", when: "An order is ready to print", vars: ["name", "order", "link"],
    subject: "Order {{order}} is ready to print",
    body: "Hello {{name}},\n\nGood news: the final file for order {{order}} is ready and goes to the printer next.\n\nSee your order: {{link}}" },
  order_processing: { group: "Orders", label: "In production", when: "An order is marked In production", vars: ["name", "order", "link"],
    subject: "Order {{order}} is in production",
    body: "Hello {{name}},\n\nYour order {{order}} is in production. We're preparing your print file at full resolution and cutting it into numbered panels for your wall.\n\nWe'll email you again when it's printing.\n\nSee your order: {{link}}" },
  order_printing: { group: "Orders", label: "Printing", when: "An order is marked Printing", vars: ["name", "order", "link"],
    subject: "Order {{order}} is printing",
    body: "Hello {{name}},\n\nYour wallpaper for order {{order}} is on the printer now. Next we check every panel, pack it carefully and ship it.\n\nSee your order: {{link}}" },
  order_shipped: { group: "Orders", label: "Shipped (with tracking)", when: "An order is marked Shipped or gets a tracking number", vars: ["name", "order", "carrier", "tracking", "tracking_link", "link"],
    subject: "Order {{order}} has shipped",
    body: "Hello {{name}},\n\nYour order {{order}} is on its way.\n\nCarrier: {{carrier}}\nTracking number: {{tracking}}\n\nTrack your package: {{tracking_link}}\n\nTip for hanging: keep the panels in their numbered order; panel 1 starts on the left of your wall.\n\nSee your order: {{link}}" },
  order_delivered: { group: "Orders", label: "Delivered", when: "An order is marked Delivered", vars: ["name", "order", "link"],
    subject: "Your order {{order}} was delivered",
    body: "Hello {{name}},\n\nYour order {{order}} was delivered. We hope you love your new wall!\n\nWe'd love to see it: reply with a photo, or leave a review for the designer from your account.\n\nSee your order: {{link}}" },
  order_cancelled: { group: "Orders", label: "Cancelled", when: "An order is cancelled", vars: ["name", "order", "link"],
    subject: "Order {{order}} was cancelled",
    body: "Hello {{name}},\n\nYour order {{order}} was cancelled. If you didn't expect this, or want to order again, just reply to this email.\n\nSee your order: {{link}}" },
  order_refunded: { group: "Orders", label: "Refunded", when: "An order is marked Refunded", vars: ["name", "order", "total", "link"],
    subject: "Refund for order {{order}}",
    body: "Hello {{name}},\n\nWe refunded order {{order}}. Depending on your bank, it can take 5–10 business days to show on your statement.\n\nSee your order: {{link}}" },
  quote_received: { group: "Design requests", label: "Price from a designer", when: "A designer sends a price for a request", vars: ["name", "designer", "request", "price", "days", "link"],
    subject: "{{designer}} sent you a price",
    body: "Hello {{name}},\n\n{{designer}} sent a price for your request \"{{request}}\": {{price}}, ready in {{days}} days after payment.\n\nApprove it in the chat, then enter your wall size and pay the design and the print together.\n\nSee the price: {{link}}" },
  job_paid: { group: "Design requests", label: "Design order confirmed", when: "A customer pays for a design job", vars: ["name", "request", "total", "due", "link"],
    subject: "Order confirmed: {{request}}",
    body: "Hello {{name}},\n\nThank you, your payment of {{total}} is confirmed. The designer is working on \"{{request}}\" and will be done by {{due}}. Then we print and ship your wall.\n\nOpen your request: {{link}}" },
  job_delivered: { group: "Design requests", label: "Design finished", when: "The designer delivers the final design", vars: ["name", "request", "link"],
    subject: "Your design is finished: {{request}}",
    body: "Hello {{name}},\n\nThe designer finished \"{{request}}\". We're getting it ready to print, and we'll email you the tracking number when it ships.\n\nSee your design: {{link}}" },
  new_message: { group: "Messages", label: "New message", when: "Someone writes to a customer or designer", vars: ["name", "from", "message", "link"],
    subject: "New message from {{from}}",
    body: "Hello {{name}},\n\n{{from}} wrote to you:\n\n\"{{message}}\"\n\nRead and reply: {{link}}" },
  pro_approved: { group: "Artisan Pro", label: "Pro approved", when: "A Pro application is approved", vars: ["name", "pct", "link"],
    subject: "Welcome to Artisan Pro",
    body: "Hello {{name}},\n\nYou're approved for Artisan Pro. Your {{pct}}% professional price is applied automatically when you're signed in, and members get free samples.\n\nOpen your Pro account: {{link}}" },
  designer_approved: { group: "Designers", label: "Designer approved", when: "A designer application is approved", vars: ["name", "link"],
    subject: "You're approved as an Artisan Murals designer",
    body: "Hello {{name}},\n\nWelcome aboard! Your designer studio is open: upload your designs, answer customer requests and follow your sales.\n\nOpen your studio: {{link}}" },
  design_live: { group: "Designers", label: "Design is live", when: "The studio approves a design", vars: ["name", "design", "link"],
    subject: "\"{{design}}\" is live in the shop",
    body: "Hello {{name}},\n\nThe studio approved \"{{design}}\". It's in the shop now, with its own page and room pictures.\n\nSee it in the shop: {{link}}" },
};

/** Fills a template (with the owner's edits, if any). Returns subject and text; unknown keys return null. */
export async function renderEmail(env: { DB: any }, key: string, vars: Record<string, string | number | null | undefined>): Promise<{ subject: string; text: string } | null> {
  const base = EMAIL_TEMPLATES[key]; if (!base) return null;
  let edits: any = {};
  try { const r: any = await env.DB.prepare(`SELECT value FROM site_settings WHERE key = 'emailTemplates'`).first(); edits = JSON.parse(r?.value ?? "{}")?.[key] ?? {}; } catch {}
  if (edits.off) return { subject: "", text: "" };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => { const v = vars[k]; return v == null || v === "" ? "" : String(v); }).replace(/^[^\n]*:[ \t]*$/gm, "").replace(/\n{3,}/g, "\n\n"); // a line like "Tracking number:" with nothing after it is left out
  return { subject: fill(String(edits.subject || base.subject)), text: fill(String(edits.body || base.body)).trim() };
}
