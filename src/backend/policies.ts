// Row-level rules ported from the original database policies.
export type Who = { uid: string | null; admin: boolean; service: boolean; email?: string | null };
type D1 = any;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const lit = (u: string | null) => (u && UUID_RE.test(u) ? `'${u}'` : "NULL");

// SELECT / UPDATE / DELETE "USING" rules as SQL fragments; A = table alias
type Frag = (u: string, A: string) => string;
const ownerDesigner = (u: string, slugExpr: string) => `EXISTS (SELECT 1 FROM designer_accounts da WHERE da.slug = ${slugExpr} AND da.user_id = ${u})`;
const SELECT: Record<string, Frag | "public"> = {
  designer_accounts: (u, A) => `${A}.user_id = ${u}`,
  conversations: (u, A) => `(${A}.customer_id = ${u} OR ${ownerDesigner(u, `${A}.designer_slug`)})`,
  designer_messages: (u, A) => `EXISTS (SELECT 1 FROM conversations c WHERE c.id = ${A}.conversation_id AND (c.customer_id = ${u} OR ${ownerDesigner(u, "c.designer_slug")}))`,
  guest_designer_requests: (u, A) => ownerDesigner(u, `${A}.designer_slug`),
  guest_conversations: (u, A) => ownerDesigner(u, `${A}.designer_slug`),
  guest_conversation_messages: (u, A) => `EXISTS (SELECT 1 FROM guest_conversations gc JOIN designer_accounts da ON da.slug = gc.designer_slug WHERE gc.id = ${A}.conversation_id AND da.user_id = ${u})`,
  order_requests: (u, A) => `${A}.user_id = ${u}`,
  artwork_uploads: (u, A) => `${A}.owner_id = ${u}`,
  artwork_colorways: (u, A) => `EXISTS (SELECT 1 FROM artwork_uploads au WHERE au.id = ${A}.upload_id AND au.owner_id = ${u})`,
  artwork_mockups: (u, A) => `EXISTS (SELECT 1 FROM artwork_colorways ac JOIN artwork_uploads au ON au.id = ac.upload_id WHERE ac.id = ${A}.colorway_id AND au.owner_id = ${u})`,
  user_roles: (u, A) => `${A}.user_id = ${u}`,
  designer_profiles: (u, A) => `${A}.user_id = ${u}`,
  designer_payouts: (u, A) => `${A}.designer_user_id = ${u}`,
  custom_requests: (u, A) => `(${A}.user_id = ${u} OR (EXISTS (SELECT 1 FROM designer_profiles p WHERE p.user_id = ${u} AND p.status = 'approved') AND (${A}.designer_slug = 'open' OR ${ownerDesigner(u, `${A}.designer_slug`)})))`,
  design_listing: "public",
  material_settings: "public",
  design_overrides: "public",
  designer_reviews: "public",
  designer_collections: "public",
  print_originals: (u, A) => `${A}.owner_id = ${u}`,
};
const UPDATE: Record<string, Frag> = {
  designer_profiles: (u, A) => `${A}.user_id = ${u}`,
  designer_reviews: (u, A) => `${A}.user_id = ${u}`,
  designer_collections: (u, A) => `${A}.owner_id = ${u}`,
};
const DELETE: Record<string, Frag> = {
  designer_reviews: (u, A) => `${A}.user_id = ${u}`,
  designer_collections: (u, A) => `${A}.owner_id = ${u}`,
};

export function policySelect(who: Who, table: string, A: string, mode: "select" | "update" | "delete" = "select"): string {
  if (who.service || who.admin) return "";
  const u = lit(who.uid);
  if (mode === "select") {
    const r = SELECT[table];
    if (!r) return "0";
    if (r === "public") return "";
    if (u === "NULL") return "0";
    return r(u, A);
  }
  if (u === "NULL") return "0";
  const r = (mode === "update" ? UPDATE : DELETE)[table];
  return r ? r(u, A) : "0";
}

const deny = (msg = "new row violates row-level security policy") => {
  const e: any = new Error(msg);
  e.status = 403;
  e.body = { code: "42501", message: msg, details: null, hint: null };
  return e;
};
export async function policyWrite(db: D1, who: Who, table: string, op: "insert" | "update", row: any): Promise<void> {
  if (who.service || who.admin) return;
  const uid = who.uid;
  const { HttpError } = await import("./pgrest");
  const fail = () => { throw new HttpError(403, { code: "42501", message: `new row violates row-level security policy for table "${table}"`, details: null, hint: null }); };
  if (op === "insert") {
    switch (table) {
      case "guest_designer_requests": return;
      case "order_requests": if ((row.status ?? "awaiting_payment") !== "awaiting_payment") fail(); if (row.print_design_snapshot != null) fail(); if (uid && row.user_id && row.user_id !== uid) fail(); return; // print geometry (repeat + match) always comes from the design, never from the customer
      case "conversations": if (!uid || row.customer_id !== uid) fail(); return;
      case "designer_messages": {
        if (!uid || row.sender_id !== uid) fail();
        const c = await db.prepare(`SELECT 1 FROM conversations c WHERE c.id = ? AND (c.customer_id = ? OR EXISTS (SELECT 1 FROM designer_accounts da WHERE da.slug = c.designer_slug AND da.user_id = ?))`).bind(row.conversation_id, uid, uid).first();
        if (!c) fail(); return;
      }
      case "designer_profiles": if (!uid || row.user_id !== uid || (row.status ?? "pending") !== "pending") fail(); return;
      case "custom_requests": if (!uid || row.user_id !== uid || (row.status ?? "new") !== "new" || (Array.isArray(row.photo_paths) && row.photo_paths.length > 6)) fail(); return;
      case "designer_reviews": if (!uid || row.user_id !== uid) fail(); return;
      case "designer_collections": if (!uid || row.owner_id !== uid) fail(); return;
      default: fail();
    }
  } else {
    switch (table) {
      case "designer_profiles": if (!uid || (row.user_id !== undefined && row.user_id !== null && row.user_id !== uid)) fail(); if (row.status !== undefined || row.trusted !== undefined || row.public_hidden !== undefined) fail(); return;
      case "designer_reviews": if (!uid || (row.user_id != null && row.user_id !== uid)) fail(); return;
      case "designer_collections": if (!uid || (row.owner_id != null && row.owner_id !== uid)) fail(); return;
      default: fail();
    }
  }
}
