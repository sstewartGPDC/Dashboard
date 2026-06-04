ALTER TABLE circuit_data ADD COLUMN custody_rate REAL DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN conflict_total_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN conflict_closed_cases INTEGER DEFAULT 0;
ALTER TABLE circuit_data ADD COLUMN conflict_rate REAL DEFAULT 0;
