// Ready-to-print file maker: renders the customer's wall (repeat tiled, or the mural crop) at a fixed DPI
// strip by strip and writes an LZW-compressed TIFF (BigTIFF when over 4 GB). Pure functions, used by the worker.
export type Src = { w: number; h: number; n: number; data: Uint8Array; photometric: number };
export type Draw = { x: number; y: number; w: number; h: number };
export type Plan = { widthIn: number; heightIn: number; draws: Draw[]; repeat: boolean; dpi: number };

/** TIFF LZW (MSB-first, 9-12 bit codes, early change as libtiff writes it). */
export function lzwEncode(data: Uint8Array): Uint8Array {
  const next = new Int16Array(4096 * 256).fill(-1);
  const used: number[] = [];
  let out = new Uint8Array(Math.max(1024, (data.length * 1.6) | 0) + 64); let op = 0;
  let acc = 0, accBits = 0, width = 9, free = 258;
  const put = (code: number) => {
    acc = (acc << width) | code; accBits += width;
    while (accBits >= 8) { accBits -= 8; if (op >= out.length) { const o2 = new Uint8Array(out.length * 2); o2.set(out); out = o2; } out[op++] = (acc >>> accBits) & 255; }
    acc &= (1 << accBits) - 1;
  };
  const reset = () => { for (let i = 0; i < used.length; i++) next[used[i]] = -1; used.length = 0; free = 258; width = 9; };
  put(256);
  if (!data.length) { put(257); if (accBits) out[op++] = (acc << (8 - accBits)) & 255; return out.slice(0, op); }
  let w = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i], idx = w * 256 + k, c = next[idx];
    if (c >= 0) { w = c; continue; }
    put(w);
    next[idx] = free; used.push(idx); free++;
    if (free === 4094) { put(256); reset(); }
    else if (free > (1 << width) - 1) width++;
    w = k;
  }
  put(w); free++;
  if (free > (1 << width) - 1 && width < 12) width++;
  put(257);
  if (accBits) out[op++] = (acc << (8 - accBits)) & 255;
  return out.slice(0, op);
}

/** Output pixel size at the plan's DPI. */
export function outSize(p: Plan) { return { W: Math.max(1, Math.round(p.widthIn * p.dpi)), H: Math.max(1, Math.round(p.heightIn * p.dpi)) }; }

/** Fill rows [y0, y0+rows) of the wall into buf (interleaved, src.n channels). Bilinear sampling. */
export function renderRows(src: Src, p: Plan, W: number, H: number, y0: number, rows: number, buf: Uint8Array, colMap?: { sx: Float64Array; di: Int32Array }) {
  const n = src.n, blank = src.photometric === 5 || src.photometric === 0 ? 0 : 255;
  const cm = colMap ?? columnMap(src, p, W);
  const { sx, di } = cm;
  for (let r = 0; r < rows; r++) {
    const py = y0 + r, v = (py + 0.5) / H, rowOff = r * W * n;
    // source y for each draw column (cache by draw index)
    for (let px = 0; px < W; px++) {
      const o = rowOff + px * n, d = di[px];
      if (d < 0) { for (let c = 0; c < n; c++) buf[o + c] = blank; continue; }
      const dr = p.draws[d];
      let fy = (v - dr.y) / dr.h;
      if (p.repeat) fy -= Math.floor(fy); else if (fy < 0 || fy >= 1) { for (let c = 0; c < n; c++) buf[o + c] = blank; continue; }
      let syf = fy * src.h - 0.5; let sxf = sx[px];
      let x0 = Math.floor(sxf), yy0 = Math.floor(syf); const ax = sxf - x0, ay = syf - yy0;
      let x1 = x0 + 1, yy1 = yy0 + 1;
      if (p.repeat) { x0 = (x0 + src.w) % src.w; x1 = x1 % src.w; yy0 = (yy0 + src.h) % src.h; yy1 = yy1 % src.h; }
      else { if (x0 < 0) x0 = 0; if (x1 > src.w - 1) x1 = src.w - 1; if (x0 > src.w - 1) x0 = src.w - 1; if (yy0 < 0) yy0 = 0; if (yy1 > src.h - 1) yy1 = src.h - 1; if (yy0 > src.h - 1) yy0 = src.h - 1; }
      const i00 = (yy0 * src.w + x0) * n, i10 = (yy0 * src.w + x1) * n, i01 = (yy1 * src.w + x0) * n, i11 = (yy1 * src.w + x1) * n, D = src.data;
      for (let c = 0; c < n; c++) {
        const top = D[i00 + c] + (D[i10 + c] - D[i00 + c]) * ax, bot = D[i01 + c] + (D[i11 + c] - D[i01 + c]) * ax;
        buf[o + c] = (top + (bot - top) * ay + 0.5) | 0;
      }
    }
  }
}
/** Per output column: which draw covers it and the source x (float). Repeats use the draws of the first row. */
export function columnMap(src: Src, p: Plan, W: number) {
  const sx = new Float64Array(W), di = new Int32Array(W).fill(-1);
  const seen = new Set<number>();
  const cols = p.repeat ? p.draws.filter((d) => { const k = Math.round(d.x * 1e9); if (seen.has(k)) return false; seen.add(k); return true; }) : p.draws;
  for (let px = 0; px < W; px++) {
    const u = (px + 0.5) / W;
    for (let i = 0; i < cols.length; i++) {
      const d = cols[i]; const fx = (u - d.x) / d.w;
      if (fx >= 0 && fx < 1) { di[px] = p.draws.indexOf(d); sx[px] = fx * src.w - 0.5; break; }
    }
  }
  return { sx, di };
}

/** Header + IFD for the finished strips. Returns header bytes (fits in 16) and IFD bytes placed at ifdOffset. */
export function tiffTail(o: { W: number; H: number; n: number; photometric: number; rowsPerStrip: number; dpi: number; offsets: number[]; counts: number[]; ifdOffset: number }) {
  const big = o.ifdOffset + 4096 + o.offsets.length * 16 > 0xfffffff0;
  const tags: [number, number, number[] ][] = [];
  const S = 3, L = 4, R = 5, L8 = 16;
  const OT = big ? L8 : L;
  tags.push([256, L, [o.W]], [257, L, [o.H]], [258, S, Array(o.n).fill(8)], [259, S, [5]], [262, S, [o.photometric]], [273, OT, o.offsets], [277, S, [o.n]], [278, L, [o.rowsPerStrip]], [279, OT, o.counts], [282, R, [o.dpi, 1]], [283, R, [o.dpi, 1]], [284, S, [1]], [296, S, [2]]);
  if (o.photometric === 5) tags.push([332, S, [1]]);
  tags.sort((a, b) => a[0] - b[0]);
  const size = (t: number) => (t === S ? 2 : t === L ? 4 : t === R ? 4 : 8);
  const entry = big ? 20 : 12, inline = big ? 8 : 4;
  const head = big ? 8 : 2, ifdLen = head + tags.length * entry + (big ? 8 : 4);
  let extra = 0; const extraOff: number[] = [];
  for (const [, t, v] of tags) { const bytes = v.length * size(t); if (bytes > inline) { extraOff.push(extra); extra += bytes + (bytes % 2); } else extraOff.push(-1); }
  const buf = new ArrayBuffer(ifdLen + extra), dv = new DataView(buf);
  const w64 = (pos: number, val: number) => { dv.setUint32(pos, val % 4294967296, true); dv.setUint32(pos + 4, Math.floor(val / 4294967296), true); };
  const wv = (pos: number, t: number, val: number) => { if (t === S) dv.setUint16(pos, val, true); else if (t === L || t === R) dv.setUint32(pos, val, true); else w64(pos, val); };
  if (big) w64(0, tags.length); else dv.setUint16(0, tags.length, true);
  tags.forEach(([tag, t, v], i) => {
    const e = head + i * entry; dv.setUint16(e, tag, true); dv.setUint16(e + 2, t, true);
    const count = t === R ? v.length / 2 : v.length;
    if (big) w64(e + 4, count); else dv.setUint32(e + 4, count, true);
    const vp = big ? e + 12 : e + 8;
    const target = extraOff[i] >= 0 ? ifdLen + extraOff[i] : -1;
    if (target >= 0) { if (big) w64(vp, o.ifdOffset + target); else dv.setUint32(vp, o.ifdOffset + target, true); }
    const base = target >= 0 ? target : vp;
    v.forEach((val, k) => wv(base + k * size(t), t, val));
  });
  const header = new Uint8Array(16), hv = new DataView(header.buffer);
  header[0] = 73; header[1] = 73;
  if (big) { hv.setUint16(2, 43, true); hv.setUint16(4, 8, true); hv.setUint16(6, 0, true); hv.setUint32(8, o.ifdOffset % 4294967296, true); hv.setUint32(12, Math.floor(o.ifdOffset / 4294967296), true); }
  else { hv.setUint16(2, 42, true); hv.setUint32(4, o.ifdOffset, true); }
  return { header, ifd: new Uint8Array(buf), big };
}

/** Mural rows from a row source that only holds a window of rows (the source is read top to bottom). */
export function renderRowsWindow(srcW: number, srcH: number, n: number, photometric: number, getRow: (y: number) => Uint8Array, p: Plan, W: number, H: number, y0: number, rows: number, buf: Uint8Array, cm: { sx: Float64Array; di: Int32Array }) {
  const blank = photometric === 5 || photometric === 0 ? 0 : 255, d = p.draws[0];
  for (let r = 0; r < rows; r++) {
    const v = (y0 + r + 0.5) / H, fy = (v - d.y) / d.h, rowOff = r * W * n;
    if (fy < 0 || fy >= 1) { buf.fill(blank, rowOff, rowOff + W * n); continue; }
    const syf = fy * srcH - 0.5; let a = Math.floor(syf); const ay = syf - a; let b = a + 1;
    if (a < 0) a = 0; if (b > srcH - 1) b = srcH - 1; if (a > srcH - 1) a = srcH - 1;
    const R0 = getRow(a), R1 = getRow(b);
    for (let px = 0; px < W; px++) {
      const o = rowOff + px * n;
      if (cm.di[px] < 0) { for (let c = 0; c < n; c++) buf[o + c] = blank; continue; }
      const sxf = cm.sx[px]; let x0 = Math.floor(sxf); const ax = sxf - x0; let x1 = x0 + 1;
      if (x0 < 0) x0 = 0; if (x1 > srcW - 1) x1 = srcW - 1; if (x0 > srcW - 1) x0 = srcW - 1;
      const i0 = x0 * n, i1 = x1 * n;
      for (let c = 0; c < n; c++) { const t = R0[i0 + c] + (R0[i1 + c] - R0[i0 + c]) * ax, bo = R1[i0 + c] + (R1[i1 + c] - R1[i0 + c]) * ax; buf[o + c] = (t + (bo - t) * ay + 0.5) | 0; }
    }
  }
}
/** Which source rows (in a source of srcH rows) the output rows [y0, y0+rows) need. */
export function rowsNeeded(p: Plan, srcH: number, H: number, y0: number, rows: number) {
  const d = p.draws[0];
  const f = (y: number) => ((y + 0.5) / H - d.y) / d.h * srcH - 0.5;
  return { lo: Math.max(0, Math.floor(f(y0))), hi: Math.min(srcH - 1, Math.floor(f(y0 + rows - 1)) + 1) };
}
