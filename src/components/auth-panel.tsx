import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { plainError } from "@/lib/original-source";

/** Sign in / sign up in the approved preview's form style. One form: it signs you in, and if there is no account
 *  for that email yet it creates one (as the preview says: "New here? The same form creates your account"). */
export function AuthPanel({ designer = false, kicker, title, sub, cta }: { designer?: boolean; kicker?: string; title?: string; sub?: string; cta?: string } = {}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; err: boolean } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setNotice({ text: "Please type your email.", err: true }); return; }
    if (password.length < 8) { setNotice({ text: "Your password needs at least 8 characters.", err: true }); return; }
    setBusy(true);
    try {
      const si = await supabase.auth.signInWithPassword({ email, password });
      if (!si.error) return;
      if (!/invalid|not found|credentials/i.test(si.error.message)) throw si.error;
      const su = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname + window.location.search } });
      if (su.error) { if (/already|registered|exists/i.test(su.error.message)) { setNotice({ text: "That password doesn't match this email. Try again, or tap Forgot password.", err: true }); return; } throw su.error; }
      if (!su.data.session) setNotice({ text: "Your account is made. Check your email to confirm it, then sign in here.", err: false });
    } catch (error) { setNotice({ text: plainError(error, "Could not sign in."), err: true }); }
    finally { setBusy(false); }
  }
  async function forgot() {
    if (!email) { setNotice({ text: "Type your email first, then tap Forgot password.", err: true }); return; }
    setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) throw error;
      setNotice({ text: "Check your email — we sent you a link to set a new password.", err: false });
    } catch (error) { setNotice({ text: plainError(error, "Could not send the reset email."), err: true }); }
    finally { setBusy(false); }
  }
  return (
    <div className="am am-auth">
      <div className="signin">
        {kicker !== "" && <span className="k">{kicker ?? (designer ? "For designers" : "Your account")}</span>}
        {title !== "" && <h1>{title ?? (designer ? "Sign in to your studio" : "Welcome to Artisan Murals")}</h1>}
        {sub !== "" && <p>{sub ?? (designer ? "Your designs, collections and customer requests in one place." : "Keep your walls, requests and designer conversations together.")}</p>}
        <form onSubmit={submit} noValidate>
          <label className="rqf"><span>Email</span><input type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="rqf"><span>Password</span><input type="password" name="password" autoComplete="current-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button type="button" className="auth-forgot" disabled={busy} onClick={forgot}>Forgot password?</button>
          <button className="btn btn-wine big" type="submit" disabled={busy}>{busy ? "Please wait…" : cta ?? "Sign in"}</button>
          {notice && <p className={"rq-ok" + (notice.err ? " err" : "")} role={notice.err ? "alert" : "status"}>{notice.text}</p>}
          <small>New here? The same form creates your account.</small>
        </form>
      </div>
    </div>
  );
}

/** A full page that only asks to sign in, in the new look. */
export function SignInPage(props: { designer?: boolean; kicker?: string; title?: string; sub?: string; cta?: string }) {
  return <div className="am"><section className="pg auth-page"><AuthPanel {...props} /></section></div>;
}
