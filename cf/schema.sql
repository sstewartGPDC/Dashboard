-- D1 schema for the internal GPDC Dashboard (Cloudflare migration).
-- Carries over from db/schema.sql with two changes:
--   * users are keyed by EMAIL (Cloudflare Access identity), not username+password
--   * upload_history gains `status` (pending|published) for the later public flow

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',          -- 'user' | 'admin'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  filename TEXT,
  fiscal_year INTEGER,                         -- e.g. 2025 for FY25 (Jul 2024–Jun 2025)
  period TEXT NOT NULL DEFAULT 'annual',       -- 'annual' | 'Q1'..'Q4' | month, etc.
  is_shared INTEGER NOT NULL DEFAULT 0,        -- visible to all staff in-app
  status TEXT NOT NULL DEFAULT 'pending',      -- 'pending' | 'published' (public)
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_upload_user ON upload_history(user_id);
-- History accumulates by year/period instead of overwriting — this is what
-- enables year-over-year comparison.
CREATE INDEX IF NOT EXISTS idx_upload_period ON upload_history(fiscal_year, period, is_shared);

CREATE TABLE IF NOT EXISTS circuit_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER NOT NULL,
  circuit TEXT NOT NULL,
  total_cases INTEGER DEFAULT 0,
  new_cases INTEGER DEFAULT 0,
  rollover_cases INTEGER DEFAULT 0,
  closed_cases INTEGER DEFAULT 0,
  state_attorneys_filled INTEGER DEFAULT 0,
  state_attorneys_vacant INTEGER DEFAULT 0,
  county_attorneys INTEGER DEFAULT 0,
  conflict_new_cases INTEGER DEFAULT 0,
  conflict_rollover_cases INTEGER DEFAULT 0,
  total_contractors INTEGER DEFAULT 0,
  -- Case-type breakdown (for weighted caseload vs. standard)
  capital_cases INTEGER DEFAULT 0,
  felony_cases INTEGER DEFAULT 0,
  misdemeanor_cases INTEGER DEFAULT 0,
  juvenile_cases INTEGER DEFAULT 0,
  appeals_cases INTEGER DEFAULT 0,
  probation_cases INTEGER DEFAULT 0,
  -- Support staff
  investigators INTEGER DEFAULT 0,
  social_workers INTEGER DEFAULT 0,
  paralegals INTEGER DEFAULT 0,
  -- Financials
  annual_budget REAL DEFAULT 0,
  actual_spend REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_circuit_upload ON circuit_data(upload_id);

CREATE TABLE IF NOT EXISTS column_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mapping_name TEXT,
  mapping_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_key TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, config_key)
);

CREATE TABLE IF NOT EXISTS dashboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Dashboard',
  layout_json TEXT NOT NULL DEFAULT '[]',
  theme_json TEXT DEFAULT NULL,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
