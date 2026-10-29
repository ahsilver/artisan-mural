import { useMemo, useRef, useState } from "react";
import { useApi, fmtDate, Pill } from "./common";
import { printGeometry } from "@/lib/print-pdf";
import { repeatStyle } from "@/lib/wall-selection";
import { outSize, type Plan } from "@/lib/print-ready-core";

export const PRINT_DPI = 250;
const gb = (b: number) => (b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(1) + " GB" : Math.max(1, Math.round(b / 1024 ** 2)) + " MB");
const fmtIn = (inch: number) => { if (inch < 24) return `${Math.round(inch * 10) / 10} in`; const ft = Math.floor(inch / 12), i = Math.round(inch - ft * 12); return i === 0 ? `${ft} ft` : i === 12 ? `${ft + 1} ft` : `${ft} ft ${i} in`; };

/** The print plan for an order: the whole wall at 250 DPI. Repeat = tiled with its match; mural = the customer's own crop. */
export function orderPlan(order: any, dpi = PRINT_DPI): { plan?: Plan; tile?: Plan; error?: string; repeat?: boolean } {
  const snap = order?.print_design_snapshot, sel = order?.selection;
  if (!snap || !sel?.width) return { error: "This order has no saved design size, so a print file can't be made automatically." };
  try {
    const norm = snap.repeat === "halfdrop" || snap.match === "halfdrop" ? { ...snap, repeat: "both" } : snap;
    const repeat = snap.kind !== "mural" && repeatStyle(norm) !== "none";
    const g = printGeometry(snap, sel);
    const plan: Plan = { widthIn: g.widthIn, heightIn: g.heightIn, draws: g.draws, repeat, dpi };
    const d = g.draws[0];
    const tile: Plan | undefined = repeat && d ? { widthIn: d.w * g.widthIn, heightIn: d.h * g.heightIn, draws: [{ x: 0, y: 0, w: 1, h: 1 }], repeat: false, dpi } : undefined;
    return { plan, tile, repeat };
  } catch (e: any) { return { error: String(e?.message || e) }; }
}

/** Vector originals (PDF / SVG / AI): drawn sharp in the browser at the size the print needs (up to 16,000 px a side). */
async function rasterizeVector(url: string, mime: string, needW: number, needH: number) {
  const res = await fetch(url); if (!res.ok) throw new Error(`Could not download the original (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const k = Math.min(1, 16000 / Math.max(needW, needH), Math.sqrt(200e6 / (needW * needH)));
  const W = Math.max(1, Math.round(needW * k)), H = Math.max(1, Math.round(needH * k));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  if (head.startsWith("%PDF")) {
    const pdfjs: any = await import("pdfjs-dist"); const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as any);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({ data: bytes }); const doc = await task.promise;
    try { const page = await doc.getPage(1), base = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: Math.min(W / base.width, H / base.height) }); await page.render({ canvas: cv, canvasContext: ctx, viewport: vp, transform: [W / vp.width, 0, 0, H / vp.height, 0, 0] }).promise; }
    finally { await task.destroy(); }
  } else if (/<svg[\s>]/i.test(head) || /svg/.test(mime)) {
    const u = URL.createObjectURL(new Blob([bytes], { type: "image/svg+xml" }));
    try { const img = new Image(); img.src = u; await img.decode(); ctx.drawImage(img, 0, 0, W, H); } finally { URL.revokeObjectURL(u); }
  } else throw new Error("This vector file type (EPS) can't be drawn in the browser. Download the original file and print it from Illustrator.");
  const id = ctx.getImageData(0, 0, W, H).data; const out = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < id.length; i += 4, j += 3) { out[j] = id[i]; out[j + 1] = id[i + 1]; out[j + 2] = id[i + 2]; }
  return { w: W, h: H, n: 3, data: out, photometric: 2 };
}

function safeName(s: string) { return s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "design"; }

export function ReadyToPrint({ order, art, compact }: { order: any; art: any; compact?: boolean }) {
  const p = useMemo(() => orderPlan(order), [order?.id]);
  const [st, setSt] = useState<{ stage?: string; pct?: number; done?: string; err?: string; busy?: boolean }>({});
  const wk = useRef<Worker | null>(null);
  const original0 = art?.original;
  // same-origin link: range reads of big files work without cross-site checks
  const original = original0 ? { ...original0, url: (() => { try { const u = new URL(original0.url, window.location.origin); return window.location.origin + u.pathname + u.search; } catch { return original0.url; } })() } : null;
  if (!original) return <div className="rp-box"><div className="bo-sub">No print original is stored for this design{order?.design_slug && !String(order.design_slug).startsWith("u-") ? " (built-in sample design)" : ""}, so there is nothing to print from yet.</div></div>;
  if (p.error || !p.plan) return <div className="rp-box"><div className="bo-sub">{p.error}</div><a className="bo-btn" href={original.url + "&download=" + encodeURIComponent(original.filename)}>Original file</a></div>;
  const full = outSize(p.plan), n = /tif/.test(original.mime || "") ? 4 : 3;
  const sel = order.selection;
  async function run(plan: Plan, label: string) {
    const { W, H } = outSize(plan);
    const name = `${safeName(order.design_title || "design")}-${String(order.id).slice(0, 8)}-${label}-${W}x${H}px-${plan.dpi}dpi.tif`;
    let handle: any = null;
    try { if ((window as any).showSaveFilePicker) handle = await (window as any).showSaveFilePicker({ suggestedName: name, types: [{ description: "TIFF image", accept: { "image/tiff": [".tif", ".tiff"] } }] }); }
    catch (e: any) { if (e?.name === "AbortError") return; handle = null; }
    setSt({ busy: true, stage: "Starting", pct: 0 });
    wk.current?.terminate();
    const w = new Worker(new URL("../../lib/print-ready.worker.ts", import.meta.url), { type: "module" }); wk.current = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") setSt({ busy: true, stage: m.stage, pct: m.pct });
      else if (m.type === "done") {
        if (m.blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(m.blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 120000); }
        setSt({ done: `Saved ${name} · ${m.W.toLocaleString()} × ${m.H.toLocaleString()} px · ${plan.dpi} DPI · ${m.n === 4 ? "CMYK" : m.n === 1 ? "grayscale" : "RGB"} · LZW TIFF${m.big ? " (BigTIFF)" : ""} · ${gb(m.size)} · ${m.secs}s` });
        w.terminate();
      } else if (m.type === "error") { setSt({ err: m.message }); w.terminate(); }
    };
    const isVector = /pdf|svg|postscript|illustrator/.test(original.mime || "") || /\.(pdf|svg|ai|eps)$/i.test(original.filename || "");
    if (isVector) {
      try { setSt({ busy: true, stage: "Drawing the vector original", pct: 0 }); const d = plan.draws[0]; const raster = await rasterizeVector(original.url, original.mime || "", Math.ceil(d.w * W), Math.ceil(d.h * H)); w.postMessage({ plan, handle, raster }, [raster.data.buffer]); }
      catch (e: any) { setSt({ err: String(e?.message || e) }); w.terminate(); }
      return;
    }
    w.postMessage({ url: original.url, mime: original.mime, plan, handle });
  }
  const what = p.repeat ? `Full repeat for the whole wall` : `The customer's mural crop`;
  return <div className="rp-box" data-testid="ready-to-print">
    <button type="button" className="rp-main" disabled={st.busy} onClick={() => run(p.plan!, "READY")} data-testid="ready-print-btn">
      <span className="rp-t">Ready to print ({PRINT_DPI} DPI)</span>
      <span className="rp-s">{what} · {fmtIn(p.plan.widthIn)} × {fmtIn(p.plan.heightIn)}{sel?.unit ? ` (${sel.width} × ${sel.height} ${sel.unit})` : ""} · {full.W.toLocaleString()} × {full.H.toLocaleString()} px · TIFF (LZW)</span>
    </button>
    {st.busy && <div className="rp-prog"><div style={{ width: `${Math.round((st.pct ?? 0) * 100)}%` }} /><span>{st.stage}… {Math.round((st.pct ?? 0) * 100)}%</span></div>}
    {st.done && <div className="bo-msg ok" role="status">{st.done}</div>}
    {st.err && <div className="bo-msg err" role="alert">{st.err}</div>}
    {!compact && <div className="bo-sub" style={{ marginTop: 6 }}>Made in your browser from the designer's original{p.repeat ? ", tiled with its match" : ", cropped exactly where the customer placed it"}. Uncompressed it would be about {gb(full.W * full.H * n)}; LZW makes it smaller. Large walls take a few minutes. Use a computer (Chrome or Edge) for big files.</div>}
    {!compact && <PrintViews plan={p.plan} repeat={p.repeat} src={art?.url} />}
    <div className="rp-sec"><span className="rp-lbl">Other files</span>
      <a className="bo-btn sm" href={original.url + "&download=" + encodeURIComponent(original.filename)} target="_blank" rel="noreferrer">Original file{original.size ? ` (${gb(original.size)})` : ""}</a>
      {p.tile && <button type="button" className="bo-btn sm" disabled={st.busy} onClick={() => run(p.tile!, "tile")}>Single repeat tile ({PRINT_DPI} DPI)</button>}
    </div>
  </div>;
}

/** Two clear pictures for the owner: the full original (with the printed area framed) and exactly what prints. */
export function PrintViews({ plan, repeat, src }: { plan: Plan; repeat?: boolean; src?: string }) {
  if (!src || !plan?.draws?.length) return null;
  const ar = plan.widthIn / plan.heightIn;
  const d0 = plan.draws[0];
  const frame = !repeat ? { l: -d0.x / d0.w, t: -d0.y / d0.h, w: 1 / d0.w, h: 1 / d0.h } : null;
  const draws = plan.draws.slice(0, 600);
  return <div className="rp-views" data-testid="print-views">
    <figure className="rp-view"><figcaption>Full original</figcaption>
      <div className="rp-view-box"><div className="rp-orig"><img src={src} alt="The full original design" />
        {frame && <div className="rp-frame" style={{ left: `${frame.l * 100}%`, top: `${frame.t * 100}%`, width: `${frame.w * 100}%`, height: `${frame.h * 100}%` }}><span>Prints</span></div>}
      </div></div>
      <span className="rp-cap">{repeat ? "One repeat tile, as the designer uploaded it." : "The blue frame is the part the customer chose."}</span>
    </figure>
    <figure className="rp-view"><figcaption>What prints ({fmtIn(plan.widthIn)} × {fmtIn(plan.heightIn)})</figcaption>
      <div className="rp-view-box"><div className="rp-wall" style={{ aspectRatio: String(ar), ["--ar" as any]: String(ar) }}>
        {draws.map((d, i) => <img key={i} src={src} alt="" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.w * 100}%`, height: `${d.h * 100}%` }} />)}
      </div></div>
      <span className="rp-cap">{repeat ? "The full repeat, tiled across the whole wall." : "Exactly the crop, edge to edge."} The button above makes this file.</span>
    </figure>
  </div>;
}

const PRINT_STATUSES = ["paid", "ready_to_print", "processing", "printing", "awaiting_payment", "waiting_on_designer"];
/** Back office "Print": every open order with its one Ready-to-print button. */
export function PrintQueue() {
  const { data, error } = useApi<any>("admin/orders?status=&q=&from=&to=", []);
  const [open, setOpen] = useState<string | null>(null);
  if (error) return <div className="bo-sub">{error}</div>;
  if (!data) return <div className="bo-sub">Loading…</div>;
  const list = (data.orders ?? []).filter((o: any) => PRINT_STATUSES.includes(o.status));
  return <div>
    <div className="bo-top"><h1>Print</h1></div>
    <div className="bo-sub" style={{ marginBottom: 12 }}>One button per order makes the file you send to the printer: the full repeat for the customer's wall, or the exact mural area the customer chose. Always {PRINT_DPI} DPI, LZW TIFF. Originals stay one click away below it.</div>
    {list.length === 0 ? <div className="bo-empty">Nothing to print.</div> : list.map((o: any) => <div key={o.id} className="bo-card" style={{ marginBottom: 10 }} data-testid="print-row">
      <div className="bo-row" style={{ justifyContent: "space-between" }}>
        <div className="bo-row" style={{ flexWrap: "nowrap" }}>{o.thumb && <img src={o.thumb} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />}<div><b style={{ fontWeight: 600 }}>{o.design_title}</b> <span className="bo-sub">#{String(o.id).slice(0, 8).toUpperCase()} · {o.customer_name || o.customer_email} · {fmtDate(o.created_at)}</span><div className="bo-sub">{(() => { try { const s = typeof o.selection === "string" ? JSON.parse(o.selection) : o.selection; return s?.width ? `Wall ${s.width} × ${s.height} ${s.unit}${s.wallName ? ` · ${s.wallName}` : ""}` : ""; } catch { return ""; } })()}</div></div></div>
        <div className="bo-row"><Pill>{String(o.status).replace(/_/g, " ")}</Pill><button type="button" className="bo-btn sm" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? "Hide" : "Print files"}</button></div>
      </div>
      {open === o.id && <PrintRow id={o.id} />}
    </div>)}
  </div>;
}
function PrintRow({ id }: { id: string }) {
  const { data, error } = useApi<any>("admin/orders/" + id, [id]);
  if (error) return <div className="bo-sub">{error}</div>;
  if (!data) return <div className="bo-sub">Loading…</div>;
  return <ReadyToPrint order={data.order} art={data.art} />;
}
