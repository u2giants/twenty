# Database Migration Runbook

## Purpose

Transfer entity ownership from Workspace App / POP Creations SDK App to Twenty Standard App so the fork's `workspace:sync-metadata` recognizes custom objects and fields as native entities.

## Prerequisites

- PostgreSQL access to the Twenty database
- The `transfer-ownership.sql` script from this directory
- A database backup (pg_dump) before starting

## Step 1: Take a backup

```bash
pg_dump -h <host> -U <user> -d <dbname> -F c -f twenty-backup-$(date +%Y%m%d).dump
```

## Step 2: Test on a copy (REQUIRED)

```bash
# Create test database
createdb twenty_migration_test
pg_restore -d twenty_migration_test twenty-backup-$(date +%Y%m%d).dump

# Run the migration against the test DB
psql -d twenty_migration_test -f transfer-ownership.sql

# Verify: should show 8 custom objects under Twenty Standard App
psql -d twenty_migration_test -c "
  SELECT \"nameSingular\", \"applicationId\"
  FROM core.\"objectMetadata\"
  WHERE \"universalIdentifier\" IN (
    '3b6c3623-dce6-4ae4-91a4-c212e5e9efe2',
    '1b9e366d-b0a1-40e6-b253-115079fed63d',
    'c0233f86-fdb6-4a32-9693-6c6fb1d5e740',
    '1e10f8ed-8571-48b8-8571-32e53b44d63e',
    'c0baf376-8e17-4d5b-b31a-39122aae9db5',
    'b654e699-2912-433f-93dd-c97d9a5bb7e1',
    '79e9be9f-d969-40f7-988d-efc83a8e7049',
    '78e3ad65-5495-461b-842e-672f1e10d78d'
  );
"

# All 8 should show applicationId = 58dd163b-b4d9-4b30-aca8-23b41518741d
```

## Step 3: Run workspace:sync-metadata on test DB

```bash
# Point the fork server at the test database
DATABASE_URL=postgres://..._test node dist/main workspace:sync-metadata
```

**What to check:**
- No "dropping table" messages for custom objects
- No errors about missing universalIdentifiers
- All 8 custom objects recognized as existing
- SELECT option IDs match (check a field like `customerStatus` on Company)

## Step 4: Run against production

Only after Step 3 succeeds:

```bash
psql -h <prod_host> -U <user> -d <prod_db> -f transfer-ownership.sql
```

## Rollback

If anything goes wrong, restore from backup:

```bash
pg_restore -h <host> -U <user> -d <dbname> --clean twenty-backup-$(date +%Y%m%d).dump
```

## Verification queries

```sql
-- Count custom fields by old vs new appId
SELECT "applicationId", COUNT(*) FROM core."fieldMetadata"
WHERE "applicationId" IN (
  'f99617d1-aa3d-4009-8211-53a7b747f5f2',
  'b7ad46a7-1784-4fab-9f09-9eed6eedb0bf',
  '58dd163b-b4d9-4b30-aca8-23b41518741d'
)
GROUP BY "applicationId";

-- Verify no data tables were dropped
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname LIKE 'workspace_%'
AND tablename IN ('department', 'emailMessage', 'meetingNote', 'factory',
                   'ignoreRule', 'licensorApprovalThread', 'aiModelConfig',
                   'meetingNoteAttendee');
```
