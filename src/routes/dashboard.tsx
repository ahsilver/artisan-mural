import { createFileRoute } from "@tanstack/react-router";
import { Messenger, useUnreadMessages } from "@/components/messenger";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { api, useApi, money, fmtDate, Pill, Msg, Field, Drawer, useSaver } from "@/components/bo/common";
import { DesignEditor } from "@/components/designer/design-editor";
import { PublicProfile } from "@/components/designer/public-profile";
import { NotificationBell } from "@/components/projects";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DesignerAuthShell, AuthHeading, AuthInput, AuthButton, AuthNotice, AuthDivider } from "@/components/designer-auth-shell";
import { COUNTRIES, TOP_COUNTRIES } from "@/components/designer/countries";
import { DesignerRequests, CollectionsEditor, projectLabel, projectTone } from "@/components/bo/projects";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Designer dashboard — Artisan Mural" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function DesignerAuth() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [notice, setNotice] = useState("");
  const s = useSaver();
  const go = () => s.run(async () => {
    if (mode === "signup") { const { error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name, role: "designer" } } }); if (error) throw error; }
    else { const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password }); if (error) throw error; }
  }, "Welcome");
  const forgot = () => {
    if (!f.email) { setNotice("Type your email first, then tap Forgot password."); return; }
    setNotice("");
    s.run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) throw error;
      setNotice("Check your email: we sent you a link to set a new password.");
    }, "");
  };
  const swap = () => { setMode(mode === "signup" ? "signin" : "signup"); setNotice(""); };
  const err = s.msg && !s.msg.ok ? s.msg.text : "";
  return <div className="flex min-h-screen flex-col bg-background">
    <SiteHeader />
    <main className="flex-1">
      <DesignerAuthShell>
        <AuthHeading eyebrow="For designers" title={mode === "signup" ? "Create your designer account" : "Welcome back"} sub={mode === "signup" ? "It takes a minute. Upload your first design right after." : "Sign in to your designer studio."} />
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
          {mode === "signup" && <AuthInput label="Your name" name="name" autoComplete="name" placeholder="First and last name, or studio name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
          <AuthInput label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <AuthInput label="Password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {mode === "signin" && <div className="-mt-1 text-right"><button type="button" onClick={forgot} disabled={s.busy} className="text-sm font-medium text-clay underline-offset-4 hover:underline">Forgot password?</button></div>}
          <AuthNotice text={err} tone="error" />
          <AuthNotice text={notice} />
          <AuthButton type="submit" busy={s.busy}>{mode === "signup" ? "Create designer account" : "Sign in"}</AuthButton>
        </form>
        <AuthDivider />
        <p className="text-center text-[15px] text-muted-foreground">{mode === "signup" ? "Already selling with us? " : "New here? "}<button type="button" onClick={swap} className="font-semibold text-clay underline-offset-4 hover:underline">{mode === "signup" ? "I already have an account" : "Create an account"}</button></p>
        <p className="mt-3 text-center text-sm"><a href="/designers/how-it-works" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">How it works for designers (FAQ)</a></p>
      </DesignerAuthShell>
    </main>
    <SiteFooter />
  </div>;
}

const STYLE_IDEAS = ["Botanical", "Floral", "Geometric", "Tropical", "Abstract", "Chinoiserie", "Landscape", "Art Deco", "Watercolor", "Kids", "Minimal", "Vintage"];
function splitStyles(v: any): string[] { return String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean); }

function OnbField({ label, hint, opt, children, htmlFor }: { label: string; hint?: string; opt?: boolean; children: any; htmlFor?: string }) {
  return <div className="dp-field"><label className="dp-lbl" htmlFor={htmlFor}>{label}{opt && <span className="dp-opt">optional</span>}</label>{children}{hint && <p className="dp-hint">{hint}</p>}</div>;
}

function Onboarding({ email, onDone, initial }: { email?: string; onDone: () => void; initial?: any }) {
  const s = useSaver();
  const [f, setF] = useState<any>(initial ?? { full_name: "", studio_name: "", country: "", bio: "", styles: "", portfolio: "", payout_details: email ?? "" });
  const picked = splitStyles(f.styles);
  const toggleStyle = (x: string) => { const has = picked.some((p) => p.toLowerCase() === x.toLowerCase()); setF({ ...f, styles: (has ? picked.filter((p) => p.toLowerCase() !== x.toLowerCase()) : [...picked, x]).join(", ") }); };
  const countryOpts = COUNTRIES.includes(f.country) || !f.country ? COUNTRIES : [f.country, ...COUNTRIES];
  const bioLen = String(f.bio ?? "").length;
  return <div className={"dp-onb-card" + (initial ? " is-profile" : "")}>
    {!initial && <ol className="dp-stepper" aria-label="Sign-up steps">
      <li className="done"><span className="n" aria-hidden>✓</span><span>Account</span></li>
      <li className="cur" aria-current="step"><span className="n">2</span><span>About you</span></li>
      <li><span className="n">3</span><span>First design</span></li>
    </ol>}
    <div className="dp-head">
      <p className="dp-eyebrow">{initial ? "Designer profile" : "Step 2 of 3"}</p>
      <h2 className="dp-title">{initial ? "Your profile" : "Tell us about you"}</h2>
      {!initial ? <p className="dp-lead">One short form. The studio reviews it; you can upload drafts meanwhile.</p> : <p className="dp-lead">What the studio sees about you, and where your earnings go.</p>}
    </div>
    <Msg m={s.msg} />
    <fieldset className="dp-group"><legend>About you</legend>
      <div className="dp-grid2">
        <OnbField label="Full name" htmlFor="onb-name"><input id="onb-name" className="bo-in" autoComplete="name" placeholder="e.g. Maya Chen" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></OnbField>
        <OnbField label="Studio name" opt htmlFor="onb-studio" hint="Shown on your public page instead of your name."><input id="onb-studio" className="bo-in" autoComplete="organization" placeholder="e.g. Maya Chen Studio" value={f.studio_name ?? ""} onChange={(e) => setF({ ...f, studio_name: e.target.value })} /></OnbField>
      </div>
      <OnbField label="Country" htmlFor="onb-country"><select id="onb-country" className="bo-in dp-select" value={f.country ?? ""} onChange={(e) => setF({ ...f, country: e.target.value })}>
        <option value="">Choose your country</option>
        <optgroup label="Common">{TOP_COUNTRIES.map((c) => <option key={"t" + c} value={c}>{c}</option>)}</optgroup>
        <optgroup label="All countries">{countryOpts.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
      </select></OnbField>
    </fieldset>
    <fieldset className="dp-group"><legend>Your work</legend>
      <OnbField label="Styles" htmlFor="onb-styles" hint="Tap a few, or type your own separated by commas.">
        <div className="dp-chips" role="group" aria-label="Style suggestions">{STYLE_IDEAS.map((x) => { const on = picked.some((p) => p.toLowerCase() === x.toLowerCase()); return <button type="button" key={x} className={"dp-chip" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggleStyle(x)}>{on && <span aria-hidden>✓ </span>}{x}</button>; })}</div>
        <input id="onb-styles" className="bo-in" value={f.styles} onChange={(e) => setF({ ...f, styles: e.target.value })} placeholder="botanical, geometric" />
      </OnbField>
      <OnbField label="Short bio" htmlFor="onb-bio" hint={`2–3 sentences about you and your work. Shown on your public designer page.${bioLen ? ` · ${bioLen} characters` : ""}`}><textarea id="onb-bio" className="bo-ta" rows={4} placeholder="I paint large botanical murals in watercolor and gouache…" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></OnbField>
      <OnbField label="Portfolio link" htmlFor="onb-port" hint="Website, Instagram or Behance — anywhere the studio can see your work."><input id="onb-port" className="bo-in" inputMode="url" autoComplete="url" value={f.portfolio} onChange={(e) => setF({ ...f, portfolio: e.target.value })} placeholder="https://" /></OnbField>
    </fieldset>
    <fieldset className="dp-group"><legend>Getting paid</legend>
      <OnbField label="PayPal email for payouts" htmlFor="onb-pp" hint="Your earnings are paid here. You can change it any time in Profile."><input id="onb-pp" className="bo-in" inputMode="email" autoComplete="email" placeholder="you@example.com" value={f.payout_details ?? ""} onChange={(e) => setF({ ...f, payout_details: e.target.value })} /></OnbField>
    </fieldset>
    <button className="bo-btn pri dp-cta" disabled={s.busy} onClick={async () => { if (await s.run(() => api("designer/profile", { body: { full_name: f.full_name, studio_name: f.studio_name, country: f.country, bio: f.bio, styles: String(f.styles).split(",").map((x: string) => x.trim()).filter(Boolean), portfolio_links: [f.portfolio].filter(Boolean), payout_method: f.payout_details ? "PayPal" : null, payout_details: f.payout_details } }))) onDone(); }}>{s.busy && <span className="dp-spin" aria-hidden />}{initial ? "Save profile" : "Continue"}</button>
    {!initial && <p className="dp-foot">You can edit all of this later in Profile.</p>}
  </div>;
}

const REVIEW: any = { approved: ["Live", "ok"], pending: ["In review", "warn"], rejected: ["Changes needed", "bad"] };
function Dashboard() {
  const { session, loading } = useSession();
  const me = useApi<any>(session ? "designer/me" : null, [session?.user?.id]);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTabState] = useState("overview");
  const [project, setProjectState] = useState<string | null>(null);
  const jobs = useApi<any>(session ? "projects/designer" : null, [session?.user?.id]);
  useEffect(() => { const q = new URLSearchParams(window.location.search); { const tv = q.get("view") ?? q.get("tab"); if (tv) setTabState(tv); } if (q.get("project")) setProjectState(q.get("project")); }, []);
  const syncUrl = (t: string, pid: string | null) => { const q = new URLSearchParams(); if (t !== "overview") q.set("view", t); if (pid) q.set("project", pid); window.history.replaceState(null, "", "/dashboard" + (q.toString() ? "?" + q : "")); };
  const setTab = (t: string) => { setTabState(t); setProjectState(null); syncUrl(t, null); window.scrollTo({ top: 0 }); };
  const setProject = (pid: string | null) => { setProjectState(pid); syncUrl(pid ? "requests" : tab, pid); if (!pid) jobs.reload(); };
  const [creating, setCreating] = useState(false);
  const unreadMsgs = useUnreadMessages(!!session);
  if (loading) return <div className="bo dp"><div className="bo-main bo-sub">Loading…</div></div>;
  if (!session) return <DesignerAuth />;
  if (me.error) return <div className="bo dp"><div className="bo-main"><Msg m={{ text: me.error }} /></div></div>;
  if (!me.data) return <div className="bo dp"><div className="bo-main bo-sub">Loading…</div></div>;
  const d = me.data;
  const t = d.totals;
  async function newDesign() {
    setCreating(true);
    try { const r = await api("designer/uploads", { body: { title: "Untitled design", kind: "mural" } }); await me.reload(); setOpen(r.id); } finally { setCreating(false); }
  }
  const header = <div className="bo-dtop"><b style={{ fontSize: 14 }}>Artisan Mural</b><span className="bo-sub" style={{ marginRight: "auto" }}>Designer</span><NotificationBell /><a className="bo-btn sm" href="/account">My orders</a><a className="bo-btn sm" href="/">Shop</a><button className="bo-btn sm" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  if (!d.profile) return <div className="bo dp dp-onb">{header}<div className="bo-main dp-onb-main"><Onboarding email={d.email} onDone={me.reload} /></div></div>;
  const editing = d.designs.find((x: any) => x.id === open);
  const jobsData = jobs.data ?? { projects: [], open: [] };
  const todo = jobsData.projects.filter((p: any) => ["requested", "in_progress"].includes(p.status) && !p.lost).length + jobsData.open.length;
  return <div className="bo dp">
    {header}
    <div className="bo-main" style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="bo-top"><h1>Hi {d.profile.full_name.split(" ")[0]}</h1>
        {d.profile.status === "approved" ? <Pill tone="ok">Approved designer{d.profile.trusted ? " · Trusted" : ""}</Pill> : d.profile.status === "pending" ? <Pill tone="warn">Application in review</Pill> : <Pill tone="bad">{d.profile.status}</Pill>}
        {d.slug && <a className="bo-btn" href={`/designers/${d.slug}`} target="_blank" rel="noreferrer">My public page</a>}
        <button className="bo-btn pri" disabled={creating} onClick={newDesign}>Upload new design</button></div>
      {d.profile.status === "pending" && <div className="bo-msg" style={{ marginBottom: 14 }}>The studio is reviewing your application. You can already upload designs; they go live after approval.</div>}
      <div className="bo-tabs" role="tablist" style={{ flexWrap: "wrap" }}>{([["overview", "Overview"], ["requests", `Requests & jobs${todo ? ` (${todo})` : ""}`], ["messages", `Inbox${unreadMsgs ? ` (${unreadMsgs})` : ""}`], ["orders", `Orders (${(d.orders ?? []).length})`], ["designs", `My designs (${d.designs.length})`], ["collections", "Collections"], ["earnings", "Earnings"], ["profile", "Profile"]] as [string, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "overview" ? <Overview d={d} jobs={jobsData} go={setTab} openProject={setProject} /> :
        tab === "requests" ? <DesignerRequests openId={project} onOpen={setProject} /> :
        tab === "orders" ? <MyOrders d={d} openProject={setProject} /> :
        tab === "messages" ? <Messenger initialKey={new URLSearchParams(window.location.search).get("c")} urlMode="search" emptyText="No messages yet. Chats with customers and with Artisan Mural show up here." /> :
        tab === "collections" ? <div className="bo-card"><CollectionsEditor /></div> :
        tab === "earnings" ? <Earnings d={d} onDone={me.reload} /> : tab === "profile" ? <><PublicProfile /><Onboarding email={d.email} onDone={me.reload} initial={{ ...d.profile, styles: d.profile.styles.join(", "), portfolio: d.profile.portfolio_links[0] ?? "" }} /></> :
        <DesignsTable d={d} setOpen={setOpen} newDesign={newDesign} />}
    </div>
    <Drawer wide open={!!editing} onClose={() => { setOpen(null); me.reload(); }}>{editing && <DesignEditor design={editing} rules={d.rules} onChanged={me.reload} onClose={() => { setOpen(null); me.reload(); }} />}</Drawer>
  </div>;
}

function Earnings({ d, onDone }: { d: any; onDone: () => void }) {
  const s = useSaver();
  const [amt, setAmt] = useState(String(d.totals.owed || ""));
  const t = d.totals;
  return <div className="bo-card" style={{ maxWidth: 720 }}>
    <h2>Your earnings</h2>
    <div className="bo-sub" style={{ marginBottom: 12 }}>Take your money as a PayPal payout, or turn it into store credit to buy wallpaper on this site.</div>
    <Msg m={s.msg} />
    <div className="bo-row" style={{ alignItems: "flex-end" }}>
      <Field label={`Amount (up to ${money(t.owed)})`}><input className="bo-in" style={{ width: 140 }} type="number" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
      <button className="bo-btn pri" style={{ marginBottom: 12 }} disabled={s.busy || !(t.owed > 0)} onClick={() => s.run(async () => { await api("designer/cashout", { body: { amount: Number(amt), method: "paypal" } }); onDone(); }, "Cash-out requested. The studio pays it to your PayPal (test mode: no money moves).")}>Cash out to PayPal</button>
      <button className="bo-btn" style={{ marginBottom: 12 }} disabled={s.busy || !(t.owed > 0)} onClick={() => s.run(async () => { await api("designer/cashout", { body: { amount: Number(amt), method: "credit" } }); onDone(); }, "Added to your store credit. Use it at checkout.")}>Turn into store credit</button>
    </div>
    <div className="bo-dl" style={{ marginBottom: 12 }}><span>Royalties from prints</span><b>{money(t.royalties ?? 0)}</b><span>Design work (after {t.commission ?? 10}% studio commission)</span><b>{money(t.jobsEarned ?? 0)}</b><span>Design work paid, not delivered yet</span><b>{money(t.jobsPending ?? 0)}</b><span>Earned</span><b>{money(t.earned)}</b><span>Paid to you</span><b>{money(t.paid)}</b><span>Cash-out requested</span><b>{money(t.requested ?? 0)}</b><span>Store credit balance</span><b>{money(t.credit ?? 0)}</b></div>
    {(d.payouts ?? []).length > 0 && <table className="bo-tbl"><thead><tr><th>Date</th><th>How</th><th className="num">Amount</th><th>Status</th></tr></thead><tbody>{d.payouts.map((p: any, i: number) => <tr key={i}><td>{fmtDate(p.paid_at)}</td><td>{p.method ?? "PayPal"}</td><td className="num">{money(p.amount)}</td><td><Pill tone={p.status === "requested" ? "warn" : "ok"}>{p.status === "requested" ? "Requested" : "Done"}</Pill></td></tr>)}</tbody></table>}
  </div>;
}

function DesignsTable({ d, setOpen, newDesign }: { d: any; setOpen: (id: string) => void; newDesign: () => void }) {
  if (d.designs.length === 0) return <div className="bo-card" style={{ textAlign: "center", padding: 36 }}><h2>No designs yet</h2><p className="bo-sub">Upload your first design. Big files are fine, or paste a Google Drive link.</p><button className="bo-btn pri" onClick={newDesign}>Upload new design</button></div>;
  return <table className="bo-tbl stack"><thead><tr><th></th><th>Design</th><th>Type / size</th><th>Status</th><th className="num">Orders</th><th className="num">Sq ft</th><th className="num">Sales</th><th className="num">Your royalty</th><th></th></tr></thead><tbody>
    {d.designs.map((x: any) => { const r = x.submittedAt || x.review !== "pending" ? REVIEW[x.review] ?? [x.review] : ["Draft"]; return <tr key={x.id} className="click" onClick={() => setOpen(x.id)}>
      <td>{x.colors[0]?.preview ? <img className="bo-thumb" src={x.colors[0].preview} alt="" /> : <div className="bo-thumb" />}</td>
      <td>{x.title}<div className="bo-sub">{x.sku} · {x.colors.length} color{x.colors.length === 1 ? "" : "s"} · {fmtDate(x.createdAt)}</div></td>
      <td data-l="Type">{x.kind === "mural" ? "Mural" : `Repeat (${x.repeat})`}<div className="bo-sub">{x.widthCm ? (x.kind === "mural" ? `${(x.widthCm / 30.48).toFixed(1)} × ${(x.heightCm / 30.48).toFixed(1)} ft` : `${Math.round(x.widthCm)} cm repeat`) : "size not set"}</div></td>
      <td><Pill tone={r[1]}>{r[0]}</Pill>{x.reviewNote && x.review === "rejected" && <div className="bo-sub">{x.reviewNote}</div>}</td>
      <td className="num" data-l="Orders">{x.sales.orders}</td><td className="num" data-l="Sq ft">{x.sales.sqft}</td><td className="num" data-l="Sales">{money(x.sales.revenue)}</td><td className="num" data-l="Royalty">{money(x.sales.royalty)}</td>
      <td><button className="bo-btn sm">Open</button></td></tr>; })}
  </tbody></table>;
}

const OSTAT: Record<string, [string, any]> = { paid: ["Paid", "info"], waiting_on_designer: ["Waiting on you", "warn"], ready_to_print: ["Ready to print", "ok"], processing: ["In production", "info"], printing: ["Printing", "info"], shipped: ["Shipped", "ok"], delivered: ["Delivered", "ok"] };
function MyOrders({ d, openProject, limit }: { d: any; openProject: (id: string) => void; limit?: number }) {
  const rows = (d.orders ?? []).slice(0, limit ?? 1000);
  if (!rows.length) return <div className="bo-empty">No orders yet. When customers buy your designs or pay for your design work, they show here.</div>;
  return <table className="bo-tbl stack"><thead><tr><th>Date</th><th>Design</th><th className="num">Sq ft</th><th>Status</th><th className="num">You earn</th><th></th></tr></thead><tbody>
    {rows.map((o: any) => { const st = OSTAT[o.status] ?? [o.status]; return <tr key={o.id} className={o.projectId ? "click" : ""} onClick={() => o.projectId && openProject(o.projectId)}>
      <td data-l="Date">{fmtDate(o.at)}</td>
      <td>{o.design}<div className="bo-sub">{o.projectId ? "Your design work + printing" : "Print of your design"}{o.color ? ` · color ${o.color}` : ""} · {o.finish}</div></td>
      <td className="num" data-l="Sq ft">{Number(o.sqft).toFixed(1)}</td>
      <td><Pill tone={st[1]}>{st[0]}</Pill>{o.status === "waiting_on_designer" && o.dueAt && <div className="bo-sub">Due {fmtDate(o.dueAt)}</div>}</td>
      <td className="num" data-l="You earn">{money((o.royalty ?? 0) + (o.fee ?? 0))}<div className="bo-sub">{o.fee ? `design ${money(o.fee)}` : ""}{o.fee && o.royalty ? " + " : ""}{o.royalty ? `royalty ${money(o.royalty)}` : ""}</div></td>
      <td>{o.projectId && <button className="bo-btn sm">Open</button>}</td></tr>; })}
  </tbody></table>;
}

function Overview({ d, jobs, go, openProject }: { d: any; jobs: any; go: (t: string) => void; openProject: (id: string) => void }) {
  const t = d.totals; const ps = jobs.projects as any[];
  const needPrice = ps.filter((p) => p.status === "requested" && !p.lost);
  const toDeliver = ps.filter((p) => p.status === "in_progress").sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  const waiting = ps.filter((p) => ["quoted", "approved"].includes(p.status) && !p.lost);
  const Box = ({ label, n, sub, to, tone }: any) => <button className="bo-kpi" style={{ textAlign: "left", cursor: "pointer", borderColor: n && tone ? "var(--clay, #3b6d8c)" : undefined }} onClick={() => go(to)}><span>{label}</span><b>{n}</b>{sub && <div className="bo-sub" style={{ marginTop: 2 }}>{sub}</div>}</button>;
  const todo = [...toDeliver, ...needPrice];
  return <div>
    <div className="bo-kpis" style={{ marginBottom: 14 }}>
      <Box label="Requests needing your price" n={needPrice.length + jobs.open.length} sub={jobs.open.length ? `${jobs.open.length} open to all designers` : ""} to="requests" tone />
      <Box label="Jobs to deliver" n={toDeliver.length} sub={toDeliver[0] ? `Next due ${fmtDate(toDeliver[0].dueAt)}` : ""} to="requests" tone />
      <Box label="Waiting for customers" n={waiting.length} to="requests" />
      <Box label="Orders" n={(d.orders ?? []).length} to="orders" />
      <Box label="Live designs" n={t.live} sub={`${t.pending} in review · ${t.drafts} drafts`} to="designs" />
      <Box label="Available to take" n={money(t.owed)} sub={`Earned ${money(t.earned)}${t.jobsPending ? ` · ${money(t.jobsPending)} on the way` : ""}`} to="earnings" />
    </div>
    <div className="bo-card"><div className="bo-row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>To do</h2><button className="bo-btn sm" onClick={() => go("requests")}>All requests</button></div>
      {todo.length === 0 && jobs.open.length === 0 ? <div className="bo-sub" style={{ marginTop: 8 }}>Nothing to do right now. New requests show here and you get a notification.</div> :
        <table className="bo-tbl stack" style={{ marginTop: 8 }}><tbody>{todo.slice(0, 8).map((p) => <tr key={p.id} className="click" onClick={() => openProject(p.id)}><td>{p.title}<div className="bo-sub">{p.customer} · {p.kind === "edit" ? "Change request" : "Custom design"}</div></td><td><Pill tone={projectTone(p.status)}>{projectLabel(p.status)}</Pill></td><td data-l="Due">{p.status === "in_progress" ? `Due ${fmtDate(p.dueAt)}` : ""}</td><td><button className="bo-btn sm">{p.status === "requested" ? "Send price" : "Deliver"}</button></td></tr>)}
          {jobs.open.slice(0, 4).map((p: any) => <tr key={p.id} className="click" onClick={() => openProject(p.id)}><td>{p.title}<div className="bo-sub">{p.customer} · open custom request</div></td><td><Pill tone="info">Open to all designers</Pill></td><td></td><td><button className="bo-btn sm">Send price</button></td></tr>)}</tbody></table>}
    </div>
    <div className="bo-card"><div className="bo-row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Latest orders</h2><button className="bo-btn sm" onClick={() => go("orders")}>All orders</button></div><div style={{ marginTop: 8 }}><MyOrders d={d} openProject={openProject} limit={5} /></div></div>
  </div>;
}
