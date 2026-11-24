import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SignInPage } from "@/components/auth-panel";
import { CollectionManager } from "@/components/collection-manager";
import { CustomProjectBoard } from "@/components/custom-project-board";
import { PublicProfile } from "@/components/designer/public-profile";
import { api, useApi } from "@/components/bo/common";
import { papi } from "@/components/projects";
import { StoreChat } from "@/components/storefront/chat";
import { StudioUpload } from "@/components/storefront/studio-upload";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { listAllOffers } from "@/lib/studio.functions";
import { savePayoutDetails } from "@/lib/designer-profile.functions";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "Designer studio — Artisan Murals" }, { name: "description", content: "Upload designs, answer requests, send prices and see your sales and earnings." }, { name: "robots", content: "noindex" }] }),
  component: Studio,
});

/** The approved preview's designer studio: account-style page, sections on the left, the chosen section on the right. */
const SECTIONS: [string, string][] = [["overview", "Overview"], ["requests", "Requests & jobs"], ["approvals", "Approvals & status"], ["inbox", "Inbox"], ["orders", "Orders"], ["designs", "My designs"], ["collections", "Collections"], ["earnings", "Earnings"], ["notifications", "Notifications"], ["profile", "Profile"], ["upload", "Upload a design"]];
const money = (n: any) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const STATUS: Record<string, [string, string]> = { paid: ["wait", "Paid"], waiting_on_designer: ["wait", "Waiting on you"], ready_to_print: ["wait", "Ready to print"], processing: ["wait", "In production"], printing: ["wait", "Printing"], shipped: ["ok", "Shipped"], delivered: ["ok", "Delivered"] };
const designPill = (d: any): [string, string] => (!d.submittedAt ? ["", "Draft"] : d.review === "approved" ? ["ok", "Live"] : d.review === "rejected" ? ["bad", "Changes needed"] : d.review === "hidden" ? ["", "Hidden"] : ["wait", "In review"]);

function Studio() {
  const { session, loading } = useSession();
  const me = useApi<any>(session ? "designer/me" : null, [session?.user?.id]);
  const offersFn = useServerFn(listAllOffers);
  const [offers, setOffers] = useState<any[]>([]);
  const [tab, setTab] = useState("overview");
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("view"); if (v) setTab(v === "messages" ? "inbox" : v === "offers" ? "approvals" : v); }, []);
  useEffect(() => { if (session) void offersFn().then(setOffers).catch(() => setOffers([])); }, [session?.user.id]);
  const go = (k: string) => { setTab(k); window.history.replaceState(null, "", `/studio?view=${k}`); if (innerWidth < 860) document.getElementById("stMain")?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  if (loading) return <div className="am"><p className="pg hint" style={{ padding: "60px 20px" }}>Loading your studio…</p></div>;
  if (!session) return <SignInPage designer title="Designer studio" />;
  const d = me.data;
  const prof = d?.profile;
  const first = (prof?.full_name || "").split(" ")[0];
  const t = d?.totals ?? {};
  const openOffers = offers.filter((o) => o.status === "sent").length;
  const counts: Record<string, number> = { requests: 0, approvals: openOffers, designs: t.drafts ?? 0 };
  const designs: any[] = d?.designs ?? [];

  const main = () => {
    if (me.error) return <p className="rq-ok err">{me.error}</p>;
    if (!d) return <p className="hint">Loading…</p>;
    if (!prof) return <div className="sa-done"><b>Apply to sell first</b><p>Tell us about you and your work. Once the studio approves you, you can upload designs here.</p><a className="btn btn-wine btn-sm" href="/become-designer">Start my application</a></div>;
    switch (tab) {
      case "requests": return <><h2>Requests &amp; jobs</h2><p className="hint">Change requests on your designs, custom jobs and open requests from customers. Send a price and it opens a private chat.</p><div className="st-legacy"><CustomProjectBoard /></div></>;
      case "approvals": return <><h2>Approvals &amp; status</h2><p className="hint">Every price you sent and where it stands.</p>{offers.length === 0 ? <p className="hint">No prices sent yet. Send one from a request or a chat.</p> : <div className="tbl-wrap"><table className="tbl"><tbody>{offers.map((o) => { const k = o.status === "sent" ? 1 : o.status === "accepted" ? 2 : o.status === "paid" ? 3 : o.status === "delivered" ? 5 : 1; return <tr key={o.id}><td><b>{o.description || "Price offer"}</b><br /><small>{day(o.created_at)} · {money(o.amount)}</small></td><td><div className="pipe">{["Sent", "Approved", "Paid", "Print file", "Done"].map((x, i) => <span key={x} className={i < k ? "on" : ""}>{x}</span>)}</div></td></tr>; })}</tbody></table></div>}</>;
      case "inbox": return <><h2>Inbox</h2><p className="hint">All your chats with customers and the studio.</p><div id="view-chat"><StoreChat initialKey={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("c") : null} emptyText="No chats yet. When a customer asks about one of your designs, it shows up here." /></div></>;
      case "orders": return <><h2>Orders of your designs</h2>{(d.orders ?? []).length === 0 ? <p className="hint">No orders yet. They show up here as soon as a customer pays.</p> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Order</th><th>Design</th><th>Size · paper</th><th>Status</th><th>You earn</th></tr></thead><tbody>{d.orders.map((o: any) => { const [c, l] = STATUS[o.status] ?? ["", o.status]; return <tr key={o.id}><td><b>{o.id.slice(0, 8).toUpperCase()}</b><br /><small>{day(o.at)}</small></td><td>{o.design}{o.color ? <><br /><small>{o.color}</small></> : null}</td><td>{Math.round(o.sqft)} sq ft · {o.finish}</td><td><span className={"pill " + c}>{l}</span>{o.dueAt ? <><br /><small>Due {day(o.dueAt)}</small></> : null}</td><td>{money((o.royalty || 0) + (o.fee || 0))}</td></tr>; })}</tbody></table></div>}<p className="hint">You earn {t.rate ?? 10}% of each sale of your designs, plus your custom-job fee after the {t.commission ?? 10}% commission.</p></>;
      case "designs": return <><div className="st-h"><h2>My designs</h2><button type="button" className="btn btn-wine btn-sm" onClick={() => go("upload")}>Upload a design</button></div>{designs.length === 0 ? <p className="hint">No designs yet.</p> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th></th><th>Design</th><th>Status</th><th>Sold</th><th></th></tr></thead><tbody>{designs.map((x) => { const [c, l] = designPill(x); return <tr key={x.id}><td>{x.colors?.[0]?.preview ? <img src={x.colors[0].preview} alt="" /> : null}</td><td><b>{x.title}</b><br /><small>{x.sku ? `${x.sku} · ` : ""}{x.kind === "mural" ? "Mural" : "Repeat"}{x.colors?.length > 1 ? ` · ${x.colors.length} colorways` : ""}</small>{x.review === "rejected" && x.reviewNote ? <><br /><small className="err">“{x.reviewNote}”</small></> : null}</td><td><span className={"pill " + c}>{l}</span></td><td>{Math.round(x.sales?.sqft ?? 0)} sq ft</td><td className="st-acts"><a className="btn btn-sm optline" href={`/designer-upload?id=${x.id}`}>{x.submittedAt ? "Edit" : "Finish"}</a>{x.review === "approved" && <a className="btn btn-sm optline" href={`/design/${x.slug}`}>View</a>}</td></tr>; })}</tbody></table></div>}</>;
      case "collections": return <><h2>Collections</h2><p className="hint">Group your designs into a collection customers can browse together.</p><div className="st-legacy"><CollectionManager /></div></>;
      case "earnings": return <Earnings d={d} reload={me.reload} />;
      case "notifications": return <Notifications />;
      case "profile": return <><h2>Public profile</h2><p className="hint">What customers see on your designer page.</p><div className="st-legacy"><PublicProfile /></div></>;
      case "upload": return prof.status !== "approved" ? <><h2>Add a design</h2><p className="hint">Your designer application is being reviewed. You can upload as soon as the studio approves you; you'll get an email and a notification.</p></> : <><h2>Add a design</h2><StudioUpload rules={d.rules} /></>;
      default: return <>
        <div className="stats"><div className="stat"><b>{t.live ?? 0}</b><small>Live designs{t.pending ? ` · ${t.pending} in review` : ""}</small></div><div className="stat"><b>{Math.round(t.sqft ?? 0).toLocaleString()}</b><small>Square feet sold</small></div><div className="stat"><b>{openOffers}</b><small>Prices waiting for the customer</small></div><div className="stat"><b>{money(t.earned)}</b><small>Earned · {money(t.owed)} ready to cash out</small></div></div>
        <h2>To do</h2>
        {(() => { const todo = designs.filter((x) => !x.submittedAt || x.review === "rejected"); return todo.length === 0 ? <p className="hint">Nothing waiting on you. <button type="button" className="up-link" onClick={() => go("requests")}>See requests</button></p> : <div className="tbl-wrap"><table className="tbl"><tbody>{todo.map((x) => <tr key={x.id}><td>{x.colors?.[0]?.preview ? <img src={x.colors[0].preview} alt="" /> : null}</td><td><b>{x.title}</b><br /><small>{x.review === "rejected" ? `Changes needed${x.reviewNote ? `: “${x.reviewNote}”` : ""}` : "Draft · not sent for review yet"}</small></td><td><a className="btn btn-wine btn-sm" href={`/designer-upload?id=${x.id}`}>{x.review === "rejected" ? "Fix and resend" : "Finish"}</a></td></tr>)}</tbody></table></div>; })()}
      </>;
    }
  };
  return (
    <div className="am">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">My account</a><span>/</span><b>Designer studio</b></nav></div>
      <section className="pg acc studio">
        <div className="pg-head acc-head"><div><span className="k">Designer studio</span><h1>{first ? `Hi, ${first}.` : "Your studio"}</h1><p>{prof?.status === "approved" ? <>Approved designer{d?.slug ? <> · <a href={`/designers/${d.slug}`}>View my public page</a></> : null}</> : prof?.status === "pending" ? "Your application is being reviewed" : prof?.status === "rejected" ? "Your application wasn't approved" : "Designs, requests, sales and earnings"}</p></div>
          <div className="up-row">{prof?.status === "approved" && <button type="button" className="btn btn-wine" onClick={() => go("upload")}>Upload a new design</button>}<button type="button" className="btn optline btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>
        <div className="acc-grid">
          <nav className="acc-nav" aria-label="Studio sections">{SECTIONS.map(([k, n]) => <button key={k} type="button" aria-current={k === tab} onClick={() => go(k)}>{n}{counts[k] ? <em>{counts[k]}</em> : null}</button>)}</nav>
          <div className="acc-main" id="stMain">{main()}</div>
        </div>
      </section>
    </div>
  );
}

function Earnings({ d, reload }: { d: any; reload: () => void }) {
  const t = d.totals ?? {};
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const cash = async (method: "paypal" | "credit") => { setBusy(true); setMsg(""); try { await api("designer/cashout", { body: { amount: t.owed, method } }); setMsg(method === "credit" ? "Added to your store credit ✓" : "Payout requested ✓ You'll get an email when it's sent."); reload(); } catch (e: any) { setMsg(e.message); } setBusy(false); };
  return <>
    <h2>Earnings</h2>
    <div className="stats"><div className="stat"><b>{money(t.earned)}</b><small>Earned all time</small></div><div className="stat"><b>{money(t.owed)}</b><small>Ready to cash out</small></div><div className="stat"><b>{money(t.jobsPending)}</b><small>Pending (jobs in progress)</small></div><div className="stat"><b>{Number(t.sqft ?? 0).toLocaleString()}</b><small>Sq ft of your designs printed</small></div><div className="stat"><b>{money((t.rate ?? 0) / 100)}</b><small>You earn per sq ft now</small></div></div>
    {Number(t.owed) > 0 && <div className="up-row"><button type="button" className="btn btn-wine btn-sm" disabled={busy} onClick={() => void cash("paypal")}>Cash out {money(t.owed)}</button><button type="button" className="btn optline btn-sm" disabled={busy} onClick={() => void cash("credit")}>Take it as store credit</button></div>}
    {msg && <p className="rq-ok">{msg}</p>}
    {!d.profile?.payout_details && <PayoutForm onSaved={reload} />}
    {(d.designs ?? []).some((x: any) => x.sales?.orders) && <><h2>By design</h2><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Design</th><th>Orders</th><th>Sq ft printed</th><th>You earned</th></tr></thead><tbody>{d.designs.filter((x: any) => x.sales?.orders || x.sales?.sqft).map((x: any) => <tr key={x.id}><td>{x.title}</td><td>{x.sales.orders}</td><td>{Number(x.sales.sqft).toLocaleString()}</td><td>{money(x.sales.royalty)}</td></tr>)}</tbody></table></div></>}
    {(d.earningsLog ?? []).length > 0 && <><h2>Every order you earned from</h2><p className="hint">One line per paid order, at the rate you had when it was paid. If an order is cancelled or refunded, a minus line takes it back. Your totals are the sum of these lines.</p><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Order</th><th>Design</th><th>Sq ft</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{d.earningsLog.map((l: any, i: number) => <tr key={i}><td>{day(l.at)}</td><td>{l.order}{l.kind === "reversal" ? " · refunded" : ""}</td><td>{l.design}</td><td>{l.sqft}</td><td>{money(l.centsPerSqft / 100)}/sq ft</td><td>{money(l.amount)}</td></tr>)}</tbody></table></div></>}
    {(d.payouts ?? []).length > 0 && <><h2>Payouts</h2><div className="tbl-wrap"><table className="tbl"><tbody>{d.payouts.map((p: any, i: number) => <tr key={i}><td>{day(p.paid_at)}</td><td>{p.method || "Payout"}</td><td>{money(p.amount)}</td><td><span className={"pill " + (p.status === "requested" ? "wait" : "ok")}>{p.status === "requested" ? "Requested" : "Paid"}</span></td></tr>)}</tbody></table></div></>}
  </>;
}

function PayoutForm({ onSaved }: { onSaved: () => void }) {
  const save = useServerFn(savePayoutDetails);
  const [method, setMethod] = useState<"paypal" | "bank" | "wise">("paypal");
  const [details, setDetails] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  return <div className="st-card"><b>How should we pay you?</b><p className="hint">Only the Artisan Murals owner sees these details. You can add them once a design of yours is approved.</p>
    <div className="sa-radios" role="radiogroup">{([["paypal", "PayPal"], ["wise", "Wise"], ["bank", "Bank transfer"]] as const).map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}><b>{l}</b></button>)}</div>
    <label className="rqf"><span>{method === "bank" ? "Bank name, account holder, IBAN or account number, SWIFT/BIC" : `Your ${method === "paypal" ? "PayPal" : "Wise"} email`}</span><textarea rows={method === "bank" ? 3 : 1} maxLength={800} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
    {err && <p className="rq-ok err">{err}</p>}
    <button type="button" className="btn btn-wine btn-sm" disabled={busy || details.trim().length < 4} onClick={async () => { setBusy(true); setErr(""); try { await save({ data: { payoutMethod: method, payoutDetails: details } }); onSaved(); } catch (e) { setErr(plainError(e, "Could not save your payout details.")); } setBusy(false); }}>Save payout details</button>
  </div>;
}

function Notifications() {
  const [data, setData] = useState<{ items: any[] } | null>(null);
  useEffect(() => { papi("notifications").then(setData).catch(() => setData({ items: [] })); }, []);
  return <><h2>Notifications</h2>{!data ? <p className="hint">Loading…</p> : data.items.length === 0 ? <p className="hint">Nothing yet. New requests, approvals, payments and messages show up here, and by email.</p> : data.items.map((n: any) => <a key={n.id} className={"notif" + (n.read_at || n.read ? " read" : "")} href={n.link || "#"}><i /><div><b>{n.title}</b><small>{n.body}</small></div><time>{day(n.created_at)}</time></a>)}</>;
}
