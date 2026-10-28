import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { z } from "zod";

import { DesignCard } from "@/components/design-card";
import {
  categories,
  designerBySlug,
  designers,
  money,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState } from "react";
import { PromoCard } from "@/components/community";
import { useCommunity } from "@/lib/community";
import { Camera, GitCompareArrows } from "lucide-react";
import { TryOnPanel } from "@/components/try-on-wall";
import { useCompare } from "@/lib/compare";
import { useMyRooms } from "@/lib/my-rooms";
import type { Design } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { matchRoom, searchableDesignText, getTaxonomy } from "@/lib/design-taxonomy";
import { ensureShop } from "@/lib/shop";
import { liveDesigns, registerShop } from "@/lib/catalog";

const searchSchema = z.object({
  q: z.string().optional(),
  kind: z.string().optional(),
  category: z.string().optional(),
  theme: z.string().optional(),
  room: z.string().optional(),
  color: z.string().optional(),
  sort: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  // the shop list comes with the page, so the first view already shows every design and its small pictures
  loader: async ({ context }) => ({ shop: await ensureShop(context.queryClient) }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Search wallpaper designs — Artisan Mural" },
      {
        name: "description",
        content:
          "Search murals and seamless repeating wallpaper by category, room or designer. Every design prints to your exact wall size.",
      },
      { property: "og:title", content: "Search wallpaper designs — Artisan Mural" },
      {
        property: "og:description",
        content: "Search by category, room or designer. Printed to your exact wall size.",
      },
    ],
  }),
  component: Browse,
});

const kinds = [
  { id: "all", label: "Everything" },
  { id: "mural", label: "Murals (one scene)" },
  { id: "repeating", label: "Repeating patterns" },
] as const;

function Browse() {
  const community = useCommunity();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tryOn, setTryOnState] = useState(false);
  const [tryDesign, setTryDesign] = useState<Design | null>(null);
  const compare = useCompare();
  const myRooms = useMyRooms();

  const setTryOn = (v: boolean) => { setTryOnState(v); try { localStorage.setItem("am-try-on", v ? "1" : "0"); } catch {} if (v) window.scrollTo({ top: Math.min(window.scrollY, 380), behavior: "smooth" }); };
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const { shop } = Route.useLoaderData();
  registerShop(shop);
  const designs = liveDesigns(shop);
  const q = (search.q ?? "").slice(0, 80);
  const tax = getTaxonomy();
  const split = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const kindSel = split(search.kind).filter((k) => k === "mural" || k === "repeating");
  const picked = [...new Set([...split(search.category), ...split(search.theme)])];
  const lc = (x: string) => x.toLowerCase();
  const themeSel = picked.filter((x) => tax.themes.some((t) => lc(t) === lc(x)));
  const styleSel = picked.filter((x) => !themeSel.includes(x));
  const roomSel = split(search.room);
  const colorSel = split(search.color);
  const sort = search.sort ?? "featured";
  const join = (l: string[]) => (l.length ? l.join(",") : undefined);
  const toggle = (l: string[], v: string) => (l.some((x) => lc(x) === lc(v)) ? l.filter((x) => lc(x) !== lc(v)) : [...l, v]);
  const has = (l: string[], v: string) => l.some((x) => lc(x) === lc(v));
  const hasCat = (d: { categories: readonly string[] }, c: string) => d.categories.some((x) => lc(x) === lc(c));

  const update = (patch: Record<string, string | undefined>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const setCats = (styles: string[], themes: string[]) => update({ category: join(styles), theme: join(themes) });

  const needle = q.trim().toLowerCase();
  const matches = (d: (typeof designs)[number], skip?: string) => {
    const designer = designerBySlug(d.designer);
    const haystack = [d.title, d.sku ?? "", d.palette, d.description, designer?.name ?? "", ...d.room, ...d.categories, ...(d.tags ?? []), ...(d.colorways ?? []).map((c) => c.name), searchableDesignText(d)]
      .join(" ")
      .toLowerCase();
    return (
      (skip === "kind" || !kindSel.length || kindSel.includes(d.kind)) &&
      (skip === "style" || !styleSel.length || styleSel.some((c) => hasCat(d, c))) &&
      (skip === "theme" || !themeSel.length || themeSel.some((c) => hasCat(d, c))) &&
      (skip === "room" || !roomSel.length || roomSel.some((r) => matchRoom(d, r))) &&
      (skip === "color" || !colorSel.length || colorSel.some((c) => matchColor(d.palette, c))) &&
      (!needle || haystack.includes(needle))
    );
  };
  const filtered = designs.filter((d) => matches(d));
  const list =
    sort === "az" ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
    : sort === "za" ? [...filtered].sort((a, b) => b.title.localeCompare(a.title))
    : sort === "price" ? [...filtered].sort((a, b) => ((a as { pricePerSqft?: number }).pricePerSqft ?? 0) - ((b as { pricePerSqft?: number }).pricePerSqft ?? 0))
    : filtered;

  const active = kindSel.length + styleSel.length + themeSel.length + roomSel.length + colorSel.length;
  const allCats = [...tax.styles, ...tax.themes];
  const chipCats = allCats.map((c) => ({ c, n: designs.filter((d) => hasCat(d, c)).length })).filter((x) => x.n > 0 || has(picked, x.c));
  const toggleCat = (c: string) => { const isTheme = tax.themes.some((t) => lc(t) === lc(c)); setCats(isTheme ? styleSel : toggle(styleSel, c), isTheme ? toggle(themeSel, c) : themeSel); };

  const matchingDesigners = needle
    ? designers.filter((d) =>
        [d.name, d.location, d.tagline, ...d.specialties]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : [];

  return (
    <div className="collection-backdrop"><div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="text-eyebrow text-clay">The collection</p>
      <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">
        Every design here prints to your exact wall.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Search by what you're picturing, by category, or by the designer who made it. Repeating
        patterns tile to any width; murals are single scenes you can frame.
      </p>

      <div className="mt-8 flex max-w-xl items-center gap-2 rounded-sm border border-input bg-background px-3.5 py-3 focus-within:border-clay">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => update({ q: e.target.value.slice(0, 80) || undefined })}
          placeholder="Olive tree, art deco, nursery, Tomás…"
          maxLength={80}
          className="w-full bg-transparent text-sm outline-none"
        />
        {q && (
          <button type="button" onClick={() => update({ q: undefined })} aria-label="Clear search">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="cat-chips mt-7" role="group" aria-label="Categories">
        <button type="button" aria-pressed={!picked.length} onClick={() => setCats([], [])} className={cn("cat-chip", !picked.length && "on")}>All</button>
        {chipCats.map(({ c, n }) => (
          <button key={c} type="button" aria-pressed={has(picked, c)} onClick={() => toggleCat(c)} className={cn("cat-chip", has(picked, c) && "on")}>{c}<span className="cat-n">{n}</span></button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <p className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "design" : "designs"}{active > 0 && <> · <button type="button" onClick={() => navigate({ search: { q: search.q } })} className="underline underline-offset-4 hover:text-foreground">Clear {active} {active === 1 ? "filter" : "filters"}</button></>}</p>
        <div className="flex flex-wrap items-center gap-2">

        <Link to="/compare" data-testid="compare-link" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-background px-4 text-xs hover:bg-muted/50"><GitCompareArrows className="h-3.5 w-3.5" />Compare{compare.list.length ? ` (${compare.list.length})` : ""}</Link>
        <select aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === "featured" ? undefined : e.target.value })} className="h-9 rounded-full border border-input bg-background px-4 text-xs">
          <option value="featured">Sort: Featured</option>
          <option value="az">Name A–Z</option>
          <option value="za">Name Z–A</option>
          <option value="price">Price: low to high</option>
        </select>
        </div>
      </div>

      <Button variant="outline" className="mt-4 lg:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}><SlidersHorizontal />Filters{active > 0 ? ` (${active})` : ""}</Button>
      <div className="mt-6 grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside className={cn("max-w-sm space-y-6 text-sm lg:sticky lg:top-24 lg:self-start", !filtersOpen && "hidden lg:block")}>
          <FilterGroup title="Type">
            {kinds.filter((k) => k.id !== "all").map((k) => <FilterRow key={k.id} label={k.label} count={designs.filter((d) => d.kind === k.id && matches(d, "kind")).length} on={kindSel.includes(k.id)} onClick={() => update({ kind: join(toggle(kindSel, k.id)) })} />)}
          </FilterGroup>
          <FilterGroup title="Room" list={tax.rooms} count={(r) => designs.filter((d) => matchRoom(d, r) && matches(d, "room")).length} on={(r) => has(roomSel, r)} onPick={(r) => update({ room: join(toggle(roomSel, r)) })} />
          <FilterGroup title="Style" list={tax.styles} count={(c) => designs.filter((d) => hasCat(d, c) && matches(d, "style")).length} on={(c) => has(styleSel, c)} onPick={(c) => setCats(toggle(styleSel, c), themeSel)} />
          <FilterGroup title="Theme" list={tax.themes} count={(c) => designs.filter((d) => hasCat(d, c) && matches(d, "theme")).length} on={(c) => has(themeSel, c)} onPick={(c) => setCats(styleSel, toggle(themeSel, c))} />
          <FilterGroup title="Color">
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button key={c.id} type="button" title={c.label} aria-label={c.label} aria-pressed={colorSel.includes(c.id)} onClick={() => update({ color: join(toggle(colorSel, c.id)) })}
                  className={cn("size-7 rounded-full border border-border ring-offset-2 ring-offset-background transition", colorSel.includes(c.id) && "ring-2 ring-primary")} style={{ background: c.swatch }} />
              ))}
            </div>
          </FilterGroup>
        </aside>
        <div>

      {matchingDesigners.length > 0 && (
        <section className="mt-10">
          <h2 className="text-eyebrow text-muted-foreground">Designers matching "{q}"</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchingDesigners.map((d) => (
              <Link
                key={d.slug}
                to="/designers/$slug"
                params={{ slug: d.slug }}
                className="flex items-center gap-3 rounded-sm border border-border bg-card p-4 transition-shadow hover:shadow-paper"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive font-display text-olive-foreground">
                  {d.initials}
                </span>
                <span>
                  <span className="block text-sm font-medium">{d.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Custom work from {money(d.customFrom)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}


      {!tryOn && compare.list.length === 0 && <p className="mb-4 text-xs text-muted-foreground">Tip: tap <b className="font-medium text-foreground">+</b> on any design to compare up to 4 side by side.</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-24 sm:gap-7 xl:grid-cols-3">
        {list.map((design, i) => (
          <Fragment key={design.slug}>
            <DesignCard design={design} eager={i < 4} onPick={tryOn && myRooms.room ? (d) => setTryDesign(d) : undefined} picked={tryOn && tryDesign?.slug === design.slug} />
            {community.promoEnabled && !tryOn && (i + 1) % Math.max(4, Number(community.promoEvery) || 12) === 0 && <PromoCard title={community.promoTitle} text={community.promoText} cta={community.promoCta} />}
          </Fragment>
        ))}
        {community.promoEnabled && !tryOn && list.length > 0 && list.length < Math.max(4, Number(community.promoEvery) || 12) && <PromoCard title={community.promoTitle} text={community.promoText} cta={community.promoCta} />}
      </div>

      {list.length === 0 && (
        <div className="rounded-sm bg-secondary/60 p-10 text-center">
          <p className="font-display text-2xl">Nothing here matches that yet.</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Describe what you're picturing instead and every designer on Artisan Mural can reply
            with an offer.
          </p>
          <Link
            to="/custom-request"
            className="mt-6 inline-block rounded-sm bg-primary px-6 py-3.5 text-xs font-medium tracking-widest text-primary-foreground uppercase"
          >
            Post a request
          </Link>
        </div>
      )}
        </div>
      </div>
    </div></div>
  );
}

const colorOptions = [
  { id: "white", label: "White & cream", swatch: "#f4f1ea", words: ["white", "cream", "ivory", "chalk", "bone"] },
  { id: "beige", label: "Beige & neutral", swatch: "#d8c7a8", words: ["beige", "sand", "linen", "oat", "neutral", "taupe", "stone"] },
  { id: "grey", label: "Grey", swatch: "#9a9a9a", words: ["grey", "gray", "silver", "charcoal", "slate"] },
  { id: "black", label: "Black", swatch: "#222", words: ["black", "ink", "midnight"] },
  { id: "blue", label: "Blue", swatch: "#6f97c4", words: ["blue", "navy", "indigo", "sky", "teal"] },
  { id: "green", label: "Green", swatch: "#7d9a6a", words: ["green", "olive", "sage", "moss", "fern", "emerald"] },
  { id: "pink", label: "Pink", swatch: "#e8b4b8", words: ["pink", "blush", "rose"] },
  { id: "red", label: "Red & terracotta", swatch: "#b5523b", words: ["red", "terracotta", "rust", "clay", "coral"] },
  { id: "yellow", label: "Yellow & gold", swatch: "#d9b44a", words: ["yellow", "gold", "ochre", "mustard"] },
  { id: "brown", label: "Brown", swatch: "#7a5638", words: ["brown", "walnut", "umber", "tan"] },
];

function matchColor(palette: string, id: string) {
  const opt = colorOptions.find((c) => c.id === id);
  const p = palette.toLowerCase();
  return opt ? opt.words.some((w) => p.includes(w)) : p.includes(id);
}

function FilterGroup({ title, children, list, count, on, onPick }: { title: string; children?: React.ReactNode; list?: string[]; count?: (v: string) => number; on?: (v: string) => boolean; onPick?: (v: string) => void }) {
  const [more, setMore] = useState(false);
  const rows = list?.map((v) => ({ v, n: count ? count(v) : 0, on: on ? on(v) : false })) ?? [];
  const main = rows.filter((r) => r.n > 0 || r.on);
  const rest = rows.filter((r) => !(r.n > 0 || r.on));
  return (
    <details open className="border-b border-border pb-5">
      <summary className="cursor-pointer list-none text-eyebrow text-foreground">{title}</summary>
      <div className="mt-3 space-y-1">
        {children}
        {list && <>
          {main.map((r) => <FilterRow key={r.v} label={r.v} count={r.n} on={r.on} onClick={() => onPick?.(r.v)} />)}
          {more && rest.map((r) => <FilterRow key={r.v} label={r.v} count={r.n} on={r.on} onClick={() => onPick?.(r.v)} />)}
          {rest.length > 0 && <button type="button" onClick={() => setMore((m) => !m)} className="pt-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{more ? "Show less" : `Show all ${rows.length}`}</button>}
        </>}
      </div>
    </details>
  );
}

function FilterRow({ label, on, onClick, count }: { label: string; on: boolean; onClick: () => void; count?: number }) {
  return (
    <Button variant="ghost" type="button" onClick={onClick} aria-pressed={on} className={cn("flex h-auto w-full items-center justify-start gap-2.5 rounded-none px-0 py-1.5 text-left text-sm font-normal transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
      <span className={cn("size-3.5 shrink-0 rounded-sm border", on ? "border-primary bg-primary" : "border-input")} />
      <span>{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </Button>
  );
}
