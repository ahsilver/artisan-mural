import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { api } from "@/components/bo/common";
import { Orders } from "@/components/bo/orders";
import { PrintQueue } from "@/components/bo/ready-print";
import { ProProgram, EmailSignups } from "@/components/bo/pro";
import { AdminReviews, AdminProfiles } from "@/components/bo/community";
import { Overview, Designs, Designers, Payouts, Coupons, Requests, Emails } from "@/components/bo/sections";
import { Settings, PricesMaterials } from "@/components/bo/settings";
import { CustomersCRM, Invoices, Estimates } from "@/components/bo/billing";
import { DesignJobs, CollectionsEditor } from "@/components/bo/projects";
import { HomepageEditor, MenuPicturesEditor } from "@/components/bo/storefront-editor";
import { Messenger, useUnreadMessages } from "@/components/messenger";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Back office — Artisan Murals" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

/** The approved preview's back office: account-style page, grouped sections on the left (Sales · Designs · Designers · Store),
 *  every existing owner tool on the right, plus the new storefront editors. */
const GROUPS: [string, [string, string][]][] = [
  ["Sales", [["overview", "Overview"], ["orders", "Orders"], ["print", "Print files"], ["invoices", "Invoices"], ["estimates", "Estimates"], ["customers", "Customers"], ["coupons", "Discount codes"]]],
  ["Designs", [["designs", "Designs"], ["collections", "Collections"], ["jobs", "Design requests"], ["reviews", "Reviews"]]],
  ["Designers", [["designers", "Designers"], ["profiles", "Designer pages"], ["payouts", "Payouts"]]],
  ["Store", [["homepage", "Homepage & banners"], ["menu", "Menu pictures"], ["prices", "Prices & materials"], ["pro", "Artisan Pro"], ["messages", "Messages"], ["signups", "Email signups"], ["emails", "Emails"], ["settings", "Settings"], ["requests", "Old custom requests"]]],
];

function OwnerLogin() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="signin" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); const { error } = await supabase.auth.signInWithPassword({ email: "owner", password: pw }); setBusy(false); if (error) setErr("Wrong password."); }}>
    <span className="k">Owner</span><h1>Back office</h1><p>Sign in with the owner password, or with the owner's email below.</p>
    <label className="rqf"><span>Owner password</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
    <button className="btn btn-wine big" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
    {err && <p className="rq-ok err" role="alert">{err}</p>}
  </form>;
}

function AdminMessages() {
  const h = typeof window !== "undefined" ? window.location.hash : "";
  const k = h.startsWith("#messages:") ? decodeURIComponent(h.slice(10)) : null;
  return <div><div className="bo-top"><h1>Messages</h1><span className="bo-sub">Chat with any customer or designer as the store, and read every designer chat.</span></div><Messenger admin initialKey={k} urlMode="hash" emptyText="No conversations yet." /></div>;
}

function AdminPage() {
  const { session, loading } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sec, setSec] = useState("overview");
  useEffect(() => { const h = window.location.hash.slice(1).split(":")[0]; if (h) setSec(h); const on = () => { const x = window.location.hash.slice(1).split(":")[0]; if (x) setSec(x); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { if (typeof window !== "undefined" && window.location.hash.slice(1).split(":")[0] !== sec) window.history.replaceState(null, "", "#" + sec); }, [sec]);
  const unreadMsgs = useUnreadMessages(!!isAdmin);
  const [badges, setBadges] = useState<Record<string, number>>({});
  useEffect(() => { if (!isAdmin) return; let on = true; const go = () => api("admin/badges").then((r: any) => on && setBadges(r || {})).catch(() => {}); go(); const t = setInterval(go, 60000); return () => { on = false; clearInterval(t); }; }, [isAdmin]);
  useEffect(() => { if (!session) { setIsAdmin(null); return; } api("admin/overview").then(() => setIsAdmin(true)).catch(() => setIsAdmin(false)); }, [session]);
  const go = (k: string) => { setSec(k); if (typeof innerWidth !== "undefined" && innerWidth < 860) document.getElementById("boMain")?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  const shell = (children: React.ReactNode) => <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><b>Back office</b></nav></div><section className="pg auth-page">{children}</section></div>;
  if (loading || (session && isAdmin === null)) return shell(<p className="hint">Loading…</p>);
  if (!session) return shell(<div className="bo-login"><OwnerLogin /><AuthPanel kicker="" title="" sub="" /></div>);
  if (!isAdmin) return shell(<div className="sa-done"><b>This page is for the owner.</b><p>You are signed in as {session.user?.email}.</p><button type="button" className="btn optline btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button></div>);

  const body = { overview: <Overview go={go} />, orders: <Orders />, print: <PrintQueue />, messages: <AdminMessages />, jobs: <DesignJobs />, collections: <CollectionsEditor admin />, designs: <Designs />, designers: <Designers />, profiles: <AdminProfiles />, reviews: <AdminReviews />, payouts: <Payouts />, customers: <CustomersCRM />, pro: <ProProgram />, signups: <EmailSignups />, invoices: <Invoices />, estimates: <Estimates />, coupons: <Coupons />, requests: <Requests />, homepage: <HomepageEditor />, menu: <MenuPicturesEditor />, prices: <PricesMaterials />, settings: <Settings />, emails: <Emails /> }[sec] ?? <Overview go={go} />;
  const count = (k: string) => (k === "messages" ? unreadMsgs : badges[k]) || 0;
  return (
    <div className="am" id="view-admin">
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><b>Back office</b></nav></div>
      <section className="pg acc">
        <div className="pg-head acc-head"><div><span className="k">Owner · back office</span><h1>Everything in one place.</h1><p>Orders and print files, every design and its original file, designers, the homepage, menu and prices.</p></div>
          <div className="up-row"><a className="btn optline btn-sm" href="/" target="_blank" rel="noreferrer">View site ↗</a><a className="btn optline btn-sm" href="/admin-classic">Classic tools</a><button type="button" className="btn optline btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>
        <div className="acc-grid">
          <nav className="acc-nav bo-nav2" aria-label="Back office sections">
            {GROUPS.map(([g, items]) => <div key={g} className="bo-grp"><span className="bo-g">{g}</span>{items.map(([k, n]) => <button key={k} type="button" aria-current={k === sec} onClick={() => go(k)}>{n}{count(k) ? <em>{count(k)}</em> : null}</button>)}</div>)}
          </nav>
          <div className="acc-main" id="boMain"><div className="bo bo-skin">{body}</div></div>
        </div>
      </section>
    </div>
  );
}
