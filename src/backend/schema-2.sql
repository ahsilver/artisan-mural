CREATE TABLE IF NOT EXISTS "order_events" ("id" TEXT PRIMARY KEY, "order_id" TEXT NOT NULL, "kind" TEXT NOT NULL, "message" TEXT, "actor" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id);
CREATE TABLE IF NOT EXISTS "order_files" ("id" TEXT PRIMARY KEY, "order_id" TEXT NOT NULL, "bucket" TEXT NOT NULL, "path" TEXT NOT NULL, "label" TEXT, "width" INTEGER, "height" INTEGER, "created_by" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "import_jobs" ("id" TEXT PRIMARY KEY, "owner_id" TEXT NOT NULL, "upload_id" TEXT, "src" TEXT, "file_key" TEXT, "r2_upload_id" TEXT, "filename" TEXT, "mime" TEXT, "total" INTEGER, "done" INTEGER DEFAULT 0, "parts" TEXT DEFAULT '[]', "status" TEXT, "error" TEXT, "tries" INTEGER DEFAULT 0, "dims" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "ai_renders" ("id" TEXT PRIMARY KEY, "user_id" TEXT, "day" TEXT, "purpose" TEXT, "provider" TEXT, "model" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "import_parts" ("job_id" TEXT NOT NULL, "part" INTEGER NOT NULL, "etag" TEXT, "bytes" INTEGER, PRIMARY KEY ("job_id","part"));
ALTER TABLE material_settings ADD COLUMN price_adj REAL;
ALTER TABLE material_settings ADD COLUMN sample_in REAL;
ALTER TABLE material_settings ADD COLUMN standard INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS "price_history" ("id" TEXT PRIMARY KEY, "kind" TEXT, "ref" TEXT, "before" TEXT, "after" TEXT, "by_user" TEXT, "undone" INTEGER DEFAULT 0, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE IF NOT EXISTS "coupons" ("code" TEXT PRIMARY KEY, "kind" TEXT NOT NULL DEFAULT 'percent', "value" REAL NOT NULL, "min_order" REAL DEFAULT 0, "expires_at" TEXT, "max_uses" INTEGER, "per_customer" INTEGER DEFAULT 1, "uses" INTEGER DEFAULT 0, "active" INTEGER DEFAULT 1, "note" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "coupon_uses" ("id" TEXT PRIMARY KEY, "code" TEXT, "user_id" TEXT, "cart_id" TEXT, "amount" REAL, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "store_credit" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "amount" REAL NOT NULL, "kind" TEXT, "ref" TEXT, "note" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "customer_terms" ("user_id" TEXT PRIMARY KEY, "discount_pct" REAL DEFAULT 0, "trade" INTEGER DEFAULT 0, "trade_status" TEXT, "company" TEXT, "website" TEXT, "net_terms" INTEGER DEFAULT 0, "note" TEXT, "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS "saved_addresses" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "label" TEXT, "name" TEXT, "phone" TEXT, "address" TEXT, "city" TEXT, "state" TEXT, "postal" TEXT, "country" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
ALTER TABLE order_requests ADD COLUMN discount REAL;
ALTER TABLE order_requests ADD COLUMN coupon TEXT;
ALTER TABLE order_requests ADD COLUMN tax REAL;
ALTER TABLE order_requests ADD COLUMN credit_applied REAL;
ALTER TABLE order_requests ADD COLUMN amount_due REAL;
ALTER TABLE designer_payouts ADD COLUMN method TEXT;
ALTER TABLE designer_payouts ADD COLUMN status TEXT DEFAULT 'paid';

-- JOB2 (2026-10-25): owner/admin category edits for built-in designs (JSON arrays)
ALTER TABLE design_overrides ADD COLUMN categories TEXT;
ALTER TABLE design_overrides ADD COLUMN rooms TEXT;
