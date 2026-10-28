import "./lib/error-capture";
import { handleBackend, isBackendPath, ANON_KEY } from "./backend";

const ORIG_FETCH = globalThis.fetch.bind(globalThis);
let ENV: any = null;
let ORIGIN = "";
// Calls from server code to the site's own data/auth/file endpoints are answered in-process.
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  if (ENV && url) {
    try {
      const u = new URL(url);
      if ((u.origin === ORIGIN || u.hostname.endsWith(".pages.dev")) && isBackendPath(u.pathname)) {
        return handleBackend(new Request(input, init), ENV, ORIGIN);
      }
    } catch {}
  }
  return ORIG_FETCH(input, init);
}) as typeof fetch;

function bindEnv(request: Request) {
  const env = (request as any).runtime?.cloudflare?.env;
  if (!env) return;
  ENV = env;
  ORIGIN = (env.PUBLIC_ORIGIN as string) || new URL(request.url).origin;
  (globalThis as any).__AM_ENV = env;
  (globalThis as any).__AM_ORIGIN = ORIGIN;
  if (typeof process !== "undefined" && process.env) {
    process.env.SUPABASE_URL = ORIGIN;
    process.env.SUPABASE_PUBLISHABLE_KEY = ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_KEY;
    for (const [k, v] of Object.entries(env)) if (typeof v === "string" && !(k in process.env)) process.env[k] = v;
  }
}

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      bindEnv(request);
      const path = new URL(request.url).pathname;
      if (ENV && isBackendPath(path)) return await handleBackend(request, ENV, ORIGIN);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
