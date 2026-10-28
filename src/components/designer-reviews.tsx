import { useCallback, useEffect, useState } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { AuthPanel } from "@/components/auth-panel";

type Review = { id: string; user_id: string; reviewer_name: string; rating: number; body: string; created_at: string };

function Stars({ value, onChange, size = "h-4 w-4" }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return <span className="inline-flex gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label={onChange ? "Your rating" : `${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => onChange
      ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)}><Star className={`h-7 w-7 ${n <= value ? "fill-primary text-primary" : "text-border"}`} /></button>
      : <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-primary text-primary" : "text-border"}`} />)}
  </span>;
}

/** Ratings and written reviews for one designer; any signed-in customer can leave one review and edit it. */
export function DesignerReviews({ designerSlug, designerName }: { designerSlug: string; designerName: string }) {
  const { session } = useSession();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAuth, setShowAuth] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("designer_reviews").select("id, user_id, reviewer_name, rating, body, created_at").eq("designer_slug", designerSlug).order("created_at", { ascending: false }).limit(100);
    setReviews(data ?? []);
  }, [designerSlug]);
  useEffect(() => { void load(); }, [load]);

  const uid = session?.user.id;
  const mine = reviews?.find((r) => r.user_id === uid);
  useEffect(() => { if (mine) { setRating(mine.rating); setBody(mine.body); setName(mine.reviewer_name); } }, [mine?.id]);
  useEffect(() => {
    if (!uid) { setIsAdmin(false); return; }
    setName((n) => n || (session?.user.user_metadata?.["full_name"] as string | undefined) || session?.user.email?.split("@")[0] || "");
    void supabase.rpc("has_role", { _user_id: uid, _role: "admin" }).then(({ data }) => setIsAdmin(data === true));
  }, [uid]);

  async function submit() {
    if (!uid || rating < 1) return;
    setBusy(true); setMsg("");
    const row = { designer_slug: designerSlug, user_id: uid, reviewer_name: name.trim().slice(0, 80) || "Customer", rating, body: body.trim().slice(0, 2000) };
    const { error } = mine ? await supabase.from("designer_reviews").update(row).eq("id", mine.id) : await supabase.from("designer_reviews").insert(row);
    setBusy(false);
    if (error) { setMsg("Could not save your review. Please try again."); return; }
    setMsg("Thank you — your review is posted."); void load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this review?")) return;
    await supabase.from("designer_reviews").delete().eq("id", id); void load();
  }

  const avg = reviews && reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;

  return (
    <section aria-label="Reviews" className="mt-12 border-t border-border pt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl">Reviews</h2>
        {reviews && reviews.length > 0 && <span className="flex items-center gap-2 text-sm"><Stars value={avg} /> {avg.toFixed(1)} · {reviews.length} review{reviews.length > 1 ? "s" : ""}</span>}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">{mine ? "Your review" : `Rate ${designerName}`}</p>
        {!uid ? (showAuth ? <div className="mt-4"><AuthPanel /></div> : <Button className="mt-3" variant="outline" onClick={() => setShowAuth(true)}>Sign in to leave a review</Button>) : <div className="mt-3 space-y-3">
          <Stars value={rating} onChange={setRating} />
          <input aria-label="Name shown with your review" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} className="h-11 w-full rounded-md border border-input bg-background px-3 sm:max-w-xs" />
          <textarea aria-label="Your review" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="How was working with this designer?" className="w-full rounded-md border border-input bg-background p-3" />
          <Button disabled={busy || rating < 1} onClick={() => void submit()}>{busy && <Loader2 className="animate-spin" />}{mine ? "Update review" : "Post review"}</Button>
          {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
        </div>}
      </div>

      {!reviews ? <Loader2 className="mt-6 animate-spin" /> : reviews.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">No reviews yet — be the first.</p> : <ul className="mt-6 space-y-4">
        {reviews.map((r) => <li key={r.id} className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium">{r.reviewer_name} <Stars value={r.rating} size="h-3.5 w-3.5" /></span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}{(isAdmin || r.user_id === uid) && <Button size="icon" variant="ghost" aria-label="Delete review" className="h-8 w-8" onClick={() => void remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}</span></div>
          {r.body && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
        </li>)}
      </ul>}
    </section>
  );
}
