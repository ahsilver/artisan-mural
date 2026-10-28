import { useState } from "react";
import { api, useApi, Msg, Field, Pill, Drawer, useSaver, fmtDate, fmtDateTime, money } from "./common";

function csv(name: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([[keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
const LABELS: [string, string][] = [["contactName", "Contact"], ["role", "Role"], ["roleOther", "Role (other)"], ["website", "Website"], ["instagram", "Instagram"], ["portfolio", "Portfolio"], ["address", "Address"], ["city", "City"], ["state", "State"], ["postal", "Postal code"], ["country", "Country"], ["phone", "Phone"], ["years", "Years in business"], ["projects", "Project types"], ["volume", "Yearly volume"], ["heard", "How they heard"], ["taxId", "Tax ID / resale no."], ["notes", "Notes"]];
const link = (k: string, v: string) => { if (!v) return v; if (k === "instagram") return <a href={`https://instagram.com/${v.replace(/^@/, "")}`} target="_blank" rel="noreferrer">{v}</a>; if (k === "website" || k === "portfolio") return <a href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">{v}</a>; return v; };
const tone = (s: string) => (s === "approved" ? "ok" : s === "declined" ? "bad" : "warn") as any;

export function ProProgram() {
  const { data, error, reload } = useApi<any>("pro/admin/apps");
  const [tab, setTab] = useState<"pending" | "all" | "members">("pending");
  const [open, setOpen] = useState<any>(null);
  const [note, setNote] = useState(""); const [pct, setPct] = useState<any>("");
  const [edit, setEdit] = useState<Record<string, any>>({});
  const s = useSaver();
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const name = data.settings?.name || "Artisan Pro";
  const pending = data.apps.filter((a: any) => a.status === "pending");
  const list = tab === "pending" ? pending : data.apps;
  const decide = (action: "approve" | "decline") => s.run(async () => { await api(`pro/admin/apps/${open.id}`, { body: { action, note, discountPct: pct === "" ? undefined : Number(pct) } }); setOpen(null); reload(); }, action === "approve" ? "Approved. Their discount is on." : "Declined");
  return <div>
    <div className="bo-top"><h1>{name}</h1>{pending.length > 0 && <Pill tone="warn">{pending.length} waiting</Pill>}<span className="bo-sub" style={{ marginLeft: "auto" }}>Default discount {data.settings?.discountPct ?? 20}% · change it in Settings</span></div>
    <div className="bo-tabs" style={{ marginBottom: 12 }}>
      <button className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>Applications ({pending.length})</button>
      <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>All applications ({data.apps.length})</button>
      <button className={tab === "members" ? "on" : ""} onClick={() => setTab("members")}>Members ({data.members.length})</button>
    </div>
    <Msg m={s.msg} />
    {tab !== "members" ? (list.length ? <table className="bo-tbl stack"><thead><tr><th>Business</th><th>Role</th><th>Projects</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>
      {list.map((a: any) => <tr key={a.id}><td><b>{a.business}</b><div className="bo-sub">{a.email}</div></td><td data-l="Role">{a.role}</td><td data-l="Projects">{(a.answers.projects ?? []).join(", ")}</td><td data-l="Applied">{fmtDate(a.created_at)}</td><td data-l="Status"><Pill tone={tone(a.status)}>{a.status}</Pill></td>
        <td><button className="bo-btn sm" onClick={() => { setOpen(a); setNote(a.decision_note ?? ""); setPct(data.settings?.discountPct ?? 20); }}>{a.status === "pending" ? "Review" : "View"}</button></td></tr>)}
    </tbody></table> : <div className="bo-card bo-sub">{tab === "pending" ? "No applications waiting." : "No applications yet. They appear here when professionals apply on the /pro page."}</div>)
    : (data.members.length ? <table className="bo-tbl stack"><thead><tr><th>Member</th><th className="num">Orders</th><th className="num">Spent</th><th>Discount</th><th></th></tr></thead><tbody>
      {data.members.map((m: any) => { const v = edit[m.user_id] ?? m.discount_pct; return <tr key={m.user_id}><td><b>{m.company || m.name || m.email}</b> <Pill tone="ok">Pro</Pill><div className="bo-sub">{m.email}</div></td><td className="num" data-l="Orders">{m.orders}</td><td className="num" data-l="Spent">{money(m.spent)}</td>
        <td data-l="Discount"><div className="bo-row" style={{ gap: 6, flexWrap: "nowrap" }}><input className="bo-in" style={{ width: 80 }} type="number" min="0" max="80" value={v} onChange={(e) => setEdit({ ...edit, [m.user_id]: e.target.value })} aria-label="Discount percent" /><span>%</span>{String(v) !== String(m.discount_pct) && <button className="bo-btn sm pri" onClick={() => s.run(async () => { await api(`pro/admin/members/${m.user_id}`, { body: { discountPct: Number(v) } }); reload(); }, "Discount saved")}>Save</button>}</div></td>
        <td><button className="bo-btn sm" onClick={() => { if (confirm(`Remove ${m.email} from ${name}? Their discount stops.`)) s.run(async () => { await api(`pro/admin/members/${m.user_id}`, { body: { remove: true } }); reload(); }, "Removed"); }}>Remove</button></td></tr>; })}
    </tbody></table> : <div className="bo-card bo-sub">No members yet. Approve an application to add one.</div>)}
    <Drawer open={!!open} onClose={() => setOpen(null)}>{open && <div>
      <div className="bo-row" style={{ justifyContent: "space-between" }}><h2 style={{ fontSize: 16 }}>{open.business}</h2><button className="bo-btn sm" onClick={() => setOpen(null)}>Close</button></div>
      <div className="bo-sub" style={{ marginBottom: 12 }}>{open.email} · applied {fmtDateTime(open.created_at)} · <Pill tone={tone(open.status)}>{open.status}</Pill></div>
      <Msg m={s.msg} />
      <div className="bo-card"><h2>Answers</h2><table className="bo-tbl" style={{ fontSize: 13 }}><tbody>
        {LABELS.filter(([k]) => open.answers[k] && (Array.isArray(open.answers[k]) ? open.answers[k].length : true)).map(([k, l]) => <tr key={k}><td className="bo-sub" style={{ width: 150 }}>{l}</td><td>{Array.isArray(open.answers[k]) ? open.answers[k].join(", ") : link(k, open.answers[k])}</td></tr>)}
        <tr><td className="bo-sub">Document</td><td>{open.fileUrl ? <a href={open.fileUrl} target="_blank" rel="noreferrer">{open.file_name}</a> : "None uploaded"}</td></tr>
      </tbody></table></div>
      <div className="bo-card"><h2>{open.status === "pending" ? "Decision" : "Change decision"}</h2>
        <Field label="Discount for this member (%)"><input className="bo-in" style={{ width: 120 }} type="number" min="0" max="80" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <Field label="Note (sent in the email)"><textarea className="bo-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        <div className="bo-row"><button className="bo-btn pri" disabled={s.busy} onClick={() => decide("approve")}>Approve</button><button className="bo-btn" disabled={s.busy} onClick={() => decide("decline")}>Decline</button></div>
        {open.decided_at && <p className="bo-sub" style={{ marginTop: 8 }}>Last decision {fmtDateTime(open.decided_at)}{open.decided_by ? ` by ${open.decided_by}` : ""}</p>}
      </div>
    </div>}</Drawer>
  </div>;
}

export function EmailSignups() {
  const { data, error } = useApi<any>("pro/admin/signups");
  const [q, setQ] = useState("");
  if (error) return <Msg m={{ text: error }} />;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const list = data.signups.filter((r: any) => !q || r.email.includes(q.toLowerCase()));
  const used = data.signups.filter((r: any) => r.used_at).length;
  return <div>
    <div className="bo-top"><h1>Email signups</h1><Pill tone={data.settings?.enabled ? "ok" : undefined}>{data.settings?.enabled ? `Popup on · ${data.settings?.pct}% off` : "Popup off"}</Pill><button className="bo-btn" style={{ marginLeft: "auto" }} onClick={() => csv("email-signups.csv", list.map((r: any) => ({ email: r.email, code: r.code, percent: r.pct, signed_up: r.created_at, used: r.used_at ? "yes" : "", used_at: r.used_at ?? "", page: r.page ?? "" })))}>Export CSV</button></div>
    <p className="bo-sub" style={{ marginBottom: 12 }}>{data.signups.length} emails from the first-order popup · {used} codes used. Popup text, % and timing are in Settings → First-order popup.</p>
    <input className="bo-in" style={{ maxWidth: 360, marginBottom: 12 }} placeholder="Search email" value={q} onChange={(e) => setQ(e.target.value)} />
    {list.length ? <table className="bo-tbl stack"><thead><tr><th>Email</th><th>Code</th><th>Signed up</th><th>Used</th></tr></thead><tbody>
      {list.map((r: any) => <tr key={r.email}><td>{r.email}</td><td data-l="Code"><code>{r.code}</code> · {r.pct}%</td><td data-l="Signed up">{fmtDateTime(r.created_at)}</td><td data-l="Used">{r.used_at ? <Pill tone="ok">Used {fmtDate(r.used_at)}</Pill> : "–"}</td></tr>)}
    </tbody></table> : <div className="bo-card bo-sub">No signups yet.</div>}
  </div>;
}
