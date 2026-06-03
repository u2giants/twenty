-- Migration 003: Column width persistence + orphaned department cleanup
--
-- 1. Add VIEWS permission flag to Member and Admin roles so that column
--    width changes (and other view edits) are persisted to the backend.
--    Without this flag, useCanPersistViewChanges() returns false for
--    WORKSPACE-visibility views and all resize operations are silently dropped.
--
-- 2. Clean up Person records whose departmentId points to a soft-deleted
--    department. These appear in the People → Department view even though
--    their department record no longer exists in the UI.
--
-- Apply with:
--   psql "$PG_DATABASE_URL" -f 003_views_permission_and_orphaned_departments.sql

-- ── 1. VIEWS permission flag ─────────────────────────────────────────────────

INSERT INTO core."permissionFlag"
  (id, "roleId", flag, "workspaceId", "universalIdentifier", "applicationId")
SELECT
  uuid_generate_v4(),
  r.id,
  'VIEWS',
  r."workspaceId",
  uuid_generate_v4(),
  pf."applicationId"
FROM core.role r
CROSS JOIN (SELECT "applicationId" FROM core."permissionFlag" LIMIT 1) pf
WHERE r.label IN ('Member', 'Admin')
ON CONFLICT ON CONSTRAINT "IDX_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE" DO NOTHING;

-- ── 2. Clear orphaned departmentId from Person records ───────────────────────
-- Targets people whose department was soft-deleted (deletedAt IS NOT NULL).
-- Uses a dynamic workspace schema so this works regardless of schema name.

DO $$
DECLARE
  ws_schema text;
BEGIN
  SELECT schema_name
  INTO ws_schema
  FROM information_schema.schemata
  WHERE schema_name LIKE 'workspace_%'
  LIMIT 1;

  IF ws_schema IS NOT NULL THEN
    EXECUTE format(
      'UPDATE %I.person
       SET "departmentId" = NULL, "updatedAt" = NOW()
       WHERE "departmentId" IS NOT NULL
         AND "deletedAt" IS NULL
         AND "departmentId" NOT IN (
           SELECT id FROM %I."_department" WHERE "deletedAt" IS NULL
         )',
      ws_schema, ws_schema
    );

    RAISE NOTICE 'Cleared orphaned departmentId values in schema %', ws_schema;
  END IF;
END $$;
