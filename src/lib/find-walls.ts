import { guessRoomWalls, snapWalls } from "@/lib/wall-guess";
import { guessWallFound, type P } from "@/lib/wall-render";

export type FoundWall = { side: string; corners: P[]; objects: { label: string; polygon: P[] }[]; widthIn: number; heightIn: number; auto?: boolean };
export type FreeResult = { walls: FoundWall[]; how: "rooms" | "one" | "none"; why: string };

/** Walls without AI: the 3-wall perspective guess first, then a plain front-wall guess; never a whole-photo rectangle. */
export function freeWalls(px: ImageData, selW: number, selH: number): FreeResult {
  let why = "";
  try {
    const g = guessRoomWalls(px, selW);
    why = g.why;
    if (g.confident && g.walls.length) return { walls: g.walls.map((w) => ({ ...w, objects: [], auto: true })), how: g.walls.length > 1 ? "rooms" : "one", why };
  } catch (e: any) { why = String(e?.message || e); }
  const one = guessWallFound(px);
  if (one) {
    const area = (one[1].x - one[0].x) * (one[3].y - one[0].y);
    if (area < 0.72) return { walls: [{ side: "back", corners: one, objects: [], widthIn: selW, heightIn: selH, auto: true }], how: "one", why: why + "; front wall by colour" };
  }
  return { walls: [], how: "none", why };
}

/** A wall saved by the old guess (one upright rectangle, never adjusted): worth guessing again with the new finder. */
export function isOldGuess(walls?: { side: string; corners: P[]; auto?: boolean }[] | null) {
  if (!walls || walls.length !== 1) return false;
  const w = walls[0], c = w.corners;
  if (w.side !== "back" || w.auto !== undefined || !c || c.length !== 4) return false;
  return c[0].y === c[1].y && c[2].y === c[3].y && c[0].x === c[3].x && c[1].x === c[2].x;
}

/** The AI wall finder (needs the owner's AI key). Throws when it finds nothing. */
export async function aiWalls(jpeg: string, selW: number, selH: number): Promise<FoundWall[]> {
  const r = await fetch("/backend/ai/walls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: jpeg }), signal: AbortSignal.timeout(50000) }).catch(() => { throw new Error("The wall finder took too long."); });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Could not find walls.");
  const found: FoundWall[] = (d.walls ?? []).map((x: any) => ({ side: x.side, corners: x.corners, objects: x.objects ?? [], widthIn: x.side === "back" ? selW : Math.round(selH * 0.8), heightIn: selH }));
  if (!found.length) throw new Error("No wall found in this photo.");
  return found;
}

/** A usable wall outline: 4 corners, convex, some size. */
function goodQuad(c: P[]) {
  if (!c || c.length !== 4) return false;
  let sign = 0, area = 0;
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4], d = c[(i + 2) % 4]; const cr = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x); if (Math.abs(cr) < 1e-9) continue; const sg = Math.sign(cr); if (sign && sg !== sign) return false; sign = sg; area += a.x * b.y - b.x * a.y; }
  return Math.abs(area) / 2 > 0.01;
}
/** AI walls + the free guess: when the photo's own lines give a clear 3-wall layout that agrees with the AI, its
 *  corners are the more exact ones (they sit on real edges) and the AI adds what stands in front (window, furniture). */
export function mergeWalls(ai: FoundWall[], free: FreeResult, px?: ImageData): FoundWall[] {
  // AI outlines often stop short of the ceiling / floor: snap their top and bottom edges onto the photo's real lines
  let good = ai.filter((w) => goodQuad(w.corners));
  // (edge snapping tried 2026-10-25: it can jump to a table or baseboard line, so it is off)
  if (free.how !== "rooms") return good.length ? good : free.walls;
  if (!good.length) return free.walls;
  const fb = free.walls.find((w) => w.side === "back"), ab = good.find((w) => w.side === "back");
  if (fb && ab) { const d = fb.corners.reduce((t, c, i) => t + Math.hypot(c.x - ab.corners[i].x, c.y - ab.corners[i].y), 0) / 4; if (d > 0.12) return good; }
  const out = free.walls.map((fw) => { const a = good.find((x) => x.side === fw.side); return a ? { ...fw, objects: a.objects } : fw; });
  for (const a of good) if (!out.some((w) => w.side === a.side)) out.push(a);
  const order: Record<string, number> = { left: 0, back: 1, right: 2 };
  return out.sort((p, q) => (order[p.side] ?? 1) - (order[q.side] ?? 1));
}

/** Small JPEG of a canvas/ImageData for the AI finder (768 px). */
export function aiJpeg(px: ImageData) {
  const c = document.createElement("canvas"); c.width = px.width; c.height = px.height; c.getContext("2d")!.putImageData(px, 0, 0);
  const s = Math.min(1, 768 / Math.max(px.width, px.height)); const c2 = document.createElement("canvas"); c2.width = Math.round(px.width * s); c2.height = Math.round(px.height * s);
  c2.getContext("2d")!.drawImage(c, 0, 0, c2.width, c2.height); return c2.toDataURL("image/jpeg", 0.8);
}

let aiStatus: Promise<{ walls?: boolean }> | null = null;
export function wallFinderStatus() { return (aiStatus ??= fetch("/backend/ai/status").then((r) => r.json()).catch(() => ({}))); }

/** Best walls for a photo: AI when the key is set, otherwise (or when AI fails) the free guess. */
export async function findWalls(px: ImageData, selW: number, selH: number): Promise<{ walls: FoundWall[]; how: "ai" | FreeResult["how"] }> {
  const st = await wallFinderStatus();
  if (st?.walls) { try { return { walls: mergeWalls(await aiWalls(aiJpeg(px), selW, selH), freeWalls(px, selW, selH), px), how: "ai" }; } catch { /* fall back */ } }
  const f = freeWalls(px, selW, selH);
  return { walls: f.walls, how: f.how };
}
