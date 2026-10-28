import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { plainError } from "@/lib/original-source";
import { AuthHeading, AuthInput, AuthButton, AuthNotice, AuthDivider } from "@/components/designer-auth-shell";

export function AuthPanel({ designer = false }: { designer?: boolean } = {}) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const { data, error } = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname + window.location.search } }) : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (signup && !data.session) setNotice("Check your email to confirm your account, then sign in here.");
    } catch (error) { setNotice(plainError(error, "Could not sign in.")); }
    finally { setBusy(false); }
  }
  async function forgot() {
    if (!email) { setNotice("Type your email first, then click Forgot password."); return; }
    setBusy(true); setNotice("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) throw error;
      setNotice("Check your email — we sent you a link to set a new password.");
    } catch (error) { setNotice(plainError(error, "Could not send the reset email.")); }
    finally { setBusy(false); }
  }
  const isErr = /could not|invalid|wrong|incorrect|failed|error|not /i.test(notice) && !/check your email/i.test(notice);
  return <div className={designer ? "w-full" : "mx-auto w-full max-w-sm py-5"}>
    {designer
      ? <AuthHeading eyebrow="For designers" title={signup ? "Create your account" : "Designer sign in"} sub="Your designs, collections and customer projects in one place." />
      : <div className="mb-6"><h3 className="text-xl font-semibold">{signup ? "Create your account" : "Welcome back"}</h3><p className="mt-2 text-sm text-muted-foreground">Keep your wall ideas and designer conversations together.</p></div>}
    <form onSubmit={submit} className="space-y-4">
      <AuthInput label="Email" name="email" required type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      <AuthInput label="Password" name="password" required minLength={8} type="password" autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} />
      {!signup && <div className="-mt-1 text-right"><button type="button" className="text-sm font-medium text-clay underline-offset-4 hover:underline disabled:opacity-60" disabled={busy} onClick={forgot}>Forgot password?</button></div>}
      <AuthNotice text={notice} tone={isErr ? "error" : "info"} />
      <AuthButton type="submit" busy={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</AuthButton>
    </form>
    <AuthDivider />
    <p className="text-center text-[15px] text-muted-foreground">{signup ? "Already have an account? " : "New here? "}<button type="button" className="font-semibold text-clay underline-offset-4 hover:underline" onClick={() => { setSignup(!signup); setNotice(""); }}>{signup ? "Sign in" : "Create an account"}</button></p>
  </div>;
}
