import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { designBySlug, liveDesigns, registerShop } from "@/lib/catalog";
import { roomLabels } from "@/lib/design-taxonomy";
import { pic } from "@/lib/pics";
import { findContactDetails } from "@/lib/contact-guard";
import { StorefrontSprite } from "@/components/storefront/icons";
import { ensureShop } from "@/lib/shop";
import { attachFile, papi, type Att } from "@/components/projects";

const searchSchema = z.object({ designer: z.string().max(60).optional(), design: z.string().max(60).optional(), selection: z.string().max(3000).optional() });

export const Route = createFileRoute("/custom-request")({
  validateSearch: searchSchema,
  loader: ({ context }) => ensureShop(context.queryClient),
  head: () => ({
    meta: [
      { title: "Request a custom wallpaper design — Artisan Mural" },
      { name: "description", content: "Your logo, a painting, a photo or an idea, made into wallpaper by an independent designer. Get a price and a date, then pay the design and the printing together." },
      { property: "og:title", content: "Request a custom wallpaper design — Artisan Mural" },
      { property: "og:description", content: "Describe your wall and get a price from wallpaper designers." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomRequest,
});

const STARTS: [string, string][] = [["My logo", "I'd like a mural made from my logo: "], ["A photo I took", "I have a photo I'd like as a mural: "], ["A painting", "Could you turn this painting into wallpaper: "], ["Just an idea", ""]];
const BUDGETS = ["Not sure yet", "Under $250", "$250 – $500", "$500 – $1,000", "Over $1,000"];

function CustomRequest() {
  const shop = Route.useLoaderData();
  registerShop(shop);
  const { designer, design } = Route.useSearch();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const d = design ? designBySlug(design) : null;
  const edit = !!(d && d.slug.startsWith("u-"));
  const designers = (shop.designers ?? []).filter((x: any) => !x.hidden);
  const [idea, setIdea] = useState("");
  const [w, setW] = useState(""), [h, setH] = useState("");
  const [room, setRoom] = useState("");
  const [budget, setBudget] = useState(BUDGETS[0]!);
  const [who, setWho] = useState<"all" | "pick">(designer ? "pick" : "all");
  const [picked, setPicked] = useState<string[]>(designer ? [designer] : []);
  const [atts, setAtts] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false), [upBusy, setUpBusy] = useState(false);
  const [err, setErr] = useState("");
  const warn = findContactDetails(`${idea} ${room}`);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (idea.trim().length < 10) { setErr("Tell the designers a little more about your idea (at least a sentence)."); return; }
    if (warn) { setErr(`Please remove ${warn}. Contact details can't be shared; everything stays on Artisan Murals.`); return; }
    if (who === "pick" && !picked.length) { setErr("Choose at least one designer, or send it to all designers."); return; }
    setBusy(true);
    try {
      const targets = who === "all" ? ["open"] : picked;
      let first = "";
      for (const t of targets) {
        const r = await papi("projects/create", { kind: edit ? "edit" : "custom", designSlug: edit ? d!.slug : undefined, designerSlug: t, title: idea.trim().slice(0, 80), brief: idea.trim(), room, wallSize: w && h ? `${w} x ${h} ft` : "", budget: budget === BUDGETS[0] ? "" : budget, basedOn: d && !edit ? d.slug : undefined, attachments: atts });
        first ||= r.id;
      }
      void navigate({ to: "/projects/$id", params: { id: first } });
    } catch (x: any) { setErr(x.message || "Your request could not be sent."); }
    setBusy(false);
  }
  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/designers">Designers</Link><span>/</span><b>Post a request</b></nav></div>
      <section className="pg rq">
        <div className="rq-hero">
          <div><span className="k">Custom design</span><h1>{edit ? <>Change <span>“{d!.title}”</span></> : <>Don't see it? <span>Have it made.</span></>}</h1>
            <p>Your logo, a photo, a painting or just an idea. Our designers make it to fit your wall, and you only pay once you approve a price.</p></div>
          <ol className="rq-flow"><li><b>Describe it</b></li><li><b>Get prices</b></li><li><b>Approve &amp; pay</b></li><li><b>We print</b></li></ol>
        </div>
        {loading ? <p className="hint">Loading…</p> : !session ? (
          <div className="rq-card rq-signin"><h2>Sign in to send your request</h2><p className="hint">So designers can answer you here and you get a notification when a price arrives.</p><AuthPanel kicker="" title="" sub="" /></div>
        ) : (
          <form className="rq-form" noValidate onSubmit={submit}>
            <div className="rq-card">
              <div className="blk">
                <h3 className="bh"><span>1</span>Your idea</h3>
                {!edit && <div className="rq-starts" role="group" aria-label="Start from">{STARTS.map(([l, t]) => <button key={l} type="button" onClick={() => setIdea((x) => (x.trim() ? x : t))}>{l}</button>)}</div>}
                {d && !edit && <p className="hint">Based on <b>{d.title}</b>. The designer starts from this design.</p>}
                <label className="rqf"><span className="sr">What would you like?</span><textarea rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="For example: a soft jungle mural for our son's room, with a lion and a few monkeys, in sage and cream. Leave space for the window on the left." /></label>
                <label className="drop"><input type="file" accept="image/*,application/pdf" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 10 - atts.length); e.target.value = ""; setUpBusy(true); try { for (const f of fs) { const a = await attachFile(f); setAtts((x) => [...x, a]); } } catch (x: any) { setErr(x.message); } setUpBusy(false); }} /><b>{upBusy ? "Uploading…" : "Add pictures"}</b><small>{atts.length ? `${atts.length} added` : "Your wall, your logo, or anything that inspires you · up to 10"}</small></label>
                {atts.length > 0 && <div className="rq-thumbs">{atts.map((a, i) => <span key={a.key}>{a.url && /\.(jpe?g|png|webp|gif)$/i.test(a.name) ? <img src={a.url} alt="" /> : <em>{a.name}</em>}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAtts((x) => x.filter((_, k) => k !== i))}>×</button></span>)}</div>}
              </div>
              <div className="blk">
                <h3 className="bh"><span>2</span>Your wall</h3>
                <div className="sz-inputs">
                  <label className="fld"><span>Width</span><span className="iv"><input type="number" min={2} max={60} step={0.5} placeholder="12" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /><em>ft</em></span></label>
                  <span className="x" aria-hidden="true">×</span>
                  <label className="fld"><span>Height</span><span className="iv"><input type="number" min={2} max={20} step={0.5} placeholder="9" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /><em>ft</em></span></label>
                </div>
                <label className="rqf"><span>Room</span><select value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Choose a room</option>{roomLabels.map((r) => <option key={r}>{r}</option>)}</select></label>
              </div>
              {who === "all" && (
                <div className="blk">
                  <h3 className="bh"><span>3</span>Budget for the design work</h3>
                  <div className="seg-chips" role="radiogroup" aria-label="Budget">{BUDGETS.map((b) => <button key={b} type="button" role="radio" aria-checked={budget === b} onClick={() => setBudget(b)}>{b}</button>)}</div>
                  <p className="hint">Printing is priced separately by your wall size.</p>
                </div>
              )}
            </div>
            <aside className="rq-side">
              <div className="blk rq-who-blk">
                <h3 className="bh"><span>{who === "all" ? 4 : 3}</span>Who gets your request?</h3>
                <div className="seg rq-who" role="radiogroup" aria-label="Who should see your request">
                  <button type="button" role="radio" aria-checked={who === "all"} onClick={() => setWho("all")}>All designers<small>Several prices, you pick one</small></button>
                  <button type="button" role="radio" aria-checked={who === "pick"} onClick={() => setWho("pick")}>Designers I choose<small>Tap to see their work</small></button>
                </div>
                {who === "pick" && (
                  <div className="rq-pick" role="list">
                    {designers.map((x: any) => { const on = picked.includes(x.slug); const work = liveDesigns(shop).find((dd) => dd.designer === x.slug); return (
                      <button key={x.slug} type="button" role="listitem" aria-pressed={on} className={"rq-des" + (on ? " on" : "")} onClick={() => setPicked((p) => (on ? p.filter((s) => s !== x.slug) : [...p, x.slug]))}>
                        {work && <img src={pic(work, work.mockups?.[0] ?? work.image, [320])?.src ?? work.image} alt="" />}<span><b>{x.name}</b><small>{x.tagline}</small></span><em>{on ? "✓ Chosen" : "Choose"}</em>
                      </button>
                    ); })}
                  </div>
                )}
              </div>
              <div className="rq-send">
                {(err || warn) && <p className="up-err" role="alert">{err || `This looks like ${warn}. Contact details can't be shared.`}</p>}
                <button className="btn btn-wine big" type="submit" disabled={busy}>{busy ? "Sending…" : who === "pick" && picked.length > 1 ? `Send to ${picked.length} designers` : "Send request"}</button>
                <small>No payment now. Each designer replies in a private chat with a price and days; you approve one.</small>
              </div>
            </aside>
          </form>
        )}
      </section>
    </div>
  );
}
