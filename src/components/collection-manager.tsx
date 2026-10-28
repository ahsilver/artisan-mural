import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { liveDesigns, designerBySlug } from "@/lib/catalog";
import { shopQuery } from "@/lib/shop";
import { deleteCollection, getMyCollections, saveCollection, type Collection } from "@/lib/collections.functions";
import { listArtworkUploads } from "@/lib/artwork-uploads.functions";
import { plainError } from "@/lib/original-source";

type Draft = { id?: string; designerSlug: string; title: string; description: string; designs: string[] };

/** Build and edit designer collections. Designers see their own; the owner sees all. */
export function CollectionManager() {
  const load = useServerFn(getMyCollections);
  const save = useServerFn(saveCollection);
  const remove = useServerFn(deleteCollection);
  const loadUploads = useServerFn(listArtworkUploads);
  const [uploads, setUploads] = useState<Awaited<ReturnType<typeof listArtworkUploads>>>([]);
  const qc = useQueryClient();
  const shop = useQuery(shopQuery);
  const [me, setMe] = useState<Awaited<ReturnType<typeof getMyCollections>> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => load().then(setMe).catch(e => { setMe(null); setError(plainError(e, "Could not load collections.")); });
  useEffect(() => { void refresh(); void loadUploads().then(setUploads).catch(() => setUploads([])); }, []);

  if (!me) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading collections…</p>;
  if (!me.isAdmin && !me.slug) return <p className="text-sm text-muted-foreground">Once you're an approved designer, you can group your designs into collections here.</p>;

  const all = [...liveDesigns(shop.data)];
  for (const u of uploads) if (!all.some(d => d.slug === `u-${u.id}`)) all.push({ slug: `u-${u.id}`, title: u.title, image: u.artwork_colorways[0]?.images[0] ?? "", designer: me.slug ?? "", kind: u.kind === "mural" ? "mural" : "repeating", room: u.made_for, categories: [], palette: "", orientation: "landscape", description: "", orders: 0 });
  const designerSlugs = [...new Set(all.map(d => d.designer))];
  const nameOf = (s: string) => shop.data?.designers.find(d => d.slug === s)?.name ?? designerBySlug(s)?.name ?? s;
  const pool = draft ? all.filter(d => d.designer === draft.designerSlug) : [];

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError("");
    try { await save({ data: draft }); setDraft(null); await refresh(); await qc.invalidateQueries({ queryKey: shopQuery.queryKey }); }
    catch (e) { setError(plainError(e, "Could not save.")); }
    finally { setBusy(false); }
  };

  return <div className="space-y-4">
    {!draft && <Button onClick={() => setDraft({ designerSlug: me.slug ?? designerSlugs[0] ?? "", title: "", description: "", designs: [] })}><Plus />Build a collection</Button>}
    {draft && <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {me.isAdmin && <label className="text-sm">Designer<select value={draft.designerSlug} onChange={e => setDraft({ ...draft, designerSlug: e.target.value, designs: [] })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3">{designerSlugs.map(s => <option key={s} value={s}>{nameOf(s)}</option>)}</select></label>}
        <label className="text-sm">Collection name<input value={draft.title} maxLength={80} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Climbing Branches" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="text-sm sm:col-span-2">Short description<textarea value={draft.description} maxLength={500} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
      </div>
      <p className="mt-4 text-sm">Pick the designs ({draft.designs.length} chosen)</p>
      {pool.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No live designs yet for this designer.</p> :
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">{pool.map(d => { const on = draft.designs.includes(d.slug); return <Button type="button" variant="ghost" key={d.slug} aria-pressed={on} onClick={() => setDraft({ ...draft, designs: on ? draft.designs.filter(x => x !== d.slug) : [...draft.designs, d.slug] })} className={`relative block h-auto overflow-hidden rounded-md border-2 p-0 text-left ${on ? "border-primary" : "border-transparent"}`}>
          <img src={d.image} alt={d.title} loading="lazy" className="aspect-square w-full object-cover" />
          <span className="block truncate px-1 py-1 text-xs">{d.title}</span>
          {on && <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="h-3 w-3" /></span>}
        </Button>; })}</div>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2"><Button disabled={busy || !draft.title.trim() || draft.designs.length === 0} onClick={() => void submit()}>{busy && <Loader2 className="animate-spin" />}Save collection</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
    </div>}
    {me.collections.length === 0 && !draft && <p className="text-sm text-muted-foreground">No collections yet.</p>}
    {me.collections.map((c: Collection) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div><p className="font-medium">{c.title}</p><p className="text-xs text-muted-foreground">{nameOf(c.designerSlug)} · {c.designs.length} designs</p></div>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="ghost"><Link to="/collections/$id" params={{ id: c.id }}>View</Link></Button>
        <Button size="sm" variant="secondary" onClick={() => setDraft({ ...c })}>Edit</Button>
        <Button size="sm" variant="outline" onClick={() => { if (window.confirm(`Delete "${c.title}"?`)) void remove({ data: { id: c.id } }).then(refresh).then(() => qc.invalidateQueries({ queryKey: shopQuery.queryKey })); }}><Trash2 />Delete</Button>
      </div>
    </div>)}
  </div>;
}
