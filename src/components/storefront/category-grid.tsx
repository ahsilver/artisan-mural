import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { liveDesigns, registerShop, type Design } from "@/lib/catalog";
import { getTaxonomy } from "@/lib/design-taxonomy";
import { coverKey, homeLayout, linkMatches, type TileLink } from "@/lib/home-layout";
import { StorefrontSprite } from "@/components/storefront/icons";

/** "Every room" and "Every style" pages: a card for each room / style / color with a picture and how many designs it has.
 *  Pictures: the owner's category cover (back office → Homepage → Category cover pictures), else a design in a room. */
export function CategoryPage({ shop, home, kind }: { shop: any; home: any; kind: "rooms" | "styles" }) {
  registerShop(shop);
  const live = liveDesigns(shop);
  const tax = getTaxonomy();
  const layout = useMemo(() => homeLayout(home), [home]);
  const used = new Set<string>();
  const cardFor = (name: string, l: TileLink, search: Record<string, string>, sw?: string) => {
    const ds = live.filter((d) => linkMatches(d, l));
    if (!ds.length) return null; // only what customers can actually shop
    const d: Design | undefined = ds.find((x) => !used.has(x.slug)) ?? ds[0]; if (d) used.add(d.slug);
    const img = layout.covers[coverKey(l)] || d?.mockups?.[0] || d?.image || "/p/img/cover-living-room.webp";
    return <Link key={coverKey(l)} className="rcard" to="/browse" search={search}><img src={img} alt="" loading="lazy" /><span><b>{sw && <i className="st-sw" style={{ background: sw }} />}{name}</b><small>{ds.length} design{ds.length === 1 ? "" : "s"}</small></span></Link>;
  };
  return <div className="am"><StorefrontSprite />
    <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>{kind === "rooms" ? "Rooms" : "Styles"}</b></nav></div>
    <section className="pg">
      {kind === "rooms" ? <>
        <div className="pg-head"><span className="k">Shop by room</span><h1>Every room, its own wallpaper.</h1><p>Pick a room to see every design made for it, shown in that kind of room.</p></div>
        <div className="rooms-grid">{tax.rooms.map((r) => cardFor(r, { kind: "room", value: r }, { room: r }))}</div>
      </> : <>
        <div className="pg-head"><span className="k">Shop by style</span><h1>Every style, in one place.</h1><p>Pick a style or a color to see every design that has it.</p></div>
        <h2 className="st-h2">Styles</h2><div className="rooms-grid">{tax.styles.map((s) => cardFor(s, { kind: "style", value: s }, { category: s }))}</div>
        {tax.themes.length > 0 && <><h2 className="st-h2">Themes</h2><div className="rooms-grid">{tax.themes.map((s) => cardFor(s, { kind: "theme", value: s }, { theme: s }))}</div></>}
        <h2 className="st-h2">Colors</h2><div className="rooms-grid">{tax.colors.map((c) => cardFor(c.label, { kind: "color", value: c.id }, { color: c.id }, c.swatch))}</div>
      </>}
    </section>
  </div>;
}
