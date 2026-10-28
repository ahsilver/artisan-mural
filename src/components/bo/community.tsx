import { useState } from "react";
import { api, useApi, fmtDate, Pill, Msg } from "./common";

const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

/** Owner: every review (designs + designers) with hide / delete / reply. */
export function AdminReviews() {
  const { data, reload, error } = useApi<any>("community/admin/reviews");
  const [reply, setReply] = useState<Record<string, string>>({}); const [msg, setMsg] = useState<any>(null);
  const act = async (id: string, body: any) => { setMsg(null); try { await api(`community/admin/reviews/${id}`, { body }); reload(); } catch (e: any) { setMsg({ text: e.message }); } };
  if (error) return <Msg m={{ text: error }} />;
  const rows = data?.reviews ?? [];
  return <div className="bo-card" data-testid="admin-reviews"><h2>Reviews</h2>
    <p className="bo-sub">Only verified buyers can post: a design review needs an order of that design; a designer review needs a request that designer accepted. Hidden reviews don't show or count.</p>
    <Msg m={msg} />
    {rows.length === 0 ? <p className="bo-sub" style={{ marginTop: 12 }}>No reviews yet.</p> :
      <table className="bo-tbl stack" style={{ marginTop: 10 }}><thead><tr><th>Review</th><th>For</th><th>By</th><th></th></tr></thead><tbody>{rows.map((r: any) => <tr key={r.id}>
        <td data-l="Review"><span style={{ color: "#b07a4f", letterSpacing: 1 }}>{stars(r.rating)}</span> {r.hidden && <Pill tone="warn">Hidden</Pill>}<div style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>{r.body}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}><input className="bo-in" style={{ maxWidth: 320 }} placeholder="Reply (shows under the review)" value={reply[r.id] ?? r.reply ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} /><button className="bo-btn sm" onClick={() => act(r.id, { action: "reply", reply: reply[r.id] ?? r.reply ?? "" })}>Save reply</button></div></td>
        <td data-l="For">{r.kind === "design" ? "Design" : "Designer"}: <a className="bo-link" href={r.kind === "design" ? `/design/${r.target}` : `/designers/${r.target}`} target="_blank" rel="noreferrer">{r.targetName}</a><div className="bo-sub">{fmtDate(r.at)}</div></td>
        <td data-l="By">{r.name}<div className="bo-sub">{r.email}</div></td>
        <td><div style={{ display: "flex", gap: 6 }}><button className="bo-btn sm" onClick={() => act(r.id, { action: r.hidden ? "show" : "hide" })}>{r.hidden ? "Show" : "Hide"}</button><button className="bo-btn sm danger" onClick={() => confirm("Delete this review for good?") && act(r.id, { action: "delete" })}>Delete</button></div></td>
      </tr>)}</tbody></table>}
  </div>;
}

/** Owner: designer public profiles (directory) with show / hide. */
export function AdminProfiles() {
  const { data, reload } = useApi<any>("community/admin/designers");
  const rows = data?.designers ?? [];
  return <div className="bo-card" data-testid="admin-profiles"><h2>Designer profiles</h2>
    <p className="bo-sub">Approved designers appear on /designers with their photo, line, specialties, response time and turnaround. Hide a profile to take it off the directory (their designs stay in the shop).</p>
    <table className="bo-tbl stack" style={{ marginTop: 10 }}><thead><tr><th>Designer</th><th>Account</th><th>Responds</th><th>Turnaround</th><th>Reviews</th><th></th></tr></thead><tbody>{rows.map((d: any) => <tr key={d.uid}>
      <td data-l="Designer"><div style={{ display: "flex", gap: 10, alignItems: "center" }}>{d.photo ? <img src={d.photo} alt="" style={{ width: 34, height: 34, borderRadius: 999, objectFit: "cover" }} /> : <span style={{ width: 34, height: 34, borderRadius: 999, background: "#eee", display: "inline-block" }} />}<div><b style={{ fontWeight: 500 }}>{d.name}</b><div className="bo-sub">{d.tagline || d.email}</div></div></div></td>
      <td data-l="Account"><Pill tone={d.status === "approved" ? "ok" : d.status === "pending" ? "warn" : "bad"}>{d.status}</Pill>{d.hidden && <> <Pill tone="warn">Hidden</Pill></>}</td>
      <td data-l="Responds">{d.responseLabel || "—"}{d.measured && <div className="bo-sub">measured {d.measured.label}</div>}</td>
      <td data-l="Turnaround">{d.turnaroundDays ? `${d.turnaroundDays} days` : "—"}</td>
      <td data-l="Reviews">{d.count ? `${d.avg} (${d.count})` : "—"}</td>
      <td><div style={{ display: "flex", gap: 6 }}>{d.status === "approved" && !d.hidden && <a className="bo-btn sm" href={`/designers/${d.slug}`} target="_blank" rel="noreferrer">View</a>}<button className="bo-btn sm" onClick={async () => { await api(`community/admin/designers/${d.uid}`, { body: { hidden: !d.hidden } }); reload(); }}>{d.hidden ? "Show on site" : "Hide"}</button></div></td>
    </tr>)}</tbody></table>
  </div>;
}
