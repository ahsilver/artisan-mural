// Database functions ported from the original SQL.
import type { Who } from "./policies";
import { HttpError } from "./pgrest";
type D1 = any;
const now = () => new Date().toISOString();
export async function callRpc(db: D1, name: string, a: any, who: Who): Promise<any> {
  switch (name) {
    case "has_role": {
      const r = await db.prepare(`SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?`).bind(a._user_id, a._role).first();
      return !!r;
    }
    case "start_guest_conversation": {
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO guest_conversations (id, token_hash, designer_slug, design_slug, customer_name, title) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, a._token_hash, a._designer, a._design ?? null, a._name, a._title),
        db.prepare(`INSERT INTO guest_conversation_messages (id, conversation_id, sender, body, selection) VALUES (?, ?, 'customer', ?, ?)`).bind(crypto.randomUUID(), id, a._body, a._selection == null ? null : JSON.stringify(a._selection)),
      ]);
      return id;
    }
    case "send_guest_conversation_message":
    case "send_guest_conversation_message_v2": {
      const c = await db.prepare(`SELECT 1 FROM guest_conversations WHERE id = ? AND token_hash = ?`).bind(a._id, a._token_hash).first();
      if (!c) return false;
      const att = a._attachment ?? null;
      if (att && !String(att).startsWith(`guest/${a._id}/`)) return false;
      await db.prepare(`INSERT INTO guest_conversation_messages (id, conversation_id, sender, body, selection, attachment_path) VALUES (?, ?, 'customer', ?, ?, ?)`).bind(crypto.randomUUID(), a._id, a._body, a._selection == null ? null : JSON.stringify(a._selection), att).run();
      return true;
    }
    case "read_guest_conversation":
    case "read_guest_conversation_v2": {
      const r = await db.prepare(`SELECT m.id, m.sender, m.body, m.selection, m.attachment_path, m.created_at, c.designer_slug, c.design_slug, c.title FROM guest_conversations c JOIN guest_conversation_messages m ON m.conversation_id = c.id WHERE c.id = ? AND c.token_hash = ? ORDER BY m.created_at`).bind(a._id, a._token_hash).all();
      return (r.results ?? []).map((x: any) => ({ ...x, selection: x.selection ? JSON.parse(x.selection) : null }));
    }
    case "claim_artwork_mockups": {
      const lease = new Date(Date.now() + 15 * 60000).toISOString();
      const r = await db.prepare(`UPDATE artwork_uploads SET lease_until = ?, status = 'generating' WHERE id = ? AND status IN ('draft','generating','failed') AND (lease_until IS NULL OR lease_until < ?) RETURNING id`).bind(lease, a._id, now()).all();
      return (r.results ?? []).length > 0;
    }
    case "accept_project_quote": {
      const o: any = await db.prepare(`SELECT * FROM design_offers WHERE id = ? AND conversation_kind = 'account'`).bind(a._offer).first();
      if (!o || o.status !== "sent") return false;
      const c: any = await db.prepare(`SELECT * FROM conversations WHERE id = ? AND customer_id = ?`).bind(o.conversation_id, a._customer).first();
      if (!c) return false;
      const stmts = [];
      if (c.custom_request_id) {
        const taken = await db.prepare(`SELECT 1 FROM design_offers f JOIN conversations v ON v.id = f.conversation_id WHERE v.custom_request_id = ? AND f.status IN ('accepted','paid')`).bind(c.custom_request_id).first();
        if (taken) return false;
        stmts.push(db.prepare(`UPDATE custom_requests SET status = 'in_progress' WHERE id = ?`).bind(c.custom_request_id));
        stmts.push(db.prepare(`UPDATE design_offers SET status = 'cancelled' WHERE status = 'sent' AND id <> ? AND conversation_id IN (SELECT id FROM conversations WHERE custom_request_id = ?)`).bind(o.id, c.custom_request_id));
      }
      stmts.push(db.prepare(`UPDATE design_offers SET status = 'accepted', accepted_at = ? WHERE id = ?`).bind(now(), o.id));
      await db.batch(stmts);
      return true;
    }
    case "link_custom_project_order": {
      const r = await db.prepare(`UPDATE order_requests SET custom_offer_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM design_offers f JOIN conversations c ON c.id = f.conversation_id WHERE f.id = ? AND f.conversation_kind = 'account' AND f.status IN ('accepted','paid') AND f.proof_status = 'approved' AND c.customer_id = order_requests.user_id) RETURNING id`).bind(a._offer, a._order, a._offer).all();
      return (r.results ?? []).length > 0;
    }
  }
  throw new HttpError(404, { code: "PGRST202", message: `Could not find the function public.${name}`, details: null, hint: null });
}
