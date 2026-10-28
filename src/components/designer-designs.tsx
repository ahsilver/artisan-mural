import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ImageIcon, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listArtworkUploads, submitArtworkForApproval, updateArtworkTags } from "@/lib/artwork-uploads.functions";
import { artworkReviewLabel } from "@/lib/designer-workflow";
import { categories, roomLabels, matchRoom } from "@/lib/design-taxonomy";
import { editOwnArtwork } from "@/lib/artwork-uploads.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintOriginalUpload } from "@/components/print-original-upload";
import { OriginalInput, type OriginalInputValue } from "./original-input";
import { useSaveOriginal } from "@/hooks/use-save-original";
import { Link } from "@tanstack/react-router";
import { plainError } from "@/lib/original-source";

type Upload = Awaited<ReturnType<typeof listArtworkUploads>>[number];
export function DesignerDesigns({ stats = [] }: { stats?: { slug: string; orders: number; printedSqft: number; sqft: number }[] }) {
  const load = useServerFn(listArtworkUploads);
  const submit = useServerFn(submitArtworkForApproval);
  const saveTags = useServerFn(updateArtworkTags);
  const saveDesign = useServerFn(editOwnArtwork);
  const [editing, setEditing] = useState<Upload | null>(null);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [notes, setNotes] = useState("");
  const [colorName, setColorName] = useState("");
  const saveOriginal=useSaveOriginal();
  const [originalInput,setOriginalInput]=useState<OriginalInputValue>({file:null,link:"",mode:"file"});
  const [rows, setRows] = useState<Upload[] | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void load().then(setRows).catch(e => setError(e.message)); }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); setRows(await load()); setEdit(null); }
    catch (e) { setError(plainError(e, "Could not save.")); }
    finally { setBusy(false); }
  };
  return <div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {!rows && !error && <Loader2 className="animate-spin" aria-label="Loading your designs" />}
    {rows?.length === 0 && <p className="text-sm text-muted-foreground">No designs uploaded yet.</p>}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows?.map(u => <section key={u.id} className="overflow-hidden rounded-md border border-border bg-card">
      {u.artwork_colorways[0]?.images[0] ? <img src={u.artwork_colorways[0].images[0]} alt={u.title} loading="lazy" className="aspect-[4/3] w-full bg-muted object-contain" /> : <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="size-8" aria-label="Artwork not saved yet" /></div>}
      <div className="space-y-3 p-4">
        <h2 className="text-xl">{u.title}</h2><p className="text-xs text-muted-foreground">{u.sku} · {artworkReviewLabel(u)}</p>
        <p className="text-sm">{stats.find(r => r.slug === `u-${u.id}`)?.orders ?? 0} orders · {stats.find(r => r.slug === `u-${u.id}`)?.printedSqft ?? 0} sq ft printed</p>
        {u.artwork_colorways.map(c=><details key={c.id} className="border-t border-border pt-3"><summary className="cursor-pointer text-sm">{c.name} · {c.current_original_id ? "Verified print original" : "Original needed"}</summary><PrintOriginalUpload colorway={c.id} name={c.name} original={c.original} verified={!!c.current_original_id} onSaved={()=>void load().then(setRows)}/></details>)}
        {u.review_note && <p className="text-sm">{u.review_note}</p>}
        <p className="text-xs text-muted-foreground">{[...u.made_for, ...u.categories].join(" · ") || "No categories chosen"}</p>
        {u.status !== "ready" && <p className="text-xs text-muted-foreground">Room photos: {u.status}</p>}
        {!u.submitted_at && u.artwork_colorways.length > 0 && <Button size="sm" disabled={busy || u.artwork_colorways.some(c => !c.current_original_id)} onClick={() => void run(() => submit({ data: { id: u.id } }))}><Send />Submit for approval</Button>}
        <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="secondary"><a href={`/designer-upload?id=${u.id}`}>Edit design, colorways and repeat</a></Button></div>
        <Button size="sm" variant="outline" onClick={() => { setEdit(u.id); setStyles(u.categories); setRooms(roomLabels.filter(label => matchRoom({ room: u.made_for, categories: u.categories }, label))); }}>Edit categories</Button>
        {edit === u.id && <div className="space-y-3 border-t border-border pt-3">
          <fieldset><legend className="mb-2 text-sm">Rooms</legend>{roomLabels.map(r => <label key={r} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={rooms.includes(r)} onChange={e => setRooms(v => e.target.checked ? [...v, r] : v.filter(x => x !== r))} />{r}</label>)}</fieldset>
          <fieldset><legend className="mb-2 text-sm">Styles</legend>{categories.map(c => <label key={c} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={styles.includes(c)} onChange={e => setStyles(v => e.target.checked ? [...v, c] : v.filter(x => x !== c))} />{c}</label>)}</fieldset>
          <div className="flex gap-2"><Button size="sm" disabled={busy || !rooms.length} onClick={() => void run(() => saveTags({ data: { id: u.id, rooms, categories: styles } }))}><Check />Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>}
      </div>
    </section>)}</div>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Edit your design</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!editing) return; const form = new FormData(); form.set("id", editing.id); form.set("title", title); form.set("story", story); form.set("notes", notes); if(colorName){form.set("colorName",colorName);form.set("printUrl",originalInput.mode==="drive"?originalInput.link:"");} void run(async () => { const result=await saveDesign({ data: form }); if(result.colorwayId)await saveOriginal(result.colorwayId,originalInput,()=>{});setEditing(null); }); }}>
        <p className="text-sm text-muted-foreground">Saving takes this design off the shop until you submit it again and the studio approves it.</p>
        <label className="block text-sm">Design name<input required minLength={2} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="block text-sm">Story<textarea maxLength={3000} value={story} onChange={e => setStory(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
        <label className="block text-sm">Printing notes<textarea maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
        <fieldset className="space-y-3 border-t border-border pt-4"><legend className="text-sm">Add a color version (optional)</legend><label className="block text-sm">New color name<input required={Boolean(originalInput.file || originalInput.link)} maxLength={40} value={colorName} onChange={e => setColorName(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" /></label>{colorName&&<OriginalInput value={originalInput} onChange={setOriginalInput} disabled={busy} label="new color"/>}</fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save draft</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}