import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "./common";
import { shopQuery } from "@/lib/shop";
import { liveDesigns } from "@/lib/catalog";

/** Owner: who visits the site, from where, what they look at and search for, and how many go on to order. */
const COUNTRY = (c: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(c) || c; } catch { return c; } };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("en-US");
const change = (now: number, before: number) => { if (!before) return now ? "new" : ""; const d = Math.round(((now - before) / before) * 100); return `${d > 0 ? "▲" : d < 0 ? "▼" : ""} ${Math.abs(d)}% vs the ${"period"} before`; };
let NAMES: Record<string, string> = {};
const NAME = (slug: string) => NAMES[slug] || slug;
const PAGE = (p: string) => p === "/" ? "Homepage" : p.startsWith("/design/") ? (p.endsWith("/preview") ? "Customize: " : "Design: ") + NAME(decodeURIComponent(p.split("/")[2] ?? "")) : p === "/browse" ? "Shop" : p.replace(/^\//, "").replace(/^./, (c) => c.toUpperCase());

function Bars({ rows, label, value, title }: { rows: any[]; label: (r: any) => string; value: (r: any) => number; title?: (r: any) => string }) {
  const max = Math.max(1, ...rows.map(value));
  if (!rows.length) return <p className="bo-sub">Nothing yet.</p>;
  return <ul className="vz-bars">{rows.map((r, i) => <li key={i} title={title ? title(r) : `${label(r)}: ${fmt(value(r))}`}><span className="vz-l">{label(r)}</span><span className="vz-t"><i style={{ width: `${(value(r) / max) * 100}%` }} /></span><b>{fmt(value(r))}</b></li>)}</ul>;
}

function Daily({ rows, days, from }: { rows: any[]; days: number; from: string }) {
  const [hov, setHov] = useState<number | null>(null);
  const by = new Map(rows.map((r) => [r.day, r]));
  const list = Array.from({ length: days }, (_, i) => { const d = new Date(Date.parse(from) + i * 864e5).toISOString().slice(0, 10); const r = by.get(d); return { day: d, visitors: Number(r?.visitors) || 0, views: Number(r?.views) || 0 }; });
  const max = Math.max(1, ...list.map((r) => r.visitors));
  const W = 900, H = 180, bw = W / list.length;
  const h = hov != null ? list[hov] : null;
  return <div className="vz-daily">
    <div className="vz-tip" aria-live="polite">{h ? <><b>{new Date(h.day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</b> · {fmt(h.visitors)} visitors · {fmt(h.views)} pages seen</> : <span className="bo-sub">Point at a day to see its numbers.</span>}</div>
    <svg viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Visitors per day" onMouseLeave={() => setHov(null)}>
      <line x1="0" x2={W} y1={H} y2={H} stroke="currentColor" opacity=".25" />
      {list.map((r, i) => { const bh = (r.visitors / max) * (H - 10); return <g key={r.day} onMouseEnter={() => setHov(i)}>
        <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
        <rect x={i * bw + Math.min(2, bw * 0.15)} y={H - bh} width={Math.max(1, bw - Math.min(4, bw * 0.3))} height={bh} rx={Math.min(4, bw / 4)} className={"vz-bar" + (hov === i ? " on" : "")} />
      </g>; })}
      {[0, Math.floor(list.length / 2), list.length - 1].map((i) => <text key={i} x={i * bw + bw / 2} y={H + 15} textAnchor={i === 0 ? "start" : i === list.length - 1 ? "end" : "middle"} className="vz-ax">{new Date(list[i]!.day + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>)}
    </svg>
  </div>;
}

export function Visitors() {
  const [days, setDays] = useState(30);
  const { data, error } = useApi<any>(`admin/visitors?days=${days}`, [days]);
  const { data: shop } = useQuery(shopQuery);
  if (shop) NAMES = Object.fromEntries(liveDesigns(shop).map((d) => [d.slug, d.title]));
  if (error) return <p className="rq-ok err">{error}</p>;
  const t = data?.totals, pv = data?.previous;
  const top = data?.funnel?.[0]?.n || 0;
  return <div className="bo-ed vz">
    <div className="bo-top"><h1>Visitors</h1><div className="bo-row">{[[7, "7 days"], [30, "30 days"], [90, "3 months"], [365, "12 months"]].map(([d, l]) => <button key={d} type="button" className={"bo-btn" + (days === d ? " pri" : "")} onClick={() => setDays(d as number)}>{l}</button>)}</div></div>
    <p className="bo-sub">Counted by the site itself: no outside tracker, no cookies, no names or IP addresses. Your own visits to the back office and studio are not counted.</p>
    {!data ? <p className="bo-sub">Loading…</p> : <>
      <div className="vz-tiles">
        <div><span>Visitors</span><b>{fmt(t.visitors)}</b><small>{change(t.visitors, pv.visitors)}</small></div>
        <div><span>New visitors</span><b>{fmt(t.newVisitors)}</b><small>first time on the site</small></div>
        <div><span>Pages seen</span><b>{fmt(t.views)}</b><small>{t.visits ? `${(t.views / t.visits).toFixed(1)} per visit` : ""}</small></div>
        <div><span>Orders</span><b>{fmt(data.funnel[4].n)}</b><small>{pct(data.funnel[4].n, top)}% of visitors</small></div>
        <div><span>On the site now</span><b>{fmt(t.now)}</b><small>last 5 minutes</small></div>
      </div>
      <section className="st-card"><b>Visitors per day</b><Daily rows={data.daily} days={data.days} from={data.from} /></section>
      <div className="vz-grid">
        <section className="st-card"><b>Where they come from</b><Bars rows={data.sourceGroups} label={(r) => r.group} value={(r) => r.visits} title={(r) => `${r.group}: ${fmt(r.visits)} visits`} />
          <details><summary className="bo-sub">Every source</summary><Bars rows={data.sources} label={(r) => r.source} value={(r) => Number(r.visits)} /></details></section>
        <section className="st-card"><b>Countries</b><Bars rows={data.countries} label={(r) => COUNTRY(r.country)} value={(r) => Number(r.visitors)} /></section>
        <section className="st-card"><b>Phone or computer</b><Bars rows={data.devices} label={(r) => r.device} value={(r) => Number(r.visitors)} /></section>
        <section className="st-card"><b>How far they go</b><ul className="vz-funnel">{data.funnel.map((f: any, i: number) => <li key={f.step}><span>{f.step}</span><span className="vz-t"><i style={{ width: `${pct(f.n, top)}%` }} /></span><b>{fmt(f.n)}</b><small>{i ? `${pct(f.n, top)}%` : ""}</small></li>)}</ul></section>
        <section className="st-card"><b>Most seen pages</b><Bars rows={data.pages} label={(r) => PAGE(r.path)} value={(r) => Number(r.views)} title={(r) => `${r.path}: ${fmt(r.views)} views by ${fmt(r.visitors)} visitors`} /></section>
        <section className="st-card"><b>Most seen designs</b><Bars rows={data.designs} label={(r) => NAME(r.design)} value={(r) => Number(r.views)} /></section>
        <section className="st-card"><b>What they search for</b><p className="bo-sub">Searches marked "found nothing" are designs people want that the shop doesn't have yet.</p>
          {data.searches.length ? <table className="bo-tbl"><thead><tr><th>Search</th><th>Times</th><th>Designs found</th></tr></thead><tbody>{data.searches.map((r: any) => <tr key={r.q}><td>{r.q}</td><td>{fmt(Number(r.times))}</td><td>{Number(r.most) === 0 ? <span className="vz-none">found nothing</span> : r.most}</td></tr>)}</tbody></table> : <p className="bo-sub">Nothing yet.</p>}</section>
        <section className="st-card"><b>Ad and email campaigns</b><p className="bo-sub">Add ?utm_source=instagram&amp;utm_campaign=spring to a link you share, and its visits show here.</p><Bars rows={data.campaigns} label={(r) => r.campaign} value={(r) => Number(r.visits)} /></section>
      </div>
    </>}
  </div>;
}
