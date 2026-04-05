-- ============================================================================
-- POP Creations CRM — Entity Ownership Transfer
-- ============================================================================
--
-- Purpose: Transfer ownership of custom objects and fields from the Workspace
-- App and POP Creations SDK App to the Twenty Standard App, so that the fork's
-- workspace:sync-metadata command recognizes them as native entities.
--
-- Source application IDs (entities currently owned by):
--   Workspace App:       f99617d1-aa3d-4009-8211-53a7b747f5f2
--   POP Creations SDK:   b7ad46a7-1784-4fab-9f09-9eed6eedb0bf
--
-- Target application ID (Twenty Standard App):
--   58dd163b-b4d9-4b30-aca8-23b41518741d
--
-- IMPORTANT: Run this BEFORE deploying the fork image and running
-- workspace:sync-metadata. Test on a database copy first!
-- ============================================================================

BEGIN;

-- ── Step 1: Transfer custom OBJECT metadata ─────────────────────────────────

UPDATE core."objectMetadata"
SET "applicationId" = '58dd163b-b4d9-4b30-aca8-23b41518741d'
WHERE "applicationId" IN (
  'f99617d1-aa3d-4009-8211-53a7b747f5f2',
  'b7ad46a7-1784-4fab-9f09-9eed6eedb0bf'
)
AND "universalIdentifier" IN (
  '3b6c3623-dce6-4ae4-91a4-c212e5e9efe2', -- aiModelConfig
  '1b9e366d-b0a1-40e6-b253-115079fed63d', -- department
  'c0233f86-fdb6-4a32-9693-6c6fb1d5e740', -- emailMessage
  '1e10f8ed-8571-48b8-8571-32e53b44d63e', -- factory
  'c0baf376-8e17-4d5b-b31a-39122aae9db5', -- ignoreRule
  'b654e699-2912-433f-93dd-c97d9a5bb7e1', -- licensorApprovalThread
  '79e9be9f-d969-40f7-988d-efc83a8e7049', -- meetingNote
  '78e3ad65-5495-461b-842e-672f1e10d78d'  -- meetingNoteAttendee
);

-- ── Step 2: Transfer custom FIELD metadata ──────────────────────────────────
-- This covers ALL custom fields: on custom objects AND on standard objects
-- (company, person, opportunity, note, workspaceMember, attachment, favorite,
-- noteTarget, taskTarget, timelineActivity)

UPDATE core."fieldMetadata"
SET "applicationId" = '58dd163b-b4d9-4b30-aca8-23b41518741d'
WHERE "applicationId" IN (
  'f99617d1-aa3d-4009-8211-53a7b747f5f2',
  'b7ad46a7-1784-4fab-9f09-9eed6eedb0bf'
);

-- ── Step 3: Verify ──────────────────────────────────────────────────────────

-- Should return 0 rows (no custom entities left under old app IDs)
SELECT 'OBJECTS still under old appId' AS check,
       "universalIdentifier", "nameSingular"
FROM core."objectMetadata"
WHERE "applicationId" IN (
  'f99617d1-aa3d-4009-8211-53a7b747f5f2',
  'b7ad46a7-1784-4fab-9f09-9eed6eedb0bf'
);

SELECT 'FIELDS still under old appId' AS check,
       COUNT(*) AS remaining
FROM core."fieldMetadata"
WHERE "applicationId" IN (
  'f99617d1-aa3d-4009-8211-53a7b747f5f2',
  'b7ad46a7-1784-4fab-9f09-9eed6eedb0bf'
);

-- Should return 8 rows (our custom objects now under Twenty Standard)
SELECT 'Custom objects transferred' AS check,
       "universalIdentifier", "nameSingular"
FROM core."objectMetadata"
WHERE "applicationId" = '58dd163b-b4d9-4b30-aca8-23b41518741d'
AND "universalIdentifier" IN (
  '3b6c3623-dce6-4ae4-91a4-c212e5e9efe2',
  '1b9e366d-b0a1-40e6-b253-115079fed63d',
  'c0233f86-fdb6-4a32-9693-6c6fb1d5e740',
  '1e10f8ed-8571-48b8-8571-32e53b44d63e',
  'c0baf376-8e17-4d5b-b31a-39122aae9db5',
  'b654e699-2912-433f-93dd-c97d9a5bb7e1',
  '79e9be9f-d969-40f7-988d-efc83a8e7049',
  '78e3ad65-5495-461b-842e-672f1e10d78d'
);

COMMIT;
