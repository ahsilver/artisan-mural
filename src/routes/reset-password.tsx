import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { plainError } from "@/lib/original-source";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | Artisan Murals" },
      { name: "description", content: "Choose a new password for your Artisan Murals account." },
      { property: "og:title", content: "Set a new password | Artisan Murals" },
      { property: "og:description", content: "Choose a new password for your Artisan Murals account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Recovery links arrive with type=recovery in the URL hash; the client
    // exchanges it for a session and fires PASSWORD_RECOVERY.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") setReady(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setNotice("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice("Password updated — taking you to your account…");
      setTimeout(() => navigate({ to: "/account" }), 1200);
    } catch (error) {
      setNotice(plainError(error, "Could not update the password."));
    } finally { setBusy(false); }
  }

  return (
    <div className="am"><section className="pg auth-page"><div className="signin">
      <span className="k">Your account</span><h1>Set a new password</h1>
      {ready ? (
        <form onSubmit={submit}>
          <p>Choose a new password for your Artisan Murals account.</p>
          <label className="rqf"><span>New password</span><input name="password" required minLength={8} type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn btn-wine big" type="submit" disabled={busy}>{busy ? "Please wait…" : "Save new password"}</button>
          {notice && <p className={"rq-ok" + (/updated/i.test(notice) ? "" : " err")} role="status">{notice}</p>}
        </form>
      ) : (
        <>
          <p>This page opens from the password-reset link we email you. If you landed here directly, ask for a fresh link: tap Forgot password on the sign-in page.</p>
          <Link className="btn optline" to="/account">Back to sign in</Link>
        </>
      )}
    </div></section></div>
  );
}
