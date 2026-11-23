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
