import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthPanel } from "@/components/auth-panel";
import { GuestMessages } from "@/components/guest-messages";
import { StoreChat } from "@/components/storefront/chat";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/messages")({ validateSearch: z.object({ conversation: z.string().uuid().optional(), c: z.string().optional() }), head: () => ({ meta: [{ title: "Your designer conversations — Artisan Mural" }, { name: "description", content: "Discuss your wall, share photos and artwork selections, and agree a price with its original artist." }, { property: "og:title", content: "Designer conversations — Artisan Mural" }, { property: "og:description", content: "Your wall ideas, photos and designer messages in one place." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Messages });

function Messages() {
  const { session, loading } = useSession();
  const { conversation } = Route.useSearch();
  const [signIn, setSignIn] = useState(false);
  if (loading) return <p className="px-8 py-20 text-sm text-muted-foreground">Loading conversations…</p>;
  if (!session) return signIn ? <div className="mx-auto max-w-lg px-6 py-12"><AuthPanel /></div> : <GuestMessages activeId={conversation} onSignIn={() => setSignIn(true)} />;
  const c = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("c") : null;
  return <div className="am"><div className="pg crumbs-row"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">My account</a><span>/</span><b>Messages</b></nav></div><section className="pg msgs-page">
    <div className="pg-head msgs-head"><div><span className="k">Your conversations</span><h1>Messages</h1></div><button type="button" className="btn optline btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
    <div id="view-chat"><StoreChat initialKey={c} /></div>
  </section></div>;
}
