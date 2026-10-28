// Small PostgREST-compatible engine on D1 (SQLite), enough for the app's queries.
import { META, type ColKind } from "./meta";
import { policySelect, policyWrite, type Who } from "./policies";

type D1 = any;
export class HttpError extends Error {
  constructor(public status: number, public body: any) { super(body?.message ?? String(status)); }
}
const pgErr = (status: number, code: string, message: string, details: string | null = null) =>
  new HttpError(status, { code, message, details, hint: null });

// ---------- select parsing ----------
export type SelNode =
  | { type: "star" }
  | { type: "col"; name: string; alias?: string; path?: string[]; text?: boolean }
  | { type: "embed"; name: string; alias?: string; hint?: string; inner: boolean; children: SelNode[] };

function splitTop(s: string, sep = ","): string[] {
  const out: string[] = []; let depth = 0, cur = "", q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === "(") depth++;
    if (!q && ch === ")") depth--;
    if (!q && depth === 0 && ch === sep) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
export function parseSelect(s: string | null): SelNode[] {
  if (!s || s.trim() === "") return [{ type: "star" }];
  return splitTop(s.replace(/\s+/g, " ")).map(parseSelItem);
}
function parseSelItem(raw: string): SelNode {
  let s = raw.trim();
  if (s === "*") return { type: "star" };
  const paren = s.indexOf("(");
  let alias: string | undefined;
  const head = paren >= 0 ? s.slice(0, paren) : s;
  const ci = head.indexOf(":");
  if (ci >= 0 && head[ci + 1] !== ":") { alias = head.slice(0, ci).trim(); s = s.slice(ci + 1).trim(); }
  if (s.includes("(") && s.endsWith(")")) {
    const p = s.indexOf("(");
    const nameParts = s.slice(0, p).split("!").map((x) => x.trim());
    const name = nameParts[0];
    let inner = false, hint: string | undefined;
    for (const x of nameParts.slice(1)) { if (x === "inner") inner = true; else if (x === "left") {} else hint = x; }
    return { type: "embed", name, alias, hint, inner, children: parseSelect(s.slice(p + 1, -1)) };
  }
  s = s.replace(/::\w+$/, "");
  const m = s.split(/->>?/);
  if (m.length > 1) {
    return { type: "col", name: m[0].trim(), alias: alias ?? m[m.length - 1].trim(), path: m.slice(1).map((x) => x.trim()), text: s.includes("->>") };
  }
  return { type: "col", name: s.trim(), alias };
}

// ---------- values ----------
export function toDb(kind: ColKind | undefined, v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (kind === "bool") return v === true || v === "true" || v === 1 || v === "t" ? 1 : 0;
  if (kind === "json") return JSON.stringify(v);
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}
export function fromDb(table: string, row: any): any {
  const cols = META[table]?.cols ?? {};
  const out: any = {};
  for (const k of Object.keys(row)) {
    const kind = cols[k]; const v = row[k];
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (kind === "bool") out[k] = !!v;
    else if (kind === "json") { try { out[k] = JSON.parse(v); } catch { out[k] = v; } }
    else if (kind === "num" && typeof v === "string" && v !== "" && !isNaN(Number(v))) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}
function filterValue(table: string, col: string, raw: string): any {
  const kind = META[table]?.cols?.[col];
  if (raw === "null") return null;
  if (kind === "bool") return raw === "true" || raw === "t" ? 1 : 0;
  if (kind === "num" && raw !== "" && !isNaN(Number(raw))) return Number(raw);
  return raw;
}
function parseList(s: string): string[] {
  // (a,"b,c",d)
  let body = s.trim();
  if (body.startsWith("(") || body.startsWith("{")) body = body.slice(1, -1);
  const out: string[] = []; let cur = "", q = false, any = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') { q = !q; any = true; continue; }
    if (ch === "\\" && q) { cur += body[++i]; continue; }
    if (ch === "," && !q) { out.push(cur); cur = ""; any = false; continue; }
    cur += ch;
  }
  if (cur !== "" || any || out.length) out.push(cur);
  return out;
}

// ---------- filters ----------
type Cond = { sql: string; params: any[] };
function colExpr(alias: string, table: string, key: string): { expr: string; col: string } {
  const parts = key.split(/(->>?)/);
  const col = parts[0].trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) throw pgErr(400, "PGRST100", `bad column ${col}`);
  if (parts.length === 1) return { expr: `${alias}."${col}"`, col };
  const path = parts.filter((_, i) => i % 2 === 0).slice(1).map((p) => p.trim().replace(/'/g, ""));
  return { expr: `json_extract(${alias}."${col}", '$.${path.join(".")}')`, col: "" };
}
export function buildCond(alias: string, table: string, key: string, value: string): Cond {
  const { expr, col } = colExpr(alias, table, key);
  let neg = false; let v = value;
  if (v.startsWith("not.")) { neg = true; v = v.slice(4); }
  const dot = v.indexOf(".");
  const op = dot >= 0 ? v.slice(0, dot) : v;
  const arg = dot >= 0 ? v.slice(dot + 1) : "";
  const kind = col ? META[table]?.cols?.[col] : undefined;
  let c: Cond;
  switch (op) {
    case "eq": case "neq": case "gt": case "gte": case "lt": case "lte": {
      const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op]!;
      c = { sql: `${expr} ${sym} ?`, params: [filterValue(table, col, arg)] };
      break;
    }
    case "like": case "ilike":
      c = { sql: `${expr} LIKE ?`, params: [arg.replace(/\*/g, "%")] }; break;
    case "is":
      c = { sql: arg === "null" ? `${expr} IS NULL` : arg === "true" ? `${expr} = 1` : arg === "false" ? `${expr} = 0` : `${expr} IS NULL`, params: [] }; break;
    case "in": {
      const items = parseList(arg).map((x) => filterValue(table, col, x));
      c = items.length ? { sql: `${expr} IN (${items.map(() => "?").join(",")})`, params: items } : { sql: "0", params: [] };
      break;
    }
    case "cs": case "ov": case "cd": {
      let items: any[];
      if (kind === "json" && arg.trim().startsWith("[") || arg.trim().startsWith("{\"")) { try { const j = JSON.parse(arg); items = Array.isArray(j) ? j : [j]; } catch { items = parseList(arg); } }
      else items = parseList(arg);
      if (!items.length) { c = { sql: op === "ov" ? "0" : "1", params: [] }; break; }
      const one = (it: any) => `EXISTS (SELECT 1 FROM json_each(${expr}) WHERE value = ?)`;
      c = { sql: "(" + items.map(one).join(op === "ov" ? " OR " : " AND ") + ")", params: items };
      break;
    }
    case "fts": case "plfts": case "phfts": case "wfts":
      c = { sql: `${expr} LIKE ?`, params: ["%" + arg + "%"] }; break;
    default:
      throw pgErr(400, "PGRST100", `unsupported operator ${op}`);
  }
  return neg ? { sql: `NOT (${c.sql})`, params: c.params } : c;
}
export function buildLogic(alias: string, table: string, op: "or" | "and", body: string, neg = false): Cond {
  const inner = body.trim().replace(/^\(/, "").replace(/\)$/, "");
  const parts = splitTop(inner);
  const conds: Cond[] = parts.map((p) => {
    let pp = p; let n = false;
    if (pp.startsWith("not.")) { n = true; pp = pp.slice(4); }
    const lm = pp.match(/^(or|and)\((.*)\)$/s);
    if (lm) return buildLogic(alias, table, lm[1] as any, "(" + lm[2] + ")", n);
    // col.op.value
    const firstDot = pp.indexOf(".");
    const key = pp.slice(0, firstDot);
    const rest = pp.slice(firstDot + 1);
    const c = buildCond(alias, table, key, (n ? "not." : "") + rest);
    return c;
  });
  const sql = "(" + (conds.length ? conds.map((c) => c.sql).join(op === "or" ? " OR " : " AND ") : "1") + ")";
  return { sql: neg ? `NOT ${sql}` : sql, params: conds.flatMap((c) => c.params) };
}

// ---------- query model ----------
type Q = {
  table: string; filters: Cond[]; order: string[]; limit?: number; offset?: number;
  embedQ: Record<string, { filters: [string, string][]; order?: string; limit?: number; offset?: number }>;
};
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function orderSql(alias: string, table: string, spec: string): string[] {
  return splitTop(spec).map((part) => {
    const bits = part.split(".");
    let dir = "ASC", nulls = "";
    const colParts: string[] = [];
    for (const b of bits) {
      if (b === "asc") dir = "ASC"; else if (b === "desc") dir = "DESC";
      else if (b === "nullsfirst") nulls = " NULLS FIRST"; else if (b === "nullslast") nulls = " NULLS LAST";
      else colParts.push(b);
    }
    const { expr } = colExpr(alias, table, colParts.join("."));
    if (!nulls) nulls = dir === "ASC" ? " NULLS LAST" : " NULLS FIRST";
    return `${expr} ${dir}${nulls}`;
  });
}
export function parseQuery(table: string, sp: URLSearchParams, embedNames: Set<string>): Q {
  const q: Q = { table, filters: [], order: [], embedQ: {} };
  for (const [k, v] of sp.entries()) {
    const dot = k.indexOf(".");
    const prefix = dot > 0 ? k.slice(0, dot) : "";
    if (prefix && embedNames.has(prefix) && !k.includes("->")) {
      const sub = k.slice(dot + 1);
      const e = (q.embedQ[prefix] ??= { filters: [] });
      if (sub === "order") e.order = v; else if (sub === "limit") e.limit = Number(v); else if (sub === "offset") e.offset = Number(v);
      else e.filters.push([sub, v]);
      continue;
    }
    if (k === "order") { q.order.push(...orderSql("t", table, v)); continue; }
    if (k === "limit") { q.limit = Number(v); continue; }
    if (k === "offset") { q.offset = Number(v); continue; }
    if (RESERVED.has(k)) continue;
    if (k === "or" || k === "and") { q.filters.push(buildLogic("t", table, k, v)); continue; }
    if (k === "not.or" || k === "not.and") { q.filters.push(buildLogic("t", table, k.slice(4) as any, v, true)); continue; }
    q.filters.push(buildCond("t", table, k, v));
  }
  return q;
}

function embedsOf(nodes: SelNode[]): Extract<SelNode, { type: "embed" }>[] {
  return nodes.filter((n) => n.type === "embed") as any;
}
type RelInfo = { child: string; kind: "many" | "one"; localCol: string; remoteCol: string };
function resolveRel(parent: string, e: { name: string; hint?: string }): RelInfo {
  const target = e.name;
  const pm = META[parent];
  // many-to-one: parent has fk to target
  if (META[target]) {
    const m1 = pm?.rels.filter((r) => r.ref === target && (!e.hint || e.hint === r.fk || e.hint === r.col));
    if (m1 && m1.length) return { child: target, kind: "one", localCol: m1[0].col, remoteCol: m1[0].refcol };
    const m2 = META[target].rels.filter((r) => r.ref === parent && (!e.hint || e.hint === r.fk || e.hint === r.col));
    if (m2.length) return { child: target, kind: "many", localCol: m2[0].refcol, remoteCol: m2[0].col };
  }
  // embed via column name e.g. upload:upload_id(*)
  const byCol = pm?.rels.find((r) => r.col === target || r.fk === target);
  if (byCol) return { child: byCol.ref, kind: "one", localCol: byCol.col, remoteCol: byCol.refcol };
  throw pgErr(400, "PGRST200", `Could not find a relationship between '${parent}' and '${target}' in the schema cache`);
}

export async function runSelect(db: D1, who: Who, table: string, nodes: SelNode[], q: Q, opts: { count?: boolean } = {}): Promise<{ rows: any[]; total?: number }> {
  if (!META[table]) throw pgErr(404, "42P01", `relation "public.${table}" does not exist`);
  const pol = policySelect(who, table, "t");
  const where = [pol, ...q.filters.map((f) => f.sql)].filter(Boolean);
  const params = q.filters.flatMap((f) => f.params);
  const embeds = embedsOf(nodes);
  // !inner embeds become EXISTS conditions so limit/count stay correct
  for (const e of embeds) {
    if (!e.inner) continue;
    const rel = resolveRel(table, e);
    const key = e.alias ?? e.name;
    const eq = q.embedQ[key];
    const subConds = (eq?.filters ?? []).map(([k, v]) => buildCond("ie", rel.child, k, v));
    const subPol = policySelect(who, rel.child, "ie");
    where.push(`EXISTS (SELECT 1 FROM "${rel.child}" ie WHERE ie."${rel.remoteCol}" = t."${rel.localCol}"${subPol ? " AND " + subPol : ""}${subConds.map((c) => " AND " + c.sql).join("")})`);
    params.push(...subConds.flatMap((c) => c.params));
  }
  const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";
  let sql = `SELECT t.* FROM "${table}" t${whereSql}`;
  if (q.order.length) sql += " ORDER BY " + q.order.join(", ");
  if (q.limit !== undefined) sql += ` LIMIT ${Math.max(0, q.limit | 0)}`;
  if (q.offset) sql += `${q.limit === undefined ? " LIMIT -1" : ""} OFFSET ${q.offset | 0}`;
  const res = await db.prepare(sql).bind(...params).all();
  let rows: any[] = (res.results ?? []).map((r: any) => fromDb(table, r));
  let total: number | undefined;
  if (opts.count) {
    const c = await db.prepare(`SELECT COUNT(*) AS n FROM "${table}" t${whereSql}`).bind(...params).first();
    total = Number(c?.n ?? 0);
  }
  rows = await attachEmbeds(db, who, table, rows, nodes, q.embedQ);
  return { rows: rows.map((r) => project(r, nodes)), total };
}

async function attachEmbeds(db: D1, who: Who, table: string, rows: any[], nodes: SelNode[], embedQ: Q["embedQ"]): Promise<any[]> {
  const embeds = embedsOf(nodes);
  if (!embeds.length || !rows.length) return rows;
  for (const e of embeds) {
    const rel = resolveRel(table, e);
    const key = e.alias ?? e.name;
    const keys = [...new Set(rows.map((r) => r[rel.localCol]).filter((v) => v !== null && v !== undefined))];
    let children: any[] = [];
    if (keys.length) {
      const eq = embedQ[key] ?? { filters: [] };
      // nested embed params come as key "child.grandchild.col" — keep simple: only direct filters
      const directFilters = eq.filters.filter(([k]) => !k.includes(".") || k.includes("->"));
      const sub: Q = { table: rel.child, filters: directFilters.map(([k, v]) => buildCond("t", rel.child, k, v)), order: eq.order ? orderSql("t", rel.child, eq.order) : [], embedQ: {} };
      for (const [k, v] of eq.filters) {
        if (k.includes(".") && !k.includes("->")) {
          const d = k.indexOf("."); const p = k.slice(0, d); const rest = k.slice(d + 1);
          const ne = (sub.embedQ[p] ??= { filters: [] });
          if (rest === "order") ne.order = v; else if (rest === "limit") ne.limit = Number(v); else ne.filters.push([rest, v]);
        }
      }
      const chunks: any[][] = [];
      for (let i = 0; i < keys.length; i += 90) chunks.push(keys.slice(i, i + 90));
      for (const ch of chunks) {
        const q2: Q = { ...sub, filters: [...sub.filters, { sql: `t."${rel.remoteCol}" IN (${ch.map(() => "?").join(",")})`, params: ch }] };
        const nodes2 = needCols(e.children, rel.remoteCol);
        const r = await runSelect(db, who, rel.child, nodes2, q2);
        children.push(...r.rows);
      }
      if (eq.limit !== undefined && rel.kind === "many") {
        const counts = new Map<any, number>();
        children = children.filter((c) => { const k2 = c.__k; const n = (counts.get(k2) ?? 0) + 1; counts.set(k2, n); return n <= eq.limit!; });
      }
    }
    for (const r of rows) {
      const lv = r[rel.localCol];
      const matches = children.filter((c) => c.__k === lv);
      const clean = matches.map((c) => { const { __k, ...rest } = c; return rest; });
      r["__embed__" + key] = rel.kind === "one" ? (clean[0] ?? null) : clean;
    }
    if (e.inner) rows = rows.filter((r) => { const v = r["__embed__" + key]; return rel.kind === "one" ? v !== null : v.length > 0; });
  }
  return rows;
}
// make sure the join column comes back (as __k) even if not selected
function needCols(nodes: SelNode[], col: string): SelNode[] {
  return [...nodes, { type: "col", name: col, alias: "__k" }];
}
function project(row: any, nodes: SelNode[]): any {
  const out: any = {};
  for (const n of nodes) {
    if (n.type === "star") { for (const k of Object.keys(row)) if (!k.startsWith("__embed__") && k !== "__k") out[k] = row[k]; }
    else if (n.type === "col") {
      let v = row[n.name];
      if (n.path) { for (const p of n.path) v = v == null ? null : v[p]; if (n.text && v != null && typeof v === "object") v = JSON.stringify(v); }
      out[n.alias ?? n.name] = v === undefined ? null : v;
    } else {
      const key = n.alias ?? n.name;
      out[key] = row["__embed__" + key];
    }
  }
  return out;
}

// ---------- writes ----------
function cleanRow(table: string, row: any): Record<string, any> {
  const cols = META[table].cols; const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    if (!(k in cols)) { console.warn(`[db] ignoring unknown column ${table}.${k}`); continue; }
    if (v === undefined) continue;
    out[k] = toDb(cols[k], v);
  }
  return out;
}
function mapSqliteError(e: any): HttpError {
  const msg = String(e?.message ?? e);
  if (/UNIQUE constraint failed/i.test(msg)) return pgErr(409, "23505", "duplicate key value violates unique constraint", msg);
  if (/NOT NULL constraint failed/i.test(msg)) return pgErr(400, "23502", "null value violates not-null constraint", msg);
  if (/CHECK constraint failed/i.test(msg)) return pgErr(400, "23514", "check constraint violated", msg);
  return pgErr(400, "PGRST000", msg);
}
export async function runInsert(db: D1, who: Who, table: string, body: any, opts: { onConflict?: string; resolution?: "merge" | "ignore"; defaultToNull?: boolean }): Promise<string[]> {
  const meta = META[table]; if (!meta) throw pgErr(404, "42P01", `relation "public.${table}" does not exist`);
  const list = Array.isArray(body) ? body : [body];
  const pks: string[] = [];
  const stmts: any[] = [];
  for (const raw of list) {
    const row = cleanRow(table, raw);
    if (meta.pk === "id" && meta.cols.id && (row.id === undefined || row.id === null)) row.id = crypto.randomUUID();
    if (table === "artwork_uploads" && !row.sku) row.sku = "AM-" + String(Date.now() % 1000000).padStart(6, "0") + Math.floor(Math.random() * 90 + 10);
    await policyWrite(db, who, table, "insert", fromDb(table, row));
    const cols = Object.keys(row);
    let sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
    if (opts.resolution) {
      const target = (opts.onConflict ?? meta.pk).split(",").map((s) => s.trim());
      const upd = cols.filter((c) => !target.includes(c));
      sql += ` ON CONFLICT(${target.map((c) => `"${c}"`).join(",")}) DO ` + (opts.resolution === "ignore" || !upd.length ? "NOTHING" : "UPDATE SET " + upd.map((c) => `"${c}"=excluded."${c}"`).join(","));
    }
    sql += ` RETURNING "${meta.pk}" AS pk`;
    stmts.push(db.prepare(sql).bind(...cols.map((c) => row[c])));
  }
  try {
    const res = stmts.length === 1 ? [await stmts[0].all()] : await db.batch(stmts);
    for (const r of res) for (const x of r.results ?? []) pks.push(x.pk);
  } catch (e) { throw mapSqliteError(e); }
  return pks;
}
export async function runUpdate(db: D1, who: Who, table: string, body: any, q: Q): Promise<string[]> {
  const meta = META[table]; if (!meta) throw pgErr(404, "42P01", `relation "public.${table}" does not exist`);
  const row = cleanRow(table, body);
  const cols = Object.keys(row);
  if (!cols.length) return [];
  await policyWrite(db, who, table, "update", fromDb(table, row));
  const pol = policySelect(who, table, "t", "update");
  const where = [pol, ...q.filters.map((f) => f.sql)].filter(Boolean);
  const sql = `UPDATE "${table}" AS t SET ${cols.map((c) => `"${c}"=?`).join(",")}${where.length ? " WHERE " + where.join(" AND ") : ""} RETURNING "${meta.pk}" AS pk`;
  try {
    const r = await db.prepare(sql).bind(...cols.map((c) => row[c]), ...q.filters.flatMap((f) => f.params)).all();
    return (r.results ?? []).map((x: any) => x.pk);
  } catch (e) { throw mapSqliteError(e); }
}
export async function runDelete(db: D1, who: Who, table: string, q: Q): Promise<any[]> {
  const meta = META[table]; if (!meta) throw pgErr(404, "42P01", `relation "public.${table}" does not exist`);
  const pol = policySelect(who, table, "t", "delete");
  const where = [pol, ...q.filters.map((f) => f.sql)].filter(Boolean);
  const sql = `DELETE FROM "${table}" AS t${where.length ? " WHERE " + where.join(" AND ") : ""} RETURNING *`;
  try {
    const r = await db.prepare(sql).bind(...q.filters.flatMap((f) => f.params)).all();
    return (r.results ?? []).map((x: any) => fromDb(table, x));
  } catch (e) { throw mapSqliteError(e); }
}

// ---------- HTTP ----------
function json(status: number, body: any, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
export async function handleRest(req: Request, db: D1, who: Who, rpc: (name: string, args: any, who: Who) => Promise<any>): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/rest\/v1\/?/, "");
  const sp = url.searchParams;
  const prefer = req.headers.get("prefer") ?? "";
  const accept = req.headers.get("accept") ?? "";
  const wantObject = accept.includes("vnd.pgrst.object");
  try {
    if (path.startsWith("rpc/")) {
      const name = path.slice(4);
      let args: any = {};
      if (req.method === "GET" || req.method === "HEAD") { for (const [k, v] of sp.entries()) args[k] = v; }
      else { const t = await req.text(); args = t ? JSON.parse(t) : {}; }
      const out = await rpc(name, args, who);
      return json(200, out);
    }
    const table = path.split("/")[0];
    if (!META[table]) throw pgErr(404, "42P01", `relation "public.${table}" does not exist`);
    const nodes = parseSelect(sp.get("select"));
    const embedNames = new Set(embedsOf(nodes).map((e) => e.alias ?? e.name));
    const q = parseQuery(table, sp, embedNames);
    const wantCount = /count=(exact|planned|estimated)/.test(prefer);
    const returnRep = prefer.includes("return=representation");
    const finish = (rows: any[], total?: number, status = 200) => {
      const headers: Record<string, string> = {};
      const start = q.offset ?? 0;
      headers["content-range"] = `${rows.length ? `${start}-${start + rows.length - 1}` : "*"}/${total ?? "*"}`;
      if (req.method === "HEAD") return new Response(null, { status: 200, headers });
      if (wantObject) {
        if (rows.length !== 1) return json(406, { code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
        return json(status, rows[0], headers);
      }
      return json(status, rows, headers);
    };
    if (req.method === "GET" || req.method === "HEAD") {
      const r = await runSelect(db, who, table, nodes, q, { count: wantCount });
      return finish(r.rows, r.total);
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => { throw pgErr(400, "PGRST102", "Empty or invalid json"); });
      const resolution = prefer.includes("resolution=merge-duplicates") ? "merge" : prefer.includes("resolution=ignore-duplicates") ? "ignore" : undefined;
      const pks = await runInsert(db, who, table, body, { onConflict: sp.get("on_conflict") ?? undefined, resolution });
      if (!returnRep) return new Response(null, { status: 201, headers: { "content-range": `*/${pks.length}` } });
      const sysWho = { ...who, service: true };
      const r = await runSelect(db, sysWho, table, nodes, { table, filters: [{ sql: `t."${META[table].pk}" IN (${pks.map(() => "?").join(",") || "NULL"})`, params: pks }], order: [], embedQ: q.embedQ });
      return finish(r.rows, undefined, 201);
    }
    if (req.method === "PATCH") {
      const body = await req.json();
      const pks = await runUpdate(db, who, table, body, q);
      if (!returnRep) return new Response(null, { status: 204, headers: { "content-range": `*/${pks.length}` } });
      const sysWho = { ...who, service: true };
      const r = await runSelect(db, sysWho, table, nodes, { table, filters: [{ sql: `t."${META[table].pk}" IN (${pks.map(() => "?").join(",") || "NULL"})`, params: pks }], order: [], embedQ: q.embedQ });
      return finish(r.rows);
    }
    if (req.method === "DELETE") {
      const rows = await runDelete(db, who, table, q);
      if (!returnRep) return new Response(null, { status: 204, headers: { "content-range": `*/${rows.length}` } });
      return finish(rows.map((r) => project(r, nodes)));
    }
    return json(405, { code: "PGRST", message: "method not allowed" });
  } catch (e: any) {
    if (e instanceof HttpError) return json(e.status, e.body);
    console.error("[rest]", e);
    return json(500, { code: "PGRST500", message: String(e?.message ?? e), details: null, hint: null });
  }
}
