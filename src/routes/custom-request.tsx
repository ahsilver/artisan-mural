import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { designBySlug, registerShop } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { RequestForm } from "@/components/projects";

const searchSchema = z.object({ designer: z.string().max(60).optional(), design: z.string().max(60).optional(), selection: z.string().max(3000).optional() });

export const Route = createFileRoute("/custom-request")({
  validateSearch: searchSchema,
  loader: ({ context }) => ensureShop(context.queryClient),
  head: () => ({
    meta: [
      { title: "Request a custom wallpaper design — Artisan Mural" },
      { name: "description", content: "Your logo, a painting, a photo or an idea, made into wallpaper by an independent designer. Get a price and a date, then pay the design and the printing together." },
      { property: "og:title", content: "Request a custom wallpaper design — Artisan Mural" },
      { property: "og:description", content: "Describe your wall and get a price from wallpaper designers." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomRequest,
});

const STEPS = ["Describe your idea and attach your logo, photo or painting", "Designers reply with a price for the work and how many days they need", "Approve a price, enter your wall size and pay the printing and the design together", "The designer delivers the final file, and we print and ship"];

function CustomRequest() {
  const shop = Route.useLoaderData();
  registerShop(shop);
  const { designer, design } = Route.useSearch();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const d = design ? designBySlug(design) : null;
  const designers = (shop.designers ?? []).filter((x: any) => !x.hidden).map((x: any) => ({ slug: x.slug, name: x.name }));
  const edit = !!(d && d.slug.startsWith("u-"));
  return <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:py-14">
    <div>
      <p className="text-eyebrow text-muted-foreground">Custom design</p>
      <h1 className="mt-3 text-4xl leading-tight sm:text-6xl">{edit ? `Change “${d!.title}”` : "Your idea, made into wallpaper"}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">From your logo, a photo, a painting or just an idea. An independent designer makes it to fit your wall.</p>
      <ol className="mt-8 space-y-4">{STEPS.map((s, i) => <li key={i} className="flex gap-3 text-sm"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-display text-base">{i + 1}</span><span className="pt-1">{s}</span></li>)}</ol>
    </div>
    <div className="rounded-lg border border-border p-5 sm:p-7">
      {loading ? <Loader2 className="mx-auto my-10 animate-spin" /> : !session ? <div><h2 className="text-2xl">Sign in to send your request</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">So designers can answer you here and you get notified when a price comes in.</p><AuthPanel /></div>
        : <RequestForm kind={edit ? "edit" : "custom"} designSlug={edit ? d!.slug : undefined} designTitle={d?.title} designers={designers} initialDesigner={designer} basedOn={d && !edit ? { slug: d.slug, title: d.title } : null} onDone={(id) => void navigate({ to: "/projects/$id", params: { id }, search: { sent: 1 } as any })} />}
    </div>
  </div>;
}
