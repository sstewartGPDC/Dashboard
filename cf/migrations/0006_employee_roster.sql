ALTER TABLE templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'metric';
CREATE TABLE IF NOT EXISTS circuit_employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER,
  period TEXT NOT NULL DEFAULT 'annual',
  is_shared INTEGER DEFAULT 1,
  circuit TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  email TEXT,
  work_phone TEXT,
  status TEXT DEFAULT 'Active',
  submitted_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emp_period ON circuit_employees(fiscal_year, period, circuit);
