
CREATE TABLE IF NOT EXISTS store_threads ("id" TEXT PRIMARY KEY, "user_id" TEXT, "user_email" TEXT, "user_name" TEXT, "user_role" TEXT, "order_id" TEXT, "project_id" TEXT, "subject" TEXT, "created_by" TEXT, "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), "last_at" TEXT, "last_body" TEXT, "last_from" TEXT);
CREATE INDEX IF NOT EXISTS store_threads_user ON store_threads(user_id);
CREATE INDEX IF NOT EXISTS store_threads_email ON store_threads(user_email);
CREATE TABLE IF NOT EXISTS store_messages ("id" TEXT PRIMARY KEY, "thread_id" TEXT NOT NULL, "sender_id" TEXT, "sender_role" TEXT NOT NULL, "body" TEXT NOT NULL DEFAULT '', "attachments" TEXT DEFAULT '[]', "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS store_messages_thread ON store_messages(thread_id, created_at);
CREATE TABLE IF NOT EXISTS chat_reads ("user_id" TEXT NOT NULL, "conv" TEXT NOT NULL, "read_at" TEXT, PRIMARY KEY (user_id, conv));
