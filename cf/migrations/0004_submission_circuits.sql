-- Migration 0004: record which circuits each submission covered (status board).
--   wrangler d1 execute DB --remote --file=./migrations/0004_submission_circuits.sql

ALTER TABLE submissions ADD COLUMN circuits TEXT;
