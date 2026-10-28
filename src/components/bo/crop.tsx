import { useEffect, useRef, useState } from "react";
import { api } from "./common";
import { supabase } from "@/integrations/supabase/client";
type Original = { url: string; filename: string; mime: string; size: number; width: number; height: number } | null | undefined;
async function putPart(key: string, uploadId: string, part: number, chunk: Uint8Array) {
  const { data } = await supabase.auth.getSession();
  for (let a = 1; ; a++) {
    const r = await fetch(`/backend/admin/files/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${part}`, { method: "PUT", headers: { authorization: `Bearer ${data.session?.access_token}`, "content-type": "application/octet-stream" }, body: chunk });
    if (r.ok) return r.json();
    if (a >= 4) throw new Error(`Upload failed (${r.status})`);
    await new Promise((res) => setTimeout(res, 1500 * a));
  }
}

/** Crop the high-res artwork in the browser and save it as a new print file (the original is kept). */
export function CropTool({ orderId, src, original, wallRatio, onSaved, onCancel }: { orderId: string; src: string; original?: Original; wallRatio?: number | null; onSaved: () => void; onCancel: () => void }) {
  const [prog, setProg] = useState("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState<"free" | "wall" | "orig">(wallRatio ? "wall" : "free");
  const [r, setR] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "size"; sx: number; sy: number; r: typeof r } | null>(null);
  useEffect(() => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => setImg(i); i.onerror = () => setErr("Could not load the full-size image."); i.src = src; }, [src]);
  const ratio = img ? (lock === "wall" && wallRatio ? wallRatio : lock === "orig" ? img.naturalWidth / img.naturalHeight : null) : null;
  // keep the box at the locked ratio (ratio is in pixels; box is in fractions)
  useEffect(() => {
    if (!img || !ratio) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let w = r.w, h = (r.w * iw) / ratio / ih;
    if (h > 1) { h = 1; w = (h * ih * ratio) / iw; }
    setR({ x: Math.min(r.x, 1 - w), y: Math.min(r.y, 1 - h), w, h });
  }, [lock, img]);
  function down(e: React.PointerEvent, mode: "move" | "size") { e.preventDefault(); e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { mode, sx: e.clientX, sy: e.clientY, r }; }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d || !box.current || !img) return;
    const b = box.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
    if (d.mode === "move") setR({ ...d.r, x: Math.max(0, Math.min(1 - d.r.w, d.r.x + dx)), y: Math.max(0, Math.min(1 - d.r.h, d.r.y + dy)) });
    else {
      let w = Math.max(0.03, Math.min(1 - d.r.x, d.r.w + dx));
      let h = Math.max(0.03, Math.min(1 - d.r.y, d.r.h + dy));
      if (ratio) { h = (w * img.naturalWidth) / ratio / img.naturalHeight; if (d.r.y + h > 1) { h = 1 - d.r.y; w = (h * img.naturalHeight * ratio) / img.naturalWidth; } }
      setR({ ...d.r, w, h });
    }
  }
  const NW = original?.width || img?.naturalWidth || 1, NH = original?.height || img?.naturalHeight || 1;
  async function save() {
    if (!img) return;
    setBusy(true); setErr("");
    try {
      const isTiff = original && (original.mime === "image/tiff" || /\.tiff?$/i.test(original.filename));
      if (original && isTiff) {
        const { tiffCrop, urlReader } = await import("@/lib/tiff");
        const box = { x: r.x * NW, y: r.y * NH, w: r.w * NW, h: r.h * NH };
        const st = await api("admin/files/start", { body: { orderId, ext: "tif" } });
        const parts: any[] = [];
        setProg("Reading the original…");
        const out = await tiffCrop(urlReader(original.url), box, async (chunk) => { const pr = await putPart(st.key, st.uploadId, parts.length + 1, chunk); parts.push({ partNumber: pr.partNumber, etag: pr.etag }); }, (f) => setProg(`Cropping full resolution: ${Math.floor(f * 100)}%`));
        setProg("Saving…");
        await api("admin/files/complete", { body: { key: st.key, uploadId: st.uploadId, parts, mime: "image/tiff" } });
        await api(`admin/orders/${orderId}/files`, { body: { path: st.path, label: `Cropped print file (TIFF, full resolution)`, width: out.width, height: out.height } });
        setProg(""); onSaved(); return;
      }
      if (original && original.size < 150 * 1024 * 1024 && /image\/(jpeg|png|webp)/.test(original.mime)) {
        setProg("Loading the full-size original…");
        const full = new Image(); full.crossOrigin = "anonymous"; full.src = original.url; await full.decode();
        const sx = Math.round(r.x * full.naturalWidth), sy = Math.round(r.y * full.naturalHeight), sw = Math.round(r.w * full.naturalWidth), sh = Math.round(r.h * full.naturalHeight);
        const c = document.createElement("canvas"); c.width = sw; c.height = sh; c.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
        const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image too large for the browser to crop."))), "image/jpeg", 0.95));
        const t = await api(`admin/orders/${orderId}/crop-url`, { body: { ext: "jpg" } });
        const fd = new FormData(); fd.append("", new File([blob], "crop.jpg", { type: "image/jpeg" }));
        const up = await fetch(t.uploadUrl, { method: "PUT", body: fd }); if (!up.ok) throw new Error("Upload failed");
        await api(`admin/orders/${orderId}/files`, { body: { path: t.path, label: "Cropped print file (full resolution)", width: sw, height: sh } });
        setProg(""); onSaved(); return;
      }
      const sx = Math.round(r.x * img.naturalWidth), sy = Math.round(r.y * img.naturalHeight), sw = Math.round(r.w * img.naturalWidth), sh = Math.round(r.h * img.naturalHeight);
      const c = document.createElement("canvas"); c.width = sw; c.height = sh;
      c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image too large for the browser to crop."))), "image/jpeg", 0.95));
      const t = await api(`admin/orders/${orderId}/crop-url`, { body: { ext: "jpg" } });
      const fd = new FormData(); fd.append("", new File([blob], "crop.jpg", { type: "image/jpeg" }));
      const up = await fetch(t.uploadUrl, { method: "PUT", body: fd });
      if (!up.ok) throw new Error("Upload failed");
      await api(`admin/orders/${orderId}/files`, { body: { path: t.path, label: "Cropped print file", width: sw, height: sh } });
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const px = img ? `${Math.round(r.w * NW)} × ${Math.round(r.h * NH)} px${original ? " of the original" : ""}` : "";
  return <div className="bo-card">
    <h2>Crop print file</h2>
    <div className="bo-row" style={{ marginBottom: 8 }}>
      <select className="bo-sel" style={{ width: 200 }} value={lock} onChange={(e) => setLock(e.target.value as any)}>
        <option value="free">Free crop</option>{wallRatio ? <option value="wall">Customer wall shape</option> : null}<option value="orig">Original shape</option>
      </select><span className="bo-sub">{px}</span>
    </div>
    {err && <div className="bo-msg bad">{err}</div>}
    {prog && <div className="bo-msg">{prog}</div>}
    {original && <div className="bo-sub" style={{ marginBottom: 8 }}>Original: {original.filename} · {original.width} × {original.height} px · {(original.size / 1024 ** 3 >= 1 ? (original.size / 1024 ** 3).toFixed(2) + " GB" : Math.round(original.size / 1024 ** 2) + " MB")}. The crop is cut from the full original; the original is kept.</div>}
    {!img ? <div className="bo-sub">Loading full-size image…</div> :
      <div ref={box} style={{ position: "relative", userSelect: "none", touchAction: "none", lineHeight: 0 }} onPointerMove={move} onPointerUp={() => (drag.current = null)}>
        <img src={img.src} alt="" style={{ width: "100%", display: "block", borderRadius: 6 }} draggable={false} />
        <div onPointerDown={(e) => down(e, "move")} style={{ position: "absolute", left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, border: "2px solid #fff", outline: "1px solid #1c1917", boxSizing: "border-box", cursor: "move", boxShadow: "0 0 0 9999px rgba(0,0,0,.45)" }}>
          <div onPointerDown={(e) => down(e, "size")} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: "#fff", border: "1px solid #1c1917", borderRadius: 3, cursor: "nwse-resize" }} />
        </div>
      </div>}
    <div className="bo-row" style={{ marginTop: 10 }}><button className="bo-btn pri" disabled={!img || busy} onClick={save}>{busy ? "Saving…" : "Save as new print file"}</button><button className="bo-btn" onClick={onCancel}>Cancel</button><span className="bo-sub">The original stays untouched.</span></div>
  </div>;
}
