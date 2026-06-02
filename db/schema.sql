CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  filename TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_shared BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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
  FOREIGN KEY (upload_id) REFERENCES upload_history(id)
);

CREATE TABLE IF NOT EXISTS column_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mapping_name TEXT,
  mapping_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dashboard_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_key TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, config_key)
);

CREATE TABLE IF NOT EXISTS dashboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Dashboard',
  layout_json TEXT NOT NULL DEFAULT '[]',
  theme_json TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Audit trail of security-relevant actions. Required for sensitive-data
-- handling: who did what, when, and from where.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                 -- null for pre-auth events (e.g. failed login)
  username TEXT,                   -- recorded even when user_id is unknown
  action TEXT NOT NULL,            -- e.g. 'login.success', 'data.upload', 'data.clear'
  detail TEXT,                     -- free-form JSON/string with context
  ip TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Failed-login tracking for rate-limiting / lockout. One row per failed attempt;
-- cleared on success. Keyed by username + ip.
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  ip TEXT,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(username, ip, attempted_at);
