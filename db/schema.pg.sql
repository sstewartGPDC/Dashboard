-- Postgres-dialect schema for the hosted intranet deployment.
-- Mirrors db/schema.sql. Differences from SQLite:
--   * SERIAL / BIGSERIAL instead of INTEGER AUTOINCREMENT
--   * TIMESTAMPTZ instead of DATETIME
--   * Boolean-ish flags kept as SMALLINT (0/1) so application code is identical
--   * ON CONFLICT target on dashboard_config matches the SQLite UNIQUE constraint

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_shared SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS circuit_data (
  id SERIAL PRIMARY KEY,
  upload_id INTEGER NOT NULL REFERENCES upload_history(id),
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
  total_contractors INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS column_mappings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mapping_name TEXT,
  mapping_json TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_config (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  config_key TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, config_key)
);

CREATE TABLE IF NOT EXISTS dashboards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT 'My Dashboard',
  layout_json TEXT NOT NULL DEFAULT '[]',
  theme_json TEXT DEFAULT NULL,
  is_active SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT,
  ip TEXT,
  attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(username, ip, attempted_at);
