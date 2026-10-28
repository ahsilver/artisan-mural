// Backend entry: database REST, accounts, files — served from the same site.
import { handleRest } from "./pgrest";
import { handleAuth, userFromToken } from "./auth";
import { handleStorage } from "./storage";
import { callRpc } from "./rpc";
import type { Who } from "./policies";
import { handleApp } from "./app-api";

export const ANON_KEY = "am_public_anon";
export function isBackendPath(p: string) {
  return p.startsWith("/rest/v1/") || p.startsWith("/auth/v1/") || p.startsWith("/storage/v1/") || p.startsWith("/backend/");
}
export async function whoFrom(req: Request, env: any): Promise<Who> {
  const apikey = req.headers.get("apikey") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (env.SERVICE_KEY && (apikey === env.SERVICE_KEY || bearer === env.SERVICE_KEY)) return { uid: null, admin: true, service: true };
  const p = bearer && bearer !== ANON_KEY ? await userFromToken(env.DB, env.JWT_SECRET, bearer) : null;
  if (!p) return { uid: null, admin: false, service: false };
  const r = await env.DB.prepare(`SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'`).bind(p.sub).first();
  return { uid: p.sub, admin: !!r, service: false, email: p.email };
}
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info, x-upsert, cache-control, x-supabase-api-version",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
  "access-control-expose-headers": "content-range, content-length, etag",
};
export async function handleBackend(req: Request, env: any, origin: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const p = new URL(req.url).pathname;
  let res: Response;
  if (p.startsWith("/auth/v1/")) res = await handleAuth(req, env, origin);
  else {
    const who = await whoFrom(req, env);
    if (p.startsWith("/rest/v1/")) res = await handleRest(req, env.DB, who, (n, a, w) => callRpc(env.DB, n, a, w));
    else if (p.startsWith("/storage/v1/")) res = await handleStorage(req, env, who);
    else res = await handleApp(req, env, who, origin);
  }
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
