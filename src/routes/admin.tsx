import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { api } from "@/components/bo/common";
import { Orders } from "@/components/bo/orders";
import { ProProgram, EmailSignups } from "@/components/bo/pro";
import { AdminReviews, AdminProfiles } from "@/components/bo/community";
import { Overview, Designs, Designers, Payouts, Coupons, Requests, Emails } from "@/components/bo/sections";
import { Settings, Homepage } from "@/components/bo/settings";
import { CustomersCRM, Invoices, Estimates } from "@/components/bo/billing";
import { DesignJobs, CollectionsEditor } from "@/components/bo/projects";
import { Messenger, useUnreadMessages } from "@/components/messenger";
import { NotificationBell } from "@/components/projects";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Back office — Artisan Mural" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const NAV: [string, string][] = [["overview", "Overview"], ["orders", "Orders"], ["invoices", "Invoices"], ["estimates", "Estimates"], ["customers", "Customers"], ["pro", "Artisan Pro"], ["messages", "Messages"], ["jobs", "Design requests"], ["designs", "Designs"], ["collections", "Collections"], ["designers", "Designers"], ["profiles", "Designer profiles"], ["reviews", "Reviews"], ["payouts", "Payouts"], ["coupons", "Discount codes"], ["signups", "Email signups"], ["requests", "Old custom requests"]];
const NAV2: [string, string][] = [["homepage", "Homepage"], ["settings", "Settings"], ["emails", "Emails"]];

function OwnerLogin() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="bo-card" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); const { error } = await supabase.auth.signInWithPassword({ email: "owner", password: pw }); setBusy(false); if (error) setErr("Wrong password."); }}>
    <h2>Owner sign-in</h2><div className="bo-row" style={{ flexWrap: "nowrap" }}><input className="bo-in" type="password" placeholder="Owner password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Owner password" /><button className="bo-btn pri" disabled={busy || !pw}>Sign in</button></div>{err && <div className="bo-msg bad" style={{ marginTop: 8 }}>{err}</div>}
  </form>;
}

function AdminMessages() {
  const h = typeof window !== "undefined" ? window.location.hash : "";
  const k = h.startsWith("#messages:") ? decodeURIComponent(h.slice(10)) : null;
  return <div><div className="bo-top"><h1>Messages</h1><span className="bo-sub">Chat with any customer or designer as the store, and read every designer chat.</span></div><Messenger admin initialKey={k} urlMode="hash" emptyText="No conversations yet. Tap New to write to a customer or designer." /></div>;
}

function AdminPage() {
  const { session, loading } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sec, setSec] = useState(() => (typeof window !== "undefined" && window.location.hash.slice(1).split(":")[0]) || "overview");
  useEffect(() => { const h = window.location.hash.slice(1).split(":")[0]; if (h) setSec(h); const on = () => { const x = window.location.hash.slice(1).split(":")[0]; if (x) setSec(x); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { if (typeof window !== "undefined" && window.location.hash.slice(1).split(":")[0] !== sec) window.history.replaceState(null, "", "#" + sec); }, [sec]);
  const unreadMsgs = useUnreadMessages(!!isAdmin);
  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    api("admin/overview").then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
  }, [session]);
  if (loading || (session && isAdmin === null)) return <div className="bo"><div className="bo-main bo-sub">Loading…</div></div>;
  if (!session) return <div className="bo" style={{ display: "grid", placeItems: "center" }}><div style={{ width: "min(420px, 94vw)" }}><OwnerLogin /><div className="bo-card"><div className="bo-sub" style={{ marginBottom: 8 }}>Or sign in with email</div><AuthPanel /></div></div></div>;
  if (!isAdmin) return <div className="bo" style={{ display: "grid", placeItems: "center" }}><div className="bo-card" style={{ width: "min(420px, 94vw)" }}><h2>This page is for the owner.</h2><p className="bo-sub">You are signed in as {session.user?.email}.</p><button className="bo-btn" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>;
  const body = { overview: <Overview go={setSec} />, orders: <Orders />, messages: <AdminMessages />, jobs: <DesignJobs />, collections: <CollectionsEditor admin />, designs: <Designs />, designers: <Designers />, profiles: <AdminProfiles />, reviews: <AdminReviews />, payouts: <Payouts />, customers: <CustomersCRM />, pro: <ProProgram />, signups: <EmailSignups />, invoices: <Invoices />, estimates: <Estimates />, coupons: <Coupons />, requests: <Requests />, homepage: <Homepage />, settings: <Settings />, emails: <Emails /> }[sec] ?? <Overview go={setSec} />;
  return <div className="bo">
    <div className="bo-mtop"><b className="bo-brand" style={{ fontSize: 19, padding: 0 }}>Artisan Mural<span className="bo-dot">.</span></b><select className="bo-sel" value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Section">{[...NAV, ...NAV2].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><NotificationBell /><a className="bo-btn sm" href="/">Site</a></div>
    <div className="bo-shell">
      <aside className="bo-side"><div className="bo-brand" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}><span>Artisan Mural<span className="bo-dot">.</span><small>Back office</small></span><NotificationBell /></div>
        <nav className="bo-nav">{NAV.map(([k, l]) => <button key={k} className={sec === k ? "on" : ""} onClick={() => setSec(k)}>{l}{k === "messages" && unreadMsgs ? <span className="cnt">{unreadMsgs}</span> : null}</button>)}
          <div className="grp">Site</div>{NAV2.map(([k, l]) => <button key={k} className={sec === k ? "on" : ""} onClick={() => setSec(k)}>{l}</button>)}
          <div className="grp">More</div><a href="/admin-classic">Classic studio tools</a><a href="/">View site</a><button onClick={() => supabase.auth.signOut()}>Sign out</button></nav>
        <div className="bo-sub" style={{ padding: "16px 10px 0" }}>{session.user?.email}</div></aside>
      <main className="bo-main">{body}</main>
    </div>
  </div>;
}
