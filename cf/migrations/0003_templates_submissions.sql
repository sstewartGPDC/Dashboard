-- Migration 0003: data-collection templates + merge-on-submit foundation.
-- Apply with:
--   wrangler d1 execute DB --remote --file=./migrations/0003_templates_submissions.sql
-- (or paste each statement into the D1 Console one at a time)

CREATE UNIQUE INDEX IF NOT EXISTS idx_circuit_unique ON circuit_data(upload_id, circuit);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  fields TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT 'circuit',
  cadence TEXT NOT NULL DEFAULT 'annual',
  owner_role TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  template_id INTEGER,
  user_id INTEGER,
  email TEXT,
  fields TEXT,
  row_count INTEGER DEFAULT 0,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_submissions_dataset ON submissions(dataset_id);
