import { useState } from "react";
import { api } from "@/components/bo/common";
import { uploadFile } from "@/lib/designer-files";
import { categoryOf, type SampleRoom } from "@/lib/room-mask";
import { RoomCategoryTabs, usedCategories } from "@/components/room-category-tabs";
import { MAX_MOCKUP_ROOMS, MOCKUP_ROOMS, makeSampleMockup, resolveMockupRoom, sampleRoomById } from "@/lib/auto-mockup";

/** "Show it in these rooms": pick up to 5 sample rooms (in order) for a design's room pictures. */
export function MockupRoomPicker({ value, onChange, max = MAX_MOCKUP_ROOMS }: { value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= max ? value : [...value, id]);
  const [cat, setCat] = useState<string>("home");
  const counts = Object.fromEntries(usedCategories().map((c) => [c.id, value.filter((id) => categoryOf(sampleRoomById(id)) === c.id).length]));
  return <div data-testid="mockup-room-picker">
    <div style={{ marginBottom: 8 }}><RoomCategoryTabs value={cat} onChange={setCat} counts={counts} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
      {MOCKUP_ROOMS.filter((r) => categoryOf(r) === cat || usedCategories().length < 2).map((r) => { const n = value.indexOf(r.id); const on = n >= 0; const full = !on && value.length >= max;
        return <button key={r.id} type="button" onClick={() => toggle(r.id)} disabled={full} aria-pressed={on} title={full ? `Up to ${max} rooms` : r.name}
          style={{ position: "relative", padding: 0, border: on ? "2px solid #1c1917" : "1px solid #e7e5e4", borderRadius: 8, background: "#fff", overflow: "hidden", opacity: full ? 0.45 : 1, cursor: full ? "not-allowed" : "pointer", textAlign: "left" }}>
          <img src={r.thumb} alt="" loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "cover" }} />
          <span style={{ display: "block", padding: "4px 6px", fontSize: 11.5, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          {on && <span style={{ position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: 10, background: "#1c1917", color: "#fff", fontSize: 11, display: "grid", placeItems: "center" }}>{n + 1}</span>}
        </button>; })}
    </div>
    <div className="bo-sub" style={{ marginTop: 6 }}>{value.length} of {max} chosen{value.length ? ` · shown in this order: ${value.map((id) => sampleRoomById(id)?.name).filter(Boolean).join(", ")}` : ""}</div>
  </div>;
}

type Dims = { kind: "mural" | "repeating"; widthCm: number; heightCm: number; repeat?: string };
/** Make the room pictures for every color in the chosen rooms (exact design, no AI) and make them the shop's pictures. */
const loadI = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("Could not load the picture.")); i.src = src; });
const jpg = (src: CanvasImageSource, w: number, h: number, max: number) => { const k = Math.min(1, max / Math.max(w, h)); const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.88); };
const ftIn = (inch: number) => { const t = Math.round(inch); return `${Math.floor(t / 12)} ft${t % 12 ? ` ${t % 12} in` : ""}`; };
/** A room picture made by the image model from the sample room photo + the design (the same repaint as "See it in your room"). */
export async function aiSceneMockup(designSrc: string, dims: Dims, room: SampleRoom): Promise<Blob> {
  const [ri, di] = await Promise.all([loadI(room.image), loadI(designSrc)]);
  const style = dims.kind === "mural" ? "none" : dims.repeat === "horizontal" ? "horizontal" : "both";
  let design: string; const strip = style === "horizontal";
  if (strip) { // sideways only: the whole wall already laid out, one copy = full wall height
    const r0 = di.naturalWidth / di.naturalHeight, ar = room.widthIn / room.heightIn, hh = Math.min(di.naturalHeight, 1024, Math.floor(3800 / ar)), ww = Math.round(hh * ar), one = hh * r0;
    const c = document.createElement("canvas"); c.width = ww; c.height = hh; const x = c.getContext("2d")!; for (let X = (ww % one) / 2 - (ww % one ? one : 0); X < ww; X += one) x.drawImage(di, X, 0, one, hh);
    design = jpg(c, ww, hh, 1600);
  } else design = jpg(di, di.naturalWidth, di.naturalHeight, 1024);
  const scaleText = style === "none" ? `the mural is one scene covering the whole wall, about ${ftIn(room.widthIn)} wide and ${ftIn(room.heightIn)} tall; crop it to fit, never stretch it.`
    : strip ? `image 2 is the whole wall, about ${ftIn(room.widthIn)} wide and ${ftIn(room.heightIn)} tall, already laid out at its real size.`
    : `one pattern repeat (all of image 2) is about ${Math.round(dims.widthCm / 2.54)} in wide on the wall; the wall is about ${ftIn(room.heightIn)} tall, so show the pattern at that real size, not shrunk.`;
  const r: any = await api("ai/render", { body: { purpose: "mockup", mode: "photo", room: jpg(ri, ri.naturalWidth, ri.naturalHeight, 1280), design, w: ri.naturalWidth, h: ri.naturalHeight, kind: dims.kind, repeat: dims.repeat, strip, wall: "main wall facing the camera: the whole wall surface, edge to edge and corner to corner, up to the ceiling or crown molding and down to the baseboard", scaleText } });
  return await (await fetch(r.image)).blob();
}
/** AI room picture first; the flat composite only when the AI is switched off or out of pictures for today. */
export async function sceneMockup(designSrc: string, dims: Dims, room: SampleRoom): Promise<{ blob: Blob; ai: boolean }> {
  let last: any = null;
  for (let i = 0; i < 2; i++) { try { return { blob: await aiSceneMockup(designSrc, dims, room), ai: true }; } catch (e: any) { last = e; if (/limit|quota|switched on|turned off|sign in/i.test(String(e?.message))) break; } }
  void last;
  return { blob: await makeSampleMockup(designSrc, dims, room), ai: false };
}
export async function remakeRoomMockups(uploadId: string, colors: { id: string; src: string; has?: boolean }[], dims: Dims, rooms: string[], rotKey: string, onStep?: (done: number, total: number) => void) {
  const list = rooms.map((t) => resolveMockupRoom(t, rotKey)).filter(Boolean) as SampleRoom[];
  const total = list.length * colors.length; let done = 0; let kept = "";
  for (const c of colors) {
    if (!c.src) continue;
    // every room of this color at once (about 10 s in total)
    // a colorway that already has room pictures only gets AI ones: if the AI is paused, its pictures are kept
    let keys: string[];
    try {
      keys = await Promise.all(list.map(async (r) => {
        const blob = c.has ? await aiSceneMockup(c.src, dims, r) : (await sceneMockup(c.src, dims, r)).blob;
        const k = (await uploadFile(blob, { uploadId, purpose: "mockup", filename: `mockup-${r.id}.jpg` }, () => {})).key;
        onStep?.(++done, total); return k;
      }));
    } catch (e: any) { if (!c.has) throw e; kept = e?.message || "The AI pictures could not be made."; done += list.length; continue; }
    await api(`designer/colorways/${c.id}/mockups`, { body: { keys, replace: true } });
  }
  if (kept) throw new Error(`${kept} The current room pictures were kept.`);
}
export function useRoomChoice(initial: string[]) { return useState<string[]>(initial); }
