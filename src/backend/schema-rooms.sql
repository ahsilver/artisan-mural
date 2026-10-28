-- Customer "My rooms" (also created on first use by rooms-api.ts)
CREATE TABLE IF NOT EXISTS customer_rooms (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, image_key TEXT NOT NULL, w INTEGER, h INTEGER, data TEXT, created_at TEXT, updated_at TEXT);
CREATE INDEX IF NOT EXISTS customer_rooms_user ON customer_rooms (user_id, created_at);
