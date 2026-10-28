export type RoomPoint = { x: number; y: number };
export type ProtectionStroke = RoomPoint[];
export type DetectedWall = { label: string; polygon: RoomPoint[]; samples: RoomPoint[]; objects: { label: string; polygon: RoomPoint[] }[] };

function fillPolygon(ctx: CanvasRenderingContext2D, polygon: RoomPoint[], W: number, H: number) {
  const first = polygon[0]; if (!first) return;
  ctx.beginPath(); ctx.moveTo(first.x * W, first.y * H);
  polygon.slice(1).forEach((p) => ctx.lineTo(p.x * W, p.y * H));
  ctx.closePath(); ctx.fill();
}

/**
 * Turns the AI's wall outline into a mask: the outline minus the objects in front of it.
 * Opaque white = wall to wallpaper.
 */
export async function buildWallRegion(src: string, wall: DetectedWall) {
  const image = new Image(); image.src = src; await image.decode();
  const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
  const W = Math.max(1, Math.round(image.naturalWidth * scale)), H = Math.max(1, Math.round(image.naturalHeight * scale));
  const make = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new Error("Could not read your photo."); return { c, ctx }; };
  // Mask colours below are data channels, not UI colours.
  const poly = make(); poly.ctx.fillStyle = "#fff"; fillPolygon(poly.ctx, wall.polygon, W, H);
  const inPoly = poly.ctx.getImageData(0, 0, W, H).data;
  const obj = make(); obj.ctx.fillStyle = "#fff"; wall.objects.forEach((o) => fillPolygon(obj.ctx, o.polygon, W, H));
  const inObj = obj.ctx.getImageData(0, 0, W, H).data;
  // The AI outline gives clean wall edges; everything it marked as an object stays untouched.
  const region = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (inPoly[k * 4 + 3]! > 127 && inObj[k * 4 + 3]! <= 127) region[k] = 1;
  const raw = make(); const img = raw.ctx.createImageData(W, H);
  region.forEach((v, k) => { if (v) { img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 255; img.data[k * 4 + 3] = 255; } });
  raw.ctx.putImageData(img, 0, 0);
  const out = make(); out.ctx.filter = "blur(1px)"; out.ctx.drawImage(raw.c, 0, 0); out.ctx.filter = "none";
  const sm = out.ctx.getImageData(0, 0, W, H); let count = 0;
  for (let i = 3; i < sm.data.length; i += 4) { const on = sm.data[i]! > 100 && inPoly[i]! > 127; sm.data[i] = on ? 255 : 0; sm.data[i - 3] = sm.data[i - 2] = sm.data[i - 1] = 255; if (on) count++; }
  out.ctx.putImageData(sm, 0, 0);
  return { canvas: out.c, coverage: count / (W * H) };
}

/** Downscales a photo for AI analysis. */
export async function analysisPhoto(src: string) {
  const image = new Image(); image.src = src; await image.decode();
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(image.naturalWidth * scale); c.height = Math.round(image.naturalHeight * scale);
  const ctx = c.getContext("2d"); if (!ctx) throw new Error("Could not read your photo.");
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => b ? resolve(b) : reject(new Error("Could not prepare your photo.")), "image/jpeg", 0.88));
}

export function pointInPolygon(p: RoomPoint, polygon: RoomPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}


/** Finds the wall around each tapped point by growing a region of similar colour. */
export async function detectWall(src: string, seeds: RoomPoint[], tolerance = 34) {
  const image = new Image(); image.src = src; await image.decode();
  const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
  const W = Math.max(1, Math.round(image.naturalWidth * scale)), H = Math.max(1, Math.round(image.naturalHeight * scale));
  const work = document.createElement("canvas"); work.width = W; work.height = H;
  const ctx = work.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new Error("Could not read your photo.");
  ctx.filter = "blur(1.5px)"; ctx.drawImage(image, 0, 0, W, H); ctx.filter = "none";
  const px = ctx.getImageData(0, 0, W, H).data;
  const region = new Uint8Array(W * H);
  const tol2 = tolerance * tolerance;
  for (const seed of seeds) {
    const sx = Math.min(W - 1, Math.round(seed.x * (W - 1))), sy = Math.min(H - 1, Math.round(seed.y * (H - 1)));
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = sx + dx, y = sy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4; r += px[i]!; g += px[i + 1]!; b += px[i + 2]!; n++;
    }
    r /= n; g /= n; b /= n;
    const stack = [sy * W + sx];
    while (stack.length) {
      const k = stack.pop()!; if (region[k]) continue;
      const i = k * 4; const dr = px[i]! - r, dg = px[i + 1]! - g, db = px[i + 2]! - b;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      region[k] = 1; const x = k % W;
      if (x > 0) stack.push(k - 1); if (x < W - 1) stack.push(k + 1);
      if (k >= W) stack.push(k - W); if (k < W * (H - 1)) stack.push(k + W);
    }
  }
  // Smooth edges and close small speckle holes.
  const raw = document.createElement("canvas"); raw.width = W; raw.height = H;
  const rctx = raw.getContext("2d")!; const img = rctx.createImageData(W, H);
  region.forEach((v, k) => { if (v) { img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 255; img.data[k * 4 + 3] = 255; } });
  rctx.putImageData(img, 0, 0);
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const octx = out.getContext("2d", { willReadFrequently: true })!; octx.filter = "blur(2px)"; octx.drawImage(raw, 0, 0); octx.filter = "none";
  const sm = octx.getImageData(0, 0, W, H); let count = 0;
  for (let i = 3; i < sm.data.length; i += 4) { const on = sm.data[i]! > 100; sm.data[i] = on ? 255 : 0; sm.data[i - 3] = sm.data[i - 2] = sm.data[i - 1] = 255; if (on) count++; }
  octx.putImageData(sm, 0, 0);
  return { canvas: out, coverage: count / (W * H) };
}

export function drawWallMask(width: number, height: number, region: HTMLCanvasElement, strokes: ProtectionStroke[]) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the wall selection.");
  // Mask pixel colors are data, not UI colors: opaque means preserve, transparent means edit.
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(region, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = Math.min(width, height) * 0.055; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const stroke of strokes) {
    const first = stroke[0]; if (!first) continue;
    ctx.beginPath(); ctx.moveTo(first.x * width, first.y * height);
    if (stroke.length === 1) ctx.lineTo(first.x * width + 0.01, first.y * height);
    else stroke.slice(1).forEach(p => ctx.lineTo(p.x * width, p.y * height));
    ctx.stroke();
  }
  return canvas;
}

export async function compositeRoom(original: HTMLCanvasElement, mask: HTMLCanvasElement, generated: string) {
  const image = new Image(); image.src = generated; await image.decode();
  const output = document.createElement("canvas"); output.width = original.width; output.height = original.height;
  const ctx = output.getContext("2d"); if (!ctx) throw new Error("Could not finish your preview.");
  ctx.drawImage(image, 0, 0, output.width, output.height);
  // Discard all generated pixels outside the selected wall, including protected furniture.
  ctx.globalCompositeOperation = "destination-out"; ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "destination-over"; ctx.drawImage(original, 0, 0);
  return output.toDataURL("image/png");
}

export function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not prepare your photo.")), "image/png"));
}
