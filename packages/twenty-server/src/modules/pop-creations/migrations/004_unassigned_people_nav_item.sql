-- Migration 004: Add "Unassigned" sub-item under the People navigation folder
--
-- Creates a view for people who have no company assigned, then adds it as a
-- sub-item under the existing "People" FOLDER navigation menu item.
--
-- The "People" folder (id b55f5094-60fe-45a5-b176-422002efff73) currently has:
--   • Company  → people at customer companies without a department
--   • Department → people at customer companies with a department
-- This adds:
--   • Unassigned → people with no company at all
--
-- Apply with:
--   psql "$PG_DATABASE_URL" -f 004_unassigned_people_nav_item.sql

DO $$
DECLARE
  ws_schema   text;
  ws_id       uuid;
  app_id      uuid;
  person_obj_id uuid;
  view_id     uuid  := '44444444-e1a1-4b00-a001-000000000001';
  nav_id      uuid  := '44444444-e1a1-4b00-b001-000000000001';
  filter_id   uuid  := '44444444-e1a1-4b00-a001-000000000002';
  company_field_id uuid;
  people_folder_id uuid := 'b55f5094-60fe-45a5-b176-422002efff73';
BEGIN
  -- Resolve workspace schema
  SELECT schema_name INTO ws_schema
  FROM information_schema.schemata
  WHERE schema_name LIKE 'workspace_%' LIMIT 1;

  IF ws_schema IS NULL THEN
    RAISE EXCEPTION 'No workspace schema found';
  END IF;

  -- Get workspaceId and applicationId from an existing view
  SELECT "workspaceId", "applicationId"
  INTO ws_id, app_id
  FROM core.view LIMIT 1;

  -- Get the person objectMetadataId
  SELECT id INTO person_obj_id
  FROM core."objectMetadata"
  WHERE "nameSingular" = 'person' LIMIT 1;

  -- Get the company fieldMetadataId on the person object
  SELECT fm.id INTO company_field_id
  FROM core."fieldMetadata" fm
  WHERE fm."objectMetadataId" = person_obj_id
    AND fm.name = 'company'
  LIMIT 1;

  -- Create the "Unassigned" view (people with no company)
  -- NOTE: type must be 'TABLE' (uppercase enum value); icon is required
  INSERT INTO core.view
    (id, name, type, icon, "objectMetadataId", "workspaceId", "universalIdentifier", "applicationId", "isCompact", visibility)
  SELECT
    view_id,
    'Unassigned',
    'TABLE',
    'IconUserOff',
    person_obj_id,
    ws_id,
    uuid_generate_v4(),
    app_id,
    false,
    'WORKSPACE'
  WHERE NOT EXISTS (SELECT 1 FROM core.view WHERE id = view_id);

  -- Add filter: company IS_EMPTY
  IF company_field_id IS NOT NULL THEN
    INSERT INTO core."viewFilter"
      (id, "viewId", "fieldMetadataId", operand, value, "workspaceId", "universalIdentifier", "applicationId")
    SELECT
      filter_id,
      view_id,
      company_field_id,
      'IS_EMPTY',
      '[]',
      ws_id,
      uuid_generate_v4(),
      app_id
    WHERE NOT EXISTS (SELECT 1 FROM core."viewFilter" WHERE id = filter_id);
  END IF;

  -- Add navigation menu item under the People folder
  INSERT INTO core."navigationMenuItem"
    (id, name, type, "viewId", "folderId", position, "workspaceId", "universalIdentifier", "applicationId")
  SELECT
    nav_id,
    'Unassigned',
    'VIEW',
    view_id,
    people_folder_id,
    3,
    ws_id,
    uuid_generate_v4(),
    app_id
  WHERE NOT EXISTS (SELECT 1 FROM core."navigationMenuItem" WHERE id = nav_id);

  RAISE NOTICE 'Unassigned People nav item created (view %, nav %)', view_id, nav_id;
END $$;
