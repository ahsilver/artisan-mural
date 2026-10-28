// File storage (Supabase-storage-compatible subset) on R2.
import { signJwt, verifyJwt } from "./auth";
import type { Who } from "./policies";
type Env = any;
const PUBLIC_BUCKETS = new Set(["site-assets"]);
const j = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (status: number, msg: string) => j({ statusCode: String(status), error: msg, message: msg }, status);
const decodePath = (p: string) => p.split("/").map((s) => decodeURIComponent(s)).join("/");

function canRead(who: Who, bucket: string, name: string): boolean {
  if (who.service || who.admin || PUBLIC_BUCKETS.has(bucket)) return true;
  const folder = name.split("/")[0];
  if (!who.uid) return false;
  if (["designer-artwork", "custom-request-photos", "print-originals"].includes(bucket)) return folder === who.uid;
  return false;
}
function canWrite(who: Who, bucket: string, name: string): boolean {
  if (who.service || who.admin) return true;
  if (!who.uid) return false;
  const folder = name.split("/")[0];
  if (bucket === "custom-request-photos") return folder === who.uid;
  return false;
}
async function putObject(env: Env, bucket: string, name: string, body: ReadableStream | ArrayBuffer | Blob | null, mime: string, owner: string | null, upsert: boolean) {
  const key = `${bucket}/${name}`;
  if (!upsert) {
    const head = await env.FILES.head(key);
    if (head) return err(409, "The resource already exists");
  }
  const obj = await env.FILES.put(key, body as any, { httpMetadata: { contentType: mime || "application/octet-stream" } });
  await env.DB.prepare(`INSERT INTO storage_objects (bucket, name, size, mime, owner, updated_at) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(bucket, name) DO UPDATE SET size=excluded.size, mime=excluded.mime, updated_at=excluded.updated_at`).bind(bucket, name, obj?.size ?? 0, mime, owner).run();
  return j({ Id: crypto.randomUUID(), Key: key, id: crypto.randomUUID(), path: name, fullPath: key });
}
async function readBody(req: Request): Promise<{ body: any; mime: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const raw = new Uint8Array(await req.arrayBuffer());
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (m) {
      const part = firstFilePart(raw, m[1] ?? m[2]);
      if (part) return part;
    }
    const fd = await new Request("http://x", { method: "POST", headers: { "content-type": ct }, body: raw }).formData();
    for (const [, v] of fd.entries()) {
      if (typeof v !== "string") return { body: await (v as Blob).arrayBuffer(), mime: (v as Blob).type || "application/octet-stream" };
    }
    return { body: new ArrayBuffer(0), mime: "application/octet-stream" };
  }
  return { body: req.body ? await req.arrayBuffer() : new ArrayBuffer(0), mime: ct || "application/octet-stream" };
}
function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}
// Multipart parser that accepts parts with an empty name (the storage client sends those).
function firstFilePart(raw: Uint8Array, boundary: string): { body: ArrayBuffer; mime: string } | null {
  const enc = new TextEncoder();
  const delim = enc.encode("--" + boundary);
  const crlf2 = enc.encode("\r\n\r\n");
  let pos = indexOf(raw, delim);
  while (pos >= 0) {
    const start = pos + delim.length;
    if (raw[start] === 45 && raw[start + 1] === 45) break; // closing --
    const hEnd = indexOf(raw, crlf2, start);
    if (hEnd < 0) break;
    const headers = new TextDecoder().decode(raw.slice(start, hEnd));
    const next = indexOf(raw, delim, hEnd + 4);
    if (next < 0) break;
    const bodyEnd = next - 2; // strip CRLF before delimiter
    if (/filename=/i.test(headers) || /content-type:/i.test(headers)) {
      const mt = headers.match(/content-type:\s*([^\r\n;]+)/i);
      const bytes = raw.slice(hEnd + 4, bodyEnd);
      return { body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mime: mt ? mt[1].trim() : "application/octet-stream" };
    }
    pos = next;
  }
  return null;
}
export async function serveObject(req: Request, env: Env, key: string, download?: string | null): Promise<Response> {
  const range = req.headers.get("range");
  const obj = await env.FILES.get(key, range ? { range: req.headers } : undefined);
  if (!obj) return err(404, "Object not found");
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("cache-control", "private, max-age=3600");
  h.set("accept-ranges", "bytes");
  if (download !== undefined && download !== null) h.set("content-disposition", `attachment${download ? `; filename="${download.replace(/"/g, "")}"` : ""}`);
  if (range && obj.range) {
    const r: any = obj.range; const start = r.offset ?? 0; const len = r.length ?? obj.size - start;
    h.set("content-range", `bytes ${start}-${start + len - 1}/${obj.size}`);
    h.set("content-length", String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set("content-length", String(obj.size));
  return new Response(obj.body, { headers: h });
}
// Long links end on the hour, so the same file gets the same link for a while and the browser can reuse it.
const stableExp = (sec: number) => { const e = Math.floor(Date.now() / 1000) + Math.max(10, sec); return sec >= 3600 ? Math.ceil(e / 3600) * 3600 : e; };
export async function signUrl(env: Env, bucket: string, name: string, expiresIn: number): Promise<string> {
  const token = await signJwt({ url: `${bucket}/${name}`, exp: stableExp(Number(expiresIn) || 3600) }, env.JWT_SECRET);
  return `/object/sign/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}?token=${token}`;
}
export async function handleStorage(req: Request, env: Env, who: Who): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname.replace(/^\/storage\/v1\/?/, "");
  const m = req.method;
  try {
    // signed reads
    let mm = p.match(/^object\/sign\/([^/]+)\/(.+)$/);
    if (mm && (m === "GET" || m === "HEAD")) {
      const bucket = mm[1], name = decodePath(mm[2]);
      const t = await verifyJwt(url.searchParams.get("token") ?? "", env.JWT_SECRET);
      if (!t || t.url !== `${bucket}/${name}`) return err(400, "Invalid signature");
      return serveObject(req, env, `${bucket}/${name}`, url.searchParams.get("download"));
    }
    if (mm && m === "POST") {
      const bucket = mm[1], name = decodePath(mm[2]);
      if (!canRead(who, bucket, name)) return err(400, "Object not found");
      const b: any = await req.json().catch(() => ({}));
      return j({ signedURL: await signUrl(env, bucket, name, b.expiresIn) });
    }
    mm = p.match(/^object\/sign\/([^/]+)\/?$/);
    if (mm && m === "POST") {
      const bucket = mm[1];
      const b: any = await req.json().catch(() => ({}));
      const out = [];
      for (const path of b.paths ?? []) {
        if (!canRead(who, bucket, path)) { out.push({ path, error: "Either the object does not exist or you do not have access to it", signedURL: null }); continue; }
        out.push({ path, error: null, signedURL: await signUrl(env, bucket, path, b.expiresIn) });
      }
      return j(out);
    }
    // signed uploads
    mm = p.match(/^object\/upload\/sign\/([^/]+)\/(.+)$/);
    if (mm) {
      const bucket = mm[1], name = decodePath(mm[2]);
      if (m === "POST") {
        if (!canWrite(who, bucket, name)) return err(403, "new row violates row-level security policy");
        if (!(who.service || who.admin) && ["print-originals", "project-files"].includes(bucket) && (await env.FILES.head(`${bucket}/${name}`))) return err(409, "This file is kept and can't be replaced. Upload it under a new name.");
        const token = await signJwt({ upload: `${bucket}/${name}`, owner: who.uid, exp: Math.floor(Date.now() / 1000) + 7200 }, env.JWT_SECRET);
        return j({ url: `/object/upload/sign/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}?token=${token}`, token });
      }
      if (m === "PUT" || m === "POST") {
        const t = await verifyJwt(url.searchParams.get("token") ?? "", env.JWT_SECRET);
        if (!t || t.upload !== `${bucket}/${name}`) return err(400, "Invalid signature");
        const { body, mime } = await readBody(req);
        return putObject(env, bucket, name, body, mime, t.owner ?? null, true);
      }
    }
    mm = p.match(/^object\/public\/([^/]+)\/(.+)$/);
    if (mm && (m === "GET" || m === "HEAD")) {
      const bucket = mm[1], name = decodePath(mm[2]);
      if (!PUBLIC_BUCKETS.has(bucket)) return err(400, "Bucket not public");
      const r = await serveObject(req, env, `${bucket}/${name}`, url.searchParams.get("download"));
      if (r.ok) r.headers.set("cache-control", "public, max-age=86400");
      return r;
    }
    mm = p.match(/^object\/list\/([^/]+)$/);
    if (mm && m === "POST") {
      const bucket = mm[1];
      const b: any = await req.json().catch(() => ({}));
      const prefix = (b.prefix ?? "").replace(/\/?$/, b.prefix ? "/" : "");
      if (!canRead(who, bucket, prefix + "x")) return j([]);
      const r = await env.DB.prepare(`SELECT * FROM storage_objects WHERE bucket = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?`).bind(bucket, prefix + "%", Number(b.limit ?? 100), Number(b.offset ?? 0)).all();
      return j((r.results ?? []).map((o: any) => ({ name: o.name.slice(prefix.length), id: o.name, updated_at: o.updated_at, created_at: o.created_at, metadata: { size: o.size, mimetype: o.mime } })));
    }
    mm = p.match(/^object\/(?:authenticated\/)?([^/]+)\/(.+)$/);
    if (mm) {
      const bucket = mm[1], name = decodePath(mm[2]);
      if (m === "GET" || m === "HEAD") {
        if (!canRead(who, bucket, name)) return err(400, "Object not found");
        return serveObject(req, env, `${bucket}/${name}`);
      }
      if (m === "POST" || m === "PUT") {
        if (!canWrite(who, bucket, name)) return err(403, "new row violates row-level security policy");
        const { body, mime } = await readBody(req);
        return putObject(env, bucket, name, body, mime, who.uid, m === "PUT" || req.headers.get("x-upsert") === "true");
      }
      if (m === "DELETE") {
        if (!(who.service || who.admin)) return err(403, "not allowed");
        await env.FILES.delete(`${bucket}/${name}`);
        await env.DB.prepare(`DELETE FROM storage_objects WHERE bucket = ? AND name = ?`).bind(bucket, name).run();
        return j({ message: "Successfully deleted" });
      }
    }
    mm = p.match(/^object\/([^/]+)\/?$/);
    if (mm && m === "DELETE") {
      const bucket = mm[1];
      const b: any = await req.json().catch(() => ({}));
      const out = [];
      for (const name of b.prefixes ?? []) {
        if (!(who.service || who.admin)) continue;
        await env.FILES.delete(`${bucket}/${name}`);
        await env.DB.prepare(`DELETE FROM storage_objects WHERE bucket = ? AND name = ?`).bind(bucket, name).run();
        out.push({ name, bucket_id: bucket });
      }
      return j(out);
    }
    if (p.startsWith("bucket")) return j([]);
    return err(404, "not found");
  } catch (e: any) {
    console.error("[storage]", e);
    return err(500, String(e?.message ?? e));
  }
}
