import living from "@/assets/demo-living.jpg";
import bedroom from "@/assets/demo-bedroom.jpg";
import dining from "@/assets/demo-dining.jpg";
import office from "@/assets/demo-office.jpg";
import kids from "@/assets/demo-kids.jpg";
import nursery from "@/assets/demo-nursery.jpg";
import before from "@/assets/showcase-before.jpg";
import { SAMPLE_ROOMS, SAMPLE_TYPES, variantsOf, type SampleRoom } from "@/lib/room-mask";
import { blendWallpaper, exactMaskCanvas, warp } from "@/lib/wall-render";

/** Room scenes with the visible back wall (fractions) and its real height, for true-scale mockups. */
type P = [number, number][];
/** Room scenes: visible back wall, furniture in front (kept), and detail zones (plants, lamps) where only wall-colored pixels get paper. Coordinates in % of the photo. */
export const ROOM_POOL: { id: string; name: string; image: string; wall: { x0: number; y0: number; x1: number; y1: number }; wallHeightFt: number; objects: P[]; detail: [number, number, number, number, number?][]; kidsOnly?: boolean }[] = [
  { id: "living", name: "Living room", image: living, wall: { x0: 17, y0: 0, x1: 97, y1: 69.5 }, wallHeightFt: 9,
    objects: [[[25.5, 57], [28, 54.5], [84, 54.5], [86.5, 57], [86.5, 74], [25.5, 74]], [[0, 56], [14, 55.5], [27, 61], [27, 85], [0, 85]], [[37, 66], [75, 66], [75, 76], [37, 76]], [[91.5, 55], [100, 55], [100, 74], [91.5, 74]], [[98, 8], [100, 8], [100, 52], [98, 52]]],
    detail: [[10, 30, 31, 60], [55, 45, 74, 67], [82, 33, 93, 70]] },
  { id: "bedroom", name: "Bedroom", image: bedroom, wall: { x0: 12.5, y0: 2.5, x1: 93.5, y1: 68 }, wallHeightFt: 9,
    objects: [[[30.5, 43.5], [70, 43.5], [70, 69], [30.5, 69]], [[17.5, 56], [30.5, 54], [70, 54], [82, 56], [82, 100], [17.5, 100]], [[14, 54], [28, 54], [28, 70], [14, 70]], [[72, 54], [86, 54], [86, 70], [72, 70]], [[90, 49], [100, 49], [100, 75], [90, 75]], [[0, 54], [10, 55], [10, 78], [0, 78]]],
    detail: [[15, 28, 28, 38], [72, 28, 85, 38], [20.5, 0, 22, 30], [77.5, 0, 79.5, 30], [14, 38, 28, 55], [89, 24, 100, 50], [73, 50, 84, 55]] },
  { id: "dining", name: "Dining room", image: dining, wall: { x0: 10, y0: 0, x1: 98.5, y1: 68.5 }, wallHeightFt: 9,
    objects: [[[12, 55], [88, 55], [88, 61], [12, 61]], [[26, 52.5], [39, 52.5], [39, 60], [26, 60]], [[44, 52.5], [56, 52.5], [56, 60], [44, 60]], [[61, 52.5], [74, 52.5], [74, 60], [61, 60]], [[18, 57.5], [37.5, 57.5], [37.5, 100], [18, 100]], [[40.5, 57.5], [59, 57.5], [59, 100], [40.5, 100]], [[62, 57.5], [81.5, 57.5], [81.5, 100], [62, 100]], [[12, 60], [88, 60], [88, 70], [12, 70]]],
    detail: [[35, 0, 64, 25], [35, 30, 62, 56]] },
  { id: "office", name: "Home office", image: office, wall: { x0: 7.5, y0: 2, x1: 90, y1: 68.5 }, wallHeightFt: 9,
    objects: [[[23, 55.5], [77, 55.5], [77, 90], [23, 90]], [[41.5, 48], [56, 48], [56, 70], [41.5, 70]], [[85.5, 47], [100, 47], [100, 80], [85.5, 80]], [[12, 58], [19.5, 58], [19.5, 71], [12, 71]]],
    detail: [[3, 23, 27, 59], [66, 40, 74, 57], [29, 51, 64, 56], [86, 38, 100, 48]] },
  { id: "lounge", name: "Lounge", image: before, wall: { x0: 6, y0: 0, x1: 95, y1: 74 }, wallHeightFt: 9.5,
    objects: [[[17.5, 56], [23, 49], [78, 49], [85.5, 56], [85.5, 84], [17.5, 84]], [[85, 58], [100, 58], [100, 82], [85, 82]], [[7, 62], [18, 62], [18, 79], [7, 79]], [[0, 70], [7, 70], [7, 100], [0, 100]]],
    detail: [[0, 10, 29, 63], [84, 36, 95, 60], [91, 50, 100, 59]] },
  // kids rooms: used only for designs made for kids / nursery
  { id: "kids", name: "Kids room", image: kids, wall: { x0: 8.6, y0: 3.3, x1: 97.2, y1: 75.5 }, wallHeightFt: 9, kidsOnly: true,
    objects: [[[4.5, 55.5], [12.5, 55.5], [13, 56.5], [21, 56.5], [23, 60], [26, 60.5], [52.3, 62.2], [52.3, 61], [55.5, 61], [55.5, 84], [4.5, 84]],
      [[66.2, 64.6], [91, 64.6], [91, 80], [66.2, 80]], [[68, 61], [74, 61], [74, 65], [68, 65]], [[75.5, 63], [82, 63], [82, 65], [75.5, 65]], [[82, 57.5], [88.5, 57.5], [88.5, 65], [82, 65]], [[93, 69.5], [100, 69.5], [100, 80], [93, 80]]],
    detail: [[90.5, 48, 100, 70]] },
  { id: "nursery", name: "Nursery", image: nursery, wall: { x0: 2, y0: 3, x1: 99, y1: 78.5 }, wallHeightFt: 9, kidsOnly: true,
    objects: [[[0, 51], [2, 51], [15.5, 51.5], [17, 54], [17, 62], [24.5, 62], [25, 66], [25, 82], [0, 82]],
      [[32.3, 50.8], [33.4, 50.8], [33.4, 80], [32.3, 80]], [[67.8, 50.8], [69.1, 50.8], [69.1, 80], [67.8, 80]], [[32.3, 50.8], [69.1, 50.8], [69.1, 55.3], [32.3, 55.3]],
      [[33.3, 64.2], [68, 64.2], [68, 72.8], [33.3, 72.8]], [[57.5, 57.5], [63.5, 57.5], [63.5, 65], [57.5, 65]], [[80, 54], [100, 54], [100, 80], [80, 80]]],
    // the crib's white slats are close to the wall color: only pixels as dark as the wall get paper there
    detail: [[33.3, 55, 68, 79, 1.05], [80, 44, 100, 54.2, 1.05]] },
];
export type RoomScene = (typeof ROOM_POOL)[number];

function hash(s: string) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** A different set of rooms per design; a new seed gives a new set. Since 2026-10-25 these are the built-in sample
 *  rooms with exact hand-made furniture masks (the old ROOM_POOL scenes used rectangles + colour keying, which chopped
 *  lamps and chairs and papered over skirting). Kids designs get kids' rooms. */
export function pickRooms(designId: string, seed = 0, count = 3, prefer: string[] = []): SampleRoom[] {
  const types = defaultMockupRooms(prefer, prefer);
  const n = types.length; if (!n) return [];
  const k = ((seed % n) + n) % n, order = [...types.slice(k), ...types.slice(0, k)];
  const rot = rotationNumber(designId) + seed;
  return order.slice(0, count).map((t, i) => { const vs = variantsOf(t); return vs[(rot + i) % vs.length]; }).filter(Boolean);
}
const load = async (src: string) => { const i = new Image(); i.crossOrigin = "anonymous"; i.src = src; await i.decode(); return i; };

/** Composites the design on the room's wall at real size, keeping furniture and the room's light. */
export async function makeMockup(designSrc: string, design: { kind: "mural" | "repeating"; widthCm: number; heightCm: number; repeat?: string }, room: RoomScene | SampleRoom): Promise<Blob> {
  if ("mask" in room && (room as SampleRoom).mask) return makeSampleMockup(designSrc, design, room as SampleRoom);
  return makePoolMockup(designSrc, design, room as RoomScene);
}
/** Old scene compositor (rectangle wall, polygons, colour-keyed detail zones); kept for reference only. */
async function makePoolMockup(designSrc: string, design: { kind: "mural" | "repeating"; widthCm: number; heightCm: number; repeat?: string }, room: RoomScene): Promise<Blob> {
  const [roomImg, art] = await Promise.all([load(room.image), load(designSrc)]);
  const W = roomImg.naturalWidth, H = roomImg.naturalHeight;
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(roomImg, 0, 0);
  const wx0 = (room.wall.x0 / 100) * W, wy0 = (room.wall.y0 / 100) * H, wx1 = (room.wall.x1 / 100) * W, wy1 = (room.wall.y1 / 100) * H;
  const pxPerCm = (wy1 - wy0) / (room.wallHeightFt * 30.48);
  // paper layer
  const paper = document.createElement("canvas"); paper.width = W; paper.height = H;
  const pc = paper.getContext("2d")!;
  pc.save(); pc.beginPath(); pc.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); pc.clip();
  if (design.kind === "mural") {
    let mw = design.widthCm * pxPerCm, mh = design.heightCm * pxPerCm;
    // a mural made for a wall at least this big fills the wall height, true to its scale otherwise
    if (mh < wy1 - wy0) { const k = (wy1 - wy0) / mh; if (k < 1.6) { mw *= k; mh *= k; } }
    const x = (wx0 + wx1) / 2 - mw / 2, y = wy1 - mh;
    pc.fillStyle = "#f4f1ec"; pc.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    pc.drawImage(art, x, y, mw, mh);
  } else {
    const side = design.repeat === "horizontal"; // sideways only: one copy covers the full wall height
    const th = side ? wy1 - wy0 : design.widthCm * pxPerCm * (art.naturalHeight / art.naturalWidth); const tw = side ? th * (art.naturalWidth / art.naturalHeight) : design.widthCm * pxPerCm;
    for (let col = 0, x = wx0 - ((wx1 - wx0) % tw) / 2; x < wx1; x += tw, col++) {
      const off = design.repeat === "halfdrop" && col % 2 ? th / 2 : 0;
      if (side) { pc.drawImage(art, x, wy0, tw, th); continue; }
      for (let y = wy0 - off - th; y < wy1; y += th) pc.drawImage(art, x, y, tw, th);
    }
  }
  pc.restore();
  // mask: wall area minus furniture; in detail zones only wall-colored pixels get paper
  const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  const mc = mask.getContext("2d", { willReadFrequently: true })!;
  mc.fillStyle = "#fff"; mc.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  mc.globalCompositeOperation = "destination-out"; mc.fillStyle = "#000";
  for (const poly of room.objects) { mc.beginPath(); poly.forEach(([x, y], i) => (i ? mc.lineTo((x / 100) * W, (y / 100) * H) : mc.moveTo((x / 100) * W, (y / 100) * H))); mc.closePath(); mc.fill(); }
  mc.globalCompositeOperation = "source-over";
  const base = ctx.getImageData(0, 0, W, H); const b = base.data;
  const m = mc.getImageData(0, 0, W, H).data;
  const zoneAt = (x: number, y: number) => room.detail.find(([a, c, d, e]) => x >= (a / 100) * W && x <= (d / 100) * W && y >= (c / 100) * H && y <= (e / 100) * H);
  const inDetail = (x: number, y: number) => !!zoneAt(x, y);
  // wall reference color (clear wall only)
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = Math.floor(wy0); y < wy1; y += 5) for (let x = Math.floor(wx0); x < wx1; x += 5) { const i = (y * W + x) * 4; if (m[i + 3] > 200 && !inDetail(x, y)) { sr += b[i]; sg += b[i + 1]; sb += b[i + 2]; n++; } }
  const ar = sr / n, ag = sg / n, ab = sb / n, avg = 0.299 * ar + 0.587 * ag + 0.114 * ab;
  const alpha = new Float32Array(W * H);
  for (let y = Math.floor(wy0); y < Math.ceil(wy1); y++) for (let x = Math.floor(wx0); x < Math.ceil(wx1); x++) {
    const k = y * W + x, i = k * 4; if (m[i + 3] < 128) continue;
    const zone = zoneAt(x, y);
    if (zone) {
      const l = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]; const s = l / avg;
      const d = Math.abs(b[i] - ar * s) + Math.abs(b[i + 1] - ag * s) + Math.abs(b[i + 2] - ab * s);
      if (s < 0.72 || s > (zone[4] ?? 1.25) || d > 26) continue;
    }
    alpha[k] = 1;
  }
  // soften edges (3x3 average)
  const soft = new Float32Array(W * H);
  for (let y = Math.max(1, Math.floor(wy0)); y < Math.min(H - 1, Math.ceil(wy1)); y++) for (let x = Math.max(1, Math.floor(wx0)); x < Math.min(W - 1, Math.ceil(wx1)); x++) { const k = y * W + x; soft[k] = (alpha[k] * 4 + alpha[k - 1] + alpha[k + 1] + alpha[k - W] + alpha[k + W]) / 8; }
  const pp = pc.getImageData(0, 0, W, H).data;
  for (let y = Math.floor(wy0); y < Math.ceil(wy1); y++) for (let x = Math.floor(wx0); x < Math.ceil(wx1); x++) {
    const k = y * W + x, i = k * 4; const a = soft[k]; if (a <= 0.01) continue;
    const lum = (0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]) / avg;
    const shade = Math.min(1.2, Math.max(0.4, lum));
    for (let q = 0; q < 3; q++) b[i + q] = b[i + q] * (1 - a) + Math.min(255, pp[i + q] * shade) * a;
  }
  ctx.putImageData(base, 0, 0);
  return new Promise((res, rej) => out.toBlob((bb) => (bb ? res(bb) : rej(new Error("Could not make the mockup."))), "image/jpeg", 0.86));
}

// ---- sample-room mockups: the built-in sample rooms (pre-marked wall + exact furniture mask) ----
export const MAX_MOCKUP_ROOMS = 5;
/** The room types a designer picks from (one picture per type). */
export const MOCKUP_ROOMS = SAMPLE_TYPES.map((r) => ({ ...r, id: r.type }));
/** A number that steps by one from design to design (the SKU's digits), so neighbouring designs get different versions of a room. */
export function rotationNumber(key: string) { const d = (key.match(/\d+/g) ?? []).join("").slice(-6); return d ? Number(d) : hash(key); }
/** The exact room picture for a type (or a variant id) for this design: rotates through the versions of that room type. */
export function resolveMockupRoom(typeOrId: string, rotKey: string): SampleRoom | null {
  const exact = SAMPLE_ROOMS.find((r) => r.id === typeOrId); if (exact) return exact;
  const vs = variantsOf(typeOrId); if (!vs.length) return null;
  return vs[rotationNumber(rotKey) % vs.length];
}
/** Sensible rooms for a design by what it is made for / its categories (kids designs -> kids' room, playroom, nursery). */
export function defaultMockupRooms(madeFor: string[] = [], categories: string[] = []): string[] {
  const t = [...madeFor, ...categories].join(" ").toLowerCase();
  const out: string[] = [];
  const add = (...ids: string[]) => { for (const id of ids) if (!out.includes(id) && SAMPLE_ROOMS.some((r) => r.type === id)) out.push(id); };
  if (/kid|child|nursery|baby|play/.test(t)) add("kids", "playroom", "nursery");
  if (/bath|powder/.test(t)) add("bathroom");
  if (/kitchen/.test(t)) add("kitchen");
  if (/dining/.test(t)) add("dining");
  if (/bed/.test(t)) add("bedroom");
  if (/commercial|corporate|workplace/.test(t)) add("open-office", "meeting", "lobby", "office-hall");
  if (/hospital|health|clinic|medical|senior|nursing|care home/.test(t)) add("waiting", "hospital-hall", "care-room", "care-hall");
  if (/hotel|hospitality|restaurant|lobby|reception/.test(t)) add("lobby");
  if (/office|study/.test(t)) add("office");
  if (/entry|hall|foyer/.test(t)) add("entry");
  if (/living|lounge/.test(t)) add("living");
  add("living", "bedroom", "dining", "entry", "office");
  return out.slice(0, MAX_MOCKUP_ROOMS);
}
export const sampleRoomById = (id: string) => SAMPLE_ROOMS.find((r) => r.id === id) ?? MOCKUP_ROOMS.find((r) => r.id === id) ?? null;

/** The design on a sample room's feature wall at real size, furniture in front, the room's light kept (no AI). */
/** Bare wall showing at the edge of a plant or lamp (the "white halo"): give it to the wallpaper. */
function cleanHalo(F: Uint8ClampedArray, P: Uint8ClampedArray, A: Uint8ClampedArray, W: number, H: number) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < F.length; i += 32) if (F[i + 3] < 20 && A[i + 3] > 200) { r += P[i]; g += P[i + 1]; b += P[i + 2]; n++; }
  if (!n) return; r /= n; g /= n; b /= n;
  const R = 7, clear: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (F[i + 3] === 0 || A[i + 3] < 128) continue;
    const d = Math.abs(P[i] - r) + Math.abs(P[i + 1] - g) + Math.abs(P[i + 2] - b); if (d > 60) continue;
    const near = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && F[(yy * W + xx) * 4 + 3] < 64;
    if (near(x - R, y) || near(x + R, y) || near(x, y - R) || near(x, y + R)) clear.push(i);
  }
  for (const i of clear) F[i + 3] = 0;
}
export async function makeSampleMockup(designSrc: string, design: { kind: "mural" | "repeating"; widthCm: number; heightCm: number; repeat?: string }, room: SampleRoom): Promise<Blob> {
  const [roomImg, art] = await Promise.all([load(room.image), load(designSrc)]);
  const W = roomImg.naturalWidth, H = roomImg.naturalHeight;
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const bx = base.getContext("2d", { willReadFrequently: true })!; bx.drawImage(roomImg, 0, 0);
  // the wall, flat, at real scale
  const wallWcm = room.widthIn * 2.54, wallHcm = room.heightIn * 2.54;
  const AW = 1600, AH = Math.round((AW * wallHcm) / wallWcm), s = AW / wallWcm;
  const flat = document.createElement("canvas"); flat.width = AW; flat.height = AH;
  const fx = flat.getContext("2d")!;
  if (design.kind === "mural") {
    let mw = design.widthCm * s, mh = design.heightCm * s;
    if (mh < AH) { const k = AH / mh; mw *= k; mh *= k; } // a mural always fills the wall height
    if (mw < AW) { const k = AW / mw; mw *= k; mh *= k; } // and its width
    fx.drawImage(art, (AW - mw) / 2, AH - mh, mw, mh);
  } else {
    const side = design.repeat === "horizontal"; // sideways only: one copy covers the full wall height
    const th = side ? AH : Math.max(8, design.widthCm * s) * (art.naturalHeight / art.naturalWidth), tw = side ? AH * (art.naturalWidth / art.naturalHeight) : Math.max(8, design.widthCm * s);
    for (let col = 0, x = -((AW % tw) / 2); x < AW; x += tw, col++) {
      const off = design.repeat === "halfdrop" && col % 2 ? th / 2 : 0;
      if (side) { fx.drawImage(art, x, 0, tw, th); continue; }
      for (let y = -off - th; y < AH; y += th) fx.drawImage(art, x, y, tw, th);
    }
  }
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H;
  const lx = layer.getContext("2d", { willReadFrequently: true })!;
  warp(lx, flat, room.corners.map((c) => ({ x: c.x * W, y: c.y * H })));
  const mask = await exactMaskCanvas(room.mask, W, H);
  const F = mask.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const photo = bx.getImageData(0, 0, W, H);
  const out = new ImageData(W, H);
  const lay = lx.getImageData(0, 0, W, H);
  cleanHalo(F, photo.data, lay.data, W, H);
  blendWallpaper(out, photo, lay, F);
  bx.putImageData(out, 0, 0);
  return new Promise((res, rej) => base.toBlob((bb) => (bb ? res(bb) : rej(new Error("Could not make the mockup."))), "image/jpeg", 0.86));
}
