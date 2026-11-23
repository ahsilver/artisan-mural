-- Columns the old live database got by hand, so a brand-new database has everything the code uses.
-- Apply after every other schema file (it is named to sort last). Safe to re-run: "duplicate column" errors can be ignored.
ALTER TABLE order_requests ADD COLUMN project_id TEXT;
ALTER TABLE order_requests ADD COLUMN design_fee REAL;
ALTER TABLE order_requests ADD COLUMN due_at TEXT;
ALTER TABLE invoices ADD COLUMN estimate_id TEXT;
