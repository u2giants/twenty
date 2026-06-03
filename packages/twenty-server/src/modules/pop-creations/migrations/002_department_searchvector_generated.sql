-- Migration 002: Convert _department.searchVector to a GENERATED ALWAYS AS column
--
-- The _department table was created with searchVector as a plain nullable tsvector
-- column. The Twenty workspace metadata system defines it as GENERATED STORED, but
-- the schema migration that would have wired up the generation expression never ran.
-- As a result, searchVector was always NULL, causing the search query's
-- WHERE "searchVector" IS NOT NULL filter to exclude all departments from the
-- relation picker — showing "No records found" when trying to assign a department
-- to a person.
--
-- This migration drops the plain column and re-adds it as GENERATED ALWAYS AS,
-- matching the expression produced by getTsVectorColumnExpressionFromFields for
-- SEARCH_FIELDS_FOR_DEPARTMENT = [{ name: 'name', type: TEXT }].
--
-- Applied manually to production on 2026-05-07 outside the approved path.
-- This file captures that change so the repo reflects production schema.
--
-- Safe to re-run: IF EXISTS guards prevent errors if the column is already generated.

DO $$
DECLARE
  schema_name text;
BEGIN
  SELECT nspname INTO schema_name
  FROM pg_namespace
  WHERE nspname LIKE 'workspace_%'
  LIMIT 1;

  IF schema_name IS NULL THEN
    RAISE NOTICE 'No workspace schema found, skipping migration.';
    RETURN;
  END IF;

  -- Check if already a generated column; skip if so
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name
      AND table_name = '_department'
      AND column_name = 'searchVector'
      AND is_generated = 'ALWAYS'
  ) THEN
    RAISE NOTICE 'searchVector is already a generated column, skipping.';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I."_department" DROP COLUMN IF EXISTS "searchVector"',
    schema_name
  );

  EXECUTE format(
    $sql$
      ALTER TABLE %I."_department"
        ADD COLUMN "searchVector" tsvector
        GENERATED ALWAYS AS (
          to_tsvector('simple', COALESCE(public.unaccent_immutable("name"), ''))
        ) STORED
    $sql$,
    schema_name
  );

  RAISE NOTICE 'searchVector column converted to GENERATED ALWAYS AS on %.\_department', schema_name;
END;
$$;
