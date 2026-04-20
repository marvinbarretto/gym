-- Drops the unused supplements schema. Supplement coach moves to jimbo-api.
-- See docs/superpowers/specs/2026-04-18-supplement-coach-design.md.

DROP INDEX IF EXISTS gym.idx_supplement_logs_user;
DROP TABLE IF EXISTS gym.supplement_logs;
DROP TABLE IF EXISTS gym.supplements;
