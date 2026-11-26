import { useEffect, useRef, useState } from "react";
import { driveFolderFull, type DriveEntry } from "@/lib/designer-files";
import { importDrive, importLocal, newDraft, niceName } from "@/lib/design-import";

/** The approved preview's "Add a design" first step: From my computer | From Google Drive, half and half.
 *  A Drive folder opens as picture tiles right away (sub-folders open here too, big TIFFs get a sharp picture read
 *  straight from the file), pick one or many, then make one design with colorways or several designs at once. */
export const QUEUE_KEY = "am_up_queue";
type Pick = { kind: "drive"; id: string; name: string } | { kind: "local"; file: File; url: string | null; name: string; key: string };
const isTiff = (n: string) => /\.tiff?$/i.test(n);
const isPic = (f: DriveEntry) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tiff?|psd|pdf|svg|gif|ai|eps)$/i.test(f.name);
const extOf = (n: string) => (n.split(".").pop() || "file").slice(0, 5).toUpperCase();
const folderIdOf = (l: string) => l.match(/folders\/([\w-]{10,})/)?.[1] ?? l.match(/[?&]id=([\w-]{10,})/)?.[1] ?? null;
const fileIdOf = (l: string) => l.match(/\/d\/([\w-]{10,})/)?.[1] ?? null;

export function StudioUpload({ rules }: { rules: any }) {
  const [link, setLink] = useState("");
  const [stack, setStack] = useState<{ id: string; name: string }[]>([]);
  const [cache, setCache] = useState<Record<string, DriveEntry[]>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({}); // id -> blob url | "busy" | "none"
  const [sel, setSel] = useState<string[]>([]);
  const [local, setLocal] = useState<Pick[]>([]);
  const [work, setWork] = useState<{ label: string; frac: number; step: string } | null>(null);
  const names = useRef<Record<string, string>>({});
  const cur = stack[stack.length - 1];
  const files = cur ? cache[cur.id] : undefined;

  // remember every file name we have seen (for picks made in another sub-folder)
  useEffect(() => { for (const fs of Object.values(cache)) for (const f of fs) names.current[f.id] = f.name; }, [cache]);

  async function openFolder(id: string, name: string, reset = false) {
    setErr("");
    setStack((s) => { if (reset) return [{ id, name }]; const at = s.findIndex((x) => x.id === id); return at >= 0 ? s.slice(0, at + 1) : [...s, { id, name }]; });
    if (cache[id]) { void prefetch(cache[id]); return; }
    setBusy(true);
    try {
      const r = await driveFolderFull(`https://drive.google.com/drive/folders/${id}`);
      setCache((c) => ({ ...c, [id]: r.files }));
      if (reset && r.name) setStack([{ id, name: r.name }]);
      void prefetch(r.files);
    } catch (e: any) { setErr(e.message || "Couldn't open that folder. In Google Drive, share it as 'Anyone with the link'."); }
    setBusy(false);
  }
  // read sub-folders ahead (a few at a time) so opening one is instant and folders show a cover picture
  const pre = useRef(new Set<string>());
  async function prefetch(fs: DriveEntry[]) {
    const subs = fs.filter((f) => f.folder && !pre.current.has(f.id)).slice(0, 40);
    subs.forEach((f) => pre.current.add(f.id));
    for (let i = 0; i < subs.length; i += 4) {
      await Promise.all(subs.slice(i, i + 4).map(async (f) => { try { const r = await driveFolderFull(f.link); setCache((c) => (c[f.id] ? c : { ...c, [f.id]: r.files })); } catch {} }));
    }
  }
  // TIFF print files: their built-in small picture shows at once (no waiting while browsing); the big, sharp picture
  // is made only for the designs that are chosen, from the full-size copy in our storage
  const builtIn = (id: string) => `/backend/public/drive-thumb?id=${encodeURIComponent(id)}`;
  const coverOf = (id: string) => {
    for (const x of cache[id] ?? []) { if (x.folder) continue; const t = thumbs[x.id]; if (t?.startsWith("blob:")) return t; if (isTiff(x.name)) return builtIn(x.id); if (/\.(jpe?g|png|webp|gif)$/i.test(x.name)) return `https://drive.google.com/thumbnail?id=${x.id}&sz=w400`; }
    return "";
  };
  const pickedLocal = local.filter((p) => sel.includes((p as any).key));
  const folderPics = (fid: string) => (cache[fid] ?? []).filter((x) => !x.folder && isPic(x)).map((x) => ({ kind: "drive", id: x.id, name: x.name } as Pick));
  const folderName = (fid: string) => Object.values(cache).flat().find((x) => x.id === fid)?.name ?? "Folder";
  /** each chosen item as a group: a folder = one design with its pictures, a file = one design */
  const groupsOf = (): Pick[][] => sel.map((id) => {
    if (id.startsWith("f:")) { const fs = folderPics(id.slice(2)); return fs.length ? [{ ...fs[0]!, name: folderName(id.slice(2)) } as Pick, ...fs.slice(1)] : []; }
    const lp = local.find((p) => (p as any).key === id); return [lp ?? ({ kind: "drive", id, name: names.current[id] ?? "Google Drive file" } as Pick)];
  }).filter((g) => g.length);
  const picks: Pick[] = groupsOf().flat();

  function addLocal(list: FileList | File[]) {
    const add: Pick[] = [...list].map((f, i) => ({ kind: "local", file: f, url: /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name) ? URL.createObjectURL(f) : null, name: f.name, key: `local-${Date.now()}-${i}` }));
    setLocal((l) => [...l, ...add]);
    setSel((s) => [...s, ...add.map((p) => (p as any).key)]);
  }
  function show() {
    setErr("");
    const fid = folderIdOf(link), one = fileIdOf(link);
    if (fid) void openFolder(fid, "Your folder", true);
    else if (one) { names.current[one] = "Google Drive file"; setSel((s) => (s.includes(one) ? s : [...s, one])); setLink(""); }
    else setErr("That doesn't look like a Google Drive link. It should look like drive.google.com/drive/folders/… or drive.google.com/file/d/…");
  }

  /** groups: [[main, colorway, …], …] — each group becomes one design. */
  function closeDrive() { setStack([]); setLink(""); setErr(""); setSel((s) => s.filter((id) => local.some((p: any) => p.key === id))); }
  function removeLocal(key: string) { setLocal((l) => l.filter((p: any) => p.key !== key)); setSel((s) => s.filter((x) => x !== key)); }
  const stop = useRef(false);
  async function make(groups: Pick[][]) {
    stop.current = false;
    setErr("");
    const made: string[] = [];
    try {
      for (let g = 0; g < groups.length; g++) {
        if (stop.current) break;
        const grp = groups[g]!; const title = niceName(grp[0]!.name);
        const step = groups.length > 1 ? `Design ${g + 1} of ${groups.length}: ${title}` : title;
        setWork({ label: "Starting…", frac: 0, step });
        const id = await newDraft(title); made.push(id);
        for (let i = 0; i < grp.length; i++) {
          const p = grp[i]!; const cw = i === 0 ? "Original" : niceName(p.name);
          const say = (label: string, frac = 0) => setWork({ label: grp.length > 1 ? `${label} · file ${i + 1} of ${grp.length}` : label, frac, step });
          if (p.kind === "drive") await importDrive(id, p.id, p.name, cw, i === 0, rules, say);
          else await importLocal(id, p.file, cw, i === 0, rules, say);
        }
      }
      if (!made.length) { setWork(null); return; }
      try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(made.slice(1))); } catch {}
      window.location.href = `/designer-upload?id=${made[0]}`;
    } catch (e: any) {
      setWork(null);
      setErr((e.message || "Something went wrong.") + (made.length ? ` ${made.length} design${made.length > 1 ? "s were" : " was"} started and saved as drafts in My designs.` : ""));
    }
  }

  const drivePics = (files ?? []).filter((f) => !f.folder && isPic(f));
  const subFolders = (files ?? []).filter((f) => f.folder && folderPics(f.id).length);
  const allFolders = subFolders.length > 0 && subFolders.every((f) => sel.includes("f:" + f.id));
  const allOn = drivePics.length > 0 && drivePics.every((f) => sel.includes(f.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (work) return (
    <div className="up-working" role="status" aria-live="polite">
      <b>{work.step}</b>
      <p className="up-prog"><span className="up-spin" aria-hidden="true" />{work.label}{work.frac > 0 && work.frac < 1 ? ` · ${Math.floor(work.frac * 100)}%` : ""}</p>
      <div className="up-bar"><i style={{ width: `${Math.max(3, Math.min(100, work.frac * 100))}%` }} /></div>
      <small>Your full print file is copied into private storage, byte for byte. Big TIFFs take a minute or two. Keep this page open.</small>
      <button type="button" className="btn optline btn-sm up-stop" onClick={() => { stop.current = true; setWork((w) => (w ? { ...w, step: w.step + " · stopping after this file…" } : w)); }}>Stop</button>
    </div>
  );

  return (
    <div className="up-start">
      <div className="up-src3">
        <label className="up-box up-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addLocal(e.dataTransfer.files); }}>
          <input type="file" multiple accept="image/*,.tif,.tiff,.psd,.pdf,.svg,.ai,.eps" onChange={(e) => { if (e.target.files?.length) addLocal(e.target.files); e.target.value = ""; }} />
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4 M7 9l5-5 5 5 M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
          <b>From my computer</b><small>Drag files here or tap to choose.<br />JPG, PNG, TIFF, PSD, PDF or vector.</small>
          <span className="btn btn-wine btn-sm">Choose files</span>
        </label>
        <div className="up-box up-gd">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l6 11-4 7H6l-4-7z M8 3l8 14 M16 3 8 17 M2 14h20" /></svg>
          <b>From Google Drive</b><small>Paste a link to a Drive file or folder.<br />Share it as "Anyone with the link" first.</small>
          <div className="up-row"><input placeholder="Paste a Google Drive link" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); show(); } }} aria-label="Google Drive file or folder link" /><button type="button" className="btn btn-wine btn-sm" disabled={!link.trim()} onClick={show}>Add</button></div>
        </div>
      </div>
      {sel.length > 0 && <div className="up-selact-bar" role="region" aria-label="Your selection">
        <b>{sel.length} selected</b><span className="up-sel-names">{groupsOf().slice(0, 4).map((g) => niceName(g[0]!.name)).join(" · ")}{sel.length > 4 ? " …" : ""}</span>
        <div className="up-row">
          <button type="button" className={"btn btn-sm " + (sel.length > 1 ? "optline" : "btn-wine")} onClick={() => void make([picks])}>{sel.length > 1 ? "One design · these are its colorways" : "Use this picture"}</button>
          {sel.length > 1 && <button type="button" className="btn btn-sm btn-wine" onClick={() => void make(groupsOf())}>Make {sel.length} separate designs</button>}
          <button type="button" className="up-link" onClick={() => setSel([])}>Clear</button>
        </div>
        {pickedLocal.length === 0 && sel.length > 1 && <small>One design: the first picture is the main one, the others become its colorways. Separate designs: each picture becomes its own design; you finish them one after another.</small>}
      </div>}
      {err && <p className="up-gdl-msg err" role="alert">{err}</p>}

      {cur && <div className="up-gdf">
        <div className="up-gdf-h"><div className="up-crumbs">{stack.map((s, i) => i < stack.length - 1 ? <span key={s.id}><button type="button" className="up-crumb" onClick={() => void openFolder(s.id, s.name)}>{s.name}</button><span>›</span></span> : <b key={s.id}>{s.name}</b>)}</div><span className="up-gdf-acts"><a href={`https://drive.google.com/drive/folders/${cur.id}`} target="_blank" rel="noopener noreferrer">Open in Drive ↗</a><button type="button" className="up-x" aria-label="Close this Google Drive folder" title="Close" onClick={closeDrive}>✕</button></span></div>
        {subFolders.length > 1 && drivePics.length === 0 && <div className="up-selbar"><button type="button" className="up-link" onClick={() => setSel((s) => (allFolders ? s.filter((x) => !subFolders.some((f) => "f:" + f.id === x)) : [...new Set([...s, ...subFolders.map((f) => "f:" + f.id)])]))}>{allFolders ? "Clear selection" : `Choose all ${subFolders.length} folders (one design each)`}</button><small>Tap "Choose" on a folder to make it one design. Tap the folder to look inside.</small></div>}
        {drivePics.length > 0 && <div className="up-selbar"><button type="button" className="up-link" onClick={() => setSel((s) => (allOn ? s.filter((x) => !drivePics.some((f) => f.id === x)) : [...new Set([...s, ...drivePics.map((f) => f.id)])]))}>{allOn ? "Clear selection" : `Select all in this folder (${drivePics.length})`}</button><small>Tap pictures to choose them. You can choose in several folders.</small></div>}
        {busy && !files ? <p className="up-gdl-msg"><span className="up-spin" aria-hidden="true" />Opening your folder in Google Drive…</p>
          : files && !files.length ? <p className="up-gdl-msg">This folder is empty.</p>
          : files ? <div className="up-gdl">{files.map((f) => f.folder ? (
              <button key={f.id} type="button" className={"up-gdt fold" + (sel.includes("f:" + f.id) ? " on" : "")} onClick={() => void openFolder(f.id, f.name)}><span className="th">{coverOf(f.id) && <img src={coverOf(f.id)} alt="" referrerPolicy="no-referrer" />}<span className="fic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>{cache[f.id] ? cache[f.id]!.filter((x) => !x.folder).length : ""}</span></span><em role="checkbox" aria-checked={sel.includes("f:" + f.id)} aria-label={`Choose the folder ${f.name} as one design`} tabIndex={0} className="fsel" onClick={(e) => { e.stopPropagation(); toggle("f:" + f.id); }} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); toggle("f:" + f.id); } }}>{sel.includes("f:" + f.id) ? "✓ Chosen" : cache[f.id] ? (folderPics(f.id).length ? "Choose" : "No pictures") : "…"}</em><small>{f.name}</small></button>
            ) : (
              <button key={f.id} type="button" className={"up-gdt" + (sel.includes(f.id) ? " on" : "") + (f.copied ? " used" : "")} aria-pressed={sel.includes(f.id)} disabled={!isPic(f)} onClick={() => toggle(f.id)}>
                <span className="th"><span className="ext">{extOf(f.name)}</span>
                  {thumbs[f.id]?.startsWith("blob:") ? <img src={thumbs[f.id]} alt="" /> : isTiff(f.name) ? <img src={builtIn(f.id)} alt="" onError={(e) => e.currentTarget.remove()} /> : isPic(f) ? <img src={`https://drive.google.com/thumbnail?id=${f.id}&sz=w400`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.remove()} /> : null}
                  <em>{sel.includes(f.id) ? "✓ Selected" : f.copied ? "Used before" : isPic(f) ? "Select" : "Not a picture"}</em></span>
                <small title={f.name}>{f.name}</small>
              </button>
            ))}</div> : null}
      </div>}

      {local.length > 0 && <div className="up-files">{local.map((p: any) => (
        <button key={p.key} type="button" className={"up-file up-th" + (sel.includes(p.key) ? " on" : "")} aria-pressed={sel.includes(p.key)} onClick={() => toggle(p.key)}>
          {p.url ? <img src={p.url} alt="" /> : <span className="up-ext">{extOf(p.name)}<small>Picture made when you continue</small></span>}
          <em>{sel.includes(p.key) ? "✓ Selected" : "Select"}</em><small title={p.name}>{p.name}</small>
          <span role="button" tabIndex={0} className="up-x up-x-file" aria-label={`Remove ${p.name}`} title="Remove" onClick={(e) => { e.stopPropagation(); removeLocal(p.key); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeLocal(p.key); } }}>✕</span>
        </button>))}</div>}

      {!cur && !local.length && <p className="hint">Tip: paste one Drive folder with all your designs. You'll see them as pictures, open sub-folders here, and make many designs at once.</p>}
    </div>
  );
}
