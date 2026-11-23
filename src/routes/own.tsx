import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { materials, money, registerShop, unitPrice } from "@/lib/catalog";
import { ensureShop } from "@/lib/shop";
import { useSession } from "@/hooks/use-session";
import { AuthPanel } from "@/components/auth-panel";
import { attachFile, papi } from "@/components/projects";
import { StorefrontSprite } from "@/components/storefront/icons";

export const Route = createFileRoute("/own")({
  loader: ({ context }) => ensureShop(context.queryClient),
  head: () => ({ meta: [{ title: "Your own image as wallpaper | Artisan Murals" }, { name: "description", content: "Upload a photo or painting you own, size it to your wall, check the sharpness and get it printed as wallpaper." }] }),
  component: Own,
});

const PANEL_IN = 52;
const FAQ: [string, string][] = [
  ["Can I use any picture?", "Yes, as long as you own it or have permission to print it: your own photos, your own art, or images you have a licence for."],
  ["My picture is too small. What now?", "Send it to a designer with the button above. They can upscale it with care, redraw details and extend the edges to fit a wider wall, then send you a proof and a price."],
  ["Can I see it before it is printed?", "Yes. You see what is printed on the wall preview, and the studio sends you a proof to approve before anything is printed."],
  ["Which paper should I choose?", "Canvas gives an artist’s-canvas weave and suits photos and paintings. Linen is a finer, softer weave. Grasscloth has a pronounced natural weave. Suede has a soft, embossed grain."],
  ["What if my wall has a window or door?", "Enter the full wall size. The panels go over openings and you trim them on the wall, like any wallpaper."],
];
const driveId = (l: string) => (l.match(/\/d\/([\w-]{10,})/) || l.match(/[?&]id=([\w-]{10,})/))?.[1];

function Own() {
  const shop = Route.useLoaderData();
  registerShop(shop);
  const { session } = useSession();
  const navigate = useNavigate();
  const [src, setSrc] = useState(""); const [name, setName] = useState(""); const [px, setPx] = useState<[number, number]>([0, 0]);
  const [file, setFile] = useState<File | null>(null); const [drive, setDrive] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [w, setW] = useState(12), [h, setH] = useState(9);
  const [zoom, setZoom] = useState(1); const [pos, setPos] = useState<[number, number]>([50, 50]);
  const [mat, setMat] = useState(materials[0]?.id ?? "canvas");
  const [rights, setRights] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState<"" | "print" | "designer">("");
  const wallRef = useRef<HTMLDivElement>(null); const drag = useRef<{ x: number; y: number; p: [number, number] } | null>(null);
  const m = materials.find((x) => x.id === mat) ?? materials[0];
  const rate = unitPrice(undefined, m);
  const sqft = w * h;
  // the picture covers the wall; zoom makes it bigger than the wall
  const ar = px[0] && px[1] ? px[0] / px[1] : 1.5, wallAr = w / h;
  const coverW = (ar >= wallAr ? h * ar : w) * zoom; // printed picture width in ft
  const dpi = px[0] ? Math.round(px[0] / (coverW * 12)) : 0;
  const dpiWord = !dpi ? "–" : dpi >= 60 ? `${dpi} DPI · Sharp up close` : dpi >= 35 ? `${dpi} DPI · Sharp from a few steps` : `${dpi} DPI · Too small for this wall`;
  const panels = Math.ceil((w * 12) / (PANEL_IN - 3));

  const load = (url: string, nm: string) => { const i = new Image(); i.onload = () => { setPx([i.naturalWidth, i.naturalHeight]); setSrc(url); setName(nm); setZoom(1); setPos([50, 50]); setErr(""); }; i.onerror = () => setErr("We couldn't open that picture. Try a JPG or PNG, or check the Drive link is shared."); i.src = url; };
  const onFile = (f?: File) => { if (!f) return; setFile(f); setDrive(""); load(URL.createObjectURL(f), f.name); };
  const onDrive = () => { const id = driveId(driveLink.trim()); if (!id) { setErr("That isn't a Google Drive file link. It should look like drive.google.com/file/d/…"); return; } setDrive(id); setFile(null); load(`https://drive.google.com/thumbnail?id=${id}&sz=w2400`, "Google Drive picture"); };
  useEffect(() => { const up = () => { drag.current = null; }; addEventListener("pointerup", up); return () => removeEventListener("pointerup", up); }, []);

  async function send(kind: "print" | "designer") {
    setErr("");
    if (!src) { setErr("Upload your picture first."); return; }
    if (kind === "print" && !rights) { setErr("Please confirm you own the image or have permission to print it."); return; }
    if (!session) { setAsk(kind); return; }
    setBusy(true);
    try {
      const atts = file ? [await attachFile(file)] : [];
      const brief = kind === "print"
        ? `Print my own image as wallpaper.\nWall: ${w} × ${h} ft (${sqft} sq ft), ${panels} panels.\nPaper: ${m?.name} (${money(rate)} / sq ft, about ${money(sqft * rate)}).\nPlacement: zoom ${Math.round(zoom * 100)}%, center ${Math.round(pos[0])}% / ${Math.round(pos[1])}%.\nMeasured sharpness: ${dpiWord}.${drive ? `\nGoogle Drive file: https://drive.google.com/file/d/${drive}/view` : ""}\nPlease check the file and send a proof and price.`
        : `Please work on my picture for my wall: upscale, extend or touch it up as needed.\nWall: ${w} × ${h} ft. Paper: ${m?.name}.\nMeasured sharpness now: ${dpiWord}.${drive ? `\nGoogle Drive file: https://drive.google.com/file/d/${drive}/view` : ""}`;
      const r = await papi("projects/create", { kind: "custom", designerSlug: "open", title: kind === "print" ? "Print my own image" : "Upscale / fix my own image", brief, room: "", wallSize: `${w} x ${h} ft`, attachments: atts });
      void navigate({ to: "/projects/$id", params: { id: r.id } });
    } catch (x: any) { setErr(x.message || "That didn't go through. Please try again."); }
    setBusy(false);
  }

  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Your own image</b></nav></div>
      <section className="pg own">
        <div className="own-head">
          <div><span className="k">Do it yourself</span><h1>Your photo, <span>as wallpaper.</span></h1><p>Upload any picture you own: a family photo, a painting, a landscape you love. Size it to your wall, place it, and we print it. No designer needed.</p></div>
          <ol className="own-flow"><li className="on">Upload</li><li className={src ? "on" : ""}>Size &amp; place</li><li className={src ? "on" : ""}>Paper</li><li>Order</li></ol>
        </div>
        {!src ? (
          <label className="own-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="od-ic" aria-hidden="true">+</span>
            <b>Upload your image</b>
            <small>JPG, PNG or WEBP. The bigger the file, the sharper the print: we check it for you.</small>
            <span className="od-drive" onClick={(e) => e.preventDefault()}><span className="od-sep">or paste a Google Drive link</span><span className="od-drow"><input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/file/d/…" aria-label="Google Drive link to your picture" /><button type="button" className="btn btn-wine btn-sm" onClick={onDrive}>Use link</button></span></span>
          </label>
        ) : (
          <div className="own-work">
            <div className="own-stage">
              <div className="own-wall" ref={wallRef} aria-label="Your wall. Drag to move your image." style={{ aspectRatio: `${w} / ${h}`, touchAction: "none" }}
                onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, p: pos }; }}
                onPointerMove={(e) => { const d = drag.current, r = wallRef.current?.getBoundingClientRect(); if (!d || !r) return; setPos([Math.min(100, Math.max(0, d.p[0] - ((e.clientX - d.x) / r.width) * 100 / Math.max(0.2, zoom - 0.6))), Math.min(100, Math.max(0, d.p[1] - ((e.clientY - d.y) / r.height) * 100 / Math.max(0.2, zoom - 0.6)))]); }}>
                <div className="own-art" style={{ backgroundImage: `url(${src})`, backgroundSize: `${(coverW / w) * 100}% auto`, backgroundPosition: `${pos[0]}% ${pos[1]}%`, backgroundRepeat: "no-repeat" }} />
                <div className="own-guides">{Array.from({ length: panels - 1 }, (_, k) => <i key={k} style={{ left: `${((k + 1) * (PANEL_IN - 3)) / (w * 12) * 100}%` }} />)}</div>
                <span className="own-dim w">{w} ft</span><span className="own-dim h">{h} ft</span>
                <span className="own-hint">Drag to move</span>
              </div>
              <div className="own-zoom"><button type="button" className="zb" aria-label="Smaller" onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}>−</button><input type="range" min={100} max={300} value={Math.round(zoom * 100)} onChange={(e) => setZoom(+e.target.value / 100)} aria-label="Image size on the wall" /><button type="button" className="zb" aria-label="Bigger" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}>+</button></div>
              <div className="own-under"><span>{panels} panels, {PANEL_IN} in wide, 3 in overlap</span><span className="own-acts"><button type="button" className="up-link" onClick={() => { setSrc(""); setFile(null); setDrive(""); }}>Use another picture</button></span></div>
            </div>
            <aside className="own-panel">
              <div className="own-file"><img src={src} alt="" /><div><b>{name}</b><small>{px[0] ? `${px[0].toLocaleString()} × ${px[1].toLocaleString()} px${drive ? " · preview size" : ""}` : ""}</small></div></div>
              <div className="blk"><h3 className="bh"><span>1</span>Your wall</h3>
                <div className="sz-inputs">
                  <label className="fld"><span>Width</span><span className="iv"><input type="number" min={2} max={60} step={0.5} value={w} onChange={(e) => setW(Math.max(2, Math.min(60, +e.target.value || 2)))} inputMode="decimal" /><em>ft</em></span></label>
                  <span className="x" aria-hidden="true">×</span>
                  <label className="fld"><span>Height</span><span className="iv"><input type="number" min={2} max={20} step={0.5} value={h} onChange={(e) => setH(Math.max(2, Math.min(20, +e.target.value || 2)))} inputMode="decimal" /><em>ft</em></span></label>
                </div></div>
              <div className="blk"><h3 className="bh"><span>2</span>Print sharpness</h3>
                <div className="sharp"><div className="sharp-top"><span>Measured from your file</span><b>{dpiWord}</b></div><div className="meter own-meter"><i style={{ width: `${Math.min(100, (dpi / 80) * 100)}%`, background: dpi >= 60 ? "#4E7A4A" : dpi >= 35 ? "#C9A24D" : "#B03A2E" }} /><span style={{ left: "44%" }} /><span style={{ left: "75%" }} /></div></div>
                <p className="hint">{drive ? "Measured from Google's preview; the studio checks the full-size file." : dpi && dpi < 35 ? "Too small for this wall. Send it to a designer to upscale it, or choose a smaller wall." : "35 DPI is sharp from a few steps away, 60 DPI is sharp up close."}</p></div>
              <div className="blk"><h3 className="bh"><span>3</span>Paper</h3>
                <div className="chips papers" role="radiogroup" aria-label="Paper">{materials.map((x) => <button key={x.id} type="button" role="radio" aria-checked={x.id === mat} className={"chip" + (x.id === mat ? " on" : "")} onClick={() => setMat(x.id)}>{x.name}<small>{money(unitPrice(undefined, x))}</small></button>)}</div></div>
              <div className="sz-total"><div><b>{sqft} sq ft</b><small>{m?.name} · {money(rate)} / sq ft</small></div><strong>{money(sqft * rate)}</strong></div>
              <label className="co-check own-rights"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /><span>I own this image or have permission to print it.</span></label>
              <button type="button" className="btn btn-wine big" disabled={busy} onClick={() => send("print")}>{busy ? "Sending…" : "Get my proof & price"}</button>
              <p className="hint">The studio checks your file, sends a proof of exactly what will print, and the final price. You pay after you approve.</p>
              {err && <p className="up-err" role="alert">{err}</p>}
              {ask && !session && <div className="own-signin"><b>Sign in to send it</b><p className="hint">So we can send you the proof and the price.</p><AuthPanel /></div>}
            </aside>
          </div>
        )}
        {err && !src && <p className="up-err" role="alert">{err}</p>}
        <div className="own-pro">
          <div><b>Want it custom, bigger or sharper?</b><p>A designer can upscale a small photo, extend it to a bigger wall, change colors, remove things or redraw it as artwork. You get a price first and approve a proof before printing.</p></div>
          <button type="button" className="btn btn-wine" onClick={() => (src ? send("designer") : void navigate({ to: "/custom-request" }))}>Send this picture to a designer</button>
        </div>
        <div className="own-info">
          <section className="oi-how"><span className="k">How it works</span><h2>From your photo to your wall</h2>
            <ol className="oi-steps">
              <li><b>Upload</b><span>From your computer, phone or a Google Drive link. We keep the full-size original.</span></li>
              <li><b>Size &amp; place</b><span>Enter your wall, drag and zoom to choose what fills it.</span></li>
              <li><b>We check it</b><span>Sharpness is measured for your wall size. Before printing, the studio checks the file too.</span></li>
              <li><b>Printed &amp; shipped</b><span>Numbered panels with 3 in overlap, cut to your wall, in 5–7 business days.</span></li>
            </ol></section>
          <section className="oi-ways"><span className="k">Three ways to go</span><h2>Print it, perfect it, or pick ours</h2>
            <div className="oi-cards">
              <div className="oi-card"><span className="oi-n">1</span><b>Print it as it is</b><p>Your file is sharp enough for your wall? Upload it above and get your proof. No designer, no waiting.</p><button type="button" className="oi-go" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>Upload a picture</button></div>
              <div className="oi-card hi"><span className="oi-n">2</span><b>Have it upscaled or fixed</b><p>Picture too small, too short for a wide wall, or needs a touch-up? A designer can upscale it, extend the edges, remove things or change colors. You see a proof and a price first.</p><button type="button" className="oi-go" onClick={() => (src ? send("designer") : void navigate({ to: "/custom-request" }))}>Send it to a designer</button></div>
              <div className="oi-card"><span className="oi-n">3</span><b>Change one of our designs</b><p>Found a design you almost love? Our artists adjust their own work: colors, size, what's in it.</p><Link to="/changes" className="oi-go">How changes work</Link></div>
            </div></section>
          <section className="oi-quality">
            <div><span className="k">Getting a good print</span><h2>How big should my picture be?</h2>
              <p>Wall murals are seen from a few steps back, so they don't need as many pixels as a printed photo. Use the original file from your camera, not one sent through a chat app, which shrinks it.</p>
              <ul className="oi-tips"><li><b>Use the original file:</b> straight from the camera or phone gallery, not a screenshot.</li><li><b>Avoid heavy filters</b> and very dark photos: printed walls look a little darker than screens.</li><li><b>Leave room at the edges:</b> 1 in on each side is trimmed when hanging.</li><li><b>Not sure?</b> Upload it: the sharpness meter tells you right away, for your exact wall.</li></ul></div>
            <div className="oi-table"><table><thead><tr><th>Wall width</th><th>Good</th><th>Best</th></tr></thead><tbody>{[["8 ft", "3,400", "5,800"], ["10 ft", "4,200", "7,200"], ["12 ft", "5,000", "8,600"], ["14 ft", "5,900", "10,100"], ["16 ft", "6,700", "11,500"], ["20 ft", "8,400", "14,400"]].map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b} px</td><td>{c} px</td></tr>)}</tbody></table>
              <small>Image width in pixels. Good = 35 DPI (sharp from a few steps), best = 60 DPI (sharp up close).</small></div>
          </section>
          <section className="oi-faq"><h2>Questions</h2><div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
          <section className="oi-contact"><div><b>Need a hand?</b><p>Not sure your picture will work, or want advice on size and paper? We're happy to look at it first.</p></div>
            <div className="oi-c-btns"><Link className="btn btn-wine" to="/custom-request">Chat with a designer</Link><Link className="btn optline" to="/messages">Message the studio</Link></div></section>
        </div>
      </section>
    </div>
  );
}
