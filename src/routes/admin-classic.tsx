import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Check, ImageIcon, Loader2, MessageCircle, Package, Palette, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { Inbox } from "@/components/inbox";
import { CollectionManager } from "@/components/collection-manager";
import { useSession } from "@/hooks/use-session";
import { addManualOrder, getAdminOverview, ORDER_STATUSES, recordPayout, reviewDesign, reviewDesigner, setDesignerTrusted, updateOrderStatus, saveMaterial, setOrderPayment } from "@/lib/admin.functions";
import { designBySlug, designerBySlug, designs as sampleDesigns, money } from "@/lib/catalog";
import { setDesignListing } from "@/lib/shop.functions";
import { DesignEditor } from "@/components/design-editor";
import { OrderDetail } from "@/components/order-detail";
import { shopQuery } from "@/lib/shop";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/admin-classic")({
  head: () => ({ meta: [{ title: "Owner portal — Artisan Mural" }, { name: "description", content: "Approve designers and designs, follow orders, read every conversation and manage designer payouts." }, { property: "og:title", content: "Owner portal — Artisan Mural" }, { property: "og:description", content: "Run Artisan Mural: designers, designs, orders, messages and payouts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Data = Awaited<ReturnType<typeof getAdminOverview>>;
const tabs = [
  { id: "designers", label: "Designers", icon: Palette },
  { id: "all", label: "All designs", icon: ImageIcon },
  { id: "designs", label: "Uploads to review", icon: ImageIcon },
  { id: "orders", label: "Orders", icon: Package },
  { id: "requests", label: "Custom requests", icon: ImageIcon },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "payouts", label: "Payouts", icon: BadgeDollarSign },
  { id: "materials", label: "Materials", icon: Palette },
  { id: "collections", label: "Collections", icon: ImageIcon },
  { id: "users", label: "Users", icon: Users },
] as const;
const badge = (s: string) => <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${s === "approved" || s === "shipped" || s === "delivered" ? "bg-primary/15 text-primary" : s === "rejected" || s === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{s.replace("_", " ")}</span>;

function Admin() {
  const { session, loading } = useSession();
  const overview = useServerFn(getAdminOverview);
  const designerReview = useServerFn(reviewDesigner);
  const designReview = useServerFn(reviewDesign);
  const orderStatus = useServerFn(updateOrderStatus);
  const pay = useServerFn(recordPayout);
  const trust = useServerFn(setDesignerTrusted);
  const addOrder = useServerFn(addManualOrder);
  const listing = useServerFn(setDesignListing);
  const materialSave = useServerFn(saveMaterial);
  const orderPay = useServerFn(setOrderPayment);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [designSearch, setDesignSearch] = useState("");
  const shop = useQuery(shopQuery);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "live" | "waiting" | "removed">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => { try { setData(await overview()); setError(""); } catch (e) { setError(plainError(e, "Could not load.")); } }, [overview]);
  useEffect(() => { if (session) void load(); }, [session?.user.id, load]);
  async function act(key: string, fn: () => Promise<unknown>) { setBusy(key); try { await fn(); await load(); void qc.invalidateQueries({ queryKey: shopQuery.queryKey }); } catch (e) { setError(plainError(e, "Something went wrong.")); } finally { setBusy(""); } }
  const reject = (key: string, fn: (note: string) => Promise<unknown>) => { const note = window.prompt("Reason (shown to the designer):") ?? null; if (note !== null) void act(key, () => fn(note)); };

  if (loading) return <Loader2 className="mx-auto my-20 animate-spin" />;
  if (!session) return <div className="mx-auto max-w-lg px-6 py-12"><h1 className="mb-6 text-4xl">Owner portal</h1><AuthPanel /></div>;
  if (error && !data) return <div className="mx-auto max-w-lg px-6 py-20 text-center"><h1 className="text-3xl">Owner portal</h1><p className="mt-4 text-sm text-muted-foreground">{error}</p></div>;
  if (!data) return <Loader2 className="mx-auto my-20 animate-spin" />;
  const pending = { designers: data.designers.filter(d => d.status === "pending").length, designs: data.designs.filter(d => d.review === "pending" && d.submittedAt).length };
  const owed = data.payouts.reduce((n, p) => n + Math.max(0, p.owed), 0);

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
    <p className="text-eyebrow text-clay">Artisan Mural</p><h1 className="mt-2 text-3xl sm:text-5xl">Owner portal</h1>
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[["Waiting for approval", `${pending.designers} designers · ${pending.designs} designs`], ["Orders", String(data.orders.length)], ["Conversations", String(data.conversationCount)], ["Owed to designers", money(owed)]].map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1.5 text-lg font-semibold sm:text-2xl">{v}</p></div>)}
    </div>
    <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-border">{tabs.map(t => <Button key={t.id} role="tab" aria-selected={tab === t.id} variant="ghost" onClick={() => setTab(t.id)} className={`shrink-0 rounded-none border-b-2 ${tab === t.id ? "border-primary" : "border-transparent"}`}><t.icon />{t.label}{t.id === "designers" && pending.designers > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{pending.designers}</span>}{t.id === "designs" && pending.designs > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{pending.designs}</span>}</Button>)}</div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <div className="pt-6">
      {tab === "designers" && (data.designers.length === 0 ? <p className="text-sm text-muted-foreground">No designer applications yet. Designers apply at /become-designer.</p> : <div className="space-y-3">{data.designers.map(d => <div key={d.userId} className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-medium">{d.name}{d.studio && <span className="text-muted-foreground"> · {d.studio}</span>}</p><p className="text-xs text-muted-foreground">{d.email} · {d.country} · applied {new Date(d.created_at).toLocaleDateString()}</p></div>{badge(d.status)}</div>
        <p className="mt-3 text-sm leading-relaxed">{d.bio}</p>
        {d.styles.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Styles: {d.styles.join(", ")}</p>}
        {d.portfolio.length > 0 && <p className="mt-1 flex flex-wrap gap-3 text-xs">{d.portfolio.map((p: string) => <a key={p} href={p} target="_blank" rel="noreferrer" className="text-primary underline">{p.replace(/^https?:\/\//, "").slice(0, 40)}</a>)}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Paid by {d.method}: <span className="text-foreground">{d.details}</span></p>
        {d.note && <p className="mt-2 text-xs">Note: {d.note}</p>}
        <div className="mt-4 flex gap-2">{d.status !== "approved" && <Button size="sm" disabled={!!busy} onClick={() => void act(d.userId, () => designerReview({ data: { id: d.userId, action: "approved", note: "" } }))}><Check />Approve</Button>}{d.status !== "rejected" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => reject(d.userId, note => designerReview({ data: { id: d.userId, action: "rejected", note } }))}><X />Reject</Button>}{d.status === "approved" && <Button size="sm" variant={d.trusted ? "secondary" : "outline"} disabled={!!busy} onClick={() => void act(d.userId, () => trust({ data: { id: d.userId, trusted: !d.trusted } }))}>{d.trusted ? "Trusted — uploads go live without approval (undo)" : "Trust: skip approval for new uploads"}</Button>}</div>
      </div>)}</div>)}

      {tab === "all" && (() => {
        const hidden = new Set(shop.data?.hidden ?? []);
        const rows = [
          ...[...sampleDesigns, ...(shop.data?.designs ?? [])].map(d => ({ key: d.slug, slug: d.slug as string | null, title: d.title, sku: d.sku ?? `AM-DEMO-${sampleDesigns.findIndex(x => x.slug === d.slug)+1}`, image: d.image as string | undefined, who: designerBySlug(d.designer)?.name ?? (shop.data?.designers.find(x => x.slug === d.designer)?.name ?? ""), kind: d.kind as string, state: hidden.has(d.slug) ? "removed" : "live" })),
          ...data.designs.filter(d => d.review !== "approved").map(d => ({ key: d.id, slug: null, title: d.title, sku: d.sku, image: d.images[0], who: d.ownerName ?? d.owner, kind: d.kind, state: !d.submittedAt ? "draft" : d.review === "rejected" ? "rejected" : "waiting" })),
        ];
        const shown = rows.filter(r => (filter === "all" || r.state === filter) && `${r.title} ${r.sku}`.toLowerCase().includes(designSearch.trim().toLowerCase()));
        return <div>
          <DesignEditor slug={editing} onClose={() => setEditing(null)} onSaved={() => void qc.invalidateQueries({ queryKey: shopQuery.queryKey })} />
          <input aria-label="Search designs by SKU or name" placeholder="Search by SKU or design name" value={designSearch} onChange={e => setDesignSearch(e.target.value)} className="mb-4 h-11 w-full rounded-md border border-input bg-background px-3 sm:max-w-md" />
          <div className="mb-4 flex flex-wrap gap-2">{(["all", "live", "waiting", "removed"] as const).map(f => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f} ({f === "all" ? rows.length : rows.filter(r => r.state === f).length})</Button>)}</div>
          {shop.isLoading && <Loader2 className="my-6 animate-spin" />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(r => <div key={r.key} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            {r.image ? <img src={r.image} alt={r.title} className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />}
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate font-medium">{r.title}</p>{badge(r.state)}</div><p className="text-xs text-muted-foreground">{r.sku}</p><p className="truncate text-xs text-muted-foreground">{r.who} · {r.kind}</p>
              <div className="mt-2 flex flex-wrap gap-2">{r.slug && r.state === "live" && <><Button asChild size="sm" variant="ghost"><Link to="/design/$slug" params={{ slug: r.slug }}>View</Link></Button><Button size="sm" variant="secondary" onClick={() => setEditing(r.slug)}>Edit</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => { if (window.confirm(`Remove "${r.title}" from the site?`)) void act(r.key, async () => { await listing({ data: { slug: r.slug ?? r.key, hidden: true } }); await qc.invalidateQueries({ queryKey: shopQuery.queryKey }); }); }}><X />Remove from site</Button></>}{r.slug && r.state === "removed" && <Button size="sm" disabled={!!busy} onClick={() => void act(r.key, async () => { await listing({ data: { slug: r.slug ?? r.key, hidden: false } }); await qc.invalidateQueries({ queryKey: shopQuery.queryKey }); })}><Check />Put back</Button>}{!r.slug && <Button size="sm" variant="ghost" onClick={() => setTab("designs")}>Review</Button>}</div>
            </div>
          </div>)}</div>
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
        </div>;
      })()}

      {tab === "designs" && (data.designs.length === 0 ? <p className="text-sm text-muted-foreground">No uploaded designs yet.</p> : <div className="grid gap-4 md:grid-cols-2">{data.designs.map(d => <div key={d.id} className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-4 gap-1 bg-muted p-1">{d.images.slice(0, 4).map((src, i) => <img key={i} src={src} alt={i === 0 ? `${d.title} artwork` : "Room photo"} className="aspect-square w-full rounded object-cover" />)}{d.images.length === 0 && <div className="col-span-4 py-10 text-center text-xs text-muted-foreground">No images</div>}</div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.ownerName ?? d.owner} · {d.kind} · {d.widthCm && d.heightCm ? `${(d.widthCm / 30.48).toFixed(1)} × ${(d.heightCm / 30.48).toFixed(1)} ft` : ""} · {d.colors.length} colour{d.colors.length === 1 ? "" : "s"}</p></div>{badge(d.submittedAt ? d.review : "draft")}</div>
          {d.story && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{d.story}</p>}
          <p className="mt-2 text-xs text-muted-foreground">SKU {d.sku}</p>{d.colorFiles.map((c, i) => c.url && <a key={i} href={c.url} target="_blank" rel="noreferrer" className="mt-2 mr-4 inline-block text-xs text-primary underline">{c.name} print file</a>)}
          {d.reviewNote && <p className="mt-2 text-xs">Note: {d.reviewNote}</p>}
          <div className="mt-4 flex gap-2">{d.review !== "approved" && <Button size="sm" disabled={!!busy || !d.submittedAt || d.status !== "ready"} onClick={() => void act(d.id, () => designReview({ data: { id: d.id, action: "approved", note: "" } }))}><Check />Approve</Button>}{d.review !== "rejected" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => reject(d.id, note => designReview({ data: { id: d.id, action: "rejected", note } }))}><X />Reject</Button>}</div>
        </div>
      </div>)}</div>)}

      {tab === "orders" && <div>
        <div className="mb-4 flex justify-end"><Button onClick={() => setShowAdd(v => !v)}>{showAdd ? "Close" : "Add outside order"}</Button></div>
        {showAdd && <form className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const g = (k: string) => String(f.get(k) ?? ""); void act("add", async () => { await addOrder({ data: { design: g("design"), customer: g("customer"), email: g("email"), phone: g("phone"), address: g("address"), sqft: Number(g("sqft")) || 0, total: Number(g("total")) || 0, deliveryDate: g("delivery"), notes: g("notes") } }); setShowAdd(false); }); }}>
          {[["design", "Design / description", "text", true], ["customer", "Customer name", "text", true], ["email", "Email", "email", false], ["phone", "Phone", "tel", false], ["address", "Delivery address", "text", true], ["sqft", "Square feet", "number", false], ["total", "Total (USD)", "number", false], ["delivery", "Delivery date", "date", false]].map(([n, l, t, r]) => <label key={n as string} className="text-xs text-muted-foreground">{l as string}<input name={n as string} type={t as string} required={r as boolean} step="any" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>)}
          <label className="text-xs text-muted-foreground sm:col-span-2">Notes<textarea name="notes" rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
          <Button type="submit" disabled={!!busy} className="sm:col-span-2">Save order</Button>
        </form>}
        {data.orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : <div className="space-y-2">{data.orders.map(o => <div key={o.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{designBySlug(o.design)?.title ?? o.design} · {o.sqft} sq ft · {money(o.total)} {o.source === "outside" && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">outside order</span>}</p><p className="mt-1 text-xs text-muted-foreground">{o.customer}{o.email && ` · ${o.email}`}{o.phone && ` · ${o.phone}`} · {new Date(o.created_at).toLocaleDateString()}{o.deliveryDate && ` · deliver by ${o.deliveryDate}`}</p><p className="mt-1 truncate text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()} · {o.address}</p></div><div className="flex items-center gap-2">{badge(o.status)}<Button size="sm" variant="outline" onClick={() => setOpenOrder(o.id)}>View order</Button></div></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{ORDER_STATUSES.map(st => <Button key={st} size="sm" variant={o.status === st ? "default" : "outline"} disabled={!!busy} onClick={() => { if (st === "shipped") { const carrier = window.prompt("Carrier (UPS, USPS, FedEx, DHL, Other):", o.carrier ?? "UPS"); if (carrier === null) return; const tracking = window.prompt("Tracking number:", o.tracking ?? "") ?? ""; const c = ["UPS", "USPS", "FedEx", "DHL"].find(x => x.toLowerCase() === carrier.trim().toLowerCase()) ?? "Other"; void act(o.id, () => orderStatus({ data: { id: o.id, status: st, carrier: c as "UPS", tracking } })); } else void act(o.id, () => orderStatus({ data: { id: o.id, status: st } })); }}>{st.replace("_", " ")}</Button>)}</div>
          {o.tracking && <p className="mt-2 text-xs">{o.carrier}: <a className="text-primary underline" target="_blank" rel="noreferrer" href={o.carrier === "UPS" ? `https://www.ups.com/track?tracknum=${encodeURIComponent(o.tracking)}` : o.carrier === "USPS" ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(o.tracking)}` : o.carrier === "FedEx" ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(o.tracking)}` : `https://www.google.com/search?q=${encodeURIComponent(o.tracking)}`}>{o.tracking}</a></p>}
        </div>)}</div>}
      </div>}

      {(() => { const o = data.orders.find(x => x.id === openOrder); return o ? <OrderDetail key={o.id} order={o} busy={!!busy} onClose={() => setOpenOrder(null)} onSavePayment={m => void act(o.id, () => orderPay({ data: { id: o.id, method: m } }))} /> : null; })()}
      {tab === "messages" && <Inbox />}
      {tab === "requests" && (data.requests.length === 0 ? <p className="text-sm text-muted-foreground">No custom requests yet.</p> : <div className="space-y-3">{data.requests.map(r => <div key={r.id} className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-medium">{r.room} · {r.size}</p><p className="text-xs text-muted-foreground">{r.name} · {r.email} · {new Date(r.created_at).toLocaleDateString()} · to {r.designer === "open" ? "all designers" : r.designer}{r.budget ? ` · budget ${r.budget}` : ""}</p></div>{badge(r.status)}</div>
        <p className="mt-3 whitespace-pre-line text-sm">{r.brief}</p>
        {r.photos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{r.photos.map((src, i) => <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Customer photo ${i + 1}`} className="h-24 w-24 rounded-md object-cover" /></a>)}</div>}
      </div>)}</div>)}

      {tab === "payouts" && <div>
        <p className="mb-4 text-sm text-muted-foreground">Pay designers yourself by PayPal, Wise or bank transfer using their details, then press “Mark as paid”.</p>
        {data.payouts.length === 0 ? <p className="text-sm text-muted-foreground">No designers yet.</p> : <div className="space-y-2">{data.payouts.map(p => <div key={p.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.method ? `${p.method}: ${p.details}` : "No payout details"}</p><p className="mt-1 text-xs text-muted-foreground">{p.sqft} sq ft royalties {money(p.royalties)} · custom jobs {money(p.jobs)} · paid {money(p.paid)}</p></div>
          <div className="flex items-center gap-3"><p className="text-lg font-semibold">{money(Math.max(0, p.owed))} <span className="text-xs font-normal text-muted-foreground">owed</span></p><Button size="sm" disabled={!!busy} onClick={() => { const v = window.prompt("Amount paid (USD):", Math.max(0, p.owed).toFixed(2)); const amount = Number(v); if (v && amount > 0) void act(p.userId, () => pay({ data: { userId: p.userId, amount, note: "" } })); }}>Mark as paid</Button></div>
        </div>)}</div>}
        {data.payoutHistory.length > 0 && <><h3 className="mt-8 text-lg">Payout history</h3><div className="mt-3 space-y-1 text-sm">{data.payoutHistory.map(h => <p key={h.id} className="flex justify-between border-b border-border py-2"><span>{data.payouts.find(p => p.userId === h.userId)?.name ?? "Designer"}</span><span>{money(h.amount)} · {new Date(h.paid_at).toLocaleDateString()}</span></p>)}</div></>}
      </div>}

      {tab === "collections" && <CollectionManager />}
      {tab === "materials" && <div className="space-y-6"><MaterialEditor busy={!!busy} onSave={m => void act("material", () => materialSave({ data: m }))} />{data.materials.map(m => <MaterialEditor key={`${m.id}-${m.name}-${m.factor}-${m.active}-${m.texture}`} material={m} busy={!!busy} onSave={value => void act(m.id, () => materialSave({ data: value }))} />)}</div>}
      {tab === "users" && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Joined</th><th className="py-3 pr-4">Last sign-in</th><th className="py-3">Designer</th></tr></thead><tbody>{data.users.map(u => <tr key={u.id} className="border-b border-border"><td className="py-3 pr-4">{u.email}</td><td className="py-3 pr-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td><td className="py-3 pr-4 text-muted-foreground">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : "—"}</td><td className="py-3">{u.designer ? badge(u.designer) : "—"}</td></tr>)}</tbody></table></div>}
    </div>
    <p className="mt-10 text-xs text-muted-foreground"><Link to="/studio" className="underline">Designer studio</Link> · Card payments are not connected yet, so orders stay “awaiting payment”.</p>
  </div>;
}

type MaterialValue = { id: string; name: string; blurb: string; factor: number; texture?: string | undefined; active: boolean };
function MaterialEditor({ material, busy, onSave }: { material?: MaterialValue; busy: boolean; onSave: (value: MaterialValue & { texture: string }) => void }) {
 const [name, setName] = useState(material?.name ?? ""); const [blurb, setBlurb] = useState(material?.blurb ?? ""); const [price, setPrice] = useState(String((material?.factor ?? 1) * 4.5)); const [texture, setTexture] = useState(material?.texture ?? "");
 const value = { id: material?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, blurb, factor: Number(price)/4.5, texture, active: material?.active ?? true };
 return <form className="border-b border-border pb-6" onSubmit={e => { e.preventDefault(); onSave(value); }}><h2 className="mb-4 text-xl">{material ? `${material.name}${material.active ? "" : " · removed"}` : "Add material"}</h2><div className="grid gap-3 sm:grid-cols-2">{[["Material name", name, setName, "text"], ["Price per sq ft ($)", price, setPrice, "number"], ["Description", blurb, setBlurb, "text"], ["Texture photo URL", texture, setTexture, "url"]].map(([label, v, set, type]) => <label key={String(label)} className="text-sm">{String(label)}<input required={label !== "Texture photo URL" && label !== "Description"} type={String(type)} step="0.01" min="0.01" value={String(v)} onChange={e => (set as (v: string) => void)(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3" /></label>)}</div><div className="mt-3 flex gap-2"><Button type="submit" disabled={busy}>{material ? "Save changes" : "Add material"}</Button>{material && <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!material.active || window.confirm(`Remove ${material.name} from new orders?`)) onSave({ ...value, active: !material.active }); }}>{material.active ? "Remove material" : "Put back"}</Button>}</div></form>;
}
