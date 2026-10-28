import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { plainError } from "@/lib/original-source";
import { DesignerAuthShell, AuthHeading, AuthInput, AuthButton, AuthNotice } from "@/components/designer-auth-shell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password | Artisan Mural" },
      { name: "description", content: "Choose a new password for your Artisan Mural account." },
      { property: "og:title", content: "Set a new password | Artisan Mural" },
      { property: "og:description", content: "Choose a new password for your Artisan Mural account." },
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
    <DesignerAuthShell eyebrow="Artisan Mural" title="Beautiful walls, made for you." benefits={false}>
      <AuthHeading eyebrow="Your account" title="Set a new password" sub={ready ? "Choose a new password for your Artisan Mural account." : undefined} />
      {ready ? (
        <form onSubmit={submit} className="space-y-4">
          <AuthInput label="New password" name="password" required minLength={8} type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <AuthNotice text={notice} tone={/updated/i.test(notice) ? "ok" : "error"} />
          <AuthButton type="submit" busy={busy}>{busy ? "Please wait…" : "Save new password"}</AuthButton>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            This page opens from the password-reset link we email you. If you landed here directly,
            request a fresh link from the sign-in page.
          </p>
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <Link to="/account">Back to sign in</Link>
          </Button>
          <p className="text-center text-sm"><Link to="/designer-login" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Designer? Sign in here</Link></p>
        </div>
      )}
    </DesignerAuthShell>
  );
}
