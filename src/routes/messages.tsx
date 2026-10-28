import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/auth-panel";
import { GuestMessages } from "@/components/guest-messages";
import { Messenger } from "@/components/messenger";
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
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
    <div className="mb-4 flex items-center justify-between"><h1 className="text-3xl">Messages</h1><Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}><LogOut />Sign out</Button></div>
    <Messenger initialKey={c} urlMode="search" emptyText="No messages yet. Chats with designers and with Artisan Mural show up here." />
  </div>;
}
