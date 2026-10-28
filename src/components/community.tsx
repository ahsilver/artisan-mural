import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuthPanel } from "@/components/auth-panel";
import { useSession } from "@/hooks/use-session";
import { backend, useCommunity } from "@/lib/community";
import { designRating } from "@/lib/catalog";

export function Stars({ value, size = "h-3.5 w-3.5", onChange }: { value: number; size?: string; onChange?: (n: number) => void }) {
  if (onChange) return <span className="inline-flex gap-1" role="radiogroup" aria-label="Your rating">
    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="p-0.5"><Star className={`h-6 w-6 ${n <= value ? "fill-clay text-clay" : "text-border"}`} /></button>)}
  </span>;
  return <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-clay text-clay" : "text-border"}`} />)}</span>;
}

/** "4.8 (12)" with one star; nothing when there are no reviews. */
export function RatingInline({ rating, count, className = "" }: { rating?: number; count?: number; className?: string }) {
  if (!count) return null;
  return <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`} data-testid="rating-inline"><Star className="h-3 w-3 fill-clay text-clay" />{rating?.toFixed(1)} <span>({count})</span></span>;
}

type R = { id: string; name: string; rating: number; body: string; reply?: string | null; at: string; mine: boolean };
/** Reviews for a design or a designer. Only verified buyers can write one. */
export function Reviews({ kind, target, title }: { kind: "design" | "designer"; target: string; title: string }) {
  const { session } = useSession();
  const [d, setD] = useState<any>(null);
  const [rating, setRating] = useState(0); const [body, setBody] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [auth, setAuth] = useState(false); const [open, setOpen] = useState(false);
  const load = useCallback(() => backend(`community/reviews?kind=${kind}&target=${encodeURIComponent(target)}`).then(setD).catch(() => setD({ reviews: [], count: 0 })), [kind, target]);
  useEffect(() => { void load(); }, [load, session?.user?.id]);
  useEffect(() => { const m = d?.me?.mine; if (m) { setRating(m.rating); setBody(m.body || ""); setName(m.reviewer_name || ""); } }, [d?.me?.mine?.id]);
  if (d && d.enabled === false) return null;
  const save = async () => {
    setBusy(true); setMsg("");
    try { await backend("community/reviews", { kind, target, rating, body, name }); setOpen(false); setMsg("Thank you. Your review is up."); await load(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { await backend("community/reviews/delete", { id }).catch(() => {}); setRating(0); setBody(""); await load(); };
  const reviews: R[] = d?.reviews ?? [];
  const me = d?.me;
  return (
    <section id="reviews" className="mt-14 scroll-mt-24" data-testid={`reviews-${kind}`} aria-label="Reviews">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-2xl">Reviews</h2>
        {d && (d.count ? <span className="flex items-center gap-2 text-sm"><Stars value={d.avg} /> <span>{Number(d.avg).toFixed(1)}</span><span className="text-muted-foreground">· {d.count} review{d.count === 1 ? "" : "s"}</span></span> : <span className="text-sm text-muted-foreground">No reviews yet</span>)}
      </div>
      {!d ? <Loader2 className="mt-6 h-4 w-4 animate-spin text-muted-foreground" /> : <>
        {reviews.length === 0 && <p className="mt-5 text-sm text-muted-foreground">{kind === "design" ? `Ordered ${title}? Your review helps the next person choose.` : `Worked with ${title}? Your review helps other customers.`}</p>}
        <ul className="divide-y divide-border">
          {reviews.map((r) => <li key={r.id} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium">{r.name} <span className="text-[11px] font-normal text-muted-foreground">Verified {kind === "design" ? "buyer" : "client"}</span></span><Stars value={r.rating} /></div>
            {r.body && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
            {r.reply && <p className="mt-3 max-w-2xl border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Reply from Artisan Mural: </span>{r.reply}</p>}
            <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground"><span>{new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>{r.mine && <button type="button" className="underline" onClick={() => remove(r.id)}>Delete my review</button>}</div>
          </li>)}
        </ul>
        <div className="mt-4">
          {!session ? (auth ? <div className="max-w-sm"><AuthPanel /></div> : <button type="button" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setAuth(true)}>{kind === "design" ? "Bought this design? Sign in to review it" : "Worked with this designer? Sign in to review"}</button>)
            : me?.eligible ? (open ? <div className="max-w-xl space-y-3 rounded-sm border border-border bg-card p-4" data-testid="review-form">
                <Stars value={rating} onChange={setRating} />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name to show (e.g. Anna K.)" aria-label="Name to show" maxLength={60} />
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "design" ? "How does it look on your wall?" : "How was working together?"} aria-label="Your review" rows={3} maxLength={2000} />
                <div className="flex items-center gap-2"><Button size="sm" onClick={save} disabled={busy || !rating || name.trim().length < 2}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{me.mine ? "Update review" : "Post review"}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
              </div> : <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{me.mine ? "Edit your review" : "Write a review"}</Button>)
            : <p className="text-xs text-muted-foreground">{me?.reason || ""}</p>}
          {msg && <p className="mt-2 text-xs text-muted-foreground" role="status">{msg}</p>}
        </div>
      </>}
    </section>
  );
}

/** Contact button + small message form. Guests give name + email; the message lands in the designer's portal inbox. */
export function ContactDesigner({ slug, name, designSlug, className = "", label }: { slug: string; name: string; designSlug?: string; className?: string; label?: string }) {
  const { session } = useSession(); const cs = useCommunity();
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [nm, setNm] = useState(""); const [em, setEm] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  if (cs.contactEnabled === false) return null;
  const send = async () => {
    setBusy(true); setErr("");
    try { await backend("community/contact", { designerSlug: slug, designSlug, body: text, name: nm, email: em }); setDone(true); setText(""); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const first = name.split(" ")[0];
  return <>
    <Button type="button" className={className} onClick={() => { setOpen(true); setDone(false); }} data-testid="contact-designer">{label ?? `Contact ${first}`}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Message {name}</DialogTitle><DialogDescription>Ask a question or describe what you have in mind. {first} answers here on Artisan Mural.</DialogDescription></DialogHeader>
        {done ? <div className="space-y-3 text-sm" role="status" data-testid="contact-sent"><p>Sent. {first} will reply in your messages{session ? "" : " and we will email you"}.</p>{session ? <Link to="/account" search={{ tab: "messages" } as any} className="underline underline-offset-4">Open my messages</Link> : null}<div><Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button></div></div>
          : <div className="space-y-3">
            {!session && <div className="grid gap-3 sm:grid-cols-2"><Input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Your name" aria-label="Your name" autoComplete="name" /><Input type="email" value={em} onChange={(e) => setEm(e.target.value)} placeholder="Email" aria-label="Your email" autoComplete="email" /></div>}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={designSlug ? "What would you like changed? Colors, scale, moving an element..." : "Hi, I'm looking for..."} aria-label="Message" maxLength={3000} />
            <p className="text-[11px] leading-relaxed text-muted-foreground">Keep contact details out of the message; everything stays on Artisan Mural.</p>
            {err && <p className="text-xs text-destructive" role="alert">{err}</p>}
            <Button onClick={send} disabled={busy || text.trim().length < 10 || (!session && (nm.trim().length < 2 || !em.includes("@")))} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Send message</Button>
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}

/** A tile-sized card that sits in the design grid. */
export function PromoCard({ title, text, cta }: { title: string; text: string; cta: string }) {
  return <Link to="/custom-request" className="group flex min-w-0 flex-col rounded-lg border border-border bg-card p-2.5 shadow-paper transition-shadow duration-300 hover:shadow-lift sm:p-3" data-testid="grid-promo">
    <div className="relative flex aspect-4/5 flex-col justify-end overflow-hidden rounded-sm bg-secondary/70 p-3.5 sm:p-6">
      <span aria-hidden className="absolute right-5 top-5 hidden h-14 w-14 rounded-full border border-foreground/15 sm:block" />
      <span aria-hidden className="absolute right-11 top-11 hidden h-14 w-14 rounded-full border border-foreground/10 sm:block" />
      <p className="text-eyebrow text-clay">Custom</p>
      <p className="mt-2 font-display text-[1.35rem] leading-tight sm:text-2xl">{title}</p>
      <p className="mt-2 hidden text-sm leading-relaxed text-muted-foreground sm:block">{text}</p>
      <span className="mt-3 text-[11px] sm:mt-4 font-medium tracking-widest uppercase underline-offset-4 group-hover:underline">{cta} &rarr;</span>
    </div>
    <div className="mt-3"><p className="font-display text-lg leading-tight">Made for your wall</p><p className="text-sm text-muted-foreground">Our designers</p></div>
  </Link>;
}

export function Avatar({ name, initials, photo, size = "h-12 w-12 text-lg" }: { name: string; initials: string; photo?: string; size?: string }) {
  return photo ? <img src={photo} alt={name} className={`${size} shrink-0 rounded-full object-cover`} loading="lazy" />
    : <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-olive font-display text-olive-foreground`}>{initials}</span>;
}

/** A design's rating, drawn only in the browser (server and browser can hold different rating snapshots). */
export function DesignRating({ slug, fetchIfMissing = false, link = false, className = "" }: { slug: string; fetchIfMissing?: boolean; link?: boolean; className?: string }) {
  const [r, setR] = useState<{ rating: number; reviews: number } | null>(null);
  useEffect(() => {
    const x = designRating(slug); if (x) { setR(x); return; }
    if (fetchIfMissing) backend(`community/reviews?kind=design&target=${encodeURIComponent(slug)}`).then((j: any) => { if (j.count) setR({ rating: j.avg, reviews: j.count }); }).catch(() => {});
  }, [slug, fetchIfMissing]);
  if (!r) return null;
  const el = <RatingInline rating={r.rating} count={r.reviews} className={className} />;
  return link ? <a href="#reviews" className="hover:underline">{el}</a> : el;
}
