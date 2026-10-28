import { createFileRoute, Link } from "@tanstack/react-router";
import { DesignerNav } from "@/components/designer-nav";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BadgeDollarSign, BarChart3, ImagePlus, Loader2, Layers, LogOut, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { Inbox } from "@/components/inbox";
import { CollectionManager } from "@/components/collection-manager";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { designerBySlug } from "@/lib/catalog";
import { getDesignerStats, listAllOffers } from "@/lib/studio.functions";
import { getMyDesignerProfile, savePayoutDetails } from "@/lib/designer-profile.functions";
import { CustomProjectBoard } from "@/components/custom-project-board";
import { DesignerDesigns } from "@/components/designer-designs";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/switcher";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "Designer studio — Artisan Mural" }, { name: "description", content: "Upload designs, track square feet ordered, send price offers and chat with customers and the Artisan Mural studio." }, { property: "og:title", content: "Designer studio — Artisan Mural" }, { property: "og:description", content: "Your designs, orders, offers and messages in one place." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Studio,
});

type Stats = Awaited<ReturnType<typeof getDesignerStats>>;
type Offers = Awaited<ReturnType<typeof listAllOffers>>;
const tabs = [{ id: "designs", label: "Your designs", icon: ImagePlus }, { id:"requests",label:"Requests & projects",icon:BadgeDollarSign}, { id: "messages", label: "Messages", icon: MessageCircle }, { id: "overview", label: "Orders", icon: BarChart3 }, { id: "collections", label: "Collections", icon: Layers }, { id: "offers", label: "Offers", icon: BadgeDollarSign }] as const;

function Studio() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const stats = useServerFn(getDesignerStats);
  const offersFn = useServerFn(listAllOffers);
  const [tab, setTab] = useState<string>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view")) || "overview");
  const [data, setData] = useState<Stats | null>(null);
  const [offers, setOffers] = useState<Offers>([]);
  const profileFn = useServerFn(getMyDesignerProfile);
  const [mine, setMine] = useState<Awaited<ReturnType<typeof getMyDesignerProfile>> | null>(null);
  useEffect(() => { if (!session) return; void stats().then(setData).catch(() => setData(null)); void offersFn().then(setOffers).catch(() => setOffers([])); void profileFn().then(setMine).catch(() => setMine(null)); }, [session?.user.id]);
  if (loading) return <p className="px-8 py-20 text-sm text-muted-foreground">Loading your studio…</p>;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><h1 className="mb-6 text-4xl">Designer studio</h1><AuthPanel /></div>;
  const rows = data?.rows ?? [];
  const totalSqft = rows.reduce((n, r) => n + r.sqft, 0);
  const who = data?.isAdmin ? "Artisan Mural studio" : data?.designerSlug ? designerBySlug(data.designerSlug)?.name : null;
  return <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><DesignerNav /><p className="text-eyebrow mt-6 text-clay">{who ?? "Designer studio"}</p><h1 className="mt-1 text-3xl sm:text-4xl">{tab === "designs" ? "My designs" : "Your studio"}</h1></div>
      <div className="flex flex-wrap gap-2"><Button asChild><Link to="/designer-upload"><ImagePlus />Upload a design</Link></Button><Button variant="outline" onClick={() => setTab("collections")}><Layers />Build a collection</Button><Button variant="ghost" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: "/designer-login", replace: true }); }}><LogOut />Sign out</Button></div>
    </div>
    {data?.isAdmin && <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">You're the owner. <Link to="/admin" className="font-medium text-primary underline">Open the owner portal</Link> to approve designers and designs, see orders and pay designers.</p>}
    {mine && !mine.isAdmin && !mine.profile && <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">New here? <Link to="/become-designer" className="font-medium text-primary underline">Apply as a designer</Link> — tell us about you and your work. Once Artisan Mural approves you, you can upload designs.</p>}
    {mine?.profile?.status === "pending" && <p className="mt-6 text-sm text-muted-foreground">Your designer application is waiting for approval.</p>}
    {mine?.hasApprovedDesign && mine.profile && !mine.profile.payout_details && <PayoutPanel onSaved={() => void profileFn().then(setMine).catch(() => {})} />}
    <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
      <div className="border-l-2 border-primary pl-4"><p className="text-xs text-muted-foreground">Square feet printed</p><p className="mt-2 text-3xl">{rows.reduce((n, r) => n + r.printedSqft, 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{totalSqft.toLocaleString()} sq ft ordered</p></div>
      <div className="border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">Orders</p><p className="mt-2 text-3xl">{rows.reduce((n, r) => n + r.orders, 0)}</p></div>
      <div className="border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">Open offers</p><p className="mt-2 text-3xl">{offers.filter(o => o.status === "sent" || o.status === "accepted").length}</p></div>
    </div>
    <Tabs value={tab} onValueChange={(v) => { setTab(v); if (typeof window !== "undefined") window.history.replaceState(null, "", v === "designs" ? "/studio?view=designs" : `/studio?view=${v}`); }} className="mt-6">
    <div className="overflow-x-auto border-b border-border"><TabsList aria-label="Designer workspace" className="h-auto w-max justify-start gap-1 rounded-none bg-transparent p-0">{tabs.map(t => <TabsTrigger key={t.id} value={t.id} className="min-h-9 gap-2 rounded-none text-sm border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:shadow-none"><t.icon className="size-4" />{t.label}</TabsTrigger>)}</TabsList></div>
    <TabsContent value={tab} className="pt-6">
      {tab === "requests" && <CustomProjectBoard />}
      {tab === "designs" && <DesignerDesigns stats={rows} />}
      {tab === "overview" && (rows.length === 0 ? <p className="text-sm text-muted-foreground">No designs in the shop yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-3 pr-4">Design</th><th className="py-3 pr-4 text-right">Orders</th><th className="py-3 pr-4 text-right">Sq ft ordered</th><th className="py-3 text-right">Last order</th></tr></thead><tbody>{rows.map(r => <tr key={r.slug} className="border-b border-border"><td className="py-3 pr-4"><Link to="/design/$slug" params={{ slug: r.slug }} className="flex items-center gap-3"><img src={r.image} alt="" className="h-12 w-16 rounded object-cover" />{r.title}</Link></td><td className="py-3 pr-4 text-right">{r.orders}</td><td className="py-3 pr-4 text-right font-medium">{r.sqft.toLocaleString()}</td><td className="py-3 text-right text-muted-foreground">{r.lastOrder ? new Date(r.lastOrder).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>)}
      {tab === "messages" && <Inbox />}
      {tab === "collections" && <CollectionManager />}
      {tab === "offers" && (offers.length === 0 ? <p className="text-sm text-muted-foreground">No price offers yet. Send one from inside a conversation.</p> : <div className="space-y-2">{offers.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div><p className="font-medium">${o.amount.toFixed(2)} · {o.deliveryDays ?? "—"} days · {o.description}</p><p className="mt-1 text-xs text-muted-foreground">{designerBySlug(o.designer)?.name} · {new Date(o.created_at).toLocaleDateString()} · Designer ${o.designerPayout.toFixed(2)} · Commission ${o.commission.toFixed(2)}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{o.status === "sent" ? "Waiting for customer" : o.status === "accepted" ? o.proofStatus === "approved" ? "Design approved · awaiting payment" : "Accepted · design in progress" : o.status}</span></div>)}</div>)}
    </TabsContent>
    </Tabs>
  </div>;
}

/** Shown once a design is approved and payout details are still missing. */
function PayoutPanel({ onSaved }: { onSaved: () => void }) {
  const save = useServerFn(savePayoutDetails);
  const [method, setMethod] = useState<"paypal" | "bank" | "wise">("paypal");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try { await save({ data: { payoutMethod: method, payoutDetails: details } }); onSaved(); }
    catch (e) { setError(plainError(e, "Could not save your payout details.")); } finally { setBusy(false); }
  }
  return <div className="mt-6 rounded-xl border border-primary/40 bg-card p-5">
    <p className="flex items-center gap-2 text-lg font-medium"><Wallet className="h-5 w-5 text-primary" />A design of yours was approved — how should we pay you?</p>
    <p className="mt-1 text-sm text-muted-foreground">You earn per square foot on every order, plus 90% of custom design jobs. Payouts are sent monthly. Only the Artisan Mural owner can see these details.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">{([["paypal", "PayPal"], ["wise", "Wise"], ["bank", "Bank transfer"]] as const).map(([id, label]) => <Button key={id} type="button" variant={method === id ? "default" : "outline"} className="h-12" onClick={() => setMethod(id)}>{label}</Button>)}</div>
    <label className="mt-4 block text-sm">{method === "bank" ? "Bank name, account holder, IBAN / account number and SWIFT" : `Your ${method === "paypal" ? "PayPal" : "Wise"} email`}<textarea maxLength={800} value={details} onChange={e => setDetails(e.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3 text-base sm:text-sm" /></label>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    <Button className="mt-4 h-12" disabled={details.trim().length < 4 || busy} onClick={() => void submit()}>{busy && <Loader2 className="animate-spin" />}Save payout details</Button>
  </div>;
}
