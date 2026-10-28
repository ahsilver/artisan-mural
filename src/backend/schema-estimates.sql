CREATE TABLE IF NOT EXISTS estimates (id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, customer_id TEXT NOT NULL, order_id TEXT, project_id TEXT, invoice_id TEXT, status TEXT NOT NULL DEFAULT 'draft', issue_date TEXT NOT NULL, valid_until TEXT, discount_type TEXT NOT NULL DEFAULT 'amount', discount_value REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, notes TEXT, terms TEXT, bill_to TEXT, sent_at TEXT, accepted_at TEXT, declined_at TEXT, converted_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT);
CREATE INDEX IF NOT EXISTS estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS estimates_order ON estimates(order_id);
CREATE INDEX IF NOT EXISTS estimates_project ON estimates(project_id);
CREATE TABLE IF NOT EXISTS estimate_lines (id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL, pos INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'sqft', description TEXT NOT NULL DEFAULT '', design_slug TEXT, design_title TEXT, qty REAL NOT NULL DEFAULT 0, rate REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS estimate_lines_est ON estimate_lines(estimate_id);
ALTER TABLE invoices ADD COLUMN estimate_id TEXT;
