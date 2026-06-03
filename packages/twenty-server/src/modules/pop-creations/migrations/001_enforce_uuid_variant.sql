-- Migration 001: Enforce valid UUID variant on view-related tables
--
-- Twenty's app layer validates every UUID it reads from the database.
-- A UUID where the 4th group starts with c/d/e/f is not a valid RFC 4122
-- UUID (variant bits must be 10xx = 8/9/a/b). When one of these reaches
-- the server it throws "Error: Invalid UUID" on every request, causing the
-- frontend to render a blank white page with no visible error.
--
-- These CHECK constraints make it physically impossible to insert such a
-- UUID. Postgres rejects the write immediately — before the data can be
-- cached by Redis or served to the client.
--
-- Safe to run multiple times (constraints are dropped first if they exist).

ALTER TABLE core."view"
  DROP CONSTRAINT IF EXISTS check_uuid_variant,
  ADD CONSTRAINT check_uuid_variant
  CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89aAbB]');

ALTER TABLE core."viewField"
  DROP CONSTRAINT IF EXISTS check_uuid_variant,
  ADD CONSTRAINT check_uuid_variant
  CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89aAbB]');

ALTER TABLE core."viewFilter"
  DROP CONSTRAINT IF EXISTS check_uuid_variant,
  ADD CONSTRAINT check_uuid_variant
  CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89aAbB]');

ALTER TABLE core."viewSort"
  DROP CONSTRAINT IF EXISTS check_uuid_variant,
  ADD CONSTRAINT check_uuid_variant
  CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89aAbB]');

ALTER TABLE core."viewGroup"
  DROP CONSTRAINT IF EXISTS check_uuid_variant,
  ADD CONSTRAINT check_uuid_variant
  CHECK (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89aAbB]');
