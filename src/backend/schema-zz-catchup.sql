-- Columns the old live database got by hand, so a brand-new database has everything the code uses.
-- Apply after every other schema file (it is named to sort last). Safe to re-run: "duplicate column" errors can be ignored.
ALTER TABLE order_requests ADD COLUMN project_id TEXT;
ALTER TABLE order_requests ADD COLUMN design_fee REAL;
ALTER TABLE order_requests ADD COLUMN due_at TEXT;
ALTER TABLE invoices ADD COLUMN estimate_id TEXT;
CREATE TABLE IF NOT EXISTS design_thumbs (slug TEXT PRIMARY KEY, data TEXT, updated_at TEXT);
-- Billing address and the safe part of the card (brand, last 4, expiry, name; never the full number or the security code)
ALTER TABLE order_requests ADD COLUMN billing_address TEXT;
ALTER TABLE order_requests ADD COLUMN payment_info TEXT;
-- Shipping charged on each order line (the cart's flat fee spread over its lines; 0 for Pro members) and sample orders
ALTER TABLE order_requests ADD COLUMN shipping REAL;
ALTER TABLE order_requests ADD COLUMN is_sample INTEGER DEFAULT 0;
-- Designer earnings record: one "sale" line per paid order, locked at the rate of that moment, and one "reversal"
-- line if the order is later cancelled or refunded. Totals are sums of these lines, so they never change by themselves.
CREATE TABLE IF NOT EXISTS designer_earnings (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, kind TEXT NOT NULL, designer_user_id TEXT NOT NULL, design_slug TEXT NOT NULL, square_feet REAL NOT NULL, cents_per_sqft REAL NOT NULL, amount REAL NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(order_id, kind));
CREATE INDEX IF NOT EXISTS designer_earnings_user ON designer_earnings(designer_user_id);
-- Visitor statistics (anonymous: a random browser number, no names, no IP addresses). Kept about 13 months.
CREATE TABLE IF NOT EXISTS site_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, day TEXT NOT NULL, vid TEXT NOT NULL, sid TEXT NOT NULL, kind TEXT NOT NULL, path TEXT, source TEXT DEFAULT '', campaign TEXT DEFAULT '', country TEXT DEFAULT '', device TEXT DEFAULT '', design TEXT, q TEXT, n INTEGER);
CREATE INDEX IF NOT EXISTS site_visits_day ON site_visits(day);
-- Print jobs for huge originals (made by the print service container); the file is stored at out_key in R2.
CREATE TABLE IF NOT EXISTS print_jobs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL, name TEXT NOT NULL, source_url TEXT NOT NULL, width_in REAL NOT NULL, height_in REAL NOT NULL, dpi REAL NOT NULL, draws TEXT NOT NULL, out_key TEXT, bytes INTEGER, info TEXT, error TEXT, started_at TEXT, finished_at TEXT);
