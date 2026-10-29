import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, MessageCircle, Palette, Truck } from "lucide-react";
import room from "@/assets/hero-mural.jpg";
import { WallRoll } from "@/components/wall-roll";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COMMISSION_RATE, ROYALTY_TIERS, money } from "@/lib/catalog";
import { loadSite } from "@/lib/site-settings";
import { parseFaq, termsFrom, faqTokens, fillTokens } from "@/lib/designer-faq";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [
    { title: "Design with us: royalties & designer applications | Artisan Mural" },
    { name: "description", content: "Create wallpaper for Artisan Mural. Explore $0.50–$0.60 per square foot royalties, 90% custom design earnings, studio approval and designer applications." },
    { property: "og:title", content: "Design with us | Artisan Mural" },
    { property: "og:description", content: "Your art, made for real walls. Discover designer royalties, custom commissions and how to apply." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async () => ({ site: (await loadSite()) as any }),
  component: Sell,
});

const steps = [
  ["Apply to join", "Create an account and tell us about yourself, your country, your style and your portfolio. No payment details needed yet."],
  ["Get approved", "The studio reviews your application. You need approval before you can upload designs."],
  ["Build your collection", "Upload original murals or repeating patterns, color versions and the story behind each design. Every design is reviewed before it can be listed."],
  ["Create & earn", "Earn royalties when customers order your wallpaper. Talk with customers on Artisan Mural about paid adaptations and new custom designs."],
];


function Sell() {
  const { site } = Route.useLoaderData();
  const tk = faqTokens(termsFrom(site?.designerTerms));
  const all = parseFaq(site?.designerFaq?.faq).flatMap((g) => g.items).map((i) => ({ q: fillTokens(i.q, tk), a: fillTokens(i.a, tk) }));
  const faqs = all.slice(0, 8).map((i) => [i.q, i.a.split(/\n\n+/)[0]]);
  return (
    <>
      <WallRoll src={room} label="An original botanical wallpaper mural, unrolling down the wall" minH="min-h-[460px] sm:min-h-[560px]">
        <div className="absolute inset-0 -z-10 bg-hero-scrim/55" />
        <div className="mx-auto flex min-h-[460px] max-w-7xl flex-col justify-center px-5 py-16 text-hero-foreground sm:min-h-[560px] sm:px-8 sm:py-20">
          <p className="text-xs font-medium uppercase">For artists, illustrators & wallpaper designers</p>
          <h1 className="mt-5 max-w-xl text-4xl leading-tight sm:text-6xl">Design with<br />Artisan Mural.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-hero-foreground/90">Your creativity belongs on real walls. Create original wallpaper, reach customers, and earn when they choose your work.</p>
          <Button asChild size="lg" className="mt-7 h-12 w-fit"><Link to="/become-designer">Apply as a designer <ArrowRight /></Link></Button>
          <p className="mt-4 text-xs text-hero-foreground/80">Applications and every design are reviewed by our studio.</p>
        </div>
      </WallRoll>
      <section className="border-b border-border bg-accent">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 text-sm text-accent-foreground sm:grid-cols-3 sm:px-8">
          <p className="flex items-center gap-3"><Palette className="size-5 shrink-0" />Original murals & repeating patterns</p>
          <p className="flex items-center gap-3"><Truck className="size-5 shrink-0" />We print and ship the wallpaper</p>
          <p className="flex items-center gap-3"><MessageCircle className="size-5 shrink-0" />Paid custom work with customers</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase text-clay">Two ways to earn</p>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="text-3xl sm:text-4xl">Every wall starts with your art.</h2>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">Wallpaper royalties are based on square feet ordered. Custom design fees are paid separately.</p>
        </div>
        <h3 className="mt-9 text-2xl">01 / Wallpaper royalties</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your rate grows with the square feet of your designs sold. All amounts are in USD.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {ROYALTY_TIERS.map((tier) => <div key={tier.label} className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tier.label}</p>
            <p className="mt-4 font-display text-4xl">{money(tier.rate)}<span className="ml-2 font-sans text-sm text-muted-foreground">/ sq ft</span></p>
            <p className="mt-4 border-t border-border pt-4 text-sm">{tier.from === 0 ? "From your first square foot sold" : `From ${tier.from.toLocaleString("en-US")} sq ft sold`}</p>
          </div>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Example: a 10 × 10 ft wall is 100 sq ft. At the base rate of {money(ROYALTY_TIERS[0].rate)} / sq ft, your wallpaper royalty is {money(100 * ROYALTY_TIERS[0].rate)}. This is an illustration, not a guaranteed sale or income.</p>
        <div className="mt-10 grid gap-6 border-y border-border py-8 md:grid-cols-[.35fr_.65fr]">
          <div><h3 className="text-2xl">02 / Custom design work</h3><p className="mt-4 font-display text-5xl text-clay">{Math.round((1 - COMMISSION_RATE) * 100)}% <span className="font-sans text-sm text-muted-foreground">is yours</span></p></div>
          <div className="space-y-3 text-sm leading-7 text-muted-foreground"><p>Create a new bedroom mural, adapt a design to a larger wall, or work on a customer's color request. Agree on your fee in your Artisan Mural conversation.</p><p>You keep 90% of your custom design fee. Artisan Mural keeps {Math.round(COMMISSION_RATE * 100)}%. For example, a $200 custom design fee means $180 for you and $20 for Artisan Mural.</p><p className="font-medium text-foreground">Payments today: payouts are handled manually by the owner via PayPal, Wise or bank transfer. Automatic card payments and designer payouts are not connected yet.</p></div>
        </div>
      </section>
      <section className="bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-xs font-medium uppercase text-clay">From your portfolio to their home</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">A thoughtful start. A shared standard.</h2>
          <ol className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([title, body], i) => <li key={title} className="border-t border-border pt-5"><p className="text-sm font-medium text-clay">0{i + 1}</p><h3 className="mt-4 text-2xl">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p></li>)}</ol>
          <p className="mt-9 flex items-start gap-3 text-sm leading-6"><Check className="mt-1 size-4 shrink-0 text-clay" />Your studio brings together your designs, square feet ordered, earnings and customer conversations with photos.</p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase text-clay">Before you join</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">Your questions, answered.</h2>
        <Accordion type="single" collapsible className="mt-7">{faqs.map(([question, answer], i) => <AccordionItem value={`question-${i}`} key={question}><AccordionTrigger className="py-5 text-left text-base">{question}</AccordionTrigger><AccordionContent className="text-sm leading-7 text-muted-foreground">{answer}</AccordionContent></AccordionItem>)}</Accordion>
        <p className="mt-7"><Link to="/designers/how-it-works" className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">See all {all.length} questions and the full guide <ArrowRight className="size-4" /></Link></p>
      </section>
      <section className="border-t border-border bg-primary">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 text-primary-foreground sm:px-8 md:flex-row md:items-center">
          <div><p className="text-xs uppercase">Your next creative chapter</p><h2 className="mt-3 text-3xl sm:text-4xl">Let's put your art on the wall.</h2><p className="mt-3 text-sm">Tell us about your work. We'll review your application.</p></div>
          <Button asChild variant="secondary" size="lg" className="h-12"><Link to="/become-designer">Sign up & apply <ArrowRight /></Link></Button>
        </div>
      </section>
    </>
  );
}
