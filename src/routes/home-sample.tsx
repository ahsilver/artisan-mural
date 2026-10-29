import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, Layers, Users } from "lucide-react";
import heroAsset from "@/assets/hero-mural.webp.asset.json";
import fern from "@/assets/design-fern.jpg";
import mist from "@/assets/design-mist.jpg";
import arches from "@/assets/design-arches.jpg";
import cranes from "@/assets/design-cranes.jpg";
import dots from "@/assets/design-dots.jpg";
import waves from "@/assets/design-waves.jpg";
import { DesignCard } from "@/components/design-card";
import { HomeSearch } from "@/components/home-search";
import { WallRoll } from "@/components/wall-roll";
import { liveDesigns, registerShop } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { loadSite } from "@/lib/site-settings";
import { pic, staticPic } from "@/lib/pics";

/** SAMPLE homepage (not linked anywhere, not indexed): camera walk past real walls -> one scroll -> words typed on light blue -> wide roll -> categories + all wallpapers -> Artisan Pro. */
export const Route = createFileRoute("/home-sample")({
  head: () => ({ meta: [{ title: "Artisan Mural | Original wallpaper, made for your wall" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: async ({ context }) => { const [shop, site] = await Promise.all([ensureShop(context.queryClient), loadSite()]); return { shop, site }; },
  component: HomeSample,
});

const CATS = [
  { label: "Botanical", filter: "Botanical", image: fern },
  { label: "Landscapes", filter: "Landscape", image: mist },
  { label: "Geometric", filter: "Geometric", image: arches },
  { label: "Floral", filter: "Floral", image: cranes },
  { label: "Quiet neutrals", filter: "Minimal", image: waves },
  { label: "Kids", filter: "Kids & nursery", image: dots },
];
const LINES = ["Your wall, as art.", "Original wallpaper by independent designers.", "Printed to the exact size of your wall.", "Changed by the designer, until it is yours."];

function useTyping(start: boolean) {
  const [n, setN] = useState(0);
  const total = LINES.reduce((a, l) => a + l.length, 0);
  useEffect(() => {
    if (!start) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(total); return; }
    let i = 0; const t = setInterval(() => { i += 1; setN(i); if (i >= total) clearInterval(t); }, 34);
    return () => clearInterval(t);
  }, [start, total]);
  let left = n;
  return LINES.map((l) => { const take = Math.max(0, Math.min(l.length, left)); left -= l.length; return { text: l.slice(0, take), done: take === l.length, active: take > 0 && take < l.length }; });
}

function HomeSample() {
  const { shop } = Route.useLoaderData();
  registerShop(shop);
  const live = liveDesigns(shop);
  const walk = useMemo(() => {
    const out: { src: string; title: string; slug: string }[] = [];
    for (const d of live) { const m = d.mockups?.[0]; if (m) out.push({ src: pic(d, m, [1440])?.src ?? m, title: d.title, slug: d.slug }); if (out.length >= 6) break; }
    if (out.length < 3) out.push({ src: staticPic(heroAsset.url, [1440])?.src ?? heroAsset.url, title: "Artisan Mural", slug: "" });
    return out;
  }, [live]);
  const wide = useMemo(() => { const m = live.find((d) => d.kind === "mural" && d.orientation === "landscape") ?? live[0]; return m ? (pic(m, m.image, [1920])?.src ?? m.image) : staticPic(heroAsset.url, [1440])?.src ?? heroAsset.url; }, [live]);
  const s2 = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const typed = useTyping(seen);
  // One mouse scroll (or one swipe) from the first screen lands exactly on the second.
  useEffect(() => {
    let lock = false; let ty = 0;
    const to = (y: number) => { lock = true; window.scrollTo({ top: y, behavior: "smooth" }); setTimeout(() => { lock = false; }, 900); };
    const top2 = () => (s2.current ? s2.current.getBoundingClientRect().top + window.scrollY - 72 : window.innerHeight);
    const onWheel = (e: WheelEvent) => {
      const y = window.scrollY, t2 = top2();
      if (lock) { if (y < t2 + 4) e.preventDefault(); return; }
      if (e.deltaY > 0 && y < t2 - 8) { e.preventDefault(); to(t2); }
      else if (e.deltaY < 0 && y > 4 && y <= t2 + 8) { e.preventDefault(); to(0); }
    };
    const onTs = (e: TouchEvent) => { ty = e.touches[0].clientY; };
    const onTe = (e: TouchEvent) => { const dy = ty - e.changedTouches[0].clientY; const y = window.scrollY, t2 = top2(); if (dy > 30 && y < t2 - 8) to(t2); };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTs, { passive: true }); window.addEventListener("touchend", onTe, { passive: true });
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setSeen(true); }), { threshold: 0.35 });
    if (s2.current) io.observe(s2.current);
    return () => { window.removeEventListener("wheel", onWheel); window.removeEventListener("touchstart", onTs); window.removeEventListener("touchend", onTe); io.disconnect(); };
  }, []);
  const grid = live.slice(0, 12);
  return <div className="hs" data-testid="home-sample">
    <section className="hs-walk" aria-label="Rooms with Artisan Mural wallpaper">
      <div className="hs-cam"><div className="hs-track">{[...walk, ...walk].map((r, i) => <div key={i} className="hs-wall" aria-hidden={i >= walk.length}><img src={r.src} alt={i < walk.length ? `${r.title} in a room` : ""} loading={i < 2 ? "eager" : "lazy"} decoding="async" /></div>)}</div></div>
      <div className="hs-walk-shade" />
      <div className="hs-walk-copy">
        <p className="hs-eyebrow">Artisan Mural</p>
        <p className="hs-walk-t">Original wallpaper, made for your wall.</p>
      </div>
      <button type="button" className="hs-cue" onClick={() => s2.current && window.scrollTo({ top: s2.current.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" })} aria-label="Scroll down"><span>Scroll</span><i /></button>
    </section>
    <section ref={s2} className="hs-type" aria-label="About Artisan Mural" data-testid="hs-type">
      <div className="hs-type-in">
        <h1 className="hs-h1">{typed[0].text}<span className={`hs-caret ${typed[0].active || (!typed[0].done && seen) ? "" : "hidden"}`} /></h1>
        {typed.slice(1).map((l, i) => <p key={i} className="hs-line">{l.text}{l.active && <span className="hs-caret" />}&#8203;</p>)}
        <div className={`hs-type-actions ${typed[3].done ? "in" : ""}`}>
          <HomeSearch designs={live} tone="blue" />
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/browse" className="hs-btn">Browse designs <ArrowUpRight className="size-4" /></Link>
            <Link to="/custom-request" className="hs-btn ghost">Start a custom design</Link>
          </div>
        </div>
      </div>
    </section>
    <WallRoll src={wide} label="A wide wallpaper unrolling across the wall" minH="min-h-[360px] sm:min-h-[480px]">
      <div className="flex min-h-[360px] items-end sm:min-h-[480px]"><div className="m-5 rounded-md bg-background/90 px-5 py-4 shadow-paper sm:m-8"><p className="text-[10px] uppercase tracking-[.2em] text-primary">One roll, the whole wall</p><p className="mt-1 font-display text-2xl">Printed to the exact size of your wall.</p></div></div>
    </WallRoll>
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20" aria-label="Shop by category">
      <div className="flex items-end justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Shop by category</p><h2 className="mt-3 text-3xl sm:text-4xl">Find your wall.</h2></div><Link to="/browse" className="flex shrink-0 items-center gap-3 pb-1 text-xs">All designs <ArrowRight className="size-4" /></Link></div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CATS.map((c) => <Link key={c.label} to="/browse" search={{ category: c.filter } as any} className="group relative block aspect-[3/4] overflow-hidden rounded-t-full shadow-paper">
          <img src={staticPic(c.image, [320])?.src ?? c.image} alt={`${c.label} wallpaper`} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <span className="absolute inset-x-0 bottom-0 bg-background/85 px-2 py-2 text-center text-xs backdrop-blur">{c.label}</span></Link>)}
      </div>
    </section>
    <section className="collection-backdrop" aria-label="Wallpapers"><div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="flex items-end justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Wallpapers</p><h2 className="mt-3 text-3xl sm:text-4xl">Art that feels at home.</h2></div><Link to="/browse" className="flex shrink-0 items-center gap-3 pb-1 text-xs">See all {live.length} <ArrowRight className="size-4" /></Link></div>
      <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">{grid.map((d) => <DesignCard key={d.slug} design={d} />)}</div>
    </div></section>
    <section className="hs-pro" aria-label="Artisan Pro" data-testid="hs-pro">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div><p className="text-[10px] uppercase tracking-[.2em]">Artisan Pro</p><h2 className="mt-3 text-3xl sm:text-5xl">For the people who design the room.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 opacity-90">A free program for interior designers, architects and contractors. Professional pricing, free samples and a specialist who knows your projects, from one wall to a whole building.</p>
          <Link to="/pro" className="hs-btn mt-7 inline-flex">Join Artisan Pro <ArrowRight className="size-4" /></Link></div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[[BadgeCheck, "Pro pricing", "Trade prices on every design and custom work."], [Layers, "Free samples", "Feel the finishes before your client chooses."], [Users, "Your specialist", "One person who knows your projects."]].map(([I, t, b]: any) => <div key={t} className="hs-pro-card"><I className="size-5" /><p className="mt-3 font-display text-xl">{t}</p><p className="mt-1 text-sm opacity-80">{b}</p></div>)}
        </div>
      </div>
    </section>
  </div>;
}
