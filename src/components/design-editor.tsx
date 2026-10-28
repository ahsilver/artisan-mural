import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getDesignEditor, saveDesignOverride, type DesignEditorData } from "@/lib/design-edits.functions";
import { money } from "@/lib/catalog";
import { plainError } from "@/lib/original-source";

async function uploadPhoto(slug: string, file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${slug}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("studio-photos").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Photo upload failed.");
  return { path, url: URL.createObjectURL(file) };
}

/** Owner dialog: edit a design's text, price, main artwork and room photos. */
export function DesignEditor({ slug, onClose, onSaved }: { slug: string | null; onClose: () => void; onSaved: () => void }) {
  const load = useServerFn(getDesignEditor);
  const save = useServerFn(saveDesignOverride);
  const [d, setD] = useState<DesignEditorData | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setD(null); setError("");
    if (!slug) return;
    load({ data: { slug } }).then((v) => { setD(v); setPrice(v.pricePerSqft == null ? "" : String(v.pricePerSqft)); }).catch((e) => setError(plainError(e, "Could not load.")));
  }, [slug, load]);

  async function run(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn(); } catch (e) { setError(plainError(e, "Something went wrong.")); } finally { setBusy(false); } }
  const set = (patch: Partial<DesignEditorData>) => setD((v) => (v ? { ...v, ...patch } : v));

  return (
    <Dialog open={!!slug} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit design</DialogTitle></DialogHeader>
        {!d && !error && <Loader2 className="mx-auto my-10 animate-spin" />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {d && <div className="space-y-5">
          <label className="block text-sm">Name<input value={d.title} onChange={(e) => set({ title: e.target.value })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" /></label>
          <label className="block text-sm">Description<textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
          <label className="block text-sm">Story behind the design<textarea value={d.story} onChange={(e) => set({ story: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-background p-3" /></label>
          <label className="block text-sm">Price per sq ft <span className="text-muted-foreground">(empty = standard {money(d.standardPrice)})</span>
            <input type="number" min="0.5" step="0.05" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(d.standardPrice)} className="mt-1 h-11 w-40 rounded-md border border-input bg-background px-3" /></label>

          <div>
            <p className="text-sm">Main artwork {d.artworkReplaced && <span className="text-muted-foreground">(replaced)</span>}</p>
            <div className="mt-2 flex items-end gap-3">
              <img src={d.artwork} alt="" className="h-32 w-44 rounded-md bg-muted object-contain" />
              <div className="flex flex-col gap-2">
                <Button asChild size="sm" variant="outline" disabled={busy}><label className="cursor-pointer"><Upload />Replace artwork<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { const up = await uploadPhoto(d.slug, f); set({ imagePath: up.path, artwork: up.url, artworkReplaced: true }); }); }} /></label></Button>
                {d.artworkReplaced && <Button size="sm" variant="ghost" onClick={() => set({ imagePath: null, artworkReplaced: false })}><RotateCcw />Use designer's original</Button>}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Replacing changes the shop picture only; the designer's print file stays the same.</p>
          </div>

          <div>
            <div className="flex items-center justify-between"><p className="text-sm">Room photos</p>
              <Button asChild size="sm" variant="outline" disabled={busy}><label className="cursor-pointer"><ImagePlus />Add photos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = [...(e.target.files ?? [])]; void run(async () => { for (const f of files) { const up = await uploadPhoto(d.slug, f); setD((v) => v ? { ...v, photos: [...v.photos, { key: up.path, url: up.url, added: true, removed: false }] } : v); } }); }} /></label></Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{d.photos.map((p) => <div key={p.key} className={`relative overflow-hidden rounded-md ${p.removed ? "opacity-30" : ""}`}>
              <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <Button size="icon" variant="secondary" aria-label={p.removed ? "Bring photo back" : "Remove photo"} className="absolute right-1 top-1 h-8 w-8" onClick={() => setD((v) => v ? { ...v, photos: p.added ? v.photos.filter((x) => x.key !== p.key) : v.photos.map((x) => x.key === p.key ? { ...x, removed: !x.removed } : x) } : v)}>{p.removed ? <RotateCcw /> : <Trash2 />}</Button>
            </div>)}</div>
            {d.photos.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No room photos yet.</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !d.title.trim()} onClick={() => void run(async () => {
              const n = price.trim() === "" ? null : Number(price);
              if (n !== null && !(n > 0)) throw new Error("Enter a price above zero, or leave it empty.");
              await save({ data: { slug: d.slug, title: d.title, description: d.description, story: d.story, pricePerSqft: n, imagePath: d.imagePath, removed: d.photos.filter((p) => !p.added && p.removed).map((p) => p.key), added: d.photos.filter((p) => p.added).map((p) => p.key) } });
              onSaved(); onClose();
            })}>{busy && <Loader2 className="animate-spin" />}Save changes</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
