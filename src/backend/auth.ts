// Accounts and sessions (GoTrue-compatible subset) on D1.
type D1 = any;
const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64uDecode = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signJwt(payload: any, secret: string): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
export async function verifyJwt(token: string, secret: string): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64uDecode(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64uDecode(parts[1])));
    if (p.exp && p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
const ITER = 20000;
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(bits)}`;
}
export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [, it, salt, hash] = stored.split("$");
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64uDecode(salt), iterations: Number(it) }, key, 256);
  return b64u(bits) === hash;
}
const randomToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));

export function userJson(u: any, roles: string[] = []) {
  const meta = typeof u.user_metadata === "string" ? JSON.parse(u.user_metadata || "{}") : u.user_metadata ?? {};
  const app = typeof u.app_metadata === "string" ? JSON.parse(u.app_metadata || "{}") : u.app_metadata ?? {};
  return {
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email, phone: "",
    email_confirmed_at: u.created_at, confirmed_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? u.created_at,
    app_metadata: { provider: "email", providers: ["email"], ...app, roles },
    user_metadata: { email: u.email, ...meta }, identities: [], created_at: u.created_at, updated_at: u.updated_at ?? u.created_at, is_anonymous: false,
  };
}
async function rolesOf(db: D1, uid: string): Promise<string[]> {
  const r = await db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`).bind(uid).all();
  return (r.results ?? []).map((x: any) => x.role);
}
export async function makeSession(db: D1, secret: string, u: any, sessionId?: string, amr = "password") {
  const sid = sessionId ?? crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const roles = await rolesOf(db, u.id);
  const user = userJson(u, roles);
  const access_token = await signJwt({ aud: "authenticated", exp: now + 3600, iat: now, sub: u.id, email: u.email, phone: "", role: "authenticated", aal: "aal1", amr: [{ method: amr, timestamp: now }], session_id: sid, is_anonymous: false, app_metadata: user.app_metadata, user_metadata: user.user_metadata }, secret);
  const refresh_token = randomToken(24);
  await db.prepare(`INSERT INTO auth_refresh (token, user_id, session_id) VALUES (?, ?, ?)`).bind(refresh_token, u.id, sid).run();
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token, user };
}
const jerr = (status: number, code: string, msg: string) => new Response(JSON.stringify({ code: status, error_code: code, msg, error: code, error_description: msg, message: msg }), { status, headers: { "content-type": "application/json" } });
const jok = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function userFromToken(db: D1, secret: string, token: string | null): Promise<any | null> {
  if (!token) return null;
  const p = await verifyJwt(token, secret);
  if (!p?.sub || p.role !== "authenticated") return null;
  return p;
}

export async function handleAuth(req: Request, env: any, origin: string): Promise<Response> {
  const db = env.DB; const secret = env.JWT_SECRET;
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/auth\/v1\/?/, "");
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null;
  const body: any = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  try {
    if (path.startsWith("admin/users")) {
      const key = req.headers.get("apikey") ?? "";
      if (!env.SERVICE_KEY || (key !== env.SERVICE_KEY && bearer !== env.SERVICE_KEY)) return jerr(403, "not_admin", "User not allowed");
      const r = await db.prepare(`SELECT * FROM auth_users ORDER BY created_at DESC LIMIT 1000`).all();
      const users = (r.results ?? []).map((u: any) => userJson(u));
      const idm = path.match(/^admin\/users\/([0-9a-f-]{36})$/);
      if (idm) { const u = users.find((x: any) => x.id === idm[1]); return u ? jok(u) : jerr(404, "user_not_found", "User not found"); }
      return jok({ users, aud: "authenticated" });
    }
    if (path === "settings") return jok({ external: { email: true, google: false }, disable_signup: false, mailer_autoconfirm: true });
    if (path === ".well-known/jwks.json") return jok({ keys: [] });
    if (path === "health") return jok({ name: "auth", version: "1" });
    if (path === "signup" && req.method === "POST") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jerr(400, "validation_failed", "Please enter a valid email address.");
      if (password.length < 6) return jerr(422, "weak_password", "Password should be at least 6 characters.");
      const exists = await db.prepare(`SELECT id FROM auth_users WHERE email = ?`).bind(email).first();
      if (exists) return jerr(422, "user_already_exists", "User already registered");
      const id = crypto.randomUUID();
      const hash = await hashPassword(password);
      const meta = JSON.stringify(body.data ?? body.options?.data ?? {});
      await db.prepare(`INSERT INTO auth_users (id, email, password_hash, user_metadata, last_sign_in_at) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).bind(id, email, hash, meta).run();
      const u = await db.prepare(`SELECT * FROM auth_users WHERE id = ?`).bind(id).first();
      return jok(await makeSession(db, secret, u));
    }
    if (path === "token" && req.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const email = String(body.email ?? "").trim().toLowerCase();
        let u: any = null;
        if (email === "owner" || email === "") {
          // owner password-only sign-in: try the admin accounts
          const admins = ((await db.prepare(`SELECT u.* FROM auth_users u JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'admin'`).all()).results ?? []) as any[];
          for (const a of admins) if (await checkPassword(String(body.password ?? ""), a.password_hash)) { u = a; break; }
          if (!u) return jerr(400, "invalid_credentials", "Invalid login credentials");
        } else u = await db.prepare(`SELECT * FROM auth_users WHERE email = ?`).bind(email).first();
        if (!u || u.banned || !(await checkPassword(String(body.password ?? ""), u.password_hash))) return jerr(400, "invalid_credentials", "Invalid login credentials");
        await db.prepare(`UPDATE auth_users SET last_sign_in_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(u.id).run();
        return jok(await makeSession(db, secret, u));
      }
      if (grant === "refresh_token") {
        const rt = String(body.refresh_token ?? "");
        const row = await db.prepare(`SELECT * FROM auth_refresh WHERE token = ? AND revoked = 0`).bind(rt).first();
        if (!row) return jerr(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        await db.prepare(`UPDATE auth_refresh SET revoked = 1 WHERE token = ?`).bind(rt).run();
        const u = await db.prepare(`SELECT * FROM auth_users WHERE id = ?`).bind(row.user_id).first();
        if (!u || u.banned) return jerr(400, "user_not_found", "User not found");
        return jok(await makeSession(db, secret, u, row.session_id));
      }
      return jerr(400, "unsupported_grant_type", "unsupported grant type");
    }
    if (path === "user") {
      const p = await userFromToken(db, secret, bearer);
      if (!p) return jerr(401, "bad_jwt", "invalid JWT: unable to parse or verify signature");
      let u = await db.prepare(`SELECT * FROM auth_users WHERE id = ?`).bind(p.sub).first();
      if (!u) return jerr(404, "user_not_found", "User from sub claim in JWT does not exist");
      if (req.method === "PUT") {
        if (body.password) {
          if (String(body.password).length < 6) return jerr(422, "weak_password", "Password should be at least 6 characters.");
          await db.prepare(`UPDATE auth_users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).bind(await hashPassword(String(body.password)), u.id).run();
        }
        if (body.data) {
          const meta = { ...JSON.parse(u.user_metadata || "{}"), ...body.data };
          await db.prepare(`UPDATE auth_users SET user_metadata = ? WHERE id = ?`).bind(JSON.stringify(meta), u.id).run();
        }
        if (body.email) await db.prepare(`UPDATE auth_users SET email = ? WHERE id = ?`).bind(String(body.email).toLowerCase(), u.id).run();
        u = await db.prepare(`SELECT * FROM auth_users WHERE id = ?`).bind(p.sub).first();
      }
      return jok(userJson(u, await rolesOf(db, u.id)));
    }
    if (path === "logout") {
      const p = await userFromToken(db, secret, bearer);
      if (p?.session_id) await db.prepare(`UPDATE auth_refresh SET revoked = 1 WHERE session_id = ?`).bind(p.session_id).run();
      return new Response(null, { status: 204 });
    }
    if (path === "recover" && req.method === "POST") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const u = await db.prepare(`SELECT * FROM auth_users WHERE email = ?`).bind(email).first();
      if (u) {
        const s = await makeSession(db, secret, u, undefined, "recovery");
        const redirect = url.searchParams.get("redirect_to") || body.redirect_to || `${origin}/reset-password`;
        const link = `${redirect}#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=3600&refresh_token=${s.refresh_token}&token_type=bearer&type=recovery`;
        await db.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, kind) VALUES (?, ?, ?, ?, ?, 'password_reset')`).bind(crypto.randomUUID(), email, "Reset your password", `<p>Choose a new password: <a href="${link}">reset password</a></p>`, `Choose a new password: ${link}`).run();
      }
      return jok({});
    }
    if (path === "otp" || path === "magiclink" || path === "resend") return jok({});
    if (path.startsWith("authorize")) return jerr(400, "provider_disabled", "Sign-in with this provider is not enabled yet.");
    return jerr(404, "not_found", "not found");
  } catch (e: any) {
    console.error("[auth]", e);
    return jerr(500, "unexpected_failure", String(e?.message ?? e));
  }
}
