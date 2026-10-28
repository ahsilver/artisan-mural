import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { AuthPanel } from "@/components/auth-panel";
import { DesignerAuthShell, AuthHeading } from "@/components/designer-auth-shell";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/designer-login")({
  head: () => ({ meta: [{ title: "Designer sign in — Artisan Mural" }, { name: "description", content: "Sign in to your Artisan Mural designer studio to manage designs, collections and customer projects." }, { property: "og:title", content: "Designer sign in — Artisan Mural" }, { property: "og:description", content: "Your designs, collections and customer projects." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DesignerLogin,
});
function DesignerLogin() {
  const { session, loading } = useSession();
  return <DesignerAuthShell title="Welcome back to your studio">
    {loading ? <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
      : session ? <><AuthHeading eyebrow="For designers" title="You're signed in" sub="Pick up where you left off." /><Button asChild className="h-12 w-full rounded-xl"><Link to="/studio">Open your studio<ArrowRight /></Link></Button></>
      : <><AuthPanel designer /><p className="mt-3 text-center text-sm"><Link to="/dashboard" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Want to sell your designs? Start here</Link></p></>}
  </DesignerAuthShell>;
}
