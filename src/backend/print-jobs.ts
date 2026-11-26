/**
 * Print jobs for huge originals: the owner sets the crop or repeat on a light preview, and the print service
 * (a Cloudflare Container with libvips, see print-service/) makes the full-size print file from the original.
 *
 * Flow: admin/print-jobs (POST) saves the job -> the "artisan-print" worker (env.PRINT, a service binding) runs it in
 * a Durable Object -> the container reads the original, makes the TIFF -> it is stored in R2 under print-files/ ->
 * the job row says "done" and the back office shows "Download".
 * On a computer without the worker (local testing), env.PRINT_URL points at the service and the job runs inline.
 */
type Env = any;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const bad = (m: string, s = 400) => j({ error: m }, s);
const now = () => new Date().toISOString();

export const driveDownloadUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;

/** Runs one job: send it to the print service, store the answer in R2, mark the row. Used by the worker and locally. */
export async function runPrintJob(env: Env, id: string, send: (body: string) => Promise<Response>) {
  const row: any = await env.DB.prepare(`SELECT * FROM print_jobs WHERE id = ?`).bind(id).first();
  if (!row || row.status === "done") return;
  await env.DB.prepare(`UPDATE print_jobs SET status = 'running', started_at = ? WHERE id = ?`).bind(now(), id).run();
  try {
    const d = JSON.parse(row.draws); const job = { sourceUrl: row.source_url, widthIn: row.width_in, heightIn: row.height_in, dpi: row.dpi, draws: Array.isArray(d) ? d : d.draws, crop: Array.isArray(d) ? undefined : d.crop, name: row.name };
    const r = await send(JSON.stringify(job));
    if (!r.ok) { const e: any = await r.json().catch(() => ({})); throw new Error(e.error || `The print service answered ${r.status}.`); }
    const info = JSON.parse(r.headers.get("x-print-info") || "{}");
    const len = Number(r.headers.get("content-length") || 0);
    const key = `print-files/${id}/${row.name}.tif`;
    // R2 needs the length of a streamed upload; the service always sends it
    const body = len && (globalThis as any).FixedLengthStream ? r.body!.pipeThrough(new (globalThis as any).FixedLengthStream(len)) : await r.arrayBuffer();
    await env.FILES.put(key, body, { httpMetadata: { contentType: "image/tiff", contentDisposition: `attachment; filename="${row.name}.tif"` } });
    await env.DB.prepare(`UPDATE print_jobs SET status = 'done', out_key = ?, bytes = ?, info = ?, finished_at = ? WHERE id = ?`).bind(key, info.bytes || len, JSON.stringify(info), now(), id).run();
  } catch (e: any) {
    await env.DB.prepare(`UPDATE print_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`).bind(String(e?.message || e).slice(0, 400), now(), id).run();
  }
}

/** Owner routes: admin/print-jobs (list, create) and admin/print-jobs/:id/download. */
export async function printJobRoutes(env: Env, p: string, m: string, body: any, signUrl: (env: Env, bucket: string, name: string, exp: number) => Promise<string>): Promise<Response | null> {
  const DB = env.DB;
  if (p === "print-jobs" && m === "GET") {
    const rows = ((await DB.prepare(`SELECT id, created_at, status, name, width_in, height_in, dpi, bytes, info, error, finished_at FROM print_jobs ORDER BY created_at DESC LIMIT 30`).all()).results ?? []) as any[];
    return j({ jobs: rows.map((r) => ({ ...r, info: r.info ? JSON.parse(r.info) : null })) });
  }
  if (p === "print-jobs" && m === "POST") {
    const draws = Array.isArray(body.draws) ? body.draws.slice(0, 5000).map((d: any) => ({ x: Number(d.x), y: Number(d.y), w: Number(d.w), h: Number(d.h) })) : [];
    const widthIn = Number(body.widthIn), heightIn = Number(body.heightIn), dpi = Math.max(50, Math.min(300, Number(body.dpi) || 150));
    if (!draws.length || !(widthIn > 0) || !(heightIn > 0) || draws.some((d: any) => ![d.x, d.y, d.w, d.h].every(Number.isFinite))) return bad("Set the wall and the crop first.");
    if (widthIn * dpi * heightIn * dpi > 2e9) return bad("That wall is too big at this DPI. Lower the DPI.");
    let sourceUrl = "";
    if (typeof body.driveId === "string" && /^[\w-]{10,}$/.test(body.driveId)) sourceUrl = driveDownloadUrl(body.driveId);
    else if (typeof body.key === "string" && /^[a-z-]+\/[^.][^]*$/.test(body.key)) { const [bucket, ...rest] = body.key.split("/"); sourceUrl = env.PUBLIC_ORIGIN + "/storage/v1" + (await signUrl(env, bucket, rest.join("/"), 6 * 3600)); }
    else return bad("Choose the original: a Google Drive file or a stored file.");
    const name = String(body.name || "print-file").replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "print-file";
    const id = crypto.randomUUID();
    await DB.prepare(`INSERT INTO print_jobs (id, created_at, status, name, source_url, width_in, height_in, dpi, draws) VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?)`).bind(id, now(), name, sourceUrl, widthIn, heightIn, dpi, JSON.stringify(body.crop && Number(body.crop.w) > 0 && Number(body.crop.h) > 0 ? { draws, crop: { w: Math.min(1, Number(body.crop.w)), h: Math.min(1, Number(body.crop.h)) } } : draws)).run();
    if (env.PRINT) {
      // production: the print worker runs it in the background (it can take a few minutes for very big files)
      const r = await env.PRINT.fetch("https://print/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      if (!r.ok) { await DB.prepare(`UPDATE print_jobs SET status = 'failed', error = ? WHERE id = ?`).bind("The print service could not start.", id).run(); return bad("The print service could not start. Try again in a minute.", 502); }
    } else if (env.PRINT_URL) {
      // local testing: run it here and answer when it is finished
      await runPrintJob(env, id, (b) => fetch(String(env.PRINT_URL).replace(/\/$/, "") + "/job", { method: "POST", headers: { "content-type": "application/json" }, body: b }));
    } else {
      await DB.prepare(`UPDATE print_jobs SET status = 'failed', error = ? WHERE id = ?`).bind("The print service isn't set up yet.", id).run();
      return bad("The print service isn't set up yet.", 503);
    }
    return j({ id });
  }
  const mm = p.match(/^print-jobs\/([\w-]+)\/download$/);
  if (mm && m === "GET") {
    const row: any = await DB.prepare(`SELECT out_key, name FROM print_jobs WHERE id = ? AND status = 'done'`).bind(mm[1]).first();
    if (!row?.out_key) return bad("Not ready yet.", 404);
    const [bucket, ...rest] = String(row.out_key).split("/");
    return j({ url: "/storage/v1" + (await signUrl(env, bucket!, rest.join("/"), 3600)) + "&download=" + encodeURIComponent(`${row.name}.tif`) });
  }
  return null;
}
