import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StorefrontSprite, Ico } from "@/components/storefront/icons";

export const Route = createFileRoute("/changes")({
  head: () => ({ meta: [{ title: "Changes & custom work | Artisan Murals" }, { name: "description", content: "Love a design but want one thing changed? Chat with the artist, approve a proof, then we print it for your wall." }] }),
  component: Changes,
});

function Changes() {
  const [pos, setPos] = useState(50);
  return (
    <div className="am">
      <StorefrontSprite />
      <div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><b>Changes &amp; custom work</b></nav></div>
      <section className="sec pg top-sec chg-page" id="custom">
        <div className="cz">
          <div className="cz-left">
            <div className="cz-head">
              <div><span className="k">Made-to-order changes</span><h2>Love it, but want <span>one thing changed?</span></h2>
                <p>Every design comes from a real artist. Tell them what to change and they adjust it for your wall before it's printed.</p></div>
              <ul className="cz-promise">
                <li><Ico id="i-heart" /><b>Free to ask</b><small>No payment until you approve a price</small></li>
                <li><Ico id="i-spark" /><b>Proof before print</b><small>You see the change first</small></li>
                <li><Ico id="i-brush" /><b>Replies in about an hour</b><small>Chat directly with the designer</small></li>
              </ul>
            </div>
            <div className="ba" style={{ ["--pos" as any]: `${pos}%` }}>
              <img src="/p/img/forest-before.webp" alt="Forest mural with a large dark tree in the middle" loading="lazy" />
              <img className="after" src="/p/img/forest-after.webp" alt="The same mural with the tree removed by the designer" loading="lazy" />
              <span className="tg l">Before</span><span className="tg r">After · tree removed</span>
              <span className="rule" /><span className="knob"><Ico id="i-lr" /></span>
              <label htmlFor="bar" className="sr">Drag to compare before and after</label>
              <input id="bar" type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} />
            </div>
          </div>
          <div className="cz-side chatdemo" aria-label="Example chat with a designer">
            <header className="ct-head cd-head"><span className="av" style={{ background: "#9C7A45" }}>TR</span><div><b>Tomás Reyes</b><small>Usually replies within an hour</small></div></header>
            <div className="cd-msgs">
              <div className="msg me"><div className="bub">Hi! I love this forest mural, but could you take out the big dark tree in the middle? I want it lighter.</div><time>10:02</time></div>
              <div className="msg me"><div className="bub card"><img src="/p/img/forest-before.webp" alt="The original" /><span className="cbody"><b>The tree I mean</b><small>Original · my 14 × 9 ft wall</small></span></div><time>10:02</time></div>
              <div className="msg"><div className="bub">Of course! Here's a proof with the tree removed:</div><time>10:09</time></div>
              <div className="msg"><div className="bub card"><img src="/p/img/forest-after.webp" alt="Proof: the mural with the tree removed" /><span className="cbody"><b>Proof 1 · tree removed</b><small>Sized for your 14 × 9 ft wall</small></span></div><time>10:31</time></div>
              <div className="msg"><div className="offer"><span className="ot">Price offer</span><span className="op">$60.00</span><p>Ready in 2 days.</p><div className="ob"><span className="btn btn-wine btn-sm">✓ Approved</span></div></div><time>10:34</time></div>
            </div>
            <Link className="btn btn-wine cd-cta" to="/custom-request">Post a request</Link>
          </div>
        </div>
        <ol className="steps">
          <li><b>Pick a design</b><span>Choose any mural or pattern and enter your wall size.</span></li>
          <li><b>Tell the designer</b><span>Write what to change, add a photo of your room if you like.</span></li>
          <li><b>Approve the proof</b><span>You get a preview of the changed design and a fixed price.</span></li>
          <li><b>We print &amp; ship</b><span>Numbered panels, cut to your wall, in 5 to 7 days.</span></li>
        </ol>
      </section>
      <section className="pg sec chg-more">
        <div className="cm-grid">
          <div><b>Remove or add</b><p>Take out a tree, an animal or a building, or add something that matters to you.</p></div>
          <div><b>New colors</b><p>Match your paint, your sofa or your brand. Any colorway of any design.</p></div>
          <div><b>Bigger walls</b><p>The designer extends the scene so it fills a wall wider than the original.</p></div>
          <div><b>Your own idea</b><p>Start from your logo, a photo or a painting and have it made from scratch.</p></div>
        </div>
        <div className="cm-cta"><Link className="btn btn-wine" to="/browse">Pick a design</Link><Link className="btn optline" to="/custom-request">Post a custom request</Link></div>
      </section>
    </div>
  );
}
