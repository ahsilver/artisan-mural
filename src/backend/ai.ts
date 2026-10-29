// AI room pictures through the owner's own key (Google Gemini image model, or OpenAI as a second option).
import { getSettings } from "./app-api";
type Env = any;
const j = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });

function b64ToBytes(b64: string) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
const strip = (d: string) => { const m = String(d).match(/^data:([^;]+);base64,(.*)$/); return m ? { mime: m[1], data: m[2] } : { mime: "image/jpeg", data: String(d) }; };

async function gemini(key: string, model: string, prompt: string, images: { mime: string; data: string }[], aspect?: string): Promise<string> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }))] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"], ...(aspect ? { imageConfig: { aspectRatio: aspect } } : {}) } }),
  });
  const t: any = await r.json().catch(() => ({}));
  if (!r.ok && (r.status === 404 || /no longer available/i.test(String(t?.error?.message))) && model !== "gemini-3.1-flash-image") return gemini(key, "gemini-3.1-flash-image", prompt, images, aspect);
  if (!r.ok) throw new Error(t?.error?.message || `AI service answered ${r.status}`);
  for (const c of t.candidates ?? []) for (const p of c.content?.parts ?? []) { const d = p.inlineData ?? p.inline_data; if (d?.data) return `data:${d.mimeType ?? d.mime_type ?? "image/png"};base64,${d.data}`; }
  throw new Error("The AI didn't return a picture. Try again.");
}
async function openai(key: string, model: string, prompt: string, images: { mime: string; data: string }[]) {
  const fd = new FormData();
  fd.append("model", model); fd.append("prompt", prompt); fd.append("quality", "medium"); fd.append("size", "1536x1024");
  images.forEach((im, i) => fd.append("image[]", new Blob([b64ToBytes(im.data)], { type: im.mime }), `img${i}.${im.mime.includes("png") ? "png" : "jpg"}`));
  const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  const t: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(t?.error?.message || `AI service answered ${r.status}`);
  const b = t.data?.[0]?.b64_json; if (!b) throw new Error("The AI didn't return a picture. Try again.");
  return `data:image/png;base64,${b}`;
}


let lastVisionModel = "";
/** Vision models tried in order when one is busy (503), rate-limited (429) or gone (404). */
export const VISION_CHAIN = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
/** Gemini text/vision call that must answer JSON in the given schema. Fast: least thinking the model allows, small image.
 *  Falls through the chain on busy / missing models; thinking level stepped down when a model refuses it. */
async function geminiJson(key: string, model: string, prompt: string, image: { mime: string; data: string }, schema: any): Promise<any> {
  const started = Date.now();
  const call = async (m: string, thinking: any): Promise<{ r: Response; t: any }> => {
    // a busy model can hold a request for a minute: give each try a short limit, then move down the chain
    const limit = Math.max(4000, Math.min(m === models[0] ? 8000 : 14000, 40000 - (Date.now() - started)));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, signal: AbortSignal.timeout(limit),
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.data } }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1, ...(thinking ? { thinkingConfig: thinking } : {}) } }),
      });
      return { r, t: (await r.json().catch(() => ({}))) as any };
    } catch { return { r: new Response("{}", { status: 504 }), t: { error: { message: "The AI took too long to answer." } } }; }
  };
  const models = [model, ...VISION_CHAIN.filter((x) => x !== model)];
  let r: Response | null = null, t: any = null, used = model;
  const msg = () => String(t?.error?.message || "");
  for (const m of models) {
    used = m;
    for (const th of [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, null]) {
      ({ r, t } = await call(m, th));
      if (r.ok || !/thinking/i.test(msg())) break;
    }
    if (r!.ok) break;
    const busy = r!.status === 504 || r!.status === 503 || r!.status === 429 || r!.status === 500 || r!.status === 404 || /no longer available|not found|high demand|overloaded/i.test(msg());
    if (!busy) break;
  }
  if (!r!.ok) throw new Error(msg() || `AI service answered ${r!.status}`);
  const txt = (t.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || "").join("");
  lastVisionModel = used;
  try { return JSON.parse(txt); } catch { throw new Error("The AI answer could not be read. Try again."); }
}
const PT = { type: "OBJECT", properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } }, required: ["x", "y"] };
const WALLS_SCHEMA = { type: "OBJECT", properties: { walls: { type: "ARRAY", items: { type: "OBJECT", properties: {
  side: { type: "STRING", enum: ["left", "back", "right"] },
  corners: { type: "ARRAY", items: PT, description: "exactly 4 points: top-left, top-right, bottom-right, bottom-left of the wall surface" },
  objects: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, polygon: { type: "ARRAY", items: PT } }, required: ["label", "polygon"] } },
}, required: ["side", "corners"] } } }, required: ["walls"] };
const WALLS_PROMPT = `This is a photo of a room. Find every flat, upright wall surface that could get wallpaper: the back wall (facing the camera), the left wall and the right wall. In a room where 3 walls are visible, return all 3 (left, back, right) as separate walls, each in its own perspective.
For each wall give "side" and its 4 "corners" in order top-left, top-right, bottom-right, bottom-left, where the wall meets the ceiling, the floor (top of the baseboard), the neighbouring walls, or the photo edge. A side wall is a trapezoid that narrows toward the back wall; its corner at the back wall is the same point as the back wall's corner.
Never include the floor or the ceiling. In an attic or under a sloped ceiling, the wall is only the upright part: stop where the slope starts.
Coordinates are fractions of the photo: x 0 = left edge, 1 = right edge; y 0 = top edge, 1 = bottom edge.
Also list "objects" standing in front of that wall that wallpaper must not cover (sofa, bed, headboard, table, lamp, plant, shelf, TV, window, door, mirror, framed art), each as a tight polygon of 4 to 12 points.
Return at most one wall per side. If no wall is visible, return an empty list.`;

/** Things the wallpaper must go behind: a second, quick call on the lite models (own quota) that boxes every occluder. */
const OCC_PROMPT = `Find every object in this room photo that stands in front of a wall or is set into a wall, so wallpaper must NOT cover it: kitchen cabinets (upper and lower, each run), range hood, open shelves, windows (whole frame and sill), doors and door frames, appliances, refrigerator, countertops and backsplash, radiators, curtains, mirrors, framed art, TV, headboard, sofa, bed, tables, lamps, plants, baseboards / skirting boards, light switches and outlets. Output a JSON list where each entry has "label" and "box_2d" = [y0, x0, y1, x1] on a 0-1000 grid. Use tight boxes. Empty list if none.`;
const OCC_CHAIN = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"];
export async function occluderBoxes(apiKey: string, img: { data: string; mime: string }) {
  for (const m of OCC_CHAIN) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: img.mime || "image/jpeg", data: img.data } }, { text: OCC_PROMPT }] }], generationConfig: { responseMimeType: "application/json" } }) }).finally(() => clearTimeout(t));
      if (!r.ok) continue;
      const d: any = await r.json();
      const txt = (d?.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text || "").join("");
      const arr = JSON.parse(txt.replace(/^```(json)?|```$/g, "").trim());
      return (Array.isArray(arr) ? arr : []).filter((o: any) => Array.isArray(o?.box_2d) && o.box_2d.length === 4).slice(0, 30).map((o: any) => {
        const [y0, x0, y1, x1] = o.box_2d.map((v: any) => Math.min(1, Math.max(0, (Number(v) || 0) / 1000)));
        return { label: String(o.label || "").slice(0, 40), x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
      }).filter((b: any) => (b.x1 - b.x0) > 0.01 && (b.y1 - b.y0) > 0.008 && (b.x1 - b.x0) * (b.y1 - b.y0) < 0.6)
        .filter((b: any, i: number, all: any[]) => !all.slice(0, i).some((o: any) => Math.abs(o.x0 - b.x0) + Math.abs(o.x1 - b.x1) + Math.abs(o.y0 - b.y0) + Math.abs(o.y1 - b.y1) < 0.04));
    } catch { /* next model */ }
  }
  return [];
}
function inQuad(pt: { x: number; y: number }, q: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i], b = q[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}
/** Give each occluder box to the wall it sits on (by how much of the box lies inside the wall), as a 4-point object. */
export function attachOccluders(walls: any[], boxes: any[]) {
  for (const b of boxes) {
    let best = -1, bestN = 0;
    walls.forEach((w, wi) => { let n = 0; for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) if (inQuad({ x: b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / 5, y: b.y0 + ((b.y1 - b.y0) * (k + 0.5)) / 5 }, w.corners)) n++; if (n > bestN) { bestN = n; best = wi; } });
    if (best < 0 || bestN < 3) continue;
    const pad = 0.004; // a hair past the edge so no paper line shows around a cabinet
    const poly = [{ x: b.x0 - pad, y: b.y0 - pad }, { x: b.x1 + pad, y: b.y0 - pad }, { x: b.x1 + pad, y: b.y1 + pad }, { x: b.x0 - pad, y: b.y1 + pad }].map((c) => ({ x: Math.min(1, Math.max(0, c.x)), y: Math.min(1, Math.max(0, c.y)) }));
    (walls[best].objects ||= []).push({ label: b.label, polygon: poly });
  }
  return walls;
}
/** Put a wall's 4 points in the order top-left, top-right, bottom-right, bottom-left (models sometimes mix it). */
export function orderCorners(c: { x: number; y: number }[]) {
  const pts = c.slice(0, 4);
  const byX = [...pts].sort((a, b) => a.x - b.x);
  const L = byX.slice(0, 2).sort((a, b) => a.y - b.y), R = byX.slice(2).sort((a, b) => a.y - b.y);
  return [L[0], R[0], R[1], L[1]];
}
/** 4 corners from the model's outline: as given for 4 points; for more (a gable wall under a sloped ceiling) the
 *  upright edges' ends (the rectangle part; the slope above stays unpapered). */
export function quadOf(pts: { x: number; y: number }[]) {
  if (pts.length <= 4) return orderCorners(pts);
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const L = pts.filter((p) => p.x <= minX + 0.03).sort((a, b) => a.y - b.y), R = pts.filter((p) => p.x >= maxX - 0.03).sort((a, b) => a.y - b.y);
  if (L.length < 2 || R.length < 2) return orderCorners([...pts].sort((a, b) => 0).slice(0, 4));
  return [L[0], R[0], R[R.length - 1], L[L.length - 1]];
}
/** Clean the model's walls: valid corners, one wall per side, sides by position when the model repeats one. */
export function cleanWalls(raw: any[]) {
  // fractions of the photo; some models answer on a 0-1000 grid instead
  const cl = (v: any) => { let n = Number(v) || 0; if (n > 1.5) n /= 1000; return Math.min(1, Math.max(0, n)); };
  let ws = (Array.isArray(raw) ? raw : []).filter((w: any) => Array.isArray(w?.corners) && w.corners.length >= 4).slice(0, 3).map((w: any) => ({
    side: ["left", "back", "right"].includes(w.side) ? w.side : "back",
    corners: quadOf(w.corners.map((c: any) => ({ x: cl(c?.x), y: cl(c?.y) }))),
    objects: (w.objects ?? []).slice(0, 20).filter((o: any) => Array.isArray(o?.polygon) && o.polygon.length >= 3).map((o: any) => ({ label: String(o.label || "").slice(0, 40), polygon: o.polygon.slice(0, 16).map((c: any) => ({ x: cl(c?.x), y: cl(c?.y) })) })),
  })).filter((w: any) => { const c = w.corners; const area = Math.abs((c[0].x * c[1].y - c[1].x * c[0].y) + (c[1].x * c[2].y - c[2].x * c[1].y) + (c[2].x * c[3].y - c[3].x * c[2].y) + (c[3].x * c[0].y - c[0].x * c[3].y)) / 2; return area > 0.01; });
  const sides = new Set(ws.map((w: any) => w.side));
  if (sides.size < ws.length) { // repeated side: name them left/back/right by where they sit
    const cx = (w: any) => w.corners.reduce((t: number, c: any) => t + c.x, 0) / 4;
    ws = [...ws].sort((a: any, b: any) => cx(a) - cx(b));
    const names = ws.length === 3 ? ["left", "back", "right"] : ws.length === 2 ? (cx(ws[0]) < 0.35 ? ["left", "back"] : ["back", "right"]) : ["back"];
    ws.forEach((w: any, i: number) => { w.side = names[i]; });
  }
  // the back wall shares its upright edges with the side walls: snap its corners onto theirs (models often put the
  // back wall's top corners on a gable or leave gaps); the side wall's edge is the steadier answer
  const L = ws.find((w: any) => w.side === "left"), B = ws.find((w: any) => w.side === "back"), R = ws.find((w: any) => w.side === "right");
  const near = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y) < 0.15;
  if (B && L && near(L.corners[1], B.corners[0]) && near(L.corners[2], B.corners[3])) { B.corners[0] = { ...L.corners[1] }; B.corners[3] = { ...L.corners[2] }; }
  if (B && R && near(R.corners[0], B.corners[1]) && near(R.corners[3], B.corners[2])) { B.corners[1] = { ...R.corners[0] }; B.corners[2] = { ...R.corners[3] }; }
  // a back wall faces the camera: its top and bottom edges span about the same width. A strong trapezoid is a
  // model mistake (seen on the lite models): stand the narrow edge's corners under/over the wide edge's, and let
  // the side walls follow so no gap opens
  // a back wall's top and bottom edges are close to level; one tilted by a fifth of the photo is a wrong answer
  if (B && (Math.abs(B.corners[1].y - B.corners[0].y) > 0.2 || Math.abs(B.corners[2].y - B.corners[3].y) > 0.2)) return [];
  // …and it starts in the upper part of the photo and has height (a strip at the bottom is the floor)
  if (B && (Math.min(B.corners[0].y, B.corners[1].y) > 0.55 || (B.corners[3].y + B.corners[2].y - B.corners[0].y - B.corners[1].y) / 2 < 0.18)) return [];
  if (B) {
    const c = B.corners, tw = c[1].x - c[0].x, bw = c[2].x - c[3].x;
    if (tw > 0 && bw > 0 && Math.min(tw, bw) / Math.max(tw, bw) < 0.85) {
      const old = c.map((p: any) => ({ ...p }));
      if (bw < tw) { c[3] = { x: c[0].x, y: c[3].y }; c[2] = { x: c[1].x, y: c[2].y }; } else { c[0] = { x: c[3].x, y: c[0].y }; c[1] = { x: c[2].x, y: c[1].y }; }
      const move = (w: any) => w && w.corners.forEach((p: any, i: number) => { old.forEach((o: any, k: number) => { if (Math.hypot(p.x - o.x, p.y - o.y) < 0.04) w.corners[i] = { ...c[k] }; }); });
      move(L); move(R);
    }
  }
  const order = { left: 0, back: 1, right: 2 } as any;
  return ws.sort((a: any, b: any) => order[a.side] - order[b.side]);
}
const TAG_SCHEMA = { type: "OBJECT", properties: {
  kind: { type: "STRING", enum: ["mural", "repeating"] },
  styles: { type: "ARRAY", items: { type: "STRING" } },
  rooms: { type: "ARRAY", items: { type: "STRING" } },
  kidsFriendly: { type: "BOOLEAN" },
  summary: { type: "STRING" },
}, required: ["kind", "styles", "rooms", "kidsFriendly"] };

async function aiQuota(env: Env, who: any, req: Request, purpose: string, cap: number) {
  const day = new Date().toISOString().slice(0, 10);
  const uid = who?.uid || "ip:" + (req.headers.get("cf-connecting-ip") || "anon");
  const used: any = await env.DB.prepare(`SELECT COUNT(*) n FROM ai_renders WHERE user_id = ? AND day = ? AND purpose = ?`).bind(uid, day, purpose).first();
  return { uid, day, over: Number(used?.n ?? 0) >= cap && who?.role !== "admin" };
}

/** Prompt for repainting the customer's room photo with the wallpaper (image 1 = room, image 2 = design). */
/** How the design repeats, said so the image model never tiles a mural or stacks a sideways repeat. */
export function repeatRule(repeat: string, strip = false) {
  if (strip) return "REPEAT TYPE: SIDEWAYS ONLY. Image 2 already shows the WHOLE wall laid out at its real size (the design repeated left to right). Put it on the wall exactly like that: its top edge at the ceiling line, its bottom edge at the top of the baseboard, its left and right edges at the wall corners. Do not shrink it, do not add rows, never repeat it up and down.";
  return repeat === "none" || repeat === "mural"
    ? "REPEAT TYPE: MURAL. Image 2 is ONE scene. Place it once per wall, scaled to cover the wall (crop the edges if needed, never squash or stretch). Never tile, repeat, mirror or duplicate it, not even partly."
    : repeat === "horizontal"
      ? "REPEAT TYPE: SIDEWAYS ONLY. Image 2 repeats only left to right. One copy of image 2 covers the wall's FULL height, from the ceiling line down to the baseboard; copies sit side by side across the wall. Never stack copies on top of each other and never repeat it up and down."
      : "REPEAT TYPE: FULL REPEAT. Image 2 is one seamless tile: repeat it in every direction (left-right and up-down) at the stated scale, with no visible seams.";
}
/** Designer room pictures (2026-10-29): the whole mural, never cropped. */
export const WHOLE_MURAL_RULE = "REPEAT TYPE: MURAL. Image 2 is ONE scene. Show the WHOLE mural: every edge of image 2 must be visible on the wall, nothing cut off, never squash or stretch it. Make the papered wall the same shape as image 2 (pick the wall and framing so the full mural fits it edge to edge). Never tile, repeat, mirror or duplicate it.";
export function roomPhotoPrompt(o: { mural: boolean; wall: string; scale: string; repeat?: string; strip?: boolean }) {
  const where = o.wall
    ? `Hang this wallpaper on the ${o.wall} only, like a professional installer would. Other walls stay exactly as they are.`
    : o.mural
      ? "This is ONE mural picture: hang it once on the main wall facing the camera, like a professional installer would, filling that whole wall (crop the mural to fit, never squash or stretch it). Do not repeat it on other walls; other walls stay as they are."
      : "Hang this wallpaper on EVERY visible bare wall in image 1 (back wall and side walls), like a professional installer would.";
  return `LOCALIZED PHOTO EDIT, not a new room. Image 1 is the customer's real room photo and is the output canvas. Image 2 is ONLY the wallpaper design (a flat texture), never a room or layout reference.
${where} On each papered wall the paper runs the FULL height, from the ceiling line all the way down to the top of the baseboard, and the full width, corner to corner, with no bare strips left at the top, bottom or sides. Follow each wall's perspective and turn the corners naturally.
${repeatRule(o.repeat ?? (o.mural ? "none" : "both"), !!o.strip)}
${o.scale ? `Scale: ${o.scale} ` : ""}Keep the wallpaper's pattern, colors and proportions exactly as in image 2; do not redraw, simplify or recolor it.
The paper goes BEHIND everything, never over it, and everything in front of the wall (plants, branches, leaves, lamps, furniture) keeps its own natural edges with no white halo, outline or gap around it: keep every window (glass, frame, sill, blinds, curtains), door, door frame, trim, crown molding, baseboard, cabinet, countertop, backsplash tile, shelf, range hood, appliance, bed, headboard, furniture, lamp, plant, picture frame, mirror, outlet, switch, vent, radiator and AC unit exactly as they are. Wallpaper stops exactly at their edges. Do not add grey, beige or white boxes or borders around windows or objects.
Floor, carpet and ceiling (including sloped ceilings) stay exactly as they are, with no wallpaper on them. First find exactly where each vertical wall ends and the ceiling starts: a slanted surface above a wall (attic, sloped roof, dormer) is CEILING, not wall, even if it has the same color or texture as the wall, and gets no wallpaper. Do not add crown molding or trim that is not in image 1.
Keep the photo's real lighting: the same shadows, light falloff and window light fall across the new paper so it looks photographed, not pasted. Same camera, framing, crop and image proportions as image 1. Do not add, move or remove anything. Photorealistic.`;
}

export async function aiRoutes(req: Request, env: Env, who: any, p: string, body: any): Promise<Response> {
  const s = await getSettings(env);
  const ai = s.ai;
  const google = !!ai.apiKey && ai.provider !== "openai";
  const visionModel = ai.visionModel || VISION_CHAIN[0];
  if (p === "status") return j({ ready: !!ai.apiKey, roomRender: !!(ai.apiKey && ai.roomRenderEnabled), mockups: !!(ai.apiKey && ai.mockupsEnabled !== false), walls: google && ai.wallDetectEnabled !== false, tagging: google && ai.autoTagEnabled !== false, freeOverlay: ai.freeOverlayEnabled !== false });
  if (p === "walls" && req.method === "POST") {
    if (!google || ai.wallDetectEnabled === false) return j({ error: "Automatic wall finding is not set up. Tap the 4 corners of your wall instead.", code: "no_key" }, 400);
    const q = await aiQuota(env, who, req, "walls", Number(ai.wallDailyLimit) || 40);
    if (q.over) return j({ error: "Daily limit reached for automatic wall finding. Tap the 4 corners instead.", code: "limit" }, 429);
    const img = strip(body.image || "");
    if (!img.data || img.data.length > 2_800_000) return j({ error: "Please use a smaller photo." }, 413);
    const t0 = Date.now();
    try {
      const [out, boxes] = await Promise.all([geminiJson(ai.apiKey, visionModel, WALLS_PROMPT, img, WALLS_SCHEMA), occluderBoxes(ai.apiKey, img).catch(() => [])]);
      const walls = attachOccluders(cleanWalls(out?.walls), boxes);
      await env.DB.prepare(`INSERT INTO ai_renders (id, user_id, day, purpose, provider, model) VALUES (?, ?, ?, 'walls', 'google', ?)`).bind(crypto.randomUUID(), q.uid, q.day, visionModel).run();
      return j({ walls, occluders: boxes.length, ms: Date.now() - t0, model: lastVisionModel || visionModel });
    } catch (e: any) { return j({ error: String(e.message || e).slice(0, 300) }, 502); }
  }
  if (p === "tag" && req.method === "POST") {
    if (!who?.uid) return j({ error: "Please sign in first." }, 401);
    if (!google || ai.autoTagEnabled === false) return j({ error: "Auto-tagging is not set up.", code: "no_key" }, 400);
    const q = await aiQuota(env, who, req, "tag", 60);
    if (q.over) return j({ error: "Daily limit reached.", code: "limit" }, 429);
    const img = strip(body.image || "");
    const styles = Array.isArray(body.styles) ? body.styles.join(", ") : "";
    const rooms = Array.isArray(body.rooms) ? body.rooms.join(", ") : "";
    const prompt = `This is a wallpaper design uploaded by a designer. Classify it for a wallpaper shop.
- kind: "mural" if it is one large scene/picture meant to cover a wall once; "repeating" if it is a pattern that repeats.
- styles: 1 to 3 from exactly this list: ${styles}.
- rooms: 1 to 4 rooms it suits, from exactly this list: ${rooms}.
- kidsFriendly: true if it suits a child's room or nursery.
- summary: one short plain sentence describing the design.${body.madeFor ? `
The designer says it is made for: ${String(body.madeFor).slice(0, 200)}. Respect that.` : ""}`;
    try {
      const out = await geminiJson(ai.apiKey, visionModel, prompt, img, TAG_SCHEMA);
      await env.DB.prepare(`INSERT INTO ai_renders (id, user_id, day, purpose, provider, model) VALUES (?, ?, ?, 'tag', 'google', ?)`).bind(crypto.randomUUID(), q.uid, q.day, visionModel).run();
      return j(out);
    } catch (e: any) { return j({ error: String(e.message || e).slice(0, 300) }, 502); }
  }
  if (p !== "render") return j({ error: "not found" }, 404);
  if (!who?.uid && body.purpose === "mockup") return j({ error: "Please sign in first." }, 401);
  if (!ai.apiKey) return j({ error: "AI is not set up yet. The owner adds an AI key in Settings > Room preview.", code: "no_key" }, 400);
  const tStart = Date.now();
  const purpose = body.purpose === "mockup" ? "mockup" : "room";
  if (purpose === "room" && !ai.roomRenderEnabled) return j({ error: "AI room render is turned off.", code: "off" }, 400);
  if (purpose === "mockup" && ai.mockupsEnabled === false) return j({ error: "AI room pictures are turned off.", code: "off" }, 400);
  // daily cap per person (guests by connection)
  const day = new Date().toISOString().slice(0, 10);
  if (!who?.uid) who = { ...(who || {}), uid: "ip:" + (req.headers.get("cf-connecting-ip") || "anon") };
  const used: any = await env.DB.prepare(`SELECT COUNT(*) n FROM ai_renders WHERE user_id = ? AND day = ? AND purpose IN ('room', 'mockup')`).bind(who.uid, day).first();
  const cap = Number(ai.dailyLimit) || 10;
  if (Number(used?.n ?? 0) >= cap && who.role !== "admin") return j({ error: `Daily limit reached (${cap} AI pictures a day). Try again tomorrow.` }, 429);
  const design = strip(body.design);
  const images = [design];
  let prompt: string;
  const scale = body.scaleText ? ` Scale: ${body.scaleText}.` : "";
  let aspect: string | undefined;
  if ((purpose === "room" || purpose === "mockup") && body.mode === "photo") {
    // Like the old Lovable site: the customer's own photo + the wallpaper go to the image model, which papers the walls in place.
    images.unshift(strip(body.room));
    const ratios: Record<string, number> = { "1:1": 1, "2:3": 2 / 3, "3:2": 1.5, "3:4": 0.75, "4:3": 4 / 3, "4:5": 0.8, "5:4": 1.25, "9:16": 9 / 16, "16:9": 16 / 9, "21:9": 21 / 9 };
    const r = Number(body.w) / Number(body.h);
    if (r > 0 && isFinite(r)) aspect = Object.keys(ratios).reduce((a, k) => (Math.abs(ratios[k] - r) < Math.abs(ratios[a] - r) ? k : a), "1:1");
    const rep = body.kind === "mural" ? "none" : body.repeat === "horizontal" ? "horizontal" : "both";
    prompt = roomPhotoPrompt({ repeat: rep, strip: rep === "horizontal" && body.strip === true, mural: body.kind === "mural", wall: typeof body.wall === "string" ? body.wall : "", scale: String(body.scaleText || "").slice(0, 300) });
  } else if (purpose === "room" && body.guide) {
    // room photo + our true-scale geometric preview as a guide + the design: the model only makes it look real
    images.unshift(strip(body.room), strip(body.guide));
    const walls = Array.isArray(body.walls) ? body.walls.slice(0, 3).map((w: any) => `${w.side} wall: ${(w.corners || []).map((c: any) => `(${Math.round(c.x * 100)}%, ${Math.round(c.y * 100)}%)`).join(" ")}`).join("; ") : "";
    prompt = `Image 1 is a photo of a real room. Image 2 is the same photo with a wallpaper roughly pasted on the walls: it shows exactly which wall areas get wallpaper and how big the pattern is. Image 3 is the wallpaper design.
Make a photorealistic version of image 1 in which exactly the papered wall areas of image 2${walls ? ` (corners as % of the photo, x then y: ${walls})` : ""} are covered with this wallpaper, at the same scale and position as in image 2, following each wall's perspective, with the room's real light and shadows falling on the paper.${scale}
Do NOT put wallpaper on the floor, the ceiling (including sloped ceilings), windows, doors, trim, baseboards or furniture. Everything that is in front of a wall in image 1 stays in front. ${body.kind || body.repeat ? " " + repeatRule(body.kind === "mural" ? "none" : body.repeat) : ""} Keep the wallpaper's pattern and colors exactly as given. Keep everything else exactly as in image 1: same room, same objects, same camera angle and framing, same image proportions. Do not add or remove anything.`;
  } else if (purpose === "room") {
    images.unshift(strip(body.room));
    prompt = `The first image is a photo of a real room. The second image is a wallpaper design. Edit the first photo so the ${body.wall || "main back wall"} is covered with this wallpaper, edge to edge, following the wall's perspective and lighting.${scale}${body.kind || body.repeat ? " " + repeatRule(body.kind === "mural" ? "none" : body.repeat) : ""} Keep the wallpaper's pattern and colors exactly as given. Keep everything else in the room exactly the same: furniture, windows, doors, outlets, floor, ceiling, decor and camera angle. Do not add or remove objects. Photorealistic.`;
  } else {
    aspect = "4:3";
    // designer room pictures of a mural show the WHOLE mural (owner, 2026-10-29); customers' room photos are unchanged
    const wholeMural = purpose === "mockup" && body.whole === true && body.kind === "mural";
    prompt = `Create a photorealistic interior photo of a ${body.room || "living room"} with the given wallpaper design covering the main back wall, edge to edge and from the ceiling line down to the baseboard.${scale}${wholeMural ? " " + WHOLE_MURAL_RULE : body.kind || body.repeat ? " " + repeatRule(body.kind === "mural" ? "none" : body.repeat) : ""} Keep the wallpaper's pattern and colors exactly as given; do not redraw or change the design. Natural daylight, tasteful furniture in front of the wall that leaves most of the wallpaper visible, straight-on camera view, magazine quality.`;
  }
  // the same picture asked again (same room, same design, same words) comes from the cache: no second paid call
  const provider0 = ai.provider === "openai" ? "openai" : "google";
  const cacheKey = await (async () => { try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode([provider0, ai.model || "", aspect, prompt, ...images].join("\u0001"))); return "ai-cache/" + [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("") + ".txt"; } catch { return ""; } })();
  if (cacheKey) { try { const hit = await env.FILES.get(cacheKey); if (hit) return j({ image: await hit.text(), model: "cache", ms: Date.now() - tStart, cached: true }); } catch {} }
  try {
    const provider = provider0;
    let model = ai.model || (provider === "google" ? "gemini-3.1-flash-image" : "gpt-image-1");
    let out = "";
    if (provider === "google") {
      // busy image model: try the other cheap flash model only (never the far pricier pro model on its own)
      const chain = [model, ...["gemini-3.1-flash-image", "gemini-2.5-flash-image"].filter((x) => x !== model)];
      let last: any = null;
      for (const m of chain) { try { out = await gemini(ai.apiKey, m, prompt, images, aspect); model = m; last = null; break; } catch (e: any) { last = e; if (!/high demand|overloaded|unavailable|503|429|not found|no longer/i.test(String(e?.message))) break; } }
      if (last) throw last;
    } else out = await openai(ai.apiKey, model, prompt, images);
    const ms = Date.now() - tStart;
    await env.DB.prepare(`INSERT INTO ai_renders (id, user_id, day, purpose, provider, model) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), who.uid, day, purpose, provider, model).run();
    if (cacheKey && out) { try { await env.FILES.put(cacheKey, out); } catch {} }
    return j({ image: out, model, ms });
  } catch (e: any) {
    const m = String(e?.message || e);
    // the key's Google project has no paid plan: image models get 0 free pictures
    if (/prepayment|credits? (are )?depleted|402/i.test(m)) return j({ error: "AI pictures are paused: the shop's Google AI credit is used up. Add credit in Google AI Studio to turn them back on.", code: "quota" }, 503);
    if (/quota|billing|free.?tier|limit: 0|RESOURCE_EXHAUSTED/i.test(m)) return j({ error: "Realistic AI pictures aren't switched on yet for this shop.", code: "quota" }, 503);
    return j({ error: m.slice(0, 300) }, 502);
  }
}
