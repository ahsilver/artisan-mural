import { trackingUrl } from "@/lib/tracking";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";
import { getOrderPrintOriginal } from "@/lib/print-pdf.functions";
import { createPrintPdf } from "@/lib/print-pdf";
import { z } from 'zod';
import { getOrderProjects, linkOrderProject } from '@/lib/custom-projects.functions';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designBySlug, materials, money } from "@/lib/catalog";
import { frameGeometry, wallSelectionSchema } from "@/lib/wall-selection";
import { plainError } from "@/lib/original-source";

type Order = { id: string; design: string; finish: string; sqft: number; total: number; customer: string; email: string; phone: string | null; address: string; status: string; created_at: string; carrier: string | null; tracking: string | null; source: string; deliveryDate: string | null; notes: string | null; selection: unknown; cartId: string | null; paymentMethod: string | null; statusUpdatedAt: string };

const PAYMENT_OPTIONS = ["Card (Sola)", "PayPal", "Bank transfer", "Zelle", "Cash", "Check", "Other"];

/** Full owner view of one order, including the exact part of the design the customer picked. */
export function OrderDetail({ order, onClose, onSavePayment, busy }: { order: Order; onClose: () => void; onSavePayment: (method: string) => void; busy: boolean }) {
  const design = designBySlug(order.design);
  const finish = materials.find(m => m.id === order.finish);
  const parsed = wallSelectionSchema.safeParse(order.selection);
  const sel = parsed.success ? parsed.data : null;
  const box = sel ? frameGeometry(sel) : null;
  const [method, setMethod] = useState(order.paymentMethod ?? "");
  const [original, setOriginal] = useState<File | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [printMessage, setPrintMessage] = useState("");
  const projectsFn=useServerFn(getOrderProjects),linkProject=useServerFn(linkOrderProject);
  const [projects,setProjects]=useState<Awaited<ReturnType<typeof getOrderProjects>>|null>(null),[projectId,setProjectId]=useState('');
  useEffect(()=>{void projectsFn({data:{order:order.id}}).then(r=>{setProjects(r);setProjectId(r.selected??'');}).catch(()=>setProjects(null));},[order.id]);
  const getOriginal = useServerFn(getOrderPrintOriginal);
  async function downloadPrint(format: "pdf" | "tiff") {
    setPrintBusy(true); setPrintMessage("");
    try {
      let bytes: Uint8Array; let type=original?.type || "image/jpeg"; let sourceDesign=design; let sourceSelection=sel;
      if(original){bytes=new Uint8Array(await original.arrayBuffer());}else{
        const saved=await getOriginal({data:{id:order.id}}); type=saved.type;
        const response=await fetch(saved.url);if(!response.ok)throw new Error('Could not download original.');
        bytes=new Uint8Array(await response.arrayBuffer());
        const snapshot=z.object({kind:z.enum(['mural','repeating']),repeat:z.enum(['none','horizontal','vertical','both','halfdrop']).optional(),match:z.enum(['halfdrop','straight']).optional(),repeatCm:z.number().optional(),printHeightCm:z.number().optional(),title:z.string()}).parse(saved.design);
        sourceDesign={...design,...snapshot,match:snapshot.repeat==='halfdrop'||snapshot.match==='halfdrop'?'halfdrop':undefined} as typeof design;
        sourceSelection=wallSelectionSchema.parse(saved.selection);
      }
      if(!sourceDesign||!sourceSelection)throw new Error('Saved print geometry is unavailable.');
      const title=`Order ${order.id} — ${sourceDesign.title}`;
      let blob:Blob;let widthIn:number,heightIn:number,dpi:number|null;
      if(format==='tiff') {const {createPrintTiff}=await import('@/lib/print-tiff');const result=await createPrintTiff(bytes,type,sourceDesign,sourceSelection,title);blob=result.blob;({widthIn,heightIn,dpi}=result);}
      else {if(type==='image/tiff'){const {originalBitmap}=await import('@/lib/original-preview');const bitmap=await originalBitmap(new Blob([new Uint8Array(bytes)],{type}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not convert TIFF for PDF.');ctx.drawImage(bitmap,0,0);bitmap.close();const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not convert TIFF.')),'image/png'));bytes=new Uint8Array(await png.arrayBuffer());}
       const result=await createPrintPdf(bytes,sourceDesign,sourceSelection,title);blob=new Blob([new Uint8Array(result.bytes)],{type:'application/pdf'});({widthIn,heightIn,dpi}=result);}
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Artisan-Mural-${order.id.slice(0,8)}.${format==='tiff'?'tif':'pdf'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      setPrintMessage(`${format.toUpperCase()} downloaded: ${widthIn.toFixed(2)} × ${heightIn.toFixed(2)} inches · ${dpi===null?'vector artwork preserved':`${Math.floor(dpi)} DPI`}. Print at actual size (100%).`);
    } catch (error) { setPrintMessage(plainError(error, "Could not create the print PDF.")); }
    finally { setPrintBusy(false); }
  }
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 border-b border-border py-2 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Order #{order.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Part of the design they picked</p>
          {design && box ? <div className="relative overflow-hidden rounded-md border border-border">
            <img src={design.image} alt={design.title} className="block w-full" />
            <div className="absolute inset-0 bg-foreground/50" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${(box.x - box.w / 2) * 100}% ${(box.y - box.h / 2) * 100}%,${(box.x - box.w / 2) * 100}% ${(box.y + box.h / 2) * 100}%,${(box.x + box.w / 2) * 100}% ${(box.y + box.h / 2) * 100}%,${(box.x + box.w / 2) * 100}% ${(box.y - box.h / 2) * 100}%,${(box.x - box.w / 2) * 100}% ${(box.y - box.h / 2) * 100}%)`, clipRule: "evenodd" }} />
            <div className="absolute border-2 border-primary" style={{ left: `${(box.x - box.w / 2) * 100}%`, top: `${(box.y - box.h / 2) * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />
          </div> : <p className="text-sm text-muted-foreground">{design ? "No crop saved (outside order)." : "Design not found."}</p>}
          {sel && <p className="mt-2 text-xs text-muted-foreground">Bright area inside the blue frame is printed. {sel.wallName ? <b className="font-medium text-foreground">{sel.wallName}: </b> : null}Wall {sel.width} × {sel.height} {sel.unit}{(sel.colorName || sel.color) ? ` · color ${sel.colorName || sel.color}` : ""}.</p>}
          {sel && <section className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Print files</h3>
            <label className="mt-3 block text-xs text-muted-foreground">Manual original (optional, for older orders without a saved original)
              <input aria-label="Original print artwork" type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" disabled={printBusy} className="mt-2 block w-full text-sm" onChange={e => { setOriginal(e.target.files?.[0] ?? null); setPrintMessage(""); }} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2"><Button disabled={printBusy} onClick={()=>void downloadPrint("pdf")}>{printBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {printBusy ? "Preparing PDF…" : "Download print PDF"}</Button><Button variant="outline" disabled={printBusy} onClick={()=>void downloadPrint("tiff")}><Download className="size-4"/>Download print TIFF</Button></div><p className="mt-2 text-xs text-muted-foreground">TIFF is lossless RGB at 250+ DPI. Large walls and vector PDFs may require your printer’s TIFF conversion; no resizing to bypass quality limits.</p>
            {printMessage && <p role="status" className="mt-3 text-sm text-foreground">{printMessage}</p>}
          </section>}
        </div>
        <div>
          {row("Order number", <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>)}
          {order.cartId && row("Cart", <span className="font-mono">{order.cartId.slice(0, 8).toUpperCase()}</span>)}
          {row("Placed", new Date(order.created_at).toLocaleString())}
          {row("Status", order.status.replace("_", " "))}
          {row("Design", `${design?.title ?? order.design}${design?.sku ? ` · ${design.sku}` : ""}`)}
          {row("Finish", finish?.name ?? order.finish)}
          {row("Size", `${order.sqft} sq ft`)}
          {row("Total", money(order.total))}
          {row("Payment method", order.paymentMethod ?? "Not paid yet")}
          {row("Customer", order.customer)}
          {row("Email", order.email || "—")}
          {row("Phone", order.phone || "—")}
          {row("Delivery address", order.address)}
          {order.deliveryDate && row("Deliver by", order.deliveryDate)}
          {order.tracking && row("Tracking", <a className="underline underline-offset-4" href={trackingUrl(order.carrier, order.tracking)!} target="_blank" rel="noreferrer">{`${order.carrier ?? ""} ${order.tracking}`}</a>)}
          {order.notes && row("Notes", order.notes)}
          {!!projects?.offers.length&&<div className="mt-4"><label className="text-sm">Related custom project<select aria-label="Related custom project" value={projectId} onChange={e=>setProjectId(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Choose approved project</option>{projects.offers.map(o=><option key={o.id} value={o.id}>${o.amount} · {o.description}</option>)}</select></label><Button size="sm" variant="outline" className="mt-2" disabled={!projectId||printBusy} onClick={async()=>{setPrintBusy(true);try{await linkProject({data:{order:order.id,offer:projectId}});setPrintMessage('Printing order linked to the customer’s approved custom project.');}catch(e){setPrintMessage(plainError(e,'Could not link project.'));}finally{setPrintBusy(false);}}}>Link printing order</Button></div>}
          <label className="mt-4 block text-sm">Set payment method
            <div className="mt-2 flex gap-2"><select value={method} onChange={e => setMethod(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm"><option value="">Not paid yet</option>{PAYMENT_OPTIONS.map(p => <option key={p}>{p}</option>)}</select><Button size="sm" className="h-10" disabled={busy} onClick={() => onSavePayment(method)}>Save</Button></div>
          </label>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
