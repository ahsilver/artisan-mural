import { useEffect, useMemo, useState } from "react";
import { Folder } from "lucide-react";
import { api } from "@/components/bo/common";
import { importSummary } from "@/lib/drive-verify";
import { driveFolderFull, driveInfo, driveImport, driveTiffThumb, dominantColor, previewFromStored, makePreview, uploadFile, fmtBytes, type DriveEntry } from "@/lib/designer-files";
import { checkRepeat } from "@/lib/repeat-check";

type Pick = { role: "color" | "extra"; name: string; swatch: string; autoSwatch: boolean; forColor: string };
const LAST = "am-last-drive-folder";
const niceName = (file: string) => file.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
const isPic = (f: DriveEntry, mime?: string) => /^image\//.test(mime || f.type) || /\.(jpe?g|png|webp|tiff?|psd)$/i.test(f.name);

/** One Google Drive folder -> pick the print file of each color (and extra pictures) from a thumbnail grid. */
export function DriveFolderPicker({ design, onChanged }: { design: any; onChanged: () => void }) {
  const [link, setLink] = useState<string>(design.driveFolder || "");
  const [lastLink, setLastLink] = useState<string>("");
  const [stack, setStack] = useState<{ link: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveEntry[] | null>(null);
  const [info, setInfo] = useState<Record<string, { ok: boolean; size?: number; name?: string; mime?: string }>>({});
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [done, setDone] = useState("");
  useEffect(() => { try { const l = localStorage.getItem(LAST) || ""; setLastLink(l); if (!design.driveFolder && l && !design.colors.length) setLink(l); } catch {} }, []);

  async function open(l = link, name?: string, push = true) {
    setErr(""); setDone(""); setBusy(true);
    try {
      const r = await driveFolderFull(l.trim());
      setFiles(r.files); setInfo({}); setThumbs({});
      if (push) setStack((s) => [...s, { link: l.trim(), name: name || r.name || "Folder" }]);
      if (!stack.length && push) { try { localStorage.setItem(LAST, l.trim()); } catch {} if (design.driveFolder !== l.trim()) void api(`designer/uploads/${design.id}`, { body: { driveFolder: l.trim() } }).catch(() => {}); }
      const ids = r.files.filter((f) => !f.folder).map((f) => f.id);
      for (let i = 0; i < ids.length; i += 10) { const got = await driveInfo(ids.slice(i, i + 10)); setInfo((m) => { const n = { ...m }; for (const g of got) n[g.id] = g; return n; }); }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  // thumbnails for TIFFs Google can't preview: read just enough of the file, one at a time
  useEffect(() => {
    if (!files) return; let stop = false;
    (async () => { for (const f of files) { if (stop) return; if (thumbs[f.id] !== "tiff" ) continue; try { const u = await driveTiffThumb(f.id); if (!stop) setThumbs((m) => ({ ...m, [f.id]: u })); } catch { if (!stop) setThumbs((m) => ({ ...m, [f.id]: null })); } } })();
    return () => { stop = true; };
  }, [files, Object.values(thumbs).filter((x) => x === "tiff").length]);

  const existing: { id: string; name: string }[] = design.colors.map((c: any) => ({ id: c.id, name: c.name }));
  const colorPicks = useMemo(() => (files ?? []).filter((f) => picks[f.id]?.role === "color"), [files, picks]);
  const colorChoices = [...existing.map((c) => ({ key: "c:" + c.id, label: c.name })), ...colorPicks.map((f) => ({ key: "p:" + f.id, label: picks[f.id].name || niceName(f.name) }))];
  const roleOf = (id: string) => (picks[id] ? (picks[id].role === "color" ? "color" : "x:" + picks[id].forColor) : "");
  function setRole(f: DriveEntry, v: string) {
    setPicks((p) => {
      const n = { ...p };
      if (!v) { delete n[f.id]; return n; }
      const base = n[f.id] ?? { role: "color", name: niceName(f.name), swatch: "#cccccc", autoSwatch: true, forColor: "" };
      n[f.id] = v === "color" ? { ...base, role: "color" } : { ...base, role: "extra", forColor: v.slice(2) };
      return n;
    });
    if (v === "color" && !picks[f.id]) { const t = thumbs[f.id]; if (t && t !== "tiff") void dominantColor(t).then((c) => c && setPicks((p) => (p[f.id]?.autoSwatch ? { ...p, [f.id]: { ...p[f.id], swatch: c } } : p))); }
  }
  const picked = (files ?? []).filter((f) => picks[f.id]);
  const nColors = colorPicks.length, nExtra = picked.length - nColors;

  async function copyPicked() {
    setErr(""); setDone(""); setBusy(true);
    const made: Record<string, string> = {}; // pick file id -> colorway id
    try {
      let first = design.colors.length === 0;
      const order = [...picked.filter((f) => picks[f.id].role === "color"), ...picked.filter((f) => picks[f.id].role === "extra")];
      for (const f of order) {
        const pk = picks[f.id];
        const say = (t: string) => setStatus((s) => ({ ...s, [f.id]: t }));
        say("Copying…");
        const orig: any = await driveImport(f.link, design.id, (d, t) => say(t > 1 ? `Copying ${Math.floor((d / t) * 100)}%` : "Copying…"));
        const chk = importSummary({ name: orig.filename, bytes: orig.size, driveBytes: orig.driveBytes, dims: orig.dims, minDpi: 150 });
        say(orig.reused ? "Already copied · making picture…" : "Making picture…");
        let preview: Blob | null = null;
        try { preview = await previewFromStored(orig.key, orig.mime, orig.size, orig.dims, (x) => say(`Making picture ${Math.floor(x * 100)}%`)); } catch { preview = null; }
        if (!preview) throw new Error(`${f.name}: can't make a picture from this file type. Use a JPG, PNG or TIFF.`);
        if (pk.role === "color") {
          const pv = await uploadFile(preview, { uploadId: design.id, purpose: "preview", filename: "preview.jpg" }, () => {});
          const sw = pk.autoSwatch ? (await dominantColor(preview)) ?? pk.swatch : pk.swatch;
          const r = await api(`designer/uploads/${design.id}/colorways`, { body: { name: pk.name || niceName(f.name), swatch: sw, sourceName: f.name, previewKey: pv.key, originalKey: orig.key, filename: orig.filename, mime: orig.mime, size: orig.size, width: orig.dims?.width, height: orig.dims?.height, dpi: orig.dims?.vector ? null : orig.dims?.dpi } });
          made[f.id] = r.colorwayId;
          if (first) {
            first = false;
            try { const url = URL.createObjectURL(preview); const rc = await checkRepeat(url, "both"); URL.revokeObjectURL(url); const seamless = rc.lr.ok && !!rc.tb?.ok, sideways = rc.lr.ok && !rc.tb?.ok; const pick = design.meta?.repeatChosen || design.review === "approved" ? {} : seamless ? { kind: "repeating", repeat: "both" } : sideways ? { kind: "repeating", repeat: "horizontal" } : { kind: "mural", repeat: "none" }; await api(`designer/uploads/${design.id}`, { body: { ...pick, meta: { ...(design.meta ?? {}), autoDetect: { seamless, sideways, lr: rc.lr.score, tb: rc.tb?.score } } } }); } catch {}
          }
        } else {
          const target = pk.forColor.startsWith("p:") ? made[pk.forColor.slice(2)] : pk.forColor.slice(2);
          if (!target) throw new Error(`${f.name}: pick which color this extra picture belongs to.`);
          const small = await makePreview(preview, null, 1600);
          const up = await uploadFile(small, { uploadId: design.id, purpose: "mockup", filename: "photo.jpg" }, () => {});
          await api(`designer/colorways/${target}/mockups`, { body: { keys: [up.key] } });
        }
        say(`Added · ${chk.line}${chk.warn ? " · " + chk.warn : ""}`);
      }
      setDone(`Added ${nColors} color${nColors === 1 ? "" : "s"}${nExtra ? ` and ${nExtra} extra picture${nExtra === 1 ? "" : "s"}` : ""}. Only the files you picked were copied.`);
      setPicks({}); onChanged();
    } catch (e: any) { setErr(e.message); onChanged(); }
    setBusy(false);
  }

  return <div className="bo-drive" data-testid="drive-picker">
    <div className="bo-lbl">Pick from a Google Drive folder</div>
    <div className="bo-sub" style={{ marginBottom: 6 }}>Paste one folder link. You'll see every file in it, and pick the print file for each color (Sage, Navy…) and any extra pictures. Only the files you pick are copied.</div>
    <div className="bo-row">
      <input className="bo-in" style={{ flex: "1 1 240px", width: "auto" }} placeholder="https://drive.google.com/drive/folders/…" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Google Drive folder link" />
      <button className="bo-btn" disabled={busy || !/folders\/|[?&]id=/.test(link)} onClick={() => { setStack([]); void open(link); }}>Show files</button>
      {lastLink && lastLink !== link && !files && <button className="bo-btn sm" onClick={() => { setLink(lastLink); setStack([]); void open(lastLink); }}>Use my last folder</button>}
    </div>
    {lastLink && lastLink === link && !files && !design.driveFolder && <div className="bo-sub" style={{ marginTop: 4 }}>This is the folder you used last time. Press Show files to pick from it again.</div>}
    {err && <div className="bo-msg bad" style={{ marginTop: 8 }}>{err}</div>}
    {done && <div className="bo-msg ok" style={{ marginTop: 8 }}>{done}</div>}
    {files && <>
      <div className="bo-row" style={{ margin: "10px 0 6px", gap: 6 }}>
        {stack.map((s, i) => <span key={i} className="bo-sub">{i > 0 && " › "}{i < stack.length - 1 ? <button className="bo-link" onClick={() => { const st = stack.slice(0, i + 1); setStack(st); void open(s.link, s.name, false); }}>{s.name}</button> : <b style={{ color: "#1c1917" }}>{s.name}</b>}</span>)}
        <span className="bo-sub">· {files.filter((f) => !f.folder).length} files{files.some((f) => f.folder) ? `, ${files.filter((f) => f.folder).length} folders` : ""}</span>
      </div>
      <div className="bo-dgrid">
        {files.map((f) => {
          if (f.folder) return <button key={f.id} type="button" className="bo-dtile folder" onClick={() => void open(f.link, f.name)}><div className="th"><Folder size={30} strokeWidth={1.4} /></div><div className="nm">{f.name}</div><div className="bo-sub">Open folder</div></button>;
          const inf = info[f.id]; const cant = inf && !inf.ok; const pic = isPic(f, inf?.mime);
          const tiff = /tiff?$/i.test(f.name) || /tiff/.test(f.type);
          const th = thumbs[f.id];
          const pk = picks[f.id];
          return <div key={f.id} className={"bo-dtile" + (pk ? " on" : "") + (cant ? " off" : "")} data-name={f.name}>
            <div className="th">
              {th === undefined && pic ? <img src={`https://lh3.googleusercontent.com/d/${f.id}=w320`} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={(e) => { const u = (e.target as HTMLImageElement).src; setThumbs((m) => (m[f.id] === undefined ? { ...m, [f.id]: u } : m)); }} onError={() => setThumbs((m) => ({ ...m, [f.id]: tiff ? "tiff" : null }))} />
                : th && th !== "tiff" ? <img src={th} alt="" referrerPolicy="no-referrer" /> : <span className="ext">{th === "tiff" ? "Loading…" : (f.name.split(".").pop() || "file").toUpperCase().slice(0, 5)}</span>}
              {pk && <span className="badge">{pk.role === "color" ? "Color" : "Extra"}</span>}
            </div>
            <div className="nm" title={f.name}>{f.name}</div>
            <div className="bo-sub">{inf?.size ? fmtBytes(inf.size) : f.size ? fmtBytes(f.size) : inf ? "" : "…"}{f.copied ? " · copied before" : ""}{cant ? "Can't be copied (not a file)" : ""}</div>
            {f.usedIn && f.usedIn.length > 0 && <div className="bo-sub" title={f.usedIn.join(", ")}>Used in: {f.usedIn.join(", ")}</div>}
            {!cant && <select className="bo-sel sm" value={roleOf(f.id)} disabled={busy} onChange={(e) => setRole(f, e.target.value)} aria-label={`Use ${f.name} as`}>
              <option value="">Not used</option>
              <option value="color">A color of this design</option>
              {colorChoices.filter((c) => c.key !== "p:" + f.id).map((c) => <option key={c.key} value={"x:" + c.key}>Extra picture · {c.label}</option>)}
            </select>}
            {pk?.role === "color" && <div className="bo-row" style={{ gap: 6, marginTop: 6, flexWrap: "nowrap" }}>
              <input type="color" className="bo-swatch" value={pk.swatch} onChange={(e) => setPicks((p) => ({ ...p, [f.id]: { ...p[f.id], swatch: e.target.value, autoSwatch: false } }))} aria-label="Color dot" title="Color dot shown to customers" />
              <input className="bo-in sm" value={pk.name} maxLength={40} onChange={(e) => setPicks((p) => ({ ...p, [f.id]: { ...p[f.id], name: e.target.value } }))} aria-label="Color name" placeholder="e.g. Sage" />
            </div>}
            {status[f.id] && <div className="bo-sub" style={{ marginTop: 4 }}>{status[f.id]}</div>}
          </div>;
        })}
      </div>
      <div className="bo-row" style={{ marginTop: 10 }}>
        <button className="bo-btn pri" disabled={busy || !picked.length} onClick={copyPicked}>{busy && picked.length ? "Working…" : picked.length ? `Add ${nColors ? `${nColors} color${nColors === 1 ? "" : "s"}` : ""}${nColors && nExtra ? " + " : ""}${nExtra ? `${nExtra} extra picture${nExtra === 1 ? "" : "s"}` : ""}` : "Pick files above"}</button>
        <span className="bo-sub">The first color is the main design. You can rename and reorder colors below.</span>
      </div>
    </>}
  </div>;
}
