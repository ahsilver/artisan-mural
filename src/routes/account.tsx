import { useLiveDesigns } from "@/lib/shop";
import { trackingUrl } from "@/lib/tracking";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { designBySlug, money, materials } from "@/lib/catalog";
import { getMyAccount } from "@/lib/orders.functions";
import { MyRequests } from "@/components/projects";
import { Messenger, useUnreadMessages } from "@/components/messenger";
import { getMyDesignerProfile } from "@/lib/designer-profile.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, ImagePlus, MessageCircle, Package, BadgeDollarSign, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/switcher";
import { useProSettings } from "@/lib/pro";
import { useAccountExtras, StoreCredit, Addresses, TradeAccount } from "@/components/account-extras";
import { api } from "@/components/bo/common";
import { AccountRooms } from "@/components/my-rooms-picker";
import { cart } from "@/lib/cart";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My account — Artisan Mural" }, { name: "description", content: "Your wallpaper orders, delivery status and custom design requests." }, { property: "og:title", content: "My account — Artisan Mural" }, { property: "og:description", content: "Track your Artisan Mural orders and custom requests." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

type Data = Awaited<ReturnType<typeof getMyAccount>>;
const label = (s: string) => ({ awaiting_payment: "awaiting payment", paid: "paid", waiting_on_designer: "waiting on designer", ready_to_print: "ready to print", processing: "in production", printing: "printing", shipped: "shipped", delivered: "delivered", cancelled: "cancelled", refunded: "refunded" } as Record<string, string>)[s] ?? s.replace("_", " ");

function Account() {
  const proName = useProSettings().name;
  const qc = useQueryClient();
  useLiveDesigns(); // so uploaded designs show their names after a hard reload
  const getProfile = useServerFn(getMyDesignerProfile);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyDesignerProfile>> | null>(null);
  const { session, loading } = useSession();
  const load = useServerFn(getMyAccount);
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const extras = useAccountExtras();
  const [tab, setTab] = useState("orders");
  const [initC, setInitC] = useState<string | null>(null);
  useEffect(() => { const sp = new URLSearchParams(window.location.search); const t = sp.get("view") ?? sp.get("tab"); if (t) setTab(t); if (sp.get("c")) setInitC(sp.get("c")); }, []);
  const unread = useUnreadMessages(!!session);
  useEffect(() => { if (session) void getProfile().then(setProfile).catch(() => setProfile(null)); }, [session?.user.id]);
  useEffect(() => { if (session) void load().then(setData).catch(() => setData({ orders: [], requests: [] })); }, [session?.user.id, load]);
  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><h1 className="text-4xl">My account</h1><AuthPanel /></div>;
  return <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-5xl">My account</h1><p className="mt-2 text-sm text-muted-foreground">{session.user.email}</p></div><Button variant="outline" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/account", replace: true }); }}>Sign out</Button></div>
    {profile?.profile && <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-border py-6"><div><h2 className="flex items-center gap-2 text-2xl"><Layers className="size-5" />Seller portal</h2><p className="mt-1 text-sm text-muted-foreground">{profile.profile.status === "approved" ? "Your designs, sales and earnings." : "Your designer application is being reviewed. You can already upload designs."}</p></div><div className="flex flex-wrap gap-3"><Button asChild><a href="/dashboard">Open seller portal<ArrowRight /></a></Button></div></section>}
    {profile && !profile.isAdmin && !profile.profile && <Button asChild variant="outline" className="mt-8"><a href="/dashboard">Sell your designs</a></Button>}
    <Tabs value={tab} onValueChange={(v) => { setTab(v); if (typeof window !== "undefined") { const u = new URL(window.location.href); u.searchParams.set("view", v); u.searchParams.delete("tab"); if (v !== "messages") u.searchParams.delete("c"); window.history.replaceState(null, "", u.pathname + u.search); } }} className="mt-8">
    <div className="overflow-x-auto border-b border-border"><TabsList aria-label="My account" className="h-auto w-max justify-start gap-1 rounded-none bg-transparent p-0">
      <TabsTrigger value="orders" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"><Package className="size-4" />My orders</TabsTrigger>
      <TabsTrigger value="requests" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"><BadgeDollarSign className="size-4" />Requests & projects</TabsTrigger>
      <TabsTrigger value="messages" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"><MessageCircle className="size-4" />Messages{unread ? ` (${unread})` : ""}</TabsTrigger>
      <TabsTrigger value="rooms" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"><ImagePlus className="size-4" />My rooms</TabsTrigger>
      <TabsTrigger value="credit" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Store credit{extras.d?.credit ? ` (${money(extras.d.credit)})` : ""}</TabsTrigger>
      <TabsTrigger value="addresses" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Addresses</TabsTrigger>
      <TabsTrigger value="trade" className="min-h-12 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">{proName}</TabsTrigger>
    </TabsList></div>
    <TabsContent value="messages" className="pt-6"><h2 className="mb-3 text-2xl">Messages</h2><Messenger initialKey={initC} urlMode="search" emptyText="No messages yet. Chats with designers and with Artisan Mural show up here." /></TabsContent>
    <TabsContent value="orders" className="pt-6"><h2 className="text-2xl">My wallpaper orders</h2>
    {!data ? <Loader2 className="my-6 animate-spin" /> : data.orders.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No orders yet. <Link to="/browse" className="text-primary underline">Browse wallpaper</Link></p> :
      <div className="mt-4 space-y-3">{data.orders.map(o => <div key={o.id} className="soft-panel flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{designBySlug(o.design)?.title ?? o.design}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}{o.color ? ` · ${o.color}` : ""} · {o.sqft.toFixed(1)} sq ft · {materials.find(m => m.id === o.finish)?.name ?? o.finish}</p>{o.tracking && <p className="mt-1 text-xs"><a className="underline underline-offset-4" href={trackingUrl(o.carrier, o.tracking)!} target="_blank" rel="noreferrer">Track package: {o.carrier ?? ""} {o.tracking}</a></p>}</div><div className="text-right"><p className="font-semibold">{money(o.total)}</p><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] capitalize">{label(o.status)}</span><div className="mt-2"><Button size="sm" variant="outline" onClick={async () => { const r = await api(`account/reorder/${o.id}`, { body: {} }); for (const it of r.items) cart.add(it); navigate({ to: "/cart" }); }}>Order again</Button></div></div></div>)}</div>}
    </TabsContent>
    <TabsContent value="requests" className="pt-6"><MyRequests /></TabsContent>
    <TabsContent value="rooms" className="pt-6"><AccountRooms /></TabsContent>
    <TabsContent value="credit" className="pt-6"><StoreCredit d={extras.d} /></TabsContent>
    <TabsContent value="addresses" className="pt-6"><Addresses d={extras.d} reload={extras.reload} /></TabsContent>
    <TabsContent value="trade" className="pt-6"><TradeAccount d={extras.d} reload={extras.reload} /></TabsContent>
    </Tabs>
  </div>;
}
