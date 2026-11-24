type Env = { DB: any; PUBLIC_ORIGIN?: string };

/** One place for "tell someone": an in-site notification (bell) and an email, both for the same event.
 *  Emails go to email_outbox as 'queued'; deliverOutbox() sends them through Resend when the owner has turned real
 *  sending on (Back office → Settings → Emails), otherwise they are kept as test-mode copies. */
export async function alert(env: Env, o: { uid?: string | null; email?: string | null; kind: string; title: string; body: string; link?: string; sendEmail?: boolean; emailText?: string; emailSubject?: string; tpl?: { key: string; vars: Record<string, any> } }) {
  const link = o.link || "/account";
  if (o.uid && o.uid !== "guest") await env.DB.prepare(`INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), o.uid, o.kind, o.title.slice(0, 200), o.body.slice(0, 500), link).run();
  if (o.sendEmail === false) return;
  let to = o.email ?? null;
  if (!to && o.uid && o.uid !== "guest") { const u: any = await env.DB.prepare(`SELECT email FROM auth_users WHERE id = ?`).bind(o.uid).first(); to = u?.email ?? null; }
  if (!to || !/@/.test(to)) return;
  if (o.tpl) {
    // the ready-written email (owner-editable in Back office → Email templates)
    const { renderEmail } = await import("./email-templates");
    const t = await renderEmail(env, o.tpl.key, { link: absolute(env, link), ...o.tpl.vars });
    if (t && !t.subject) return; // the owner switched this email off
    if (t) { await queueMail(env, to, t.subject, t.text.includes("http") ? t.text : t.text + `\n\n${absolute(env, link)}`, o.kind); return; }
  }
  await queueMail(env, to, o.emailSubject || o.title, (o.emailText || o.body) + `\n\n${absolute(env, link)}`, o.kind);
}

/** Every admin (owner) gets it too. */
export async function alertOwners(env: Env, o: { kind: string; title: string; body: string; link?: string; sendEmail?: boolean }) {
  const rows = ((await env.DB.prepare(`SELECT r.user_id, u.email FROM user_roles r LEFT JOIN auth_users u ON u.id = r.user_id WHERE r.role = 'admin'`).all()).results ?? []) as any[];
  for (const r of rows) await alert(env, { uid: r.user_id, email: r.email, ...o });
}

export async function queueMail(env: Env, to: string, subject: string, text: string, kind: string) {
  await env.DB.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind, status) VALUES (?, ?, ?, ?, ?, ?, 'queued')`).bind(crypto.randomUUID(), to, subject, brandHtml(subject, text), text, kind).run();
}

const absolute = (env: Env, link: string) => (/^https?:/.test(link) ? link : (env.PUBLIC_ORIGIN || "") + link);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The email in the site's style: Fraunces heading, warm paper background, charcoal button for the first link. */
export function brandHtml(subject: string, text: string): string {
  const urlRe = /(https?:\/\/[^\s]+)/;
  const m = text.match(urlRe); const url = m?.[1];
  // "Track your package: https://…" becomes a button reading "Track your package"; a bare link becomes "Open"
  let label = "Open", rest = text;
  if (url) {
    const line = text.split("\n").find((l) => l.includes(url)) ?? "";
    const lead = line.slice(0, line.indexOf(url)).replace(/[:\s]+$/, "").trim();
    if (lead && lead.length <= 40 && line.trim().endsWith(url)) { label = lead; rest = text.replace(line, ""); }
    else rest = text.replace(url, "");
    rest = rest.replace(/\n{3,}/g, "\n\n").trim();
  }
  const body = esc(rest).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font:15px/1.6 'Nunito Sans',Arial,sans-serif;color:#201D1D">${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#201D1D">$1</a>')}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#F5F2EC"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FCFBF8;border:1px solid #E6E1D8">
<tr><td style="padding:22px 28px;border-bottom:1px solid #E6E1D8;font:400 22px Fraunces,Georgia,serif;color:#201D1D">Artisan Murals</td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 16px;font:400 26px/1.2 Fraunces,Georgia,serif;color:#201D1D">${esc(subject)}</h1>${body}
${url ? `<p style="margin:22px 0 8px"><a href="${esc(url)}" style="display:inline-block;background:#201D1D;color:#ffffff;text-decoration:none;font:700 12px 'Nunito Sans',Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:14px 22px">${esc(label)}</a></p>` : ""}</td></tr>
<tr><td style="padding:18px 28px 24px;font:12px/1.5 'Nunito Sans',Arial,sans-serif;color:#6F6A66;border-top:1px solid #E6E1D8">Murals and wallpaper by independent artists, printed to the size of your wall.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends queued emails when real sending is on; in test mode marks them as kept copies (they stay in Back office → Emails). */
export async function deliverOutbox(env: Env & { [k: string]: any }) {
  const row: any = await env.DB.prepare(`SELECT value FROM site_settings WHERE key = 'emails'`).first();
  let s: any = {}; try { s = JSON.parse(row?.value ?? "{}"); } catch {}
  const queued = ((await env.DB.prepare(`SELECT id, to_addr, subject, html, text FROM email_outbox WHERE status = 'queued' ORDER BY created_at LIMIT 20`).all()).results ?? []) as any[];
  if (!queued.length) return;
  const live = s.mode === "live" && s.provider === "resend" && typeof s.resendKey === "string" && s.resendKey.length > 10 && /@/.test(s.fromEmail || "");
  for (const e of queued) {
    if (!live) { await env.DB.prepare(`UPDATE email_outbox SET status = 'test-mode, not sent' WHERE id = ?`).bind(e.id).run(); continue; }
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${s.resendKey}`, "content-type": "application/json" }, body: JSON.stringify({ from: `${s.fromName || "Artisan Murals"} <${s.fromEmail}>`, to: [e.to_addr], subject: e.subject, html: e.html, text: e.text, ...(s.replyTo ? { reply_to: s.replyTo } : {}) }) });
      await env.DB.prepare(`UPDATE email_outbox SET status = ? WHERE id = ?`).bind(r.ok ? "sent" : `failed ${r.status}`, e.id).run();
    } catch { await env.DB.prepare(`UPDATE email_outbox SET status = 'failed (network)' WHERE id = ?`).bind(e.id).run(); }
  }
}
