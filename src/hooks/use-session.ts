import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return { session, loading };
}