import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { AuthPanel } from "@/components/auth-panel";

export const Route = createFileRoute("/designer-login")({
  head: () => ({ meta: [{ title: "Designer sign in — Artisan Murals" }, { name: "description", content: "Sign in to your Artisan Murals designer studio to manage designs, collections and customer requests." }, { name: "robots", content: "noindex" }] }),
  component: DesignerLogin,
});

/** Designer sign-in in the new form style; signed-in designers go straight to their studio. */
function DesignerLogin() {
  const { session, loading } = useSession();
  return <div className="am"><section className="pg auth-page">
    {loading ? <p className="hint">Loading…</p>
      : session ? <div className="sa-done" style={{ maxWidth: 460, margin: "0 auto" }}><span className="k">For designers</span><b>You're signed in</b><p>Pick up where you left off.</p><Link className="btn btn-wine btn-sm" to="/studio">Open my studio</Link></div>
      : <><AuthPanel designer /><p className="hint" style={{ textAlign: "center", marginTop: 14 }}>Want to sell your designs? <Link to="/sell">See how it works</Link> or <Link to="/become-designer">apply here</Link>.</p></>}
  </section></div>;
}
