import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import room from "@/assets/hero-mural.jpg";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { loadSite } from "@/lib/site-settings";
import { parseFaq, termsFrom, faqTokens, fillTokens } from "@/lib/designer-faq";

export const Route = createFileRoute("/designers/how-it-works")({
  head: () => ({ meta: [
    { title: "How it works for designers: questions and answers | Artisan Mural" },
    { name: "description", content: "How selling wallpaper and murals on Artisan Mural works: signing up, uploading print files, studio review, how customers order, royalties, custom work and payouts." },
    { property: "og:title", content: "How it works for designers | Artisan Mural" },
    { property: "og:description", content: "Everything a designer needs to know: uploads, review, orders, royalties and payouts." },
    { property: "og:type", content: "website" },
  ] }),
  loader: async () => ({ site: (await loadSite()) as any }),
  component: HowItWorks,
});

const DEFAULT_INTRO = "You create the design. We print it to the exact size of each customer's wall, ship it, and pay you for every square foot sold. Here is every step, and the answers to the questions designers ask us most.";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function HowItWorks() {
  const { site } = Route.useLoaderData();
  const terms = termsFrom(site?.designerTerms);
  const tk = faqTokens(terms);
  const groups = parseFaq(site?.designerFaq?.faq).map((g) => ({ ...g, items: g.items.map((i) => ({ q: fillTokens(i.q, tk), a: fillTokens(i.a, tk) })) }));
  const intro = (site?.designerFaq?.intro ?? "").trim() || DEFAULT_INTRO;
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const steps: [string, string][] = [
    ["Create your account", "Sign up with your name, email and a password, then fill in one short profile: country, styles, a short bio, a portfolio link and your PayPal email for payouts."],
    ["Upload your design", `Choose mural or repeating pattern, upload the full-resolution print file for each color (up to 6), set the size, and pick the style, theme and rooms it suits.`],
    ["Check it and send it", "Repeating patterns get a seamless edge check. We place your design in rooms at real size, then you send it to the studio."],
    ["Studio review", `The studio looks at every design by hand.${tk.review_time ? ` Most reviews are done within ${tk.review_time}.` : ""} Approved designs go live with their own page and appear in the shop categories you picked.`],
    ["Customers order", "Customers enter their wall size, see your design at true scale in 52 in panels, try it on a photo of their own wall, pick a color and finish, and order."],
    ["You get paid", `You earn ${tk.royalty_starter} to ${tk.royalty_atelier} per sq ft sold, plus ${tk.designer_share} of any custom work. Cash out to PayPal or take store credit.`],
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: groups.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } }))) };
  return (
    <div className="designer-faq">
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-clay">For designers</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">How it works for designers.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">{intro}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12"><a href="/dashboard">Create designer account <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="outline" className="h-12"><a href="#faq">Read the questions</a></Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Already a designer? <a href="/dashboard" className="underline underline-offset-4">Sign in to your dashboard</a></p>
        </div>
        <img src={room} alt="An original botanical wallpaper mural in a living room" className="aspect-[4/3] w-full rounded-lg object-cover" />
      </section>

      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase text-clay">Step by step</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">From your file to their wall.</h2>
          <ol className="mt-9 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map(([t, b], i) => <li key={t} className="border-t border-border pt-5"><p className="text-sm font-medium text-clay">0{i + 1}</p><h3 className="mt-3 text-2xl">{t}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{b}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-medium uppercase text-clay">What you upload</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">Two kinds of design, one print standard.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6"><h3 className="text-xl">Mural</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">One picture made for a whole wall. Sold at the size you made it or smaller; bigger walls come to you as paid custom work.</p></div>
          <div className="rounded-lg border border-border bg-card p-6"><h3 className="text-xl">Repeating pattern</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">A tile that repeats across the wall: straight repeat, half-drop, or left-right only. We check that the edges join without a line.</p></div>
          <div className="rounded-lg border border-border bg-card p-6"><h3 className="text-xl">Print files</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {[`JPG, PNG, TIFF, PSD or PDF, up to ${tk.max_upload_gb} GB each`, `Printed at ${tk.target_dpi} DPI: wall size = pixels ÷ ${tk.target_dpi}`, "Up to 6 colors, one file per color", "Upload, or bring files in from a Google Drive link"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-clay" />{x}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase text-clay">How you earn</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Royalties on every square foot.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[["Starter", tk.royalty_starter, "From your first square foot sold"], ["Studio", tk.royalty_studio, "Once 2,500 sq ft of your designs have sold"], ["Atelier", tk.royalty_atelier, "From 5,000 sq ft sold"]].map(([l, r, d]) => <div key={l} className="rounded-lg border border-border bg-card p-6"><p className="text-xs font-medium uppercase text-muted-foreground">{l}</p><p className="mt-4 font-display text-4xl">{r}<span className="ml-2 font-sans text-sm text-muted-foreground">/ sq ft</span></p><p className="mt-4 border-t border-border pt-4 text-sm">{d}</p></div>)}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6"><h3 className="text-xl">Custom work: {tk.designer_share} is yours</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Customers can ask you for changes to a design or a new custom design. You send a price offer, they accept and pay on the site, you deliver the file. Artisan Mural keeps {tk.studio_commission} of the design fee.</p></div>
            <div className="rounded-lg border border-border bg-card p-6"><h3 className="text-xl">Payouts</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Request a cash-out to your PayPal from your Earnings page (minimum {tk.minimum_payout}); the studio pays requests {tk.payout_schedule}. Or turn your earnings into store credit for wallpaper on this site.</p></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Example: a 10 × 10 ft wall is 100 sq ft, so {tk.example_royalty} at the starting rate. An example, not a promise of sales.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-8 md:grid-cols-[.4fr_.6fr]">
          <div><p className="text-xs font-medium uppercase text-clay">Your dashboard</p><h2 className="mt-3 text-3xl sm:text-4xl">Everything in one place.</h2></div>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {[["Overview", "Your designs, sales and what needs you"], ["Requests & jobs", "Change requests, custom jobs, offers and chats"], ["Orders", "Orders of your designs with square feet"], ["My designs", "Upload, edit, send for review, remove"], ["Collections", "Group your designs into collections"], ["Earnings", "Royalties, custom work, cash-outs and history"], ["Profile", "Bio, styles, portfolio and PayPal email"]].map(([t, d]) => <li key={t} className="border-b border-border py-3"><p className="text-sm font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></li>)}
          </ul>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-medium uppercase text-clay">Questions and answers</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Designer FAQ</h2>
              <p className="mt-3 text-sm text-muted-foreground">{count} questions</p>
              <nav aria-label="FAQ topics" className="mt-5 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {groups.map((g) => g.title && <a key={g.title} href={`#${slug(g.title)}`} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary lg:rounded-md lg:border-0 lg:px-2">{g.title}</a>)}
              </nav>
            </div>
            <div className="min-w-0">
              {groups.map((g, gi) => <div key={gi} id={g.title ? slug(g.title) : undefined} className="scroll-mt-24 [&:not(:first-child)]:mt-10">
                {g.title && <h3 className="text-sm font-medium uppercase text-muted-foreground">{g.title}</h3>}
                <Accordion type="multiple" className="mt-2">
                  {g.items.map((it, i) => <AccordionItem value={`q-${gi}-${i}`} key={i}><AccordionTrigger className="py-5 text-left text-base">{it.q}</AccordionTrigger><AccordionContent className="text-sm leading-7 text-muted-foreground">{it.a.split(/\n\n+/).map((para, k) => <p key={k} className={k ? "mt-3" : ""}>{para}</p>)}</AccordionContent></AccordionItem>)}
                </Accordion>
              </div>)}
              <p className="mt-10 text-sm text-muted-foreground">Still have a question? {site?.general?.contactEmail ? <>Write to us at <a className="underline underline-offset-4" href={`mailto:${site.general.contactEmail}`}>{site.general.contactEmail}</a>.</> : <>Ask the studio from your dashboard once you have an account.</>}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-primary">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 text-primary-foreground sm:px-8 md:flex-row md:items-center">
          <div><h2 className="text-3xl sm:text-4xl">Ready to put your art on walls?</h2><p className="mt-3 text-sm">Create your account in a minute and upload your first design right after.</p></div>
          <Button asChild variant="secondary" size="lg" className="h-12"><a href="/dashboard">Create designer account <ArrowRight /></a></Button>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </div>
  );
}
