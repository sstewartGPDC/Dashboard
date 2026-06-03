-- Migration 0002: case-type, support-staff, and financial metrics.
-- Additive columns on circuit_data — existing rows default to 0. Enables
-- weighted caseload, support-staff ratios, and cost-per-case.
--
-- Apply with:
--   wrangler d1 execute DB --remote --file=./migrations/0002_expand_metrics.sql
-- (or paste each ALTER into the D1 Console one at a time)

ALTER TABLE circuit_data ADD COLUMN capital_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN felony_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN misdemeanor_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN juvenile_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN appeals_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN probation_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN investigators INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN social_workers INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN paralegals INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN annual_budget REAL DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN actual_spend REAL DEFAULT 0;
