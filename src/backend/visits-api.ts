/** Visitor statistics: store anonymous events (public/hit) and add them up for the owner (admin/visitors). */
type Env = { DB: any };
const j = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|monitor|headless|lighthouse|curl|wget|python|httpclient/i;
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex|brave)\./;
const SOCIAL: [RegExp, string][] = [[/instagram\./, "Instagram"], [/(facebook|fb)\.(com|me)|l\.facebook/, "Facebook"], [/pinterest\.|pin\.it/, "Pinterest"], [/tiktok\./, "TikTok"], [/(twitter|t)\.co$|x\.com/, "X (Twitter)"], [/youtube\.|youtu\.be/, "YouTube"], [/linkedin\./, "LinkedIn"], [/reddit\./, "Reddit"], [/houzz\./, "Houzz"]];
const MAIL = /mail\.|outlook\.|gmail/;

/** "Google", "Instagram", "Email", "Direct", "Ad: spring-sale", or the other website's name. */
export function sourceOf(ref: string, ownHost: string, utm: { src?: string; medium?: string }) {
  const src = (utm.src ?? "").trim().toLowerCase(), medium = (utm.medium ?? "").trim().toLowerCase();
  if (src) { const nice = src.charAt(0).toUpperCase() + src.slice(1); return /cpc|paid|ads?$/.test(medium) ? `Ad: ${nice}` : medium === "email" ? "Email" : nice; }
  let host = ""; try { host = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch {}
  if (!host || host === ownHost.replace(/^www\./, "")) return "Direct";
  const m = host.match(SEARCH); if (m) return m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1);
  for (const [re, n] of SOCIAL) if (re.test(host)) return n;
  if (MAIL.test(host)) return "Email";
  return host;
}
const groupOf = (s: string) => s === "Direct" ? "Direct" : s === "Email" ? "Email" : s.startsWith("Ad:") ? "Ads" : /^(Google|Bing|Yahoo|Duckduckgo|Ecosia|Baidu|Yandex|Brave)$/.test(s) ? "Search engines" : SOCIAL.some(([, n]) => n === s) ? "Social media" : "Other websites";

export async function hit(req: Request, env: Env, body: any) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!body || BOT.test(ua)) return j({ ok: true });
  const kind = ["view", "search", "cart", "order"].includes(body.kind) ? body.kind : "view";
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const vid = s(body.vid, 32), sid = s(body.sid, 32); if (!vid) return j({ ok: true });
  const url = new URL(req.url);
  const country = ((req as any).cf?.country || req.headers.get("cf-ipcountry") || "").toUpperCase().slice(0, 2);
  const w = Number(body.w) || 0, device = /mobile|iphone|android.+mobile/i.test(ua) || (w && w < 700) ? "Phone" : /ipad|tablet|android/i.test(ua) || (w && w < 1100) ? "Tablet" : "Computer";
  const ref = s(body.ref, 300), src = s(body.src, 60);
  const source = ref || src ? sourceOf(ref, url.hostname, { src, medium: s(body.medium, 40) }) : "";
  const at = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO site_visits (at, day, vid, sid, kind, path, source, campaign, country, device, design, q, n) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(at, at.slice(0, 10), vid, sid, kind, s(body.path, 200), source, s(body.campaign, 80), country, device, s(body.design, 80) || null, s(body.q, 80).toLowerCase().trim() || null, Number.isFinite(Number(body.n)) ? Number(body.n) : null).run();
  // keep about 13 months
  if (Math.random() < 0.002) await env.DB.prepare(`DELETE FROM site_visits WHERE day < ?`).bind(new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)).run();
  return j({ ok: true });
}

/** Everything the owner's Visitors page shows, for the last `days` days (and the same length before it, to compare). */
export async function visitors(env: Env, days: number) {
  const d = Math.max(1, Math.min(366, Math.round(days) || 30));
  const from = new Date(Date.now() - (d - 1) * 864e5).toISOString().slice(0, 10), prevFrom = new Date(Date.now() - (2 * d - 1) * 864e5).toISOString().slice(0, 10);
  const all = async (sql: string, ...b: unknown[]) => ((await env.DB.prepare(sql).bind(...b).all()).results ?? []) as any[];
  const one = async (sql: string, ...b: unknown[]) => (await env.DB.prepare(sql).bind(...b).first()) as any;
  const totals = await one(`SELECT COUNT(DISTINCT vid) visitors, COUNT(DISTINCT sid) visits, SUM(kind='view') views FROM site_visits WHERE day >= ?`, from);
  const prev = await one(`SELECT COUNT(DISTINCT vid) visitors, COUNT(DISTINCT sid) visits, SUM(kind='view') views FROM site_visits WHERE day >= ? AND day < ?`, prevFrom, from);
  const firstSeen = await one(`SELECT COUNT(*) n FROM (SELECT vid, MIN(day) f FROM site_visits GROUP BY vid) WHERE f >= ?`, from);
  const now = await one(`SELECT COUNT(DISTINCT vid) n FROM site_visits WHERE at >= ?`, new Date(Date.now() - 5 * 60e3).toISOString());
  const daily = await all(`SELECT day, COUNT(DISTINCT vid) visitors, SUM(kind='view') views FROM site_visits WHERE day >= ? GROUP BY day ORDER BY day`, from);
  // where visits came from: the source of each visit's first page
  const srcRows = await all(`SELECT source, COUNT(DISTINCT sid) visits FROM site_visits WHERE day >= ? AND source != '' GROUP BY source ORDER BY visits DESC LIMIT 40`, from);
  const visitsTotal = Number(totals?.visits) || 0;
  const withSource = srcRows.reduce((n, r) => n + Number(r.visits), 0);
  const sources = [...srcRows]; if (visitsTotal > withSource) { const dIdx = sources.findIndex((r) => r.source === "Direct"); if (dIdx >= 0) sources[dIdx] = { ...sources[dIdx], visits: Number(sources[dIdx].visits) + visitsTotal - withSource }; else sources.push({ source: "Direct", visits: visitsTotal - withSource }); }
  const groups: Record<string, number> = {}; for (const r of sources) groups[groupOf(r.source)] = (groups[groupOf(r.source)] ?? 0) + Number(r.visits);
  const countries = await all(`SELECT country, COUNT(DISTINCT vid) visitors FROM site_visits WHERE day >= ? AND country != '' GROUP BY country ORDER BY visitors DESC LIMIT 25`, from);
  const devices = await all(`SELECT device, COUNT(DISTINCT vid) visitors FROM site_visits WHERE day >= ? GROUP BY device ORDER BY visitors DESC`, from);
  const pages = await all(`SELECT path, SUM(kind='view') views, COUNT(DISTINCT vid) visitors FROM site_visits WHERE day >= ? AND kind = 'view' GROUP BY path ORDER BY views DESC LIMIT 25`, from);
  const designs = await all(`SELECT design, COUNT(*) views, COUNT(DISTINCT vid) visitors FROM site_visits WHERE day >= ? AND kind = 'view' AND design IS NOT NULL GROUP BY design ORDER BY views DESC LIMIT 20`, from);
  const searches = await all(`SELECT q, COUNT(*) times, MIN(n) fewest, MAX(n) most FROM site_visits WHERE day >= ? AND kind = 'search' AND q IS NOT NULL GROUP BY q ORDER BY times DESC LIMIT 40`, from);
  const campaigns = await all(`SELECT campaign, COUNT(DISTINCT sid) visits FROM site_visits WHERE day >= ? AND campaign != '' GROUP BY campaign ORDER BY visits DESC LIMIT 15`, from);
  // how far visitors go: any page -> a design -> customize & order -> cart -> order
  const step = async (where: string) => Number((await one(`SELECT COUNT(DISTINCT vid) n FROM site_visits WHERE day >= ? AND ${where}`, from))?.n) || 0;
  const funnel = [
    { step: "Visited the site", n: Number(totals?.visitors) || 0 },
    { step: "Opened a design", n: await step(`kind='view' AND design IS NOT NULL AND path NOT LIKE '%/preview'`) },
    { step: "Customized the size", n: await step(`kind='view' AND path LIKE '/design/%/preview'`) },
    { step: "Added to cart", n: await step(`kind='cart'`) },
    { step: "Placed an order", n: await step(`kind='order'`) },
  ];
  return { days: d, from, totals: { visitors: Number(totals?.visitors) || 0, visits: visitsTotal, views: Number(totals?.views) || 0, newVisitors: Number(firstSeen?.n) || 0, now: Number(now?.n) || 0 },
    previous: { visitors: Number(prev?.visitors) || 0, visits: Number(prev?.visits) || 0, views: Number(prev?.views) || 0 },
    daily, sources, sourceGroups: Object.entries(groups).map(([group, visits]) => ({ group, visits })).sort((a, b) => b.visits - a.visits), countries, devices, pages, designs, searches, campaigns, funnel };
}
