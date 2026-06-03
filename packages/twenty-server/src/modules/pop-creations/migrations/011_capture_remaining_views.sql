-- Migration 011: Capture remaining drifted views + de-duplicate redundant defaults
--
-- WHY: beyond the routing views captured in 010, the production drift audit (2.8_upgrade.md §12)
-- found more saved views that existed only in production (created via UI / app installs), plus
-- redundant duplicate default views created by the workspace-local "POP Creations CRM" app.
-- This migration makes the functional views reproducible from the repo and removes the cruft.
--
-- CAPTURED (reproduced idempotently, metadata resolved by name for portability):
--   • emailMessage : Company / Dept. / Opport.   (grouping views, under the Email folder)
--   • meetingNote  : Company / Dept. / Opport.   (under the Meeting Notes folder)
--   • person       : Company / Department         (under the People folder)
--   • person       : Person Fields Panel          (FIELDS_WIDGET record-page view, no nav)
--
-- DE-DUPLICATED (deleted — empty, unused copies from the "POP Creations CRM" app, no nav/fields;
-- the active equivalents from "Workspace's custom application" are kept):
--   • department "All Departments", factory "All Factories", licensorApprovalThread "All Licensor Approvals"
--
-- NOTE: company.creditStatus (a UI-created SELECT field) is intentionally NOT captured — it is
-- unused and is allowed to lapse on re-fork (see §12).
--
-- Idempotent and re-runnable. Apply with:
--   docker exec -i twenty-postgres psql -U twenty -d twenty \
--     < packages/twenty-server/src/modules/pop-creations/migrations/011_capture_remaining_views.sql

DO $$
DECLARE
  ws_id         uuid;
  std_app_id    uuid;
  custom_app_id uuid;
  emailmsg_obj_id    uuid;
  meetingnote_obj_id    uuid;
  person_obj_id    uuid;
  email_folder_id uuid;
  meeting_folder_id uuid;
  people_folder_id uuid;
BEGIN
  SELECT "workspaceId" INTO ws_id FROM core.view LIMIT 1;
  IF ws_id IS NULL THEN RAISE EXCEPTION 'No workspace found in core.view'; END IF;

  SELECT id INTO std_app_id    FROM core.application WHERE name='Twenty Standard'                AND "workspaceId"=ws_id LIMIT 1;
  SELECT id INTO custom_app_id FROM core.application WHERE name='Workspace''s custom application' AND "workspaceId"=ws_id LIMIT 1;
  IF std_app_id    IS NULL THEN SELECT "applicationId" INTO std_app_id FROM core.view LIMIT 1; END IF;
  IF custom_app_id IS NULL THEN custom_app_id := std_app_id; END IF;

  SELECT id INTO emailmsg_obj_id FROM core."objectMetadata" WHERE "nameSingular"='emailMessage' AND "workspaceId"=ws_id LIMIT 1;
  SELECT id INTO meetingnote_obj_id FROM core."objectMetadata" WHERE "nameSingular"='meetingNote' AND "workspaceId"=ws_id LIMIT 1;
  SELECT id INTO person_obj_id FROM core."objectMetadata" WHERE "nameSingular"='person' AND "workspaceId"=ws_id LIMIT 1;

  -- folders (find-or-create by name)
  SELECT id INTO email_folder_id FROM core."navigationMenuItem" WHERE type='FOLDER' AND name='Email' AND "workspaceId"=ws_id LIMIT 1;
  IF email_folder_id IS NULL THEN
    email_folder_id := '11111111-e1a1-4b00-b001-000000000001';
    INSERT INTO core."navigationMenuItem" (id,name,type,position,icon,"workspaceId","universalIdentifier","applicationId")
    VALUES (email_folder_id, 'Email', 'FOLDER', -3, 'IconMail', ws_id, uuid_generate_v4(), custom_app_id);
  END IF;
  SELECT id INTO meeting_folder_id FROM core."navigationMenuItem" WHERE type='FOLDER' AND name='Meeting Notes' AND "workspaceId"=ws_id LIMIT 1;
  IF meeting_folder_id IS NULL THEN
    meeting_folder_id := '3f4e4c6d-1251-4420-bc46-932190830ade';
    INSERT INTO core."navigationMenuItem" (id,name,type,position,icon,"workspaceId","universalIdentifier","applicationId")
    VALUES (meeting_folder_id, 'Meeting Notes', 'FOLDER', -2, 'IconNotes', ws_id, uuid_generate_v4(), custom_app_id);
  END IF;
  SELECT id INTO people_folder_id FROM core."navigationMenuItem" WHERE type='FOLDER' AND name='People' AND "workspaceId"=ws_id LIMIT 1;
  IF people_folder_id IS NULL THEN
    people_folder_id := 'b55f5094-60fe-45a5-b176-422002efff73';
    INSERT INTO core."navigationMenuItem" (id,name,type,position,icon,"workspaceId","universalIdentifier","applicationId")
    VALUES (people_folder_id, 'People', 'FOLDER', -1, 'IconUsers', ws_id, uuid_generate_v4(), std_app_id);
  END IF;

  -- ============ CAPTURE VIEWS ============

  -- ---- view: Company (emailMessage) [11111111-e1a1-4b00-a001-000000000002]
  IF emailmsg_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '11111111-e1a1-4b00-a001-000000000002', 'Company', 'TABLE', 'IconMail', 11, false, false, 'SIDE_PANEL', 'WORKSPACE', emailmsg_obj_id, custom_app_id, 'dcb6bd9e-6549-4335-abac-48f03712612e', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='11111111-e1a1-4b00-a001-000000000002');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '1abf5eb6-f6d8-417d-92df-5d037f87fb49','11111111-e1a1-4b00-a001-000000000002', fm.id, 'IS', '["COMPANY_ONLY"]', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='routingStatus'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='1abf5eb6-f6d8-417d-92df-5d037f87fb49');
    INSERT INTO core."viewSort" (id,"viewId","fieldMetadataId",direction,"workspaceId","universalIdentifier","applicationId")
    SELECT 'fc349b98-bebe-43db-87b6-bb640174f92a','11111111-e1a1-4b00-a001-000000000002', fm.id, 'DESC', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='receivedAt'
      AND NOT EXISTS (SELECT 1 FROM core."viewSort" WHERE id='fc349b98-bebe-43db-87b6-bb640174f92a');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '11111111-e1a1-4b00-a001-000000000002', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), custom_app_id
    FROM (VALUES
      ('eb3d7ec6-175b-4ca5-9309-f29df5acbac9'::uuid, 'sender'::text, 0, true, 200),
      ('0ce1e738-af00-4a56-9c88-421d570cb39a'::uuid, 'recipients'::text, 1, true, 200),
      ('37d876a4-584e-476e-a737-130d10487e93'::uuid, 'subject'::text, 2, true, 300),
      ('878dfbe9-eb3b-4f2e-be99-44fe15633a6f'::uuid, 'receivedAt'::text, 3, true, 157),
      ('102620ee-28a8-4c1e-8b70-ad6d5aa4f1a0'::uuid, 'company'::text, 4, true, 150),
      ('b248e3a6-cc60-4c3d-8365-ddf17af81e7c'::uuid, 'department'::text, 5, true, 150),
      ('822cf65a-c37c-4be0-aff1-c94655c1aa01'::uuid, 'program'::text, 6, true, 150)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=emailmsg_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '11111111-e1a1-4b00-b001-000000000002', 'Company', 'VIEW', '11111111-e1a1-4b00-a001-000000000002', email_folder_id, 1, 'IconMail', ws_id, uuid_generate_v4(), custom_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='11111111-e1a1-4b00-a001-000000000002' AND type='VIEW');
  END IF;
  -- ---- view: Dept. (emailMessage) [11111111-e1a1-4b00-a001-000000000003]
  IF emailmsg_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '11111111-e1a1-4b00-a001-000000000003', 'Dept.', 'TABLE', 'IconMail', 12, false, false, 'SIDE_PANEL', 'WORKSPACE', emailmsg_obj_id, custom_app_id, '46deab72-65ef-4103-8c67-a1353a82b5ca', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='11111111-e1a1-4b00-a001-000000000003');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT 'd3d77839-b061-4363-a287-3618df6781d4','11111111-e1a1-4b00-a001-000000000003', fm.id, 'IS', '["COMPANY_DEPT"]', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='routingStatus'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='d3d77839-b061-4363-a287-3618df6781d4');
    INSERT INTO core."viewSort" (id,"viewId","fieldMetadataId",direction,"workspaceId","universalIdentifier","applicationId")
    SELECT '28a49479-82d2-4a4a-bc73-f3a4374c8410','11111111-e1a1-4b00-a001-000000000003', fm.id, 'DESC', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='receivedAt'
      AND NOT EXISTS (SELECT 1 FROM core."viewSort" WHERE id='28a49479-82d2-4a4a-bc73-f3a4374c8410');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '11111111-e1a1-4b00-a001-000000000003', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), custom_app_id
    FROM (VALUES
      ('a1a7cac7-5277-4d7c-a159-40583d1209bd'::uuid, 'sender'::text, 0, true, 200),
      ('e8793792-cfa9-433e-9a62-37173cc56aa1'::uuid, 'recipients'::text, 1, true, 200),
      ('513e4523-be4f-4a82-a1bc-d743652bd084'::uuid, 'subject'::text, 2, true, 300),
      ('e2791ef7-abe8-4ff1-97cc-e89177d9b55c'::uuid, 'receivedAt'::text, 3, true, 157),
      ('430e3356-c0c2-439d-8a42-d3929c8ac5fb'::uuid, 'company'::text, 4, true, 150),
      ('58483dad-4d84-4c5f-af56-055af4d56d27'::uuid, 'department'::text, 5, true, 150),
      ('e568a7a1-79b6-4819-ac72-497171f961db'::uuid, 'program'::text, 6, true, 150)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=emailmsg_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '11111111-e1a1-4b00-b001-000000000003', 'Dept.', 'VIEW', '11111111-e1a1-4b00-a001-000000000003', email_folder_id, 2, 'IconMail', ws_id, uuid_generate_v4(), custom_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='11111111-e1a1-4b00-a001-000000000003' AND type='VIEW');
  END IF;
  -- ---- view: Opport. (emailMessage) [11111111-e1a1-4b00-a001-000000000004]
  IF emailmsg_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '11111111-e1a1-4b00-a001-000000000004', 'Opport.', 'TABLE', 'IconMail', 13, false, false, 'SIDE_PANEL', 'WORKSPACE', emailmsg_obj_id, custom_app_id, '1d0a95f9-9f51-46ea-9667-04b80db99bcc', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='11111111-e1a1-4b00-a001-000000000004');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT 'fd9aa8b2-329a-40e3-960a-a74d947cd31f','11111111-e1a1-4b00-a001-000000000004', fm.id, 'IS', '["ROUTED"]', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='routingStatus'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='fd9aa8b2-329a-40e3-960a-a74d947cd31f');
    INSERT INTO core."viewSort" (id,"viewId","fieldMetadataId",direction,"workspaceId","universalIdentifier","applicationId")
    SELECT '5e5b1e5a-a7c1-4be6-bce1-ad32b0f55628','11111111-e1a1-4b00-a001-000000000004', fm.id, 'DESC', ws_id, uuid_generate_v4(), custom_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=emailmsg_obj_id AND fm.name='receivedAt'
      AND NOT EXISTS (SELECT 1 FROM core."viewSort" WHERE id='5e5b1e5a-a7c1-4be6-bce1-ad32b0f55628');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '11111111-e1a1-4b00-a001-000000000004', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), custom_app_id
    FROM (VALUES
      ('ac6c094c-c940-4882-98fe-cb3ae83823bc'::uuid, 'sender'::text, 0, true, 200),
      ('23df5160-161d-4e6a-8370-8250100c8b26'::uuid, 'recipients'::text, 1, true, 200),
      ('d40ccf58-df93-4812-971c-f5e1d81a41e0'::uuid, 'subject'::text, 2, true, 300),
      ('e39f1fa1-0735-43ce-b474-8d95067063df'::uuid, 'receivedAt'::text, 3, true, 157),
      ('9566d0cf-a704-4c1e-a4d6-0997a419897a'::uuid, 'company'::text, 4, true, 150),
      ('b65d895e-76ce-4331-b33b-f3e9d3a8180d'::uuid, 'department'::text, 5, true, 150),
      ('d536678a-a9b7-46f0-8324-0fdd54b5cb84'::uuid, 'program'::text, 6, true, 150)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=emailmsg_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '11111111-e1a1-4b00-b001-000000000004', 'Opport.', 'VIEW', '11111111-e1a1-4b00-a001-000000000004', email_folder_id, 3, 'IconMail', ws_id, uuid_generate_v4(), custom_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='11111111-e1a1-4b00-a001-000000000004' AND type='VIEW');
  END IF;
  -- ---- view: Company (meetingNote) [22222222-e1a1-4b00-a001-000000000002]
  IF meetingnote_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '22222222-e1a1-4b00-a001-000000000002', 'Company', 'TABLE', 'IconNotes', 0, false, false, 'SIDE_PANEL', 'WORKSPACE', meetingnote_obj_id, std_app_id, '0d2469fa-c5ad-40bb-9d4b-55dbbba13424', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='22222222-e1a1-4b00-a001-000000000002');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000002','22222222-e1a1-4b00-a001-000000000002', fm.id, 'IS_NOT_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='company'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000002');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000003','22222222-e1a1-4b00-a001-000000000002', fm.id, 'IS_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='department'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000003');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000004','22222222-e1a1-4b00-a001-000000000002', fm.id, 'IS_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='program'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000004');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '22222222-e1a1-4b00-a001-000000000002', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('dd5189e5-9e7a-49dc-93c7-496218b09cea'::uuid, 'name'::text, 0, true, 300),
      ('81bb722d-a368-4e43-a004-337802c54c1e'::uuid, 'date'::text, 1, true, 150),
      ('c4c808ca-ff79-40df-ae19-aa1a85d3186c'::uuid, 'company'::text, 2, true, 150),
      ('647d4205-ab20-43e5-947d-2d980c2774d0'::uuid, 'department'::text, 3, true, 150),
      ('10665ef7-9d0b-4422-ac73-d88a8baa674b'::uuid, 'program'::text, 4, true, 150),
      ('6dacf9f4-29f5-416e-aec7-6fe04a109d07'::uuid, 'participants'::text, 5, true, 250),
      ('88e83578-e20a-413e-bc65-8a1143f890b6'::uuid, 'source'::text, 6, true, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=meetingnote_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-b001-000000000002', 'Company', 'VIEW', '22222222-e1a1-4b00-a001-000000000002', meeting_folder_id, 1, 'IconNotes', ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='22222222-e1a1-4b00-a001-000000000002' AND type='VIEW');
  END IF;
  -- ---- view: Dept. (meetingNote) [22222222-e1a1-4b00-a001-000000000003]
  IF meetingnote_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '22222222-e1a1-4b00-a001-000000000003', 'Dept.', 'TABLE', 'IconNotes', 0, false, false, 'SIDE_PANEL', 'WORKSPACE', meetingnote_obj_id, std_app_id, '26d1c6dc-12fa-4e2b-a0f5-dd15585c133c', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='22222222-e1a1-4b00-a001-000000000003');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000005','22222222-e1a1-4b00-a001-000000000003', fm.id, 'IS_NOT_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='department'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000005');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000006','22222222-e1a1-4b00-a001-000000000003', fm.id, 'IS_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='program'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000006');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '22222222-e1a1-4b00-a001-000000000003', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('261f6efc-1c9d-4415-b8a7-24ce71038472'::uuid, 'name'::text, 0, true, 300),
      ('14930b6b-bf01-4f82-83e2-d682ad64b549'::uuid, 'date'::text, 1, true, 150),
      ('b29cec12-add4-422a-b434-428ffcfe06dd'::uuid, 'company'::text, 2, true, 150),
      ('7ae04d65-a298-4dc1-8a9a-0d034cb4d77c'::uuid, 'department'::text, 3, true, 150),
      ('ae77d3c4-258c-478a-b0f0-4d6f7cd9d50e'::uuid, 'program'::text, 4, true, 150),
      ('8211ebf1-9940-43ec-9e7e-826efb26110d'::uuid, 'participants'::text, 5, true, 250),
      ('0ba921c3-cc0f-4763-a50e-415dfcc2e22d'::uuid, 'source'::text, 6, true, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=meetingnote_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-b001-000000000003', 'Dept.', 'VIEW', '22222222-e1a1-4b00-a001-000000000003', meeting_folder_id, 2, 'IconNotes', ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='22222222-e1a1-4b00-a001-000000000003' AND type='VIEW');
  END IF;
  -- ---- view: Opport. (meetingNote) [22222222-e1a1-4b00-a001-000000000004]
  IF meetingnote_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '22222222-e1a1-4b00-a001-000000000004', 'Opport.', 'TABLE', 'IconNotes', 0, false, false, 'SIDE_PANEL', 'WORKSPACE', meetingnote_obj_id, std_app_id, '89f29038-3d1c-4190-80e2-a11cd1ad1daf', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='22222222-e1a1-4b00-a001-000000000004');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-9001-000000000007','22222222-e1a1-4b00-a001-000000000004', fm.id, 'IS_NOT_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=meetingnote_obj_id AND fm.name='program'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='22222222-e1a1-4b00-9001-000000000007');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '22222222-e1a1-4b00-a001-000000000004', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('f0970ef2-72be-4578-8830-343560a64762'::uuid, 'name'::text, 0, true, 300),
      ('630ab4d6-1f81-4a93-bfa8-197e8243a9e8'::uuid, 'date'::text, 1, true, 150),
      ('d2349862-5284-4378-bfe1-c61aed38bdb7'::uuid, 'company'::text, 2, true, 150),
      ('dc8dfe73-4e98-48fc-86b2-155e95da5a91'::uuid, 'department'::text, 3, true, 150),
      ('6171455b-2c5f-4a83-8b09-dc4e0cfb7056'::uuid, 'program'::text, 4, true, 150),
      ('4818aadc-e8eb-4b75-999e-ab4733a6fe0e'::uuid, 'participants'::text, 5, true, 250),
      ('20f85bda-a5b7-4aea-9c38-58bc13c9e454'::uuid, 'source'::text, 6, true, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=meetingnote_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '22222222-e1a1-4b00-b001-000000000004', 'Opport.', 'VIEW', '22222222-e1a1-4b00-a001-000000000004', meeting_folder_id, 3, 'IconNotes', ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='22222222-e1a1-4b00-a001-000000000004' AND type='VIEW');
  END IF;
  -- ---- view: Company (person) [33333333-e1a1-4b00-b001-000000000001]
  IF person_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '33333333-e1a1-4b00-b001-000000000001', 'Company', 'TABLE', 'IconBuilding', 0, false, true, 'SIDE_PANEL', 'WORKSPACE', person_obj_id, std_app_id, '39560338-f6bf-4ba8-a79f-03722df3d1d0', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='33333333-e1a1-4b00-b001-000000000001');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-e1a1-4b00-9001-000000000001','33333333-e1a1-4b00-b001-000000000001', fm.id, 'IS_NOT_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=person_obj_id AND fm.name='company'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='33333333-e1a1-4b00-9001-000000000001');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-e1a1-4b00-9001-000000000002','33333333-e1a1-4b00-b001-000000000001', fm.id, 'IS_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=person_obj_id AND fm.name='department'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='33333333-e1a1-4b00-9001-000000000002');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-b001-4f00-a001-000000000001','33333333-e1a1-4b00-b001-000000000001', fm.id, 'IS', '["ACTIVE_CUSTOMER", "POTENTIAL_CUSTOMER"]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=person_obj_id AND fm.name='companyCustomerStatus'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='33333333-b001-4f00-a001-000000000001');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '33333333-e1a1-4b00-b001-000000000001', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('6746787b-172f-43ee-990d-23ef529dbaaf'::uuid, 'name'::text, 0, true, 0),
      ('59a3ac3c-1052-4564-80c1-0a1b28411381'::uuid, 'emails'::text, 1, true, 0),
      ('a0dd8381-1ccb-4e2c-8b0b-c08a4c5ca25e'::uuid, 'company'::text, 2, true, 0),
      ('66faec30-2eaf-4d6a-bf46-f85151ca567f'::uuid, 'department'::text, 3, true, 0),
      ('01a56189-f1eb-49af-af5c-95d2bb0c62bd'::uuid, 'jobTitle'::text, 4, true, 0),
      ('619d3c95-ac9a-41cc-837f-7e0ab2ba0ba6'::uuid, 'phones'::text, 5, true, 0),
      ('d226c09e-c274-4810-bd69-0c292d8b9c10'::uuid, 'createdAt'::text, 6, false, 0),
      ('2b85ebea-8afa-486b-9166-cef67cf5d1e3'::uuid, 'createdBy'::text, 7, false, 0),
      ('6f6236d7-e0ff-4fc8-9edc-b73e61451b7f'::uuid, 'updatedAt'::text, 8, false, 147),
      ('9e579fbb-4134-400d-bede-830fba108f10'::uuid, 'contactType'::text, 9, true, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=person_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-e1a1-4b00-b002-000000000001', 'Company', 'VIEW', '33333333-e1a1-4b00-b001-000000000001', people_folder_id, 0, NULL, ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='33333333-e1a1-4b00-b001-000000000001' AND type='VIEW');
  END IF;
  -- ---- view: Department (person) [33333333-e1a1-4b00-b001-000000000002]
  IF person_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '33333333-e1a1-4b00-b001-000000000002', 'Department', 'TABLE', 'IconSitemap', 0, false, true, 'SIDE_PANEL', 'WORKSPACE', person_obj_id, std_app_id, '4c3de18a-3e37-484e-b521-0dc3394ad5b5', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='33333333-e1a1-4b00-b001-000000000002');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-e1a1-4b00-9001-000000000003','33333333-e1a1-4b00-b001-000000000002', fm.id, 'IS_NOT_EMPTY', '[]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=person_obj_id AND fm.name='department'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='33333333-e1a1-4b00-9001-000000000003');
    INSERT INTO core."viewFilter" (id,"viewId","fieldMetadataId",operand,value,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-b001-4f00-a001-000000000002','33333333-e1a1-4b00-b001-000000000002', fm.id, 'IS', '["ACTIVE_CUSTOMER", "POTENTIAL_CUSTOMER"]', ws_id, uuid_generate_v4(), std_app_id
    FROM core."fieldMetadata" fm WHERE fm."objectMetadataId"=person_obj_id AND fm.name='companyCustomerStatus'
      AND NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id='33333333-b001-4f00-a001-000000000002');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '33333333-e1a1-4b00-b001-000000000002', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('27334b45-6665-474e-b872-e0a3d7489091'::uuid, 'name'::text, 0, true, 0),
      ('b030accc-89c6-4458-b96c-9322756edc0d'::uuid, 'emails'::text, 1, true, 0),
      ('78bb900e-d43a-4c8a-a8b1-ae516adc7b62'::uuid, 'company'::text, 2, true, 0),
      ('64a17a68-7986-414e-98b0-c158d1e46b9c'::uuid, 'department'::text, 3, true, 0),
      ('4b362a63-0b01-4029-b4fc-386e7e9f6458'::uuid, 'jobTitle'::text, 4, true, 0),
      ('0803d9c7-dfe3-46cc-a52f-e389ec6edc7a'::uuid, 'phones'::text, 5, true, 0),
      ('38adf6f6-4a73-4aad-a58e-e312f668d366'::uuid, 'createdAt'::text, 6, false, 0),
      ('e728e536-01cc-4436-9586-cb859b76ba45'::uuid, 'createdBy'::text, 7, false, 0),
      ('68f232d2-9161-4a13-b608-2d2b055604db'::uuid, 'contactType'::text, 8, false, 100)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=person_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
    INSERT INTO core."navigationMenuItem" (id,name,type,"viewId","folderId",position,icon,"workspaceId","universalIdentifier","applicationId")
    SELECT '33333333-e1a1-4b00-b002-000000000002', 'Department', 'VIEW', '33333333-e1a1-4b00-b001-000000000002', people_folder_id, 1, NULL, ws_id, uuid_generate_v4(), std_app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE "viewId"='33333333-e1a1-4b00-b001-000000000002' AND type='VIEW');
  END IF;
  -- ---- view: Person Fields Panel (person) [55555555-e1a1-4b00-a001-000000000001]
  IF person_obj_id IS NOT NULL THEN
    INSERT INTO core.view (id, name, type, icon, position, "isCompact", "isCustom", "openRecordIn", visibility, "objectMetadataId", "applicationId", "universalIdentifier", "workspaceId")
    SELECT '55555555-e1a1-4b00-a001-000000000001', 'Person Fields Panel', 'FIELDS_WIDGET', 'IconList', 99, false, true, 'SIDE_PANEL', 'WORKSPACE', person_obj_id, std_app_id, '982a6ddb-e289-4128-b44c-337b4a58eb07', ws_id
    WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id='55555555-e1a1-4b00-a001-000000000001');
    INSERT INTO core."viewField" (id,"viewId","fieldMetadataId",position,"isVisible",size,"workspaceId","universalIdentifier","applicationId")
    SELECT f.fid, '55555555-e1a1-4b00-a001-000000000001', fm.id, f.pos, f.vis, f.sz, ws_id, uuid_generate_v4(), std_app_id
    FROM (VALUES
      ('55555555-b001-4f00-a001-000000000001'::uuid, 'companyCustomerStatus'::text, 0, true, 0),
      ('55555555-b001-4f00-a001-000000000002'::uuid, 'department'::text, 1, true, 0),
      ('55555555-b001-4f00-a001-000000000003'::uuid, 'scope'::text, 2, true, 0),
      ('55555555-b001-4f00-a001-000000000004'::uuid, 'contactType'::text, 3, true, 0),
      ('55555555-b001-4f00-a001-000000000005'::uuid, 'city'::text, 4, true, 0),
      ('55555555-b001-4f00-a001-000000000006'::uuid, 'company'::text, 5, true, 0),
      ('55555555-b001-4f00-a001-000000000007'::uuid, 'emails'::text, 6, true, 0),
      ('55555555-b001-4f00-a001-000000000008'::uuid, 'jobTitle'::text, 7, true, 0),
      ('55555555-b001-4f00-a001-000000000009'::uuid, 'linkedinLink'::text, 8, true, 0),
      ('55555555-b001-4f00-a001-000000000010'::uuid, 'phones'::text, 9, true, 0),
      ('55555555-b001-4f00-a001-000000000011'::uuid, 'xLink'::text, 10, true, 0)
    ) AS f(fid, fname, pos, vis, sz)
    JOIN core."fieldMetadata" fm ON fm."objectMetadataId"=person_obj_id AND fm.name=f.fname
    WHERE NOT EXISTS (SELECT 1 FROM core."viewField" WHERE id=f.fid);
  END IF;

  -- ============ DE-DUPLICATE (delete orphan POP Creations CRM copies) ============
  -- orphan duplicate: All Departments [43de866b-1055-44d0-ae89-7159f2fdfa42]
  DELETE FROM core."navigationMenuItem" WHERE "viewId"='43de866b-1055-44d0-ae89-7159f2fdfa42';
  DELETE FROM core."viewField"  WHERE "viewId"='43de866b-1055-44d0-ae89-7159f2fdfa42';
  DELETE FROM core."viewFilter" WHERE "viewId"='43de866b-1055-44d0-ae89-7159f2fdfa42';
  DELETE FROM core."viewSort"   WHERE "viewId"='43de866b-1055-44d0-ae89-7159f2fdfa42';
  DELETE FROM core.view WHERE id='43de866b-1055-44d0-ae89-7159f2fdfa42';
  -- orphan duplicate: All Factories [91c2609c-b0ab-470a-bd6e-9397501c40f4]
  DELETE FROM core."navigationMenuItem" WHERE "viewId"='91c2609c-b0ab-470a-bd6e-9397501c40f4';
  DELETE FROM core."viewField"  WHERE "viewId"='91c2609c-b0ab-470a-bd6e-9397501c40f4';
  DELETE FROM core."viewFilter" WHERE "viewId"='91c2609c-b0ab-470a-bd6e-9397501c40f4';
  DELETE FROM core."viewSort"   WHERE "viewId"='91c2609c-b0ab-470a-bd6e-9397501c40f4';
  DELETE FROM core.view WHERE id='91c2609c-b0ab-470a-bd6e-9397501c40f4';
  -- orphan duplicate: All Licensor Approvals [bc61f03d-5781-4322-9f3b-b440f8c19cbb]
  DELETE FROM core."navigationMenuItem" WHERE "viewId"='bc61f03d-5781-4322-9f3b-b440f8c19cbb';
  DELETE FROM core."viewField"  WHERE "viewId"='bc61f03d-5781-4322-9f3b-b440f8c19cbb';
  DELETE FROM core."viewFilter" WHERE "viewId"='bc61f03d-5781-4322-9f3b-b440f8c19cbb';
  DELETE FROM core."viewSort"   WHERE "viewId"='bc61f03d-5781-4322-9f3b-b440f8c19cbb';
  DELETE FROM core.view WHERE id='bc61f03d-5781-4322-9f3b-b440f8c19cbb';

  RAISE NOTICE 'Migration 011: captured 9 views, removed 3 orphan duplicates';
END $$;
