-- Migration 0001: make uploads period-aware (year-over-year foundation).
-- Safe to run on an existing D1 — additive columns only, existing rows keep
-- NULL fiscal_year and 'annual' period until re-tagged.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=./migrations/0001_add_period.sql
-- (or paste the two ALTER statements into the D1 Console one at a time)

ALTER TABLE upload_history ADD COLUMN fiscal_year INTEGER;
ALTER TABLE upload_history ADD COLUMN period TEXT NOT NULL DEFAULT 'annual';
CREATE INDEX IF NOT EXISTS idx_upload_period ON upload_history(fiscal_year, period, is_shared);
