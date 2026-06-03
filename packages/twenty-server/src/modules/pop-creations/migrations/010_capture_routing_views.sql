-- Migration 010: Capture the routing saved views + their nav placement in code
--
-- WHY: these views and their sidebar nav items existed only in production (created via the
-- UI / ad hoc), not in any committed migration — undocumented drift. This file makes the full
-- set reproducible from the repo so a rebuild or re-fork reconstructs them deterministically.
--
-- THREE DISTINCT VIEWS (not duplicates — different objects, different filters):
--   • "Needs Routing"   (company)      → customerStatus IS ["UNASSIGNED"]      | folder: Companies
--   • "Unrouted Emails" (emailMessage) → routingStatus  IS ["UNROUTED"]        | folder: Email
--                                        sorted receivedAt DESC
--   • "Unrouted Notes"  (meetingNote)  → company        IS_EMPTY              | folder: Meeting Notes
--
-- The two formerly both named "Unrouted" are renamed to "Unrouted Emails" / "Unrouted Notes"
-- for sidebar clarity (they were never true duplicates; they do different jobs).
--
-- PORTABILITY: object/field metadata IDs and folders are resolved BY NAME (they differ per
-- workspace). View / filter / field / sort / nav-item entity IDs are fixed (matching production).
-- Every write is guarded (WHERE NOT EXISTS / id match), so the migration is idempotent and
-- re-runnable, and the rename UPDATEs are no-ops once applied.
--
-- Apply with:
--   docker exec -i twenty-postgres psql -U twenty -d twenty \
--     < packages/twenty-server/src/modules/pop-creations/migrations/010_capture_routing_views.sql

DO $$
DECLARE
  ws_id              uuid;
  std_app_id         uuid;
  custom_app_id      uuid;
  company_obj_id     uuid;
  email_obj_id       uuid;
  meeting_obj_id     uuid;
  fid                uuid;
  companies_folder_id uuid;
  email_folder_id     uuid;
  meeting_folder_id   uuid;
BEGIN
  -- ---- Workspace + application bindings (resolved by name; both apps exist in every workspace)
  SELECT "workspaceId" INTO ws_id FROM core.view LIMIT 1;
  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'No workspace found in core.view';
  END IF;

  SELECT id INTO std_app_id    FROM core.application WHERE name = 'Twenty Standard'                AND "workspaceId" = ws_id LIMIT 1;
  SELECT id INTO custom_app_id FROM core.application WHERE name = 'Workspace''s custom application' AND "workspaceId" = ws_id LIMIT 1;
  IF std_app_id    IS NULL THEN SELECT "applicationId" INTO std_app_id FROM core.view LIMIT 1; END IF;
  IF custom_app_id IS NULL THEN custom_app_id := std_app_id; END IF;

  SELECT id INTO company_obj_id FROM core."objectMetadata" WHERE "nameSingular" = 'company'      AND "workspaceId" = ws_id LIMIT 1;
  SELECT id INTO email_obj_id   FROM core."objectMetadata" WHERE "nameSingular" = 'emailMessage' AND "workspaceId" = ws_id LIMIT 1;
  SELECT id INTO meeting_obj_id FROM core."objectMetadata" WHERE "nameSingular" = 'meetingNote'  AND "workspaceId" = ws_id LIMIT 1;

  -- =====================================================================
  -- VIEW 1 — "Needs Routing" (company): customerStatus IS ["UNASSIGNED"]
  -- =====================================================================
  IF company_obj_id IS NOT NULL THEN
    INSERT INTO core.view
      (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn",
       visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT 'a1000002-0000-4000-a000-000000000001', 'Needs Routing', 'TABLE', 'IconRoute',
           1, false, true, 'SIDE_PANEL', 'WORKSPACE',
           company_obj_id, std_app_id, 'a1000002-0000-4000-a000-000000000002', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id = 'a1000002-0000-4000-a000-000000000001');

    SELECT id INTO fid FROM core."fieldMetadata"
      WHERE "objectMetadataId" = company_obj_id AND name = 'customerStatus' LIMIT 1;
    IF fid IS NOT NULL THEN
      INSERT INTO core."viewFilter"
        (id, "viewId", "fieldMetadataId", operand, value, "workspaceId", "universalIdentifier", "applicationId")
      SELECT 'a1000003-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
             fid, 'IS', '["UNASSIGNED"]', ws_id, uuid_generate_v4(), std_app_id
      WHERE NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id = 'a1000003-0000-4000-a000-000000000001');
    END IF;

    INSERT INTO core."viewField"
      (id, "viewId", "fieldMetadataId", position, "isVisible", size, "workspaceId", "universalIdentifier", "applicationId")
    SELECT f.fid, 'a1000002-0000-4000-a000-000000000001', fm.id, f.pos, f.vis, f.sz,
           ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('3336eb81-d501-4afa-8043-97f868f99347'::uuid, 'name'::text,           0, true,  287),
      ('296f11e8-1c7c-4114-81b7-9dd5352beab0'::uuid, 'domainName'::text,     1, true,  184),
      ('4657bd5e-2948-41e4-b0d1-7c42f744a10c'::uuid, 'createdBy'::text,      2, true,  150),
      ('f1de77ef-6cb1-44e7-ad66-a6010d7037da'::uuid, 'accountOwner'::text,   3, false, 150),
      ('acdd05f1-c6e2-43a3-94a3-9f2b00e66225'::uuid, 'customerStatus'::text, 3, true,  150),
      ('97f722c5-b33b-4d71-b87a-91d1ed8045cf'::uuid, 'createdAt'::text,      4, true,  150),
      ('824b873d-f841-4b19-b7c0-d7e8677450ab'::uuid, 'chainType'::text,      4, true,  150),
      ('464846b1-1dca-4a5b-ba70-51dd83338dda'::uuid, 'employees'::text,      5, true,  150),
      ('864d2732-f123-439c-8c2b-d136a28912ed'::uuid, 'address'::text,        7, true,  170)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId" = company_obj_id AND fm.name = f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id = f.fid);
  ELSE
    RAISE NOTICE 'Skipping "Needs Routing": company object not found';
  END IF;

  -- =====================================================================
  -- VIEW 2 — "Unrouted Emails" (emailMessage): routingStatus IS ["UNROUTED"], sort receivedAt DESC
  -- =====================================================================
  IF email_obj_id IS NOT NULL THEN
    INSERT INTO core.view
      (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn",
       visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '11111111-e1a1-4b00-a001-000000000001', 'Unrouted Emails', 'TABLE', 'IconMail',
           10, false, false, 'SIDE_PANEL', 'WORKSPACE',
           email_obj_id, custom_app_id, '5cb6c376-2e51-428d-9aa1-b4399e2f3e9b', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id = '11111111-e1a1-4b00-a001-000000000001');
    -- rename existing prod row (was "Unrouted")
    UPDATE core.view SET name = 'Unrouted Emails'
      WHERE id = '11111111-e1a1-4b00-a001-000000000001' AND name = 'Unrouted';

    SELECT id INTO fid FROM core."fieldMetadata"
      WHERE "objectMetadataId" = email_obj_id AND name = 'routingStatus' LIMIT 1;
    IF fid IS NOT NULL THEN
      INSERT INTO core."viewFilter"
        (id, "viewId", "fieldMetadataId", operand, value, "workspaceId", "universalIdentifier", "applicationId")
      SELECT '67c84e80-83f8-4137-a8fd-98721b5394f5', '11111111-e1a1-4b00-a001-000000000001',
             fid, 'IS', '["UNROUTED"]', ws_id, uuid_generate_v4(), custom_app_id
      WHERE NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id = '67c84e80-83f8-4137-a8fd-98721b5394f5');
    END IF;

    SELECT id INTO fid FROM core."fieldMetadata"
      WHERE "objectMetadataId" = email_obj_id AND name = 'receivedAt' LIMIT 1;
    IF fid IS NOT NULL THEN
      INSERT INTO core."viewSort"
        (id, "viewId", "fieldMetadataId", direction, "workspaceId", "universalIdentifier", "applicationId")
      SELECT '9ce1e0b8-e733-4532-b7e4-7f02d0c83c5c', '11111111-e1a1-4b00-a001-000000000001',
             fid, 'DESC', ws_id, uuid_generate_v4(), custom_app_id
      WHERE NOT EXISTS (SELECT 1 FROM core."viewSort" WHERE id = '9ce1e0b8-e733-4532-b7e4-7f02d0c83c5c');
    END IF;

    INSERT INTO core."viewField"
      (id, "viewId", "fieldMetadataId", position, "isVisible", size, "workspaceId", "universalIdentifier", "applicationId")
    SELECT f.fid, '11111111-e1a1-4b00-a001-000000000001', fm.id, f.pos, f.vis, f.sz,
           ws_id, uuid_generate_v4(), custom_app_id
    FROM (VALUES
      ('226865d8-6deb-4b43-a0d3-09515f641d09'::uuid, 'sender'::text,     0, true, 200),
      ('4f5e2a89-ecc9-4135-8210-e883c3c1156c'::uuid, 'recipients'::text, 1, true, 200),
      ('0bab9902-7757-43b5-91d6-aa09c6a15f81'::uuid, 'subject'::text,    2, true, 300),
      ('924e5920-cad0-4cab-aa75-441cf1a59ec7'::uuid, 'receivedAt'::text, 3, true, 157),
      ('cb8b8b45-1f89-45cf-95ad-221ac405b23f'::uuid, 'company'::text,    4, true, 150),
      ('986b7503-67cf-4714-bc86-d6b5bef7c9a6'::uuid, 'department'::text, 5, true, 150),
      ('194c8521-20b9-41de-8c61-6b4a92681f09'::uuid, 'program'::text,    6, true, 150)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId" = email_obj_id AND fm.name = f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id = f.fid);
  ELSE
    RAISE NOTICE 'Skipping "Unrouted Emails": emailMessage object not found';
  END IF;

  -- =====================================================================
  -- VIEW 3 — "Unrouted Notes" (meetingNote): company IS_EMPTY
  -- =====================================================================
  IF meeting_obj_id IS NOT NULL THEN
    INSERT INTO core.view
      (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn",
       visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '22222222-e1a1-4b00-a001-000000000001', 'Unrouted Notes', 'TABLE', 'IconNotes',
           0, false, false, 'SIDE_PANEL', 'WORKSPACE',
           meeting_obj_id, std_app_id, 'c61feed2-87de-45f0-9d3a-c16aa07c4f86', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id = '22222222-e1a1-4b00-a001-000000000001');
    UPDATE core.view SET name = 'Unrouted Notes'
      WHERE id = '22222222-e1a1-4b00-a001-000000000001' AND name = 'Unrouted';

    SELECT id INTO fid FROM core."fieldMetadata"
      WHERE "objectMetadataId" = meeting_obj_id AND name = 'company' LIMIT 1;
    IF fid IS NOT NULL THEN
      INSERT INTO core."viewFilter"
        (id, "viewId", "fieldMetadataId", operand, value, "workspaceId", "universalIdentifier", "applicationId")
      SELECT '22222222-e1a1-4b00-9001-000000000001', '22222222-e1a1-4b00-a001-000000000001',
             fid, 'IS_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
      WHERE NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id = '22222222-e1a1-4b00-9001-000000000001');
    END IF;

    INSERT INTO core."viewField"
      (id, "viewId", "fieldMetadataId", position, "isVisible", size, "workspaceId", "universalIdentifier", "applicationId")
    SELECT f.fid, '22222222-e1a1-4b00-a001-000000000001', fm.id, f.pos, f.vis, f.sz,
           ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('1cdbeb7c-2bfd-49d7-bafd-e2d59ce235a1'::uuid, 'name'::text,         0, true, 300),
      ('c0b66070-370c-4aec-bbae-92ca87c56812'::uuid, 'date'::text,         1, true, 150),
      ('7e5e9a55-3d41-4dee-9f8d-bb31e4bf05f6'::uuid, 'company'::text,      2, true, 150),
      ('9e1dc537-0dd1-4ee6-9151-f804eed6371e'::uuid, 'department'::text,   3, true, 150),
      ('7366521c-d4b4-4b41-b031-4ad71962776c'::uuid, 'program'::text,      4, true, 150),
      ('1e445d33-3dc9-494a-8ae7-752559260883'::uuid, 'participants'::text, 5, true, 250),
      ('35fc9ef9-8f59-4a48-9767-be5684085e88'::uuid, 'source'::text,       6, true, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId" = meeting_obj_id AND fm.name = f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id = f.fid);
  ELSE
    RAISE NOTICE 'Skipping "Unrouted Notes": meetingNote object not found';
  END IF;

  -- =====================================================================
  -- NAVIGATION PLACEMENT
  -- Folders are find-or-create BY NAME so a re-fork reuses an existing standard folder
  -- instead of creating a duplicate. VIEW items are guarded per (viewId, type=VIEW).
  -- =====================================================================

  -- ---- Companies folder (for Needs Routing)
  SELECT id INTO companies_folder_id FROM core."navigationMenuItem"
    WHERE type = 'FOLDER' AND name = 'Companies' AND "workspaceId" = ws_id LIMIT 1;
  IF companies_folder_id IS NULL THEN
    companies_folder_id := 'a1000001-0000-4000-a000-000000000001';
    INSERT INTO core."navigationMenuItem"
      (id, name, type, position, icon, "workspaceId", "universalIdentifier", "applicationId")
    VALUES (companies_folder_id, 'Companies', 'FOLDER', 0, 'IconBuildingSkyscraper',
            ws_id, uuid_generate_v4(), std_app_id);
  END IF;

  -- ---- Email folder (for Unrouted Emails)
  SELECT id INTO email_folder_id FROM core."navigationMenuItem"
    WHERE type = 'FOLDER' AND name = 'Email' AND "workspaceId" = ws_id LIMIT 1;
  IF email_folder_id IS NULL THEN
    email_folder_id := '11111111-e1a1-4b00-b001-000000000001';
    INSERT INTO core."navigationMenuItem"
      (id, name, type, position, icon, "workspaceId", "universalIdentifier", "applicationId")
    VALUES (email_folder_id, 'Email', 'FOLDER', -3, 'IconMail',
            ws_id, uuid_generate_v4(), custom_app_id);
  END IF;

  -- ---- Meeting Notes folder (for Unrouted Notes)
  SELECT id INTO meeting_folder_id FROM core."navigationMenuItem"
    WHERE type = 'FOLDER' AND name = 'Meeting Notes' AND "workspaceId" = ws_id LIMIT 1;
  IF meeting_folder_id IS NULL THEN
    meeting_folder_id := '3f4e4c6d-1251-4420-bc46-932190830ade';
    INSERT INTO core."navigationMenuItem"
      (id, name, type, position, icon, "workspaceId", "universalIdentifier", "applicationId")
    VALUES (meeting_folder_id, 'Meeting Notes', 'FOLDER', -2, 'IconNotes',
            ws_id, uuid_generate_v4(), custom_app_id);
  END IF;

  -- ---- VIEW item: Needs Routing → Companies
  IF company_obj_id IS NOT NULL THEN
    INSERT INTO core."navigationMenuItem"
      (id, name, type, "viewId", "folderId", position, icon, "workspaceId", "universalIdentifier", "applicationId")
    SELECT 'a1000004-0000-4000-a000-000000000001', 'Needs Routing', 'VIEW',
           'a1000002-0000-4000-a000-000000000001', companies_folder_id, 1, 'IconRoute',
           ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (
      SELECT 1 FROM core."navigationMenuItem"
      WHERE "viewId" = 'a1000002-0000-4000-a000-000000000001' AND type = 'VIEW');
  END IF;

  -- ---- VIEW item: Unrouted Emails → Email
  IF email_obj_id IS NOT NULL THEN
    INSERT INTO core."navigationMenuItem"
      (id, name, type, "viewId", "folderId", position, icon, "workspaceId", "universalIdentifier", "applicationId")
    SELECT '11111111-e1a1-4b00-b001-000000000005', 'Unrouted Emails', 'VIEW',
           '11111111-e1a1-4b00-a001-000000000001', email_folder_id, 0, 'IconMail',
           ws_id, uuid_generate_v4(), custom_app_id
    WHERE NOT EXISTS (
      SELECT 1 FROM core."navigationMenuItem"
      WHERE "viewId" = '11111111-e1a1-4b00-a001-000000000001' AND type = 'VIEW');
    UPDATE core."navigationMenuItem" SET name = 'Unrouted Emails'
      WHERE "viewId" = '11111111-e1a1-4b00-a001-000000000001' AND type = 'VIEW' AND name = 'Unrouted';
  END IF;

  -- ---- VIEW item: Unrouted Notes → Meeting Notes
  IF meeting_obj_id IS NOT NULL THEN
    INSERT INTO core."navigationMenuItem"
      (id, name, type, "viewId", "folderId", position, icon, "workspaceId", "universalIdentifier", "applicationId")
    SELECT '22222222-e1a1-4b00-b001-000000000001', 'Unrouted Notes', 'VIEW',
           '22222222-e1a1-4b00-a001-000000000001', meeting_folder_id, 0, 'IconNotes',
           ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (
      SELECT 1 FROM core."navigationMenuItem"
      WHERE "viewId" = '22222222-e1a1-4b00-a001-000000000001' AND type = 'VIEW');
    UPDATE core."navigationMenuItem" SET name = 'Unrouted Notes'
      WHERE "viewId" = '22222222-e1a1-4b00-a001-000000000001' AND type = 'VIEW' AND name = 'Unrouted';
  END IF;

  RAISE NOTICE 'Routing views + nav captured (Needs Routing, Unrouted Emails, Unrouted Notes)';
END $$;
