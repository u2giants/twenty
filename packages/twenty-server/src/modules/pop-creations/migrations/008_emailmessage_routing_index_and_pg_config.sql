-- Migration 008: Partial index on _emailMessage for email rerouter + Postgres settings
--
-- Root cause (2026-05-20 incident investigation): EmailRerouterCronJob runs every 6 hours
-- and does a full table scan on _emailMessage for every batch page because no index covers
-- (routingStatus, createdAt, id). Confirmed via EXPLAIN ANALYZE: Seq Scan on 10,379 rows,
-- ~12ms/batch, ~20 batches/run, processing 9,833 reroutable emails.
--
-- The partial index below converts each batch page from a seq scan to an index range scan.
--
-- NOTE: The following have already been applied directly to production on 2026-05-20:
--   - This index (CREATE INDEX CONCURRENTLY)
--   - ALTER ROLE twenty SET statement_timeout / idle_in_transaction_session_timeout
--   - ALTER SYSTEM for shared_preload_libraries, shared_buffers, work_mem,
--     log_min_duration_statement, log_line_prefix
--   - CREATE EXTENSION pg_stat_statements
-- This file documents those changes for the migration record.

-- ─── Partial index for email rerouter cursor scan ──────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_emailMessage_routing_cursor"
  ON "workspace_93r34ew9zc9644a9y5f1yeylz"."_emailMessage" ("createdAt" ASC, id ASC)
  WHERE "routingStatus" IN ('UNROUTED', 'COMPANY_ONLY', 'COMPANY_DEPT');

-- ─── Role-level query safeguards ──────────────────────────────────────────

ALTER ROLE twenty SET statement_timeout = '300s';
ALTER ROLE twenty SET idle_in_transaction_session_timeout = '60s';

-- ─── Postgres observability (applied via ALTER SYSTEM — requires pg restart) ──
--
-- Already applied to production. Documented here for reference.
-- To re-apply on a fresh instance:
--
--   ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
--   ALTER SYSTEM SET pg_stat_statements.track = 'all';
--   ALTER SYSTEM SET log_min_duration_statement = 1000;
--   ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
--   ALTER SYSTEM SET shared_buffers = '3GB';
--   ALTER SYSTEM SET work_mem = '32MB';
--   ALTER SYSTEM SET maintenance_work_mem = '512MB';
--   -- then restart postgres and:
--   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
