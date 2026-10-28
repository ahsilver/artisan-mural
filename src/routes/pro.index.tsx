import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import room from "@/assets/showcase-after.jpg";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { loadSite } from "@/lib/site-settings";
import { PRO_DEFAULTS, useProMe } from "@/lib/pro";

export const Route = createFileRoute("/pro/")({
  head: () => ({ meta: [
    { title: "For design professionals | Artisan Mural" },
    { name: "description", content: "A free program for interior designers, architects, contractors, stagers and hospitality and healthcare buyers: professional pricing, free samples, priority production and a dedicated specialist." },
    { property: "og:title", content: "For design professionals | Artisan Mural" },
    { property: "og:description", content: "Professional pricing, free samples, priority production and project quotes for the trade." },
    { property: "og:type", content: "website" },
  ] }),
  loader: async () => ({ site: (await loadSite()) as any }),
  component: ProPage,
});

function ProPage() {
  const { site } = Route.useLoaderData();
  const pro = { ...PRO_DEFAULTS, ...(site?.pro ?? {}) };
  const { me } = useProMe();
  const approved = me?.status === "approved", pending = me?.status === "pending";
  const benefits: [string, string][] = [
    [`${pro.discountPct}% off every order`, "Your professional price is applied automatically in the cart and at checkout, on every design and finish."],
    ...(pro.freeSamples ? [["Free samples", "Order printed samples of any design and finish at no cost, so clients can feel the material before they decide."] as [string, string]] : []),
    ["Priority production", "Pro orders move to the front of the print queue, with tracked shipping on every order."],
    ["A dedicated specialist", "One person who knows your projects: sizing, panel layouts, finishes and timelines."],
    ["Project quotes", "Multi-room, multi-wall and commercial jobs quoted in one place, with custom sizes and colorways."],
    ["Made to measure", "Every wall printed to its exact size, in numbered panels, with print files checked by hand."],
  ];
  const faq: [string, string][] = [
    ["Who can apply?", "Interior designers, architects, contractors and installers, home stagers, developers and property managers, and buyers for hotels, restaurants, offices, senior living and healthcare."],
    ["What does it cost?", `Nothing. ${pro.name} is free to join and there is no minimum order.`],
    ["How long does approval take?", `We review every application by hand, usually within ${pro.approvalDays}. You'll get an email as soon as you're approved.`],
    ["What do I need to apply?", "Your business name, your role, a website, Instagram or portfolio, and your business address and phone. A resale certificate or tax ID is optional but speeds things up."],
    ["How does the discount work?", "Once approved, sign in with the same account. Your discount shows in the cart and is applied at checkout automatically."],
    ["Can I order for a client's address?", "Yes. Ship to any address, and save several addresses in your account for different projects."],
    ["Do you handle commercial projects?", "Yes. Offices, hallways, lobbies, hotels, senior living and healthcare spaces. Ask your specialist about commercial-grade finishes and project quotes."],
  ];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const cta = approved ? <Button asChild size="lg" className="h-12"><a href="/browse">Shop with your {pro.discountPct}% price <ArrowRight /></a></Button>
    : pending ? <Button asChild size="lg" variant="outline" className="h-12"><a href="/account">Application received · view status</a></Button>
    : <Button asChild size="lg" className="h-12"><a href="/pro/apply">Apply now <ArrowRight /></a></Button>;
  return (
    <div className="pro-page">
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-clay">{pro.name}</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">For the people who design the room.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">A free program for design professionals. Professional pricing, free samples and a specialist who knows your projects, from one wall to a whole building.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">{cta}{!approved && <Button asChild size="lg" variant="outline" className="h-12"><a href="#faq">Questions</a></Button>}</div>
          <p className="mt-4 text-sm text-muted-foreground">Free to join · Approval in {pro.approvalDays}</p>
        </div>
        <img src={room} alt="A made-to-measure wallpaper mural in a finished room" className="aspect-[4/3] w-full rounded-lg object-cover" />
      </section>

      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase text-clay">Member benefits</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">What you get.</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([t, d]) => <div key={t} className="border-t border-border pt-5"><h3 className="text-lg font-medium">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-medium uppercase text-clay">How it works</p>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {[["Apply", "A short application, about three minutes."], ["Get approved", `We review it by hand within ${pro.approvalDays}.`], ["Order at your price", "Sign in and your price applies automatically."]].map(([t, d], i) => <li key={t} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-sm">{i + 1}</span><div><p className="font-medium">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p></div></li>)}
        </ol>
      </section>

      <section id="faq" className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="text-xs font-medium uppercase text-clay">Questions</p><h2 className="mt-3 text-3xl sm:text-4xl">Good to know.</h2></div>
          <Accordion type="single" collapsible className="w-full">
            {faq.map(([q, a], i) => <AccordionItem key={q} value={"f" + i}><AccordionTrigger className="text-left text-base">{q}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent></AccordionItem>)}
          </Accordion>
        </div>
      </section>

      {!approved && <section className="border-t border-border bg-secondary"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 sm:px-8"><div><h2 className="text-2xl">Ready to work together?</h2><p className="mt-1 text-sm text-muted-foreground">Free to join. No minimum order.</p></div>{cta}</div></section>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
