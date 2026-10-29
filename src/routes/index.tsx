import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ArrowUpRight, MessageCircle, Ruler, Truck } from "lucide-react";
import heroAsset from "@/assets/hero-mural.webp.asset.json";
import roomBefore from "@/assets/showcase-before.jpg";
import fern from "@/assets/design-fern.jpg";
import mist from "@/assets/design-mist.jpg";
import arches from "@/assets/design-arches.jpg";
import cranes from "@/assets/design-cranes.jpg";
import dots from "@/assets/design-dots.jpg";
import waves from "@/assets/design-waves.jpg";
import { RoomShowcase } from "@/components/room-showcase";
import { DesignerInvitation } from "@/components/designer-invitation";
import { Button } from "@/components/ui/button";
import { DesignCard } from "@/components/design-card";
import { HomeSearch } from "@/components/home-search";
import { PRICE_PER_SQFT, liveDesigns, money, registerShop, categories as allCategories } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { loadSite } from "@/lib/site-settings";
import { staticPic, pic, CARD_W } from "@/lib/pics";
const heroPic = staticPic(heroAsset.url, [720, 1080, 1440])!;

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "preload", as: "image", href: heroPic.src, imageSrcSet: heroPic.srcSet, imageSizes: "(min-width: 1024px) 58vw, 100vw", fetchPriority: "high" }],
    meta: [
      { title: "Artisan Mural | Original wallpaper, made for your wall" },
      {
        name: "description",
        content:
          "Original murals and patterns by independent artists. Find your design, see it in your room, and make it yours.",
      },
      { property: "og:title", content: "Artisan Mural | Original wallpaper, made for your wall" },
      { property: "og:description", content: "Original murals and patterns by independent artists. Find your design, see it in your room, and make it yours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: heroAsset.url },
      { name: "twitter:image", content: heroAsset.url },
    ],
  }),
  loader: async ({ context }) => { const [shop, site] = await Promise.all([ensureShop(context.queryClient), loadSite()]); return { shop, site }; },
  component: Index,
});

const categories = [
  { label: "Botanical", filter: "Botanical", image: fern },
  { label: "Landscapes", filter: "Landscape", image: mist },
  { label: "Geometric", filter: "Geometric", image: arches },
  { label: "Floral", filter: "Floral", image: cranes },
  { label: "Quiet neutrals", filter: "Minimal", image: waves },
  { label: "Kids", filter: "Kids & nursery", image: dots },
];
function Index() {
  const { shop, site } = Route.useLoaderData();
  registerShop(shop);
  const home = site?.homepage ?? {};
  const hero = home.hero ?? {};
  const on = (k: string) => home.sections?.[k] !== false;
  const live = liveDesigns(shop);
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const used = new Set<string>();
  const spareImages = [...live.map((d) => d.image), fern, mist, arches, cranes, dots, waves];
  const roll = allCategories.map((label) => {
    const inCategory = live.filter((d) => d.categories.includes(label));
    const image =
      inCategory.find((d) => !used.has(d.image))?.image ??
      spareImages.find((u) => !used.has(u)) ??
      inCategory[0]?.image ??
      fern;
    used.add(image);
    const d = live.find((x) => x.image === image);
    return { label, image: (d ? pic(d, image, [320]) : staticPic(image, [320]))?.src ?? image };
  });
  const pick = (home.featuredSlugs?.length ? home.featuredSlugs : ["cranes-at-dusk", "fernhouse", "deco-arches", "long-mist"]) as string[];
  const featured = pick.flatMap((slug) => live.filter((d) => d.slug === slug)).slice(0, 8);
  return (
    <>
      <DesignerInvitation />
      <section className="wallpaper-blue grid lg:grid-cols-[.38fr_.62fr]">
        <div data-reveal="left" className="is-in order-2 flex flex-col justify-center px-6 py-10 lg:order-1 lg:px-12 lg:py-16">
          <p className="text-[10px] uppercase tracking-[.2em] text-primary">Original art. Made to measure.</p>
          <h1 className="mt-5 max-w-md text-4xl leading-[1.08] sm:text-5xl">
            {hero.title ? hero.title : <>Beautiful walls,<br />made for you.</>}
          </h1>
          <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
            {hero.subtitle || "Find your design. See it in your room. Made to fit your wall."}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-5">
            <Button asChild size="lg" className="h-12 rounded-none px-6">
              <Link to={(hero.ctaLink || "/browse") as any}>
                {hero.ctaText || "Explore designs"}
                <ArrowUpRight className="ml-3 size-4" />
              </Link>
            </Button>
            <Link
              to="/design/$slug/preview"
              params={{ slug: "long-mist" }}
              search={{ view: "room" }}
              className="border-b border-primary/40 pb-1 text-sm text-primary"
            >
              See it in your room
            </Link>
          </div>
        </div>
        <img
          {...(() => { const hp = hero.image ? staticPic(hero.image, [720, 1080, 1440])! : heroPic; return { src: hp.src, srcSet: hp.srcSet, sizes: hp.srcSet ? "(min-width: 1024px) 58vw, 100vw" : undefined }; })()}
          alt="Botanical mural in a sunlit living room"
          fetchPriority="high"
          decoding="async"
          width={1440}
          height={900}
          className="order-1 h-auto w-full object-cover lg:order-2 lg:h-[560px] lg:object-[62%_center]"
        />
      </section>
      <HomeSearch designs={live} />
      <section aria-label="Made-to-measure wallpaper" className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-4 px-5 py-6 text-xs sm:grid-cols-4 sm:px-8">
          <span className="flex items-center gap-2">
            <Ruler className="size-4 shrink-0 text-primary" />
            Made to your measurements
          </span>
          <span className="flex items-center gap-2">
            <MessageCircle className="size-4 shrink-0 text-primary" />
            Work with the original artist
          </span>
          <span className="flex items-center gap-2">
            <Truck className="size-4 shrink-0 text-primary" />
            Printed &amp; shipped by us
          </span>
          <span className="sm:text-right">
            From <strong className="font-medium">{money(site?.general?.pricePerSqft || PRICE_PER_SQFT)}</strong> / sq ft
          </span>
        </div>
      </section>
      {roll.length > 2 && <section aria-label="Wallpaper categories" className="roll-strip overflow-hidden border-b border-border bg-background py-6">
        <div className="roll-track">{[...roll, ...roll].map((c, i) => <Link key={`${c.label}-${i}`} to="/browse" search={{ category: c.label }} aria-hidden={i >= roll.length} tabIndex={i >= roll.length ? -1 : undefined} className="group relative block h-40 w-32 shrink-0 overflow-hidden rounded-t-full shadow-paper sm:h-52 sm:w-40">
          <img src={c.image} alt={`${c.label} wallpaper`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <span className="absolute inset-x-0 bottom-0 bg-background/85 px-2 py-1.5 text-center text-[11px] backdrop-blur">{c.label}</span>
        </Link>)}</div>
      </section>}
      {on("featured") && featured.length > 0 && <section data-reveal className="collection-backdrop"><div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">The considered collection</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Art that feels at home.</h2>
          </div>
          <Link to="/browse" className="flex shrink-0 items-center gap-3 pb-1 text-xs">
            All designs
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {featured.map((d, i) => <DesignCard key={d.slug} design={d} eager={i < 2} />)}
        </div>
        <p className="mt-5 text-[10px] text-muted-foreground">Original artwork. Each design is sized to your wall.</p>
      </div></section>}
      {on("rooms") && <div id="room-preview" data-reveal="zoom" className="border-y border-border bg-secondary/30">
        <RoomShowcase />
      </div>}
      {on("showcase") && <section data-reveal className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Follow your feeling</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">Find your kind of beautiful.</h2>
        <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
          {categories.map((c) => (
            <Link key={c.label} to="/browse" search={{ category: c.filter }} className="group block">
              <div className="aspect-[4/5] overflow-hidden">
                <img
                  src={staticPic(c.image, CARD_W)?.src ?? c.image}
                  srcSet={staticPic(c.image, CARD_W)?.srcSet}
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                  alt={`${c.label} wallpaper detail`}
                  loading="lazy"
                  decoding="async"
                  width={1280}
                  height={1024}
                  className="h-full w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
                  style={c.label === "Quiet neutrals" ? { filter: "saturate(.15) brightness(1.12)" } : undefined}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <h3 className="text-lg">{c.label}</h3>
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </section>}
      {on("designers") && <section data-reveal className="wallpaper-blue">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:py-20">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">The artist behind the wall</p>
            <h2 className="mt-4 text-4xl sm:text-5xl">Meet Yuki Arai.</h2>
            <p className="mt-4 font-display text-xl leading-relaxed">Ink, gold leaf, and a lot of empty space.</p>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
              Discover the artist behind Cranes at Dusk. Explore the collection, find your favorite color, or start a
              conversation about your own wall.
            </p>
            <Button asChild className="mt-7 h-12 rounded-none px-6">
              <Link to="/designers/$slug" params={{ slug: "yuki-arai" }}>
                Meet the artist
                <ArrowUpRight className="ml-3 size-4" />
              </Link>
            </Button>
          </div>
          <div className="relative pb-7 pl-9 sm:pb-10 sm:pl-14">
            <img
              src={staticPic(roomBefore, [720, 1080])!.src}
              srcSet={staticPic(roomBefore, [720, 1080])!.srcSet}
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt="Furnished room inspiration"
              loading="lazy"
              decoding="async"
              width={1280}
              height={1024}
              className="aspect-[3/2] w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 w-[32%] border-[6px] border-background shadow-sm">
              <img
                src={staticPic(cranes, [320, 480])!.src}
                alt="Cranes at Dusk artwork detail"
                loading="lazy"
                decoding="async"
                width={1280}
                height={1024}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
            <p className="mt-3 text-right text-[10px] text-muted-foreground">Artwork detail / room inspiration</p>
          </div>
        </div>
      </section>}
      {on("howItWorks") && <section id="how-it-works" data-reveal className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">
            From inspiration to installation
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl">A wall that's entirely yours.</h2>
        </div>
        <div className="mt-12 grid gap-9 sm:grid-cols-3 sm:gap-12">
          {[
            ["01", "Choose your art", "Find an original mural or pattern that feels like you."],
            ["02", "See it in your space", "Preview the design in your room and enter your wall measurements."],
            ["03", "Made for your wall", "We print to order and ship your wallpaper, ready for its new home."],
          ].map(([n, title, text]) => (
            <div key={n} className="border-t border-border pt-5">
              <span className="text-[10px] tracking-[.16em] text-primary">{n}</span>
              <h3 className="mt-4 text-2xl">{title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>}
      {on("sell") && <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-primary-foreground/70">A personal touch</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Something a little more you?</h2>
            <p className="mt-3 text-sm text-primary-foreground/80">
              A new color, an unusual wall, a design all your own.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg" className="h-12 rounded-none px-6">
            <Link to="/custom-request">
              Start a custom design
              <ArrowUpRight className="ml-3 size-4" />
            </Link>
          </Button>
        </div>
      </section>}
    </>
  );
}
