import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeDollarSign, BarChart3, ImagePlus, MessageCircle, Palette, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { designs } from "@/lib/catalog";
import { DemoMessenger } from "@/components/demo-messenger";

export const Route = createFileRoute("/studio-demo")({
  head: () => ({ meta: [{ title: "Designer studio preview — Artisan Mural" }, { name: "description", content: "A preview of the designer studio: orders, messages, price offers and design uploads." }, { property: "og:title", content: "Designer studio preview — Artisan Mural" }, { property: "og:description", content: "Preview designer collections, messages, offers and uploads with sample data." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" }] }),
  component: StudioDemo,
});

const tabs = [{ id: "collection", label: "Your collection", icon: Palette }, { id: "messages", label: "Messages", icon: MessageCircle }, { id: "offers", label: "Offers", icon: BadgeDollarSign }, { id: "upload", label: "Add a design", icon: ImagePlus }] as const;

const demoRows = [
  { slug: "cranes-at-dusk", title: "Cranes at Dusk", kind: "Landscape · Mural", rooms: 128, perSqft: 2.9 },
  { slug: "deco-arches", title: "Deco Arches", kind: "Geometric · Repeat", rooms: 75, perSqft: 3.1 },
  { slug: "soft-rain", title: "Soft Rain", kind: "Minimal · Repeat", rooms: 41, perSqft: 2.7 },
];

const demoOffers = [
  { amount: 320, description: "Adapt Cranes at Dusk to a 14 × 9 ft wall", status: "Waiting for customer", payout: 288, commission: 32 },
  { amount: 540, description: "Custom mural for a bedroom wall, 12 × 8 ft", status: "Accepted · awaiting payment", payout: 486, commission: 54 },
];

const earnings = 9913.9;
const topDesign = demoRows[0]!;

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="relative rounded-xl border border-border bg-card p-6">
    <span className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><ArrowUpRight className="h-4 w-4" /></span>
    <p className="text-eyebrow text-muted-foreground">{label}</p>
    <p className="mt-3 font-display text-4xl">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
  </div>;
}

function StudioDemo() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("collection");
  const totalRooms = demoRows.reduce((n, r) => n + r.rooms, 0);
  const topArt = designs.find(a => a.slug === topDesign.slug);

  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
    <p className="mb-8 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">Demo preview with sample numbers — the real studio needs a designer sign-in. Nothing here is saved.</p>

    {/* Greeting */}
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-eyebrow text-clay">Your Artisan Mural studio</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.05] sm:text-6xl">Good morning,<br /><em className="text-clay">Mara.</em></h1>
        <p className="mt-4 text-sm text-muted-foreground">Here's what your work is making possible.</p>
      </div>
      <p className="text-eyebrow text-muted-foreground">Your independent studio</p>
    </div>

    {/* Stat cards */}
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Design sales" value="3" sub="all time" />
      <StatCard label="Your earnings" value={`$${earnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="90% design royalties" />
      <StatCard label="Next payout" value={`$${earnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="pending transfer" />
      <StatCard label="Listed designs" value={String(demoRows.length)} sub="in the collection" />
    </div>

    {/* Collection + side panels */}
    <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-eyebrow text-clay">Your collection</p><h2 className="mt-2 font-display text-3xl">The work, out in the world.</h2></div>
          <Button onClick={() => setTab("upload")}><Plus />Add a design</Button>
        </div>
        <div role="tablist" className="mt-6 flex flex-wrap gap-1 border-b border-border">{tabs.map(t => <Button key={t.id} role="tab" aria-selected={tab === t.id} variant="ghost" onClick={() => setTab(t.id)} className={`rounded-none border-b-2 ${tab === t.id ? "border-primary" : "border-transparent"}`}><t.icon />{t.label}</Button>)}</div>

        <div className="pt-4">
          {tab === "collection" && <div className="divide-y divide-border">
            {demoRows.map(r => { const art = designs.find(a => a.slug === r.slug); return <div key={r.slug} className="flex items-center gap-4 py-4">
              {art && <img src={art.image} alt="" className="h-14 w-14 rounded-md object-cover" />}
              <div className="min-w-0 flex-1"><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.kind}</p></div>
              <div className="text-right"><p className="text-sm font-medium">{r.rooms}</p><p className="text-xs text-muted-foreground">rooms</p></div>
              <div className="w-20 text-right"><p className="text-sm font-medium">${r.perSqft.toFixed(2)}</p><p className="text-xs text-muted-foreground">per sq ft</p></div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>; })}
          </div>}
          {tab === "messages" && <div className="pt-2"><DemoMessenger /></div>}
          {tab === "offers" && <div className="space-y-2 pt-2">{demoOffers.map((o, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div><p className="font-medium">${o.amount.toFixed(2)} · {o.description}</p><p className="mt-1 text-xs text-muted-foreground">Designer gets ${o.payout.toFixed(2)} · Studio commission ${o.commission.toFixed(2)}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{o.status}</span></div>)}<p className="pt-2 text-xs text-muted-foreground">When the customer accepts, they get a pay link right inside the chat. The studio sees every offer.</p></div>}
          {tab === "upload" && <div className="space-y-6 pt-2">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]"><label className="text-sm">Design name<input placeholder="Name your design" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /></label><label className="text-sm">Artwork type<select className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3"><option>Mural (one scene, cropped)</option><option>Repeats side to side only</option><option>Repeats top to bottom only</option><option>Repeats side to side and top to bottom</option></select></label></div>
            <div className="grid grid-cols-2 gap-4"><label className="text-sm">Artwork width (ft)<input type="number" placeholder="15" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /></label><label className="text-sm">Artwork height (ft)<input type="number" placeholder="10" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /></label></div>
            <div className="grid grid-cols-2 gap-4"><label className="text-sm">Biggest width we can print (ft)<input type="number" placeholder="Optional" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /></label><label className="text-sm">Biggest height we can print (ft)<input type="number" placeholder="Optional" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /></label></div>
            <label className="block text-sm">Full-resolution print file link<input placeholder="https://drive.google.com/… or Dropbox / WeTransfer link" className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3" /><span className="mt-1 block text-xs text-muted-foreground">Heavy print files (TIFF, PSD, PDF) go to Google Drive, Dropbox or WeTransfer — only the studio sees this link.</span></label>
            <div><h3 className="font-display text-2xl">Website pictures & colorways</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{["Original", "Color version 2"].map(n => <div key={n} className="rounded-lg border border-border p-4"><input aria-label={`${n} name`} placeholder={n} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /><span className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-5 text-sm"><Upload className="h-4 w-4" />Choose artwork</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Up to 5 color versions. Three installed-room photos are created automatically for each color.</p></div>
            <Button className="h-12" disabled><ImagePlus />Upload & create room photos</Button>
            <p className="text-xs text-muted-foreground">The real upload form is at <Link to="/designer-upload" className="underline">Upload your design</Link> and needs a designer sign-in.</p>
          </div>}
        </div>
      </div>

      {/* Side panels */}
      <div className="space-y-4 lg:pt-24">
        <div className="rounded-xl bg-primary p-7 text-primary-foreground">
          <p className="text-eyebrow opacity-80">This is yours</p>
          <p className="mt-4 font-display text-5xl">${earnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="mt-3 max-w-[24ch] text-sm opacity-90">Every design royalty. Every sale. It all belongs to you.</p>
          <div className="mt-6 flex justify-end"><span className="flex h-20 w-20 flex-col items-center justify-center rounded-full border border-primary-foreground/40 text-center"><span className="font-display text-xl">90%</span><span className="text-[9px] uppercase tracking-widest opacity-80">artist royalties</span></span></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-eyebrow text-clay">Your top design</p>
          <div className="mt-4 flex items-center gap-4">
            {topArt && <img src={topArt.image} alt="" className="h-16 w-16 rounded-md object-cover" />}
            <div><p className="font-medium">{topDesign.title}</p><p className="text-xs text-muted-foreground">Most loved by the community</p><Link to="/design/$slug" params={{ slug: topDesign.slug }} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-clay">See its page <ArrowRight className="h-3 w-3" /></Link></div>
          </div>
        </div>
        <button type="button" onClick={() => setTab("messages")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-5 text-left">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1"><span className="block text-sm font-medium">Talk with a buyer</span><span className="block text-xs text-muted-foreground">Open your conversations</span></span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  </div>;
}
