import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, useApi, Field, Msg } from "@/components/bo/common";

async function shrink(file: File, max: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.86));
  } finally { URL.revokeObjectURL(url); }
}
async function upload(path: string, blob: Blob) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch("/backend/" + path, { method: "POST", headers: { "content-type": "image/jpeg", authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: blob });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Upload failed"); return j;
}

/** Designer edits the public profile customers see on /designers/<slug>. */
export function PublicProfile() {
  const { data: me, reload } = useApi<any>("community/me");
  const [f, setF] = useState<any>(null); const [msg, setMsg] = useState<any>(null); const [busy, setBusy] = useState(""); const [caption, setCaption] = useState("");
  useEffect(() => { if (me) setF({ name: me.name ?? "", tagline: me.tagline ?? "", bio: me.bio ?? "", specialties: (me.specialties ?? []).join(", "), responseLabel: me.responseLabel ?? "", turnaroundDays: me.turnaroundDays ?? "" }); }, [me]);
  if (!me || !f) return <div className="bo-card">Loading your public profile…</div>;
  const save = async () => { setBusy("save"); setMsg(null); try { await api("community/me", { body: f }); setMsg({ ok: true, text: "Saved. Your public page is updated." }); reload(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(""); } };
  const put = async (kind: "photo" | "portfolio", file?: File) => {
    if (!file) return; setBusy(kind); setMsg(null);
    try { await upload(kind === "photo" ? "community/me/photo" : `community/me/portfolio?caption=${encodeURIComponent(caption)}`, await shrink(file, kind === "photo" ? 600 : 1600)); setCaption(""); reload(); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(""); }
  };
  const remove = async (key: string) => { await api("community/me/portfolio/remove", { body: { key } }).catch(() => {}); reload(); };
  return <div className="bo-card" data-testid="public-profile">
    <div className="bo-row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
      <h2 style={{ margin: 0 }}>Public profile</h2>
      {me.status === "approved" && !me.hidden ? <a className="bo-btn sm" href={`/designers/${me.slug}`} target="_blank" rel="noreferrer">View my page</a> : <span className="bo-sub">{me.hidden ? "Hidden by the studio for now" : "Shows on the site once your account is approved"}</span>}
    </div>
    <p className="bo-sub" style={{ marginTop: 4 }}>This is what customers see in the designers directory and on your page.</p>
    <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0", flexWrap: "wrap" }}>
      {me.photo ? <img src={me.photo} alt="" style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover" }} /> : <div style={{ width: 72, height: 72, borderRadius: 999, background: "#eee" }} />}
      <label className="bo-btn sm" style={{ cursor: "pointer" }}>{busy === "photo" ? "Uploading…" : me.photo ? "Change photo" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => put("photo", e.target.files?.[0])} data-testid="photo-input" /></label>
    </div>
    <div className="bo-grid2">
      <Field label="Name shown"><input className="bo-in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
      <Field label="Short line" hint="One sentence under your name"><input className="bo-in" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} maxLength={120} placeholder="Botanical murals painted by hand" /></Field>
    </div>
    <Field label="About you"><textarea className="bo-in" rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={2000} /></Field>
    <Field label="Specialties" hint="Comma separated, up to 8"><input className="bo-in" value={f.specialties} onChange={(e) => setF({ ...f, specialties: e.target.value })} placeholder="Botanical, murals, kids rooms" /></Field>
    <div className="bo-grid2">
      <Field label="Usually responds" hint={me.measured ? `Measured on the site: ${me.measured.label} (average of ${me.measured.n})` : "Your measured time shows here after your first replies"}>
        <select className="bo-in" value={f.responseLabel} onChange={(e) => setF({ ...f, responseLabel: e.target.value })} data-testid="response-select"><option value="">Choose…</option>{(me.options ?? []).map((o: string) => <option key={o} value={o}>{o === "within an hour" ? "Within 1 hour" : o === "within a few hours" ? "Within a few hours" : o === "within a day" ? "Within 1 day" : "Within 2–3 days"}</option>)}</select>
      </Field>
      <Field label="Typical turnaround (days)"><input className="bo-in" type="number" min={1} max={120} value={f.turnaroundDays} onChange={(e) => setF({ ...f, turnaroundDays: e.target.value })} data-testid="turnaround-input" /></Field>
    </div>
    <div className="bo-row" style={{ gap: 8, marginTop: 8 }}><button className="bo-btn pri" onClick={save} disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save profile"}</button></div>
    <Msg m={msg} />
    <h3 style={{ marginTop: 24 }}>Portfolio pictures</h3>
    <p className="bo-sub">Rooms, murals and work you are proud of. Your designs on the site show automatically. Up to 24 pictures.</p>
    <div className="bo-row" style={{ gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
      <input className="bo-in" style={{ maxWidth: 260 }} placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} />
      <label className="bo-btn sm" style={{ cursor: "pointer" }}>{busy === "portfolio" ? "Uploading…" : "Add picture"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => put("portfolio", e.target.files?.[0])} data-testid="portfolio-input" /></label>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
      {(me.portfolio ?? []).map((x: any) => <div key={x.key}><img src={x.url} alt={x.caption} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4 }} /><div className="bo-sub" style={{ display: "flex", justifyContent: "space-between", gap: 4 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.caption}</span><button className="bo-link" onClick={() => remove(x.key)}>Remove</button></div></div>)}
    </div>
  </div>;
}
