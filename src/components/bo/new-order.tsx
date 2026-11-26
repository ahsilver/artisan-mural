import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { shopQuery } from "@/lib/shop";
import { liveDesigns, registerShop, resolvedMaterials, unitPrice, withColorway, type Design } from "@/lib/catalog";
import { designerScaleSelection, frameGeometry, measurementInches, orderSqft, type WallSelection } from "@/lib/wall-selection";
import { createPortal } from "react-dom";
import { WallStage } from "@/components/storefront/size-studio";
import { RepeatAligner, type RepeatFit } from "@/components/designer/repeat-aligner";
import { oneRepeat } from "@/lib/repeat-fix";
import { MIN_PRINT_DPI, createPrintPdf, effectivePrintDpi, printGeometry } from "@/lib/print-pdf";
import { readTiff } from "@/lib/tiff";
import { api, useApi, money, Msg, Field } from "./common";

type Unit = "ft" | "in" | "cm";
const PAY = [["paid", "Paid"], ["unpaid", "Unpaid"], ["invoice", "Invoice"]] as const;
const seg = (on: boolean) => "bo-btn" + (on ? " pri" : "");

async function putFile(orderId: string, blob: Blob, ext: "jpg" | "png", label: string, width?: number, height?: number) {
  const t = await api(`admin/orders/${orderId}/crop-url`, { body: { ext } });
  const fd = new FormData(); fd.append("", new File([blob], `file.${ext}`, { type: ext === "png" ? "image/png" : "image/jpeg" }));
  const up = await fetch(t.uploadUrl, { method: "PUT", body: fd });
  if (!up.ok) throw new Error("The file upload failed.");
  await api(`admin/orders/${orderId}/files`, { body: { path: t.path, label, width, height } });
}
/** A shared Google Drive file, read in pieces through the site (Drive blocks reading it straight from the browser). */
async function driveFile(id: string, say: (t: string) => void): Promise<File> {
  const info = (await api("designer/drive/info", { body: { ids: [id] } })).info?.[0];
  if (!info?.ok) throw new Error("Google Drive didn't share that file. Set sharing to 'Anyone with the link' and try again.");
  if (info.size > 400 * 1024 * 1024) throw new Error(`That file is ${Math.round(info.size / 1048576).toLocaleString()} MB, too big for a web browser to open. Save a JPG copy of it (up to about 15,000 pixels on the longest side) and use that here.`);
  const out = new Uint8Array(info.size); const CH = 8 * 1024 * 1024; let done = 0;
  const ranges: [number, number][] = []; for (let o = 0; o < info.size; o += CH) ranges.push([o, Math.min(CH, info.size - o)]);
  for (let i = 0; i < ranges.length; i += 6) {
    const batch = ranges.slice(i, i + 6);
    const r = await api("designer/drive/ranges", { body: { id, ranges: batch }, raw: true }) as Response;
    if (!r.ok) throw new Error("Could not read the file from Google Drive.");
    const buf = new Uint8Array(await r.arrayBuffer()); const dv = new DataView(buf.buffer); let o = 0;
    for (const [start] of batch) { const len = dv.getUint32(o); o += 4; out.set(buf.subarray(o, o + len), start); o += len; done += len; }
    say(`Reading from Google Drive… ${Math.round((done / info.size) * 100)}%`);
  }
  let file = new File([out], info.name || `drive-${id}`, { type: info.mime || "application/octet-stream" });
  if (/tiff/.test(file.type) || /\.tiff?$/i.test(file.name)) {
    // TIFF: turned into a PNG of the same size, which the print file is made from
    say("Opening the TIFF…"); const { originalBitmap } = await import("@/lib/original-preview");
    const bmp = await originalBitmap(new File([out], file.name, { type: "image/tiff" })); const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d")!.drawImage(bmp, 0, 0); bmp.close();
    const png: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("This TIFF is too large to open here."))), "image/png"));
    file = new File([png], file.name.replace(/\.tiff?$/i, ".png"), { type: "image/png" });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("That file isn't a JPG, PNG, WebP or TIFF picture.");
  return file;
}
async function loadImg(src: string) { const im = new Image(); im.crossOrigin = "anonymous"; im.src = src; await im.decode(); return im; }
/** Crop the wall area out of the artwork (same rectangle as the preview) and save it as the order's print file. */
async function saveCrop(orderId: string, src: string, sel: WallSelection, label: string) {
  const im = await loadImg(src);
  const g = frameGeometry(sel);
  const sx = (g.x - g.w / 2) * im.naturalWidth, sy = (g.y - g.h / 2) * im.naturalHeight, sw = g.w * im.naturalWidth, sh = g.h * im.naturalHeight;
  const k = Math.min(1, 16000 / Math.max(sw, sh), Math.sqrt(200e6 / (sw * sh)));
  const c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext("2d")!.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image too large for the browser to crop."))), "image/jpeg", 0.95));
  await putFile(orderId, blob, "jpg", label, c.width, c.height);
}

/** "Make a print file": the same tools without an order: upload a file, crop it or line up a repeat, download the print file. Nothing is saved. */
export function PrintMaker() { return <NewOrder onDone={() => {}} tool />; }

export function NewOrder({ onDone, tool }: { onDone: (id: string) => void; tool?: boolean }) {
  const { data: shop } = useQuery(shopQuery);
  if (shop) registerShop(shop);
  const designs = useMemo(() => liveDesigns(shop), [shop]);
  const finishes = useMemo(() => resolvedMaterials(shop?.materialSettings), [shop]);
  const [src, setSrc] = useState<"pick" | "upload">(tool ? "upload" : "pick");
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState<string | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [upKind, setUpKind] = useState<"mural" | "repeating">("mural");
  const [repeatIn, setRepeatIn] = useState("24");
  // repeat from an outside file: the owner lines it up on screen; the result is one clean repeat tile (PNG)
  const [repMode, setRepMode] = useState<"both" | "horizontal" | "halfdrop">("both");
  const [align, setAlign] = useState(false); const [fit, setFit] = useState<RepeatFit | null>(null);
  const [tile, setTile] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(null);
  const [srcPx, setSrcPx] = useState<{ w: number; h: number } | null>(null);
  const [srcPxReal, setSrcPxReal] = useState<{ w: number; h: number } | null>(null);
  const [anyDpi, setAnyDpi] = useState(false);
  // Google Drive: one file, or a folder to choose from
  const [dLink, setDLink] = useState(""); const [dBusy, setDBusy] = useState(""); const [dErr, setDErr] = useState("");
  const [dFolder, setDFolder] = useState<{ name: string; files: any[]; stack: { id: string; name: string }[] } | null>(null);
  const [server, setServer] = useState<{ id: string; name: string; size: number } | null>(null);
  const useFile = (f: File) => { setServer(null); setFile(f); setFileUrl(URL.createObjectURL(f)); };
  /** A Drive file too big for the browser: preview from the small picture inside it, true size from its header. */
  async function useServerFile(id: string, info: { name: string; size: number }) {
    setDBusy("Reading the file's size…");
    const read = async (start: number, length: number) => { const r = await api("designer/drive/ranges", { body: { id, ranges: [[start, length]] }, raw: true }) as Response; const b = new Uint8Array(await r.arrayBuffer()); const len = new DataView(b.buffer).getUint32(0); return b.subarray(4, 4 + len); };
    const t = await readTiff(read);
    const prev = await fetch(`/backend/public/drive-thumb?id=${encodeURIComponent(id)}`); if (!prev.ok) throw new Error("This big file has no preview picture inside. Save it as a TIFF with a preview, or use a JPG copy.");
    setFile(null); setFileUrl(URL.createObjectURL(await prev.blob()));
    setServer({ id, name: info.name, size: info.size }); setSrcPxReal({ w: t.width, h: t.height });
  }
  async function openDrive(link: string, stack: { id: string; name: string }[] = []) {
    setDErr(""); const fid = link.match(/\/file\/d\/([\w-]{10,})/)?.[1] || (!/folders/.test(link) ? link.match(/[?&]id=([\w-]{10,})/)?.[1] : undefined);
    try {
      if (fid) {
        const info = (await api("designer/drive/info", { body: { ids: [fid] } })).info?.[0];
        if (info?.ok && info.size > 400 * 1024 * 1024) { if (!/tif/i.test(info.mime || info.name)) throw new Error(`That file is ${Math.round(info.size / 1048576).toLocaleString()} MB. Files this big work as TIFFs (the print service reads them on the server); for other types, save a JPG copy.`); await useServerFile(fid, info); }
        else { setDBusy("Reading from Google Drive…"); useFile(await driveFile(fid, setDBusy)); }
        setDFolder(null);
      }
      else { setDBusy("Opening the folder…"); const r = await api("designer/drive/list", { body: { link } }); setDFolder({ name: r.name || "Folder", files: r.files, stack: [...stack, { id: r.folderId, name: r.name || "Folder" }] }); }
    } catch (e: any) { setDErr(e.message || "Could not open that link."); }
    setDBusy("");
  }
  const [w, setW] = useState("12"); const [h, setH] = useState("9"); const [unit, setUnit] = useState<Unit>("ft");
  const [finish, setFinish] = useState("");
  const [cust, setCust] = useState<"existing" | "new">("existing");
  const [cq, setCq] = useState(""); const [picked, setPicked] = useState<any>(null);
  const [nc, setNc] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState(""); const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"paid" | "unpaid" | "invoice">("unpaid"); const [paidBy, setPaidBy] = useState("Cash / check");
  const [total, setTotal] = useState(""); const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<any>(null); const [busy, setBusy] = useState("");
  const customers = useApi<any>(cust === "existing" ? "admin/crm/customers" : null, [cust]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const base: Design | null = useMemo(() => {
    if (src === "pick") { const d = designs.find((x) => x.slug === slug); return d ? withColorway(d, color) : null; }
    if (!fileUrl) return null;
    const rcm = (Number(repeatIn) || 24) * 2.54, tr = tile ? tile.w / tile.h : srcPx ? srcPx.w / srcPx.h : 1;
    return { slug: "outside-file", title: file?.name ?? "Customer file", image: upKind === "repeating" && tile ? tile.url : fileUrl, kind: upKind,
      ...(upKind === "repeating" ? { repeat: repMode === "horizontal" ? "horizontal" : "both", match: repMode === "halfdrop" ? "halfdrop" : undefined, repeatCm: rcm, printHeightCm: repMode === "horizontal" ? rcm / tr : undefined } : {}) } as any;
  }, [src, designs, slug, color, fileUrl, file, upKind, repeatIn, repMode, tile, srcPx]);
  useEffect(() => { setFit(null); setTile((t) => { if (t) URL.revokeObjectURL(t.url); return null; }); setSrcPx(null); if (!server) setSrcPxReal(null); if (fileUrl) loadImg(fileUrl).then((im) => setSrcPx({ w: im.naturalWidth, h: im.naturalHeight })).catch(() => {}); }, [fileUrl]);
  async function useFit(f: RepeatFit) {
    const im = await loadImg(fileUrl); const c = oneRepeat(im, im.naturalWidth, im.naturalHeight, f);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("This file is too large for the browser."))), "image/png"));
    setTile((t) => { if (t) URL.revokeObjectURL(t.url); return { blob, url: URL.createObjectURL(blob), w: c.width, h: c.height }; });
    setFit(f); setRepMode(f.mode === "sideways" ? "horizontal" : f.mode === "halfdrop" ? "halfdrop" : "both"); setAlign(false);
  }
  /** The exact bytes that get printed: the lined-up tile for repeats, the customer's file for murals (webp turned into PNG). */
  async function printSource(): Promise<{ bytes: Uint8Array; type: string; px: { w: number; h: number } }> {
    if (upKind === "repeating" && tile) return { bytes: new Uint8Array(await tile.blob.arrayBuffer()), type: "image/png", px: { w: tile.w, h: tile.h } };
    if (!file) throw new Error("Upload the customer's file first.");
    if (/png|jpe?g/.test(file.type)) return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, px: srcPx ?? { w: 0, h: 0 } };
    const im = await loadImg(fileUrl); const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d")!.drawImage(im, 0, 0);
    const b: Blob = await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error("Could not read the file."))), "image/png"));
    return { bytes: new Uint8Array(await b.arrayBuffer()), type: "image/png", px: { w: c.width, h: c.height } };
  }
  const jobs = useApi<any>("admin/print-jobs", [busy]);
  useEffect(() => { if (!(jobs.data?.jobs ?? []).some((j: any) => j.status === "queued" || j.status === "running")) return; const t = setInterval(() => jobs.reload(), 4000); return () => clearInterval(t); }, [jobs.data]);
  async function makeOnServer() {
    if (!base || !sel || !server) return;
    setMsg(null); setBusy("Sending it to the print service…");
    try {
      const g = printGeometry(base as any, sel);
      const name = `${server.name.replace(/\.[a-z0-9]+$/i, "")}-${w}x${h}${unit}`;
      await api("admin/print-jobs", { body: { driveId: server.id, widthIn: g.widthIn, heightIn: g.heightIn, dpi: 150, draws: g.draws, crop: upKind === "repeating" && fit ? { w: fit.w, h: fit.h } : undefined, name } });
      setMsg({ ok: true, text: "The print service is making it. It shows below; the Download button appears when it is ready (usually under a minute, a few minutes for the biggest files)." });
    } catch (e: any) { setMsg({ ok: false, text: e.message || "Could not start the print file." }); }
    setBusy("");
  }
  async function downloadJob(id: string) { try { const r = await api(`admin/print-jobs/${id}/download`); window.location.href = r.url; } catch (e: any) { setMsg({ ok: false, text: e.message }); } }
  async function download(kind: "pdf" | "tiff") {
    if (!base || !sel) return;
    setMsg(null); setBusy(kind === "pdf" ? "Making the print PDF…" : "Making the print TIFF…");
    try {
      const s0 = await printSource(); const min = anyDpi ? 1 : MIN_PRINT_DPI; const name = `${(file?.name || "print").replace(/\.[a-z0-9]+$/i, "")}-${w}x${h}${unit}`;
      let blob: Blob;
      if (kind === "pdf") { const r = await createPrintPdf(s0.bytes, base as any, sel, name, min); blob = new Blob([new Uint8Array(r.bytes)], { type: "application/pdf" }); }
      else { const { createPrintTiff } = await import("@/lib/print-tiff"); const r = await createPrintTiff(s0.bytes, s0.type, base as any, sel, name, min); blob = r.blob; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.${kind === "pdf" ? "pdf" : "tif"}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMsg({ ok: true, text: `Print file ready: ${a.download}. It prints at the exact wall size (${w} × ${h} ${unit}).` });
    } catch (e: any) { setMsg({ ok: false, text: e.message || "Could not make the print file." }); }
    setBusy("");
  }
  const dims = { width: Number(w) || 0, height: Number(h) || 0, unit };
  const [sel, setSel] = useState<WallSelection | null>(null);
  // new design or new wall size -> start from the design's own scale, centred
  const key = `${base?.slug}|${base?.image}|${base?.kind}|${repeatIn}|${w}|${h}|${unit}`;
  const lastKey = useRef("");
  useEffect(() => {
    if (!base || !dims.width || !dims.height) { setSel(null); return; }
    if (lastKey.current === key) return;
    const keepArt = sel?.artRatio ?? 1.5;
    const start: WallSelection = { ...dims, zoom: 1, x: 0.5, y: 0.5, artRatio: keepArt, waste: 0 } as any;
    setSel(base.kind === "mural" ? { ...start, zoom: 1 } : designerScaleSelection(base as any, start));
    lastKey.current = key;
  }, [key]);
  // the picture's proportion: from the real file when the print service makes it (the preview inside a TIFF is rounded)
  useEffect(() => { if (base?.image) loadImg(base.image).then((im) => setSel((s) => { if (!s) return s; const r0 = server && srcPxReal ? srcPxReal.w / srcPxReal.h : im.naturalWidth / im.naturalHeight; const r = server && srcPxReal && upKind === "repeating" && fit ? (srcPxReal.w * fit.w) / (srcPxReal.h * fit.h) : r0; return { ...s, artRatio: r }; })).catch(() => {}); }, [base?.image, srcPxReal, fit]);
  useEffect(() => { if (!finish && finishes[0]) setFinish(finishes[0].id); }, [finishes]);
  const material = finishes.find((m) => m.id === finish) ?? finishes[0];
  const real = server && srcPxReal ? srcPxReal : null;
  const px = real ? (upKind === "repeating" && fit ? { w: real.w * fit.w, h: real.h * fit.h } : real) : upKind === "repeating" && tile ? { w: tile.w, h: tile.h } : srcPx;
  let dpi = 0; try { if (src === "upload" && base && sel && px) dpi = Math.floor(effectivePrintDpi(px.w, px.h, printGeometry(base as any, sel))); } catch {}
  const sqft = dims.width && dims.height ? orderSqft(dims as any) : 0;
  const auto = Math.round(sqft * unitPrice(src === "pick" ? base ?? undefined : undefined, material) * 100) / 100;
  useEffect(() => { if (!touched) setTotal(auto ? String(auto) : ""); }, [auto, touched]);

  const list = designs.filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const people = (customers.data?.customers ?? []).filter((c: any) => !cq || `${c.email ?? ""} ${c.name ?? ""} ${c.company ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(cq.toLowerCase())).slice(0, 6);
  const custName = cust === "existing" ? picked?.name || picked?.email || "" : nc.name;

  async function save() {
    setMsg(null);
    if (!base || !sel) return setMsg({ ok: false, text: "Pick a design or upload a file, and enter the wall size." });
    if (!custName.trim()) return setMsg({ ok: false, text: "Choose a customer or type the new customer's name." });
    if (file && file.size > 95 * 1024 * 1024) return setMsg({ ok: false, text: "That file is over 95 MB. Send it to the order after saving, or use a smaller copy." });
    try {
      setBusy("Saving the order…");
      const selection = { ...sel, color: src === "pick" ? color : undefined, colorName: src === "pick" ? base.colorways?.find((c) => c.id === color)?.name : undefined, outside: { kind: base.kind, repeatIn: base.kind === "repeating" && src === "upload" ? Number(repeatIn) : undefined, repeat: base.kind === "repeating" && src === "upload" ? repMode : undefined, fit: fit ?? undefined, file: file?.name } };
      const r = await api("admin/orders", { body: { design: src === "pick" ? base.slug : "outside-file", finish: material?.name ?? finish, selection, sqft: Math.round(sqft * 10) / 10, total: Number(total) || 0,
        customer: custName.trim(), email: cust === "existing" ? picked?.email ?? "" : nc.email, phone: cust === "existing" ? picked?.phone || null : nc.phone || null, userId: cust === "existing" ? picked?.user_id || undefined : undefined,
        address, notes, paymentStatus: pay, paidBy } });
      const wall = `${w} x ${h} ${unit}`;
      if (file) { setBusy("Uploading the customer's file…"); await putFile(r.id, file, file.type === "image/png" ? "png" : "jpg", base.kind === "repeating" && !tile ? `Customer file (repeat tile, ${repeatIn} in wide)` : "Customer file (original)"); }
      if (tile && base.kind === "repeating") { setBusy("Saving the lined-up repeat…"); await putFile(r.id, tile.blob, "png", `Print tile: one repeat, ${repeatIn} in wide (${repMode === "horizontal" ? "sideways" : repMode === "halfdrop" ? "half-drop" : "all sides"})`, tile.w, tile.h); }
      if (base.kind === "mural") {
        setBusy("Saving the crop as the print file…");
        let src2 = base.image, full = !!file;
        if (!file) { const o = await api(`admin/orders/${r.id}`); const og = o.art?.original; if (og && og.size < 150 * 1024 * 1024 && /image\/(jpeg|png|webp)/.test(og.mime)) { src2 = og.url; full = true; } }
        await saveCrop(r.id, src2, sel, full ? `Print file (cropped to the wall, ${wall})` : `Crop preview (${wall}); for full size use Crop on the print original`);
      }
      setBusy(""); onDone(r.id);
    } catch (e: any) { setBusy(""); setMsg({ ok: false, text: e.message || "Could not save the order." }); }
  }

  return <div className="bo-new-order">
    {tool ? <><h2>Make a print file</h2><div className="bo-sub" style={{ marginBottom: 12 }}>For yourself: upload any design, crop it or line it up as a repeat, choose the wall size, and download a print-ready PDF or TIFF. Nothing goes on the website and no order is made. To charge a customer for it, use Orders → New order instead.</div></>
      : <><h2>New order</h2><div className="bo-sub" style={{ marginBottom: 12 }}>For orders that came by phone, email or the showroom.</div></>}
    <Msg m={msg} />
    <div className={tool ? "mk" : undefined}><div className={tool ? "mk-l" : undefined}>
    <h3 className="bo-h3">1. Design</h3>
    {!tool && <div className="bo-row" style={{ marginBottom: 8 }}><button type="button" className={seg(src === "pick")} onClick={() => setSrc("pick")}>Pick a design</button><button type="button" className={seg(src === "upload")} onClick={() => setSrc("upload")} data-testid="no-upload-tab">Upload a file</button></div>}
    {src === "pick" ? <div>
      <input className="bo-in" placeholder="Search designs" value={q} onChange={(e) => setQ(e.target.value)} data-testid="no-design-q" />
      <div className="bo-pick">{list.map((d) => <button type="button" key={d.slug} className={"bo-pick-item" + (d.slug === slug ? " on" : "")} onClick={() => { setSlug(d.slug); setColor(d.colorways?.[0]?.id); }}><img src={d.image} alt="" loading="lazy" /><span>{d.title}<small>{d.kind === "repeating" ? "Repeat" : "Mural"}</small></span></button>)}</div>
      {base?.colorways && base.colorways.length > 1 && <Field label="Color"><select className="bo-sel" value={color} onChange={(e) => setColor(e.target.value)}>{base.colorways.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    </div> : <div>
      <div className="mk-up"><label className="btn btn-wine btn-sm">{file ? "Choose another file" : "Upload a file"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" data-testid="no-file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileUrl(f ? URL.createObjectURL(f) : ""); }} /></label><span className="bo-sub">{file ? file.name : tool ? "The design: JPG, PNG or WebP" : "The customer's file: JPG, PNG or WebP"}</span></div>
      <Field label="…or from Google Drive: a link to one file or a folder"><div className="bo-row"><input className="bo-in" style={{ flex: 1 }} placeholder="https://drive.google.com/…" value={dLink} onChange={(e) => setDLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void openDrive(dLink.trim()); } }} data-testid="no-drive" /><button type="button" className="bo-btn" disabled={!!dBusy || !dLink.trim()} onClick={() => void openDrive(dLink.trim())} data-testid="no-drive-go">Open</button></div></Field>
      {dBusy && <div className="bo-sub" role="status">{dBusy}</div>}{dErr && <div className="bo-sub err" role="alert">{dErr}</div>}
      {dFolder && <div className="bo-dfolder" data-testid="no-dfolder">
        <div className="bo-row" style={{ justifyContent: "space-between" }}><span className="bo-sub">{dFolder.stack.map((x, i) => <span key={x.id}>{i ? " › " : ""}{i < dFolder.stack.length - 1 ? <button type="button" className="up-link" onClick={() => void openDrive(`https://drive.google.com/drive/folders/${x.id}`, dFolder.stack.slice(0, i))}>{x.name}</button> : <b>{x.name}</b>}</span>)}</span><button type="button" className="up-link" onClick={() => setDFolder(null)}>Close</button></div>
        <div className="bo-dgrid">{dFolder.files.filter((f: any) => f.folder || /image|tif/i.test(f.type) || /\.(jpe?g|png|webp|tiff?)$/i.test(f.name)).map((f: any) => <button key={f.id} type="button" disabled={!!dBusy} onClick={() => void (f.folder ? openDrive(f.link, dFolder.stack) : openDrive(`https://drive.google.com/file/d/${f.id}/view`))}>
          {f.folder ? <span className="bo-dfold">📁</span> : <img src={/\.tiff?$/i.test(f.name) || /tif/.test(f.type) ? `/backend/public/drive-thumb?id=${f.id}` : `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`} alt="" loading="lazy" />}<span>{f.name}</span></button>)}</div>
        <div className="bo-sub">Tap a picture to use it, or a folder to open it.</div></div>}
      <div className="bo-row"><button type="button" className={seg(upKind === "mural")} onClick={() => setUpKind("mural")}>Mural</button><button type="button" className={seg(upKind === "repeating")} onClick={() => setUpKind("repeating")} data-testid="no-kind-repeat">Repeat</button>
        {upKind === "repeating" && <label className="bo-inline">Repeat width <input className="bo-in" style={{ width: 70 }} type="number" value={repeatIn} onChange={(e) => setRepeatIn(e.target.value)} /> in</label>}</div>
      {upKind === "repeating" && fileUrl && <div className="bo-row" style={{ marginTop: 8, alignItems: "center" }}>
        <button type="button" className="bo-btn pri" onClick={() => setAlign(true)} data-testid="no-align">{fit ? "Line up the repeat again" : "Line up the repeat"}</button>
        {tile ? <span className="bo-sub">✓ One clean repeat: {tile.w.toLocaleString()} × {tile.h.toLocaleString()} px · {repMode === "horizontal" ? "sideways only" : repMode === "halfdrop" ? "half-drop" : "all sides"}{fit?.blend ? " · ends faded together" : ""}</span>
          : <span className="bo-sub">Drag the copies until they join, zoom on the join, see it on a wall. Or use the whole file as one repeat.</span>}
      </div>}
      {align && typeof document !== "undefined" && createPortal(<div className="am"><div className="ra-modal" role="dialog" aria-modal="true" aria-label="Line up the repeat"><div className="ra-sheet"><div className="ra-head"><b>Line up the repeat</b></div>
        <RepeatAligner src={fileUrl} mode={repMode === "horizontal" ? "sideways" : repMode === "halfdrop" ? "halfdrop" : "straight"} {...(fit ? { initial: fit } : {})} onSave={(f) => void useFit(f).catch((e) => setMsg({ ok: false, text: e.message }))} onCancel={() => setAlign(false)} />
      </div></div></div>, document.body)}
    </div>}
    <h3 className="bo-h3">{tool ? "2. Wall" : "2. Wall and finish"}</h3>
    <div className="bo-grid3 bo-wall"><Field label="Wall width"><input className="bo-in" type="number" value={w} onChange={(e) => setW(e.target.value)} data-testid="no-w" /></Field><Field label="Wall height"><input className="bo-in" type="number" value={h} onChange={(e) => setH(e.target.value)} data-testid="no-h" /></Field><Field label="Unit"><select className="bo-sel" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}><option value="ft">feet</option><option value="in">inches</option><option value="cm">cm</option></select></Field></div>
    </div><div className={tool ? "mk-r" : undefined}>
    {tool && !(base && sel) && <div className="mk-empty">Upload a design or open it from Google Drive. Your wall shows here, with the print file box under it.</div>}
    {base && sel && <div className="bo-preview" data-testid="no-preview"><div className="am"><WallStage design={base} selection={sel} onChange={setSel} maxH={tool ? 0.56 : 0.4} /></div>
      <div className="bo-sub" style={{ marginTop: 6 }}>{base.kind === "mural" ? (tool ? "Drag the picture to choose the part that goes on the wall. The print file is exactly what you see." : "Drag the picture to choose the part that goes on the wall. This crop is saved as the print file.") : "The pattern repeats across the wall in panels. Use the size slider to change the scale."}</div>
      {src === "upload" && <div className="bo-printbox" data-testid="no-printbox"><b>Ready to print</b>
        <span className={"bo-sub" + (dpi && dpi < MIN_PRINT_DPI ? " err" : "")}>{dpi ? `${dpi} DPI at this size · ${dpi >= 200 ? "very sharp" : dpi >= MIN_PRINT_DPI ? "good from a normal distance" : `below ${MIN_PRINT_DPI} DPI, will look soft`}` : "…"}. The file is exactly {w} × {h} {unit}, in numbered-panel width, {base.kind === "mural" ? "cropped to what you see" : "repeated across the wall as you see it"}.</span>
        {dpi > 0 && dpi < MIN_PRINT_DPI && <label className="bo-inline"><input type="checkbox" checked={anyDpi} onChange={(e) => setAnyDpi(e.target.checked)} /> Make it anyway (the customer accepts a softer print)</label>}
        {server ? <><div className="bo-sub">{server.name} is {(server.size / 1073741824).toFixed(1)} GB: too big to open here, so the print service makes it from the full file on the server. The preview above uses the small picture saved inside the file.</div>
          <div className="bo-row"><button type="button" className="bo-btn pri" disabled={!!busy || (dpi > 0 && dpi < MIN_PRINT_DPI && !anyDpi)} onClick={() => void makeOnServer()} data-testid="no-server">Make the print file on the server</button></div></>
          : <div className="bo-row"><button type="button" className="bo-btn pri" disabled={!!busy} onClick={() => void download("pdf")} data-testid="no-pdf">Download print PDF</button><button type="button" className="bo-btn" disabled={!!busy} onClick={() => void download("tiff")} data-testid="no-tiff">Download print TIFF</button></div>}
      </div>}</div>}
      {src === "upload" && (jobs.data?.jobs ?? []).length > 0 && <div className="bo-jobs" data-testid="no-jobs"><b>Print files made on the server</b>
        <ul>{jobs.data.jobs.slice(0, 8).map((j: any) => <li key={j.id}><span className="bo-jn">{j.name}.tif<small>{new Date(j.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {j.width_in / 12} × {j.height_in / 12} ft · {j.dpi} DPI{j.bytes ? ` · ${(j.bytes / 1048576).toFixed(0)} MB` : ""}</small></span>
          {j.status === "done" ? <button type="button" className="bo-btn pri" onClick={() => void downloadJob(j.id)} data-testid="no-job-dl">Download</button> : j.status === "failed" ? <span className="bo-sub err" title={j.error}>Failed: {j.error}</span> : <span className="bo-sub">{j.status === "running" ? "Making it…" : "Waiting…"}</span>}</li>)}</ul></div>}
    </div></div>
    {!tool && <>
    <Field label="Finish"><select className="bo-sel" value={finish} onChange={(e) => setFinish(e.target.value)}>{finishes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
    <h3 className="bo-h3">3. Customer</h3>
    <div className="bo-row" style={{ marginBottom: 8 }}><button type="button" className={seg(cust === "existing")} onClick={() => setCust("existing")}>Existing customer</button><button type="button" className={seg(cust === "new")} onClick={() => setCust("new")} data-testid="no-cust-new">New customer</button></div>
    {cust === "existing" ? <div>{picked ? <div className="bo-row"><span><b style={{ fontWeight: 500 }}>{picked.name || picked.email}</b> <span className="bo-sub">{[picked.company, picked.email, picked.phone].filter(Boolean).join(" · ")}</span></span><button type="button" className="bo-btn" onClick={() => setPicked(null)}>Change</button></div>
      : <><input className="bo-in" placeholder={customers.data ? "Search customers by name, email, phone" : "Loading customers…"} value={cq} onChange={(e) => setCq(e.target.value)} data-testid="no-cust-q" />
        <div className="bo-people">{people.map((c: any) => <button type="button" key={c.id} onClick={() => { setPicked(c); if (!address.trim() && (c.ship_address || c.address)) setAddress(c.ship_address || c.address); }} data-testid="no-cust-opt">{c.name || c.email || "(no name)"}{c.company ? ` · ${c.company}` : ""}<small>{[c.email, c.phone].filter(Boolean).join(" · ")}</small></button>)}</div></>}</div>
      : <div className="bo-grid3"><Field label="Name"><input className="bo-in" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} data-testid="no-cust-name" /></Field><Field label="Email"><input className="bo-in" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field><Field label="Phone"><input className="bo-in" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field></div>}
    <Field label="Shipping address (optional)"><textarea className="bo-ta" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
    <h3 className="bo-h3">4. Price and payment</h3>
    <div className="bo-grid2"><Field label="Total ($)" hint={auto ? `Website price: ${money(auto)} (${sqft.toFixed(1)} sq ft)` : undefined}><input className="bo-in" type="number" value={total} onChange={(e) => { setTouched(true); setTotal(e.target.value); }} data-testid="no-total" /></Field>
      <Field label="Payment"><div className="bo-row">{PAY.map(([k, l]) => <button type="button" key={k} className={seg(pay === k)} onClick={() => setPay(k)} data-testid={"no-pay-" + k}>{l}</button>)}</div></Field></div>
    {pay === "paid" && <Field label="Paid by"><select className="bo-sel" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}><option>Cash / check</option><option>Card (Sola)</option><option>PayPal</option><option>Bank transfer</option><option>Other</option></select></Field>}
    <Field label="Notes"><textarea className="bo-ta" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    <div className="bo-row" style={{ marginTop: 6 }}><button className="bo-btn pri" disabled={!!busy} onClick={save} data-testid="no-save">{busy || "Save order"}</button></div>
    </>}
  </div>;
}
