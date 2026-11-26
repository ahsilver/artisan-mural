import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { allDesigners, liveDesigns, registerShop, type Design } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { loadSite } from "@/lib/site-settings";
import { pic } from "@/lib/pics";
import { StorefrontSprite, Ico, Mark } from "@/components/storefront/icons";
import { StoreCard } from "@/components/storefront/card";
import { DEFAULT_STYLE_STRIP, featuredToday, homeLayout, linkSearch, tilePicture, type HomeLayout } from "@/lib/home-layout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Artisan Murals | Original wallpaper, printed for your wall" },
      { name: "description", content: "Murals and wallpaper drawn by independent artists, printed to the exact size of your wall." },
      { property: "og:title", content: "Artisan Murals | Original wallpaper, printed for your wall" },
      { property: "og:description", content: "Murals and wallpaper drawn by independent artists, printed to the exact size of your wall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => { const [shop, site] = await Promise.all([ensureShop(context.queryClient), loadSite()]); return { shop, site }; },
  component: Home,
});

const COVER = (n: string) => `/p/img/cover-${n}.webp`;
/** Where each wallpaper sample lies on the table in the first banner (same layout as the preview). */
const SAMPLE_SPOTS = [
  "left:47%;top:-6%;width:17%;height:44%;transform:rotate(-2deg)", "left:66%;top:6%;width:19%;height:36%;transform:rotate(3deg)",
  "left:86%;top:-4%;width:16%;height:30%;transform:rotate(-4deg)", "left:37%;top:40%;width:20%;height:42%;transform:rotate(-5deg)",
  "left:58%;top:47%;width:22%;height:30%;transform:rotate(1deg)", "left:81%;top:37%;width:15%;height:34%;transform:rotate(-2deg)",
  "left:68%;top:79%;width:18%;height:27%;transform:rotate(4deg)", "left:88%;top:74%;width:16%;height:32%;transform:rotate(-6deg)",
];
const css = (s: string): React.CSSProperties => Object.fromEntries(s.split(";").filter(Boolean).map((kv) => { const [k, v] = kv.split(":"); return [k!.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v!.trim()]; }));

/** The same designs all day, new ones tomorrow. */
function daily<T>(list: T[], salt = 0): T[] {
  let seed = (Math.floor(Date.now() / 864e5) + salt) * 2654435761 % 4294967296;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a;
}
// big pictures use the full shop picture so they stay sharp on large and high-density screens (as on the sample site)
const room = (d?: Design, k = 0) => (d ? d.mockups?.[k] ?? d.mockups?.[0] ?? d.image : undefined);
const flatPic = (d: Design) => d.image;
const has = (d: Design, words: string[]) => [...d.categories, ...d.room, ...(d.tags ?? [])].some((c) => words.some((w) => String(c).toLowerCase().includes(w)));

function Hero({ live, home, layout }: { live: Design[]; home: any; layout: HomeLayout }) {
  const samples = useMemo(() => daily(live.filter((d) => d.image)).slice(0, 8), [live]);
  const featured = useMemo(() => featuredToday(live, layout), [live, layout]);
  const h = home.hero ?? {};
  const hs: any[] = Array.isArray(h.slides) ? h.slides : [];
  const slides = [
    { k: hs[0]?.kicker || h.kicker || "Original designs by independent artists", t: hs[0]?.title || h.title || "Every wall. Your story.", p: hs[0]?.text || h.subtitle || "Murals and wallpaper drawn by independent artists, printed to the exact size of your wall." },
    { k: hs[1]?.kicker || (featured ? `Today's featured design · ${featured.title}` : "Today's featured design"), t: hs[1]?.title || "One scene, wall to wall.", p: hs[1]?.text || "Printed to the exact size of your wall and split into numbered panels, ready to hang." },
    { k: hs[2]?.kicker || "Don't love a detail?", t: hs[2]?.title || "Our designers will change it.", p: hs[2]?.text || "Remove an animal, change a color, make it bigger. Chat with the designer before you order, free on every mural." },
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (paused || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    timer.current = window.setTimeout(() => setI((x) => (x + 1) % 3), 6500);
    return () => window.clearTimeout(timer.current);
  }, [i, paused]);
  const s = slides[i]!;
  const tagA = samples[4], tagB = samples[0];
  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured">
      <div className={"slide" + (i === 0 ? " on" : "")}>
        <div className="flat">
          {samples.map((d, k) => (
            <Link key={d.slug} className="s" to="/design/$slug" params={{ slug: d.slug }} style={css(SAMPLE_SPOTS[k]!)} aria-label={`Open ${d.title}`} title={d.title}>
              <i className="sk" style={{ backgroundImage: `url(${flatPic(d)})`, backgroundSize: "260%", backgroundPosition: `${(k * 37) % 100}% ${(k * 53) % 100}%` }} />
              <span className="s-lab">{d.title}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
            </Link>
          ))}
          <div className="dish" aria-hidden="true" style={{ left: "80%", top: "22%", width: "11.5vw", height: "11.5vw", maxWidth: 150, maxHeight: 150 }} />
          <div className="vase" aria-hidden="true" style={{ left: "28%", top: "-5%", width: "9vw", height: "9vw", maxWidth: 120, maxHeight: 120 }} />
          {tagA && <div className="tag" aria-hidden="true" style={{ left: "59%", top: "83%", transform: "rotate(-3deg)" }}>{tagA.sku ? `No. ${tagA.sku.replace(/\D/g, "").slice(-3)}` : "No. 01"}<b>{tagA.title}</b></div>}
          {tagB && <div className="tag" aria-hidden="true" style={{ left: "51%", top: "34%", transform: "rotate(2deg)" }}>{tagB.sku ? `No. ${tagB.sku.replace(/\D/g, "").slice(-3)}` : "No. 02"}<b>{tagB.title}</b></div>}
        </div>
        <div className="fade" />
      </div>
      <div className={"slide" + (i === 1 ? " on" : "")}>
        {hs[1]?.image
          ? <a className="slide-link" href={hs[1]?.link || "/browse"}><img src={hs[1].image} alt="" loading="lazy" /></a>
          : featured
          ? <Link className="slide-link" to="/design/$slug" params={{ slug: featured.slug }}><img src={room(featured, 1)} alt={`${featured.title} in a room`} loading="lazy" /></Link>
          : <Link className="slide-link" to="/browse"><img src={COVER("living-room")} alt="" loading="lazy" /></Link>}
        <div className="fade" />
      </div>
      <div className={"slide" + (i === 2 ? " on" : "")}>
        <Link className="slide-link s3split" to="/changes" aria-label="See how changes work">
          <span className="s3a"><img src={hs[2]?.before || "/p/img/forest-before.webp"} alt="A forest mural, original" /><em>Original</em></span>
          <span className="s3b"><img src={hs[2]?.after || "/p/img/forest-after.webp"} alt="The same mural with the dark tree removed by the designer" loading="lazy" /><em>Tree removed for you</em></span>
        </Link>
        <div className="fade" />
      </div>
      <div className="hero-copy">
        <div className="k">{s.k}</div>
        <h1>{s.t}</h1>
        <p>{s.p}</p>
        <div className="ctas"><Link className="btn btn-white" to="/browse">Browse designs</Link><Link className="btn btn-line" to="/browse" search={{ kind: "mural" }}>Shop murals</Link></div>
      </div>
      <div className="hero-ui">
        <span className="count"><b>{String(i + 1).padStart(2, "0")}</b> <span>/</span> 03</span>
        <div className="bars" role="tablist" aria-label="Choose slide">
          {[0, 1, 2].map((k) => <button key={k} type="button" className={k === i ? "on" : ""} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)}><i /></button>)}
        </div>
        <div className="arrows">
          <button type="button" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused((p) => !p)}>
            <svg className="ico" viewBox="0 0 24 24">{paused ? <path d="M8 5l11 7-11 7z" /> : <path d="M9 6v12M15 6v12" />}</svg>
          </button>
          <button type="button" aria-label="Previous slide" onClick={() => setI((x) => (x + 2) % 3)}><Ico id="i-left" /></button>
          <button type="button" aria-label="Next slide" onClick={() => setI((x) => (x + 1) % 3)}><Ico id="i-right" /></button>
        </div>
      </div>
    </section>
  );
}

function Tile({ to, search, img, title, sub, className = "tile" }: { to: string; search?: Record<string, string> | undefined; img?: string | undefined; title: string; sub?: string | undefined; className?: string }) {
  return (
    <Link className={className} to={to} search={() => search ?? {}}>
      {img && <img src={img} alt="" loading="lazy" />}
      <span className="lab"><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
    </Link>
  );
}

function Signup() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="sec pg signup">
      <div className="head"><Mark /><h2 className="caps">Email Signup</h2></div>
      <p>Be the first to see new murals, artist collections and sample sales.</p>
      <form noValidate onSubmit={async (e) => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMsg("Please enter a valid email address."); return; }
        setBusy(true); setMsg("");
        try {
          const r = await fetch("/backend/pro/first-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "home", page: "/" }) });
          const d = await r.json().catch(() => ({}));
          setMsg(r.ok ? (d.code ? `Thanks! Your welcome code is ${d.code} (${d.pct}% off your first order). We emailed it to you too.` : "Thanks! You're on the list.") : (d.error || "Something went wrong. Please try again."));
          if (r.ok) setEmail("");
        } catch { setMsg("Something went wrong. Please try again."); }
        setBusy(false);
      }}>
        <label htmlFor="em"><span className="sr">Email address</span><input id="em" type="email" placeholder="Enter your email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="btn btn-wine" type="submit" disabled={busy}>{busy ? "Signing up…" : "Sign up"}</button>
      </form>
      <div className="msg" aria-live="polite">{msg}</div>
    </section>
  );
}

function Home() {
  const { shop, site } = Route.useLoaderData();
  registerShop(shop);
  const home = (site as any)?.homepage ?? {};
  const on = (k: string) => home.sections?.[k] !== false;
  const duo: any = home.duo ?? {};
  const tiles: any[] = Array.isArray(home.tiles) ? home.tiles : [];
  const layout = useMemo(() => homeLayout(home), [home]);
  const H = layout.headings;
  const live = liveDesigns(shop);
  const roomed = live.filter((d) => d.mockups?.length);
  const withRoom = roomed.length >= 6 ? roomed : live; // until designs have room pictures, use the wallpaper itself
  const find = (fn: (d: Design) => boolean, salt = 0) => daily(withRoom.filter(fn), salt)[0] ?? daily(withRoom, salt)[0];
  const tilePic = (t: HomeLayout["looks"][number], salt: number) => tilePicture(t, layout, withRoom, salt, room).img;
  const trends = [...live].sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0)).slice(0, 10);
  const arrivals = [...(shop.designs?.length ? shop.designs : live)].reverse().filter((d) => live.includes(d) || live.some((x) => x.slug === d.slug)).slice(0, 10);
  const designers = allDesigners().map((x) => ({ x, d: withRoom.find((d) => d.designer === x.slug) ?? live.find((d) => d.designer === x.slug) })).filter((r) => r.d).slice(0, 2);
  const split = find((d) => d.kind === "mural", 12);
  const big = daily(live, 13)[0];
  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg">
        {on("hero") && <Hero live={live} home={home} layout={layout} />}
        <nav className="qrow" aria-label="Quick links">
          <Link to="/own"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z M4 15l5-4 4 3 3-2 4 3 M15 9.5h.01" /></svg></span>Your own image</Link>
          <Link to="/custom-request"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></span>Post a request</Link>
          <Link to="/designers"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-4 3-6 7-6s7 2 7 6 M17 11a3 3 0 1 0 0-6 M22 21c0-3-2-5-5-5.5" /></svg></span>Designers</Link>
          <Link to="/pro"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" /></svg></span>Artisan Pro</Link>
          <Link to="/sell"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4l6 6-8.5 8.5-6-6z M5.5 12.5 3 21l8.5-2.5" /></svg></span>Sell your art</Link>
        </nav>
      </div>

      {on("duo") && (
        <section className="pg duo-top" aria-label="Artisan Pro and selling your art">
          <div className="duo2">
            <Link className="d2" to="/pro"><img src={duo.pro?.image || COVER("commercial")} alt="" loading="lazy" /><span className="d2-txt"><span className="k">{duo.pro?.kicker || "For design professionals"}</span><b>{duo.pro?.title || "Artisan Pro"}</b><small>{duo.pro?.text || "Trade pricing, free samples and one specialist for every project."}</small></span><span className="btn btn-wine">{duo.pro?.cta || "Apply"}</span></Link>
            <Link className="d2" to="/sell"><img src={duo.sell?.image || (big ? flatPic(big) : COVER("living-room"))} alt="" loading="lazy" /><span className="d2-txt"><span className="k">{duo.sell?.kicker || "For artists"}</span><b>{duo.sell?.title || "Sell your designs"}</b><small>{duo.sell?.text || "We print and ship to order. You earn on every sale."}</small></span><span className="btn btn-wine">{duo.sell?.cta || "Apply"}</span></Link>
          </div>
        </section>
      )}

      {on("look") && withRoom.length > 0 && (
        <div className="pg sec">
          <section className="g-cat" aria-label="Shop by look">
            {layout.looks.map((l, k) => <Tile key={k + l.title} to="/browse" search={linkSearch(l.link)} img={tilePic(l, k + 1)} title={l.title} sub={l.sub} />)}
          </section>
        </div>
      )}

      {on("rooms") && (
        <section className="sec pg">
          <div className="head"><Mark /><h2>{H.rooms}</h2></div>
          <div className="g-app">
            {layout.rooms.map((r, k) => <Tile key={k + r.title} className={"tile " + (["w7", "w5", "w4", "w8"][k % 4])} to="/browse" search={linkSearch(r.link)} img={tilePic(r, 20 + k)} title={r.title} />)}
          </div>
          {layout.roomStrip.length > 0 && <nav className="room-strip" aria-label="More rooms">
            {layout.roomStrip.map((r) => <Link key={r.room + r.title} to="/browse" search={{ room: r.room }}>{r.title}</Link>)}<Link className="all" to="/rooms">See all rooms <span aria-hidden="true">→</span></Link>
          </nav>}
        </section>
      )}

      {on("transform") && (
        <section className="sec pg">
          <div className="split">
            <div>
              <h2>{H.transformTitle}</h2>
              <p>{H.transformText}</p>
              <Link className="btn btn-wine" to="/browse">{H.transformButton}</Link>
            </div>
            <div className="ph"><img src={split ? room(split, 2) : COVER("living-room")} alt={split ? `${split.title} in a room` : ""} loading="lazy" /></div>
          </div>
          {withRoom.length > 0 && <div className="g-look">{layout.moods.map((m, n) => <Tile key={n + m.title} to="/browse" search={linkSearch(m.link)} img={tilePic(m, 8 + n)} title={m.title} sub={m.sub} />)}</div>}
          <nav className="room-strip" aria-label="More styles">{DEFAULT_STYLE_STRIP.map((x) => <Link key={x.title} to="/browse" search={linkSearch(x.link)}>{x.title}</Link>)}<Link className="all" to="/styles">See all styles <span aria-hidden="true">→</span></Link></nav>
        </section>
      )}


      {on("trends") && trends.length > 0 && (
        <section className="sec pg">
          <div className="head"><Mark /><h2>{H.trends}</h2></div>
          <div className="g-prod">{trends.map((d) => <StoreCard key={d.slug} d={d} />)}</div>
        </section>
      )}

      {on("new") && arrivals.length > 0 && (
        <section className="sec pg" id="new">
          <div className="head"><Mark /><h2 className="caps">{H.new}</h2></div>
          <div className="g-prod">{arrivals.map((d) => <StoreCard key={d.slug} d={d} />)}</div>
        </section>
      )}

      {on("designers") && (
        <section className="sec pg" id="designers">
          <div className="head"><Mark /><h2>{H.designers}</h2></div>
          <div className="g-des">
            <Tile className="tile big" to="/designers" img={big ? flatPic(big) : COVER("hotel")} title="All designers" />
            {designers.map(({ x, d }) => <Link key={x.slug} className="tile" to="/designers/$slug" params={{ slug: x.slug }}><img src={room(d)} alt="" loading="lazy" /><span className="lab"><strong>{x.name.toUpperCase()}</strong><small>{[x.tagline, x.location].filter(Boolean).join(" · ")}</small></span></Link>)}
          </div>
        </section>
      )}

      {on("changes") && (
        <section className="pg sec chg-band" aria-label="Changes on any design">
          <div className="cb-in">
            <img src="/p/img/forest-after.webp" alt="" loading="lazy" />
            <div className="cb-txt"><span className="k">{H.changesKicker}</span><b>{H.changesTitle}</b><p>{H.changesText}</p></div>
            <ol className="cb-steps"><li>Pick a design</li><li>Tell the designer</li><li>Approve the proof</li></ol>
            <Link className="btn btn-wine" to="/changes">How it works</Link>
          </div>
        </section>
      )}

      {on("signup") && <Signup />}
    </div>
  );
}
