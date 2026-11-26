import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Design } from "@/lib/catalog";
import { designerBySlug, materials, money, offeredFinishes, unitPrice } from "@/lib/catalog";
import { useCompare } from "@/lib/compare";
import { pic } from "@/lib/pics";
import { Ico } from "./icons";


/** The design's pictures for cards: room pictures first, the plain wallpaper second (same order as the preview). */
export function cardPics(d: Design): string[] {
  const rooms = (d.mockups ?? []).filter(Boolean);
  const list = rooms.length ? [rooms[0]!, d.image, ...rooms.slice(1, 3)] : [d.image];
  return list.map((u) => pic(d, u)?.src ?? u);
}
const CARD_SIZES = "(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw";
const setOf = (d: Design, u: string) => pic(d, u)?.srcSet;

const cardSrc = (d: Design) => { const rooms = (d.mockups ?? []).filter(Boolean); return rooms.length ? [rooms[0]!, d.image, ...rooms.slice(1, 3)] : [d.image]; };

/** Storefront design card: room picture, plain wallpaper on hover, picture dots, save, designer and price. */
export function StoreCard({ d }: { d: Design }) {
  const vs = cardPics(d);
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [fav, setFav] = useState(false);
  const flat = pic(d, d.image)?.src ?? d.image;
  const by = designerBySlug(d.designer)?.name ?? d.designer;
  return (
    <article className={"card" + (hover && vs.length > 1 ? " flat-on" : "")}>
      <Link className="im" to="/design/$slug" params={{ slug: d.slug }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <img src={vs[i]} srcSet={setOf(d, cardSrc(d)[i] ?? d.image)} sizes={CARD_SIZES} alt={d.title} loading="lazy" />
        {vs.length > 1 && <img className="im-flat" src={hover ? flat : undefined} srcSet={hover ? setOf(d, d.image) : undefined} sizes={CARD_SIZES} alt="" aria-hidden="true" />}
      </Link>
      <button type="button" className="fav" aria-pressed={fav} aria-label={`Save ${d.title}`} onClick={() => setFav((v) => !v)}><Ico id="i-heart" /></button>
      {vs.length > 1 && (
        <div className="thumbs" role="group" aria-label={`${d.title} pictures`}>
          {vs.map((v, k) => <button key={k} type="button" aria-pressed={k === i} aria-label={`Picture ${k + 1}`} onClick={() => setI(k)}><img src={v} alt="" loading="lazy" /></button>)}
          <Link className="more" to="/design/$slug" params={{ slug: d.slug }} aria-label={`Open ${d.title}`}><Ico id="i-next" /></Link>
        </div>
      )}
      <h3><Link to="/design/$slug" params={{ slug: d.slug }}>{d.title}</Link></h3>
      <div className="meta">
        <span><Link to="/designers/$slug" params={{ slug: d.designer }}>{by}</Link> · {d.kind === "repeating" ? "Repeat" : "Mural"}</span>
        <span>{priceRange(d)} / sq ft</span>
      </div>
      <CompareBox slug={d.slug} />
    </article>
  );
}

/** "$5.00–5.50": the cheapest and dearest material for this design, as on the sample. */
function priceRange(d: Design) {
  const ps = offeredFinishes(d, materials).map((m) => unitPrice(d, m)).filter((x) => x > 0);
  if (!ps.length) return money(0);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return hi - lo < 0.005 ? money(lo) : `${money(lo)}–${money(hi).replace(/^\$/, "")}`;
}
function CompareBox({ slug }: { slug: string }) {
  const c = useCompare(); const on = c.has(slug);
  return <label className="cmpchk"><input type="checkbox" checked={on} disabled={!on && c.full} onChange={() => c.toggle(slug)} /> Compare</label>;
}
