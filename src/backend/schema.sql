CREATE TABLE IF NOT EXISTS "artwork_colorways" (
  "artwork_path" TEXT NOT NULL,
  "current_original_id" TEXT,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "print_file_url" TEXT,
  "upload_id" TEXT NOT NULL,
  UNIQUE(upload_id,position)
);
CREATE TABLE IF NOT EXISTS "artwork_mockups" (
  "colorway_id" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "image_path" TEXT NOT NULL,
  "room" INTEGER NOT NULL,
  UNIQUE(colorway_id,room)
);
CREATE TABLE IF NOT EXISTS "artwork_uploads" (
  "categories" TEXT DEFAULT '[]',
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "designer_notes" TEXT,
  "error" TEXT,
  "height_cm" REAL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "kind" TEXT NOT NULL,
  "lease_until" TEXT,
  "made_for" TEXT DEFAULT '[]',
  "max_print_height_cm" REAL,
  "max_print_width_cm" REAL,
  "owner_id" TEXT NOT NULL,
  "print_file_url" TEXT,
  "repeat_style" TEXT DEFAULT 'none',
  "review_note" TEXT,
  "review_status" TEXT DEFAULT 'pending',
  "sku" TEXT,
  "status" TEXT DEFAULT 'draft',
  "story" TEXT,
  "submitted_at" TEXT,
  "title" TEXT NOT NULL,
  "width_cm" REAL,
  UNIQUE(sku)
);
CREATE TABLE IF NOT EXISTS "conversations" (
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "custom_request_id" TEXT,
  "customer_id" TEXT NOT NULL,
  "design_slug" TEXT,
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  UNIQUE(custom_request_id, designer_slug)
);
CREATE TABLE IF NOT EXISTS "custom_requests" (
  "brief" TEXT NOT NULL,
  "budget" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "customer_email" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "design_slug" TEXT,
  "designer_slug" TEXT DEFAULT 'open',
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "material" TEXT NOT NULL,
  "photo_paths" TEXT DEFAULT '[]',
  "room" INTEGER NOT NULL,
  "selection" TEXT,
  "status" TEXT DEFAULT 'new',
  "user_id" TEXT NOT NULL,
  "wall_size" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "design_listing" (
  "hidden" INTEGER DEFAULT 0,
  "slug" TEXT PRIMARY KEY,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_by" TEXT
);
CREATE TABLE IF NOT EXISTS "design_offers" (
  "accepted_at" TEXT,
  "amount" REAL NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "conversation_kind" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "created_by" TEXT NOT NULL,
  "delivered_at" TEXT,
  "delivery_days" INTEGER,
  "description" TEXT NOT NULL,
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "proof_approved_at" TEXT,
  "proof_note" TEXT,
  "proof_path" TEXT,
  "proof_status" TEXT DEFAULT 'awaiting',
  "status" TEXT DEFAULT 'sent'
);
CREATE TABLE IF NOT EXISTS "design_overrides" (
  "added_photos" TEXT DEFAULT '[]',
  "description" TEXT,
  "image_path" TEXT,
  "price_per_sqft" REAL,
  "removed_photos" TEXT DEFAULT '[]',
  "slug" TEXT PRIMARY KEY,
  "story" TEXT,
  "title" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_by" TEXT
);
CREATE TABLE IF NOT EXISTS "designer_accounts" (
  "slug" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS "designer_collections" (
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "description" TEXT DEFAULT '',
  "design_slugs" TEXT DEFAULT '[]',
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "owner_id" TEXT,
  "title" TEXT NOT NULL,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "designer_messages" (
  "attachment_path" TEXT,
  "body" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "selection" TEXT,
  "sender_id" TEXT NOT NULL,
  "sender_role" TEXT DEFAULT 'customer'
);
CREATE TABLE IF NOT EXISTS "designer_payouts" (
  "amount" REAL NOT NULL,
  "created_by" TEXT NOT NULL,
  "designer_user_id" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "note" TEXT,
  "paid_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "designer_profiles" (
  "bio" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "full_name" TEXT NOT NULL,
  "payout_details" TEXT,
  "payout_method" TEXT,
  "portfolio_links" TEXT DEFAULT '[]',
  "review_note" TEXT,
  "reviewed_at" TEXT,
  "status" TEXT DEFAULT 'pending',
  "studio_name" TEXT,
  "styles" TEXT DEFAULT '[]',
  "trusted" INTEGER DEFAULT 0,
  "user_id" TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS "designer_reviews" (
  "body" TEXT DEFAULT '',
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "rating" INTEGER NOT NULL,
  "reviewer_name" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  UNIQUE(designer_slug,user_id)
);
CREATE TABLE IF NOT EXISTS "guest_conversation_messages" (
  "attachment_path" TEXT,
  "body" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "selection" TEXT,
  "sender" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "guest_conversations" (
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "customer_name" TEXT NOT NULL,
  "design_slug" TEXT,
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "guest_designer_requests" (
  "body" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "customer_email" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "design_slug" TEXT NOT NULL,
  "designer_slug" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "selection" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "material_settings" (
  "active" INTEGER DEFAULT 1,
  "blurb" TEXT DEFAULT '',
  "factor" REAL DEFAULT 1,
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "texture" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "order_requests" (
  "carrier" TEXT,
  "cart_id" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "custom_offer_id" TEXT,
  "customer_email" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "delivery_date" TEXT,
  "design_slug" TEXT NOT NULL,
  "estimated_total" REAL NOT NULL,
  "finish" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "notes" TEXT,
  "payment_method" TEXT,
  "phone" TEXT,
  "print_design_snapshot" TEXT,
  "print_original_id" TEXT,
  "selection" TEXT NOT NULL,
  "shipping_address" TEXT NOT NULL,
  "source" TEXT DEFAULT 'website',
  "square_feet" REAL NOT NULL,
  "status" TEXT DEFAULT 'awaiting_payment',
  "status_updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "tracking_number" TEXT,
  "user_id" TEXT
);
CREATE TABLE IF NOT EXISTS "print_originals" (
  "byte_size" INTEGER NOT NULL,
  "colorway_id" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "effective_dpi" REAL,
  "filename" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "mime_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "pixel_height" INTEGER,
  "pixel_width" INTEGER,
  "storage_path" TEXT NOT NULL,
  "validation_status" TEXT DEFAULT 'pending',
  UNIQUE(storage_path)
);
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',1+(abs(random())%4),1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "role" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  UNIQUE(user_id,role)
);

CREATE TABLE IF NOT EXISTS "auth_users" ("id" TEXT PRIMARY KEY, "email" TEXT UNIQUE NOT NULL, "password_hash" TEXT NOT NULL, "user_metadata" TEXT DEFAULT '{}', "app_metadata" TEXT DEFAULT '{}', "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), "updated_at" TEXT, "last_sign_in_at" TEXT, "banned" INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS "auth_refresh" ("token" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "session_id" TEXT NOT NULL, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), "revoked" INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS "storage_objects" ("bucket" TEXT NOT NULL, "name" TEXT NOT NULL, "size" INTEGER, "mime" TEXT, "owner" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), "updated_at" TEXT, PRIMARY KEY(bucket,name));
CREATE TABLE IF NOT EXISTS "site_settings" ("key" TEXT PRIMARY KEY, "value" TEXT, "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), "updated_by" TEXT);
CREATE TABLE IF NOT EXISTS "email_outbox" ("id" TEXT PRIMARY KEY, "to_addr" TEXT, "subject" TEXT, "html" TEXT, "text" TEXT, "kind" TEXT, "status" TEXT DEFAULT 'test-mode, not sent', "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS conv_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS msg_conv ON designer_messages(conversation_id);
CREATE INDEX IF NOT EXISTS uploads_owner ON artwork_uploads(owner_id);
CREATE INDEX IF NOT EXISTS colorways_upload ON artwork_colorways(upload_id);
CREATE INDEX IF NOT EXISTS mockups_colorway ON artwork_mockups(colorway_id);
CREATE INDEX IF NOT EXISTS orders_user ON order_requests(user_id);

CREATE TRIGGER IF NOT EXISTS assign_designer_on_insert AFTER INSERT ON designer_profiles WHEN NEW.status = 'approved' BEGIN INSERT OR IGNORE INTO designer_accounts(slug, user_id) VALUES ('studio-' || substr(NEW.user_id, 1, 8), NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS assign_designer_on_update AFTER UPDATE OF status ON designer_profiles WHEN NEW.status = 'approved' BEGIN INSERT OR IGNORE INTO designer_accounts(slug, user_id) VALUES ('studio-' || substr(NEW.user_id, 1, 8), NEW.user_id); END;
CREATE TRIGGER IF NOT EXISTS save_order_print_source AFTER INSERT ON order_requests WHEN NEW.design_slug LIKE 'u-%' BEGIN UPDATE order_requests SET print_original_id = (SELECT c.current_original_id FROM artwork_colorways c WHERE c.upload_id = substr(NEW.design_slug, 3) ORDER BY c.position LIMIT 1 OFFSET (CASE WHEN json_extract(NEW.selection, '$.color') GLOB 'c[0-9]*' THEN CAST(substr(json_extract(NEW.selection, '$.color'), 2) AS INTEGER) ELSE 0 END)), print_design_snapshot = (SELECT json_object('kind', u.kind, 'repeat', u.repeat_style, 'repeatCm', u.width_cm, 'printHeightCm', u.height_cm, 'title', u.title) FROM artwork_uploads u WHERE u.id = substr(NEW.design_slug, 3)) WHERE id = NEW.id AND EXISTS (SELECT 1 FROM artwork_uploads u WHERE u.id = substr(NEW.design_slug, 3)); END;
