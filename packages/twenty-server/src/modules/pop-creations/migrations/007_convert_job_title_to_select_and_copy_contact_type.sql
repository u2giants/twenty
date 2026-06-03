-- Migration 007: Convert jobTitle from TEXT to SELECT; copy contactType values
--
-- jobTitle was changed to a SELECT field in TypeScript in a previous session but
-- the DB was never updated. This migration applies the conversion and copies
-- existing contactType values into jobTitle so jobTitle can replace contactType
-- as the visible classification field.
--
-- Data notes:
--   - 15 records had contactType set (13 BUYER, 2 ASSISTANT_BUYER) — copied to jobTitle
--   - 2 records had free-text jobTitle values ("VP DMM", "Vice President") that
--     cannot map to an enum value — cleared to NULL
--   - The listener now reads jobTitle (not contactType) for scope auto-assignment
--
-- Apply with:
--   docker exec -i twenty-postgres psql -U twenty -d twenty \
--     < 007_convert_job_title_to_select_and_copy_contact_type.sql

DO $$
DECLARE
  ws text := 'workspace_93r34ew9zc9644a9y5f1yeylz';
BEGIN

  -- Step 1: add FORMER_CONTACT to the contactType enum (was added to JSONB options
  -- in migration 005 but never added to the actual PostgreSQL enum type).
  -- Use %I for both schema and type name to preserve mixed-case type names.
  EXECUTE format(
    'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''FORMER_CONTACT''',
    ws, 'person_contactType_enum'
  );

  -- Step 2: create the jobTitle enum with all 9 values (skip if already exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = ws AND t.typname = 'person_jobTitle_enum'
  ) THEN
    EXECUTE format(
      'CREATE TYPE %I.%I AS ENUM (
        ''BUYER'', ''ASSISTANT_BUYER'', ''PLANNER'',
        ''CHINA_OFFICE'', ''LOGISTICS'', ''LEGAL'', ''FINANCE'',
        ''OTHER'', ''FORMER_CONTACT''
      )',
      ws, 'person_jobTitle_enum'
    );
  END IF;

  -- Step 3: clear free-text jobTitle values that cannot be cast to the enum
  EXECUTE format(
    'UPDATE %I.person
     SET "jobTitle" = NULL
     WHERE "jobTitle" IS NOT NULL
       AND "jobTitle" NOT IN (
         ''BUYER'', ''ASSISTANT_BUYER'', ''PLANNER'',
         ''CHINA_OFFICE'', ''LOGISTICS'', ''LEGAL'', ''FINANCE'',
         ''OTHER'', ''FORMER_CONTACT''
       )',
    ws
  );

  -- Step 4: convert the jobTitle column from TEXT to the new enum (skip if already done).
  -- jobTitle is in the searchVector generated column, so drop searchVector first.
  -- searchVector will be recreated by workspace:sync-metadata after deploy
  -- (jobTitle was removed from SEARCH_FIELDS_FOR_PERSON since SELECT values are
  -- not useful for full-text search).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ws AND table_name = 'person'
      AND column_name = 'jobTitle' AND data_type = 'text'
  ) THEN
    EXECUTE format('ALTER TABLE %I.person DROP COLUMN IF EXISTS "searchVector"', ws);

    EXECUTE format(
      'ALTER TABLE %I.person
       ALTER COLUMN "jobTitle" TYPE %I.%I
       USING "jobTitle"::%I.%I',
      ws, ws, 'person_jobTitle_enum', ws, 'person_jobTitle_enum'
    );

    -- Recreate searchVector without jobTitle (enum values are not free text;
    -- workspace:sync-metadata would regenerate this, but we do it here so the
    -- column is immediately available without waiting for a deploy+sync cycle).
    EXECUTE format(
      $sv$ALTER TABLE %I.person ADD COLUMN IF NOT EXISTS "searchVector" tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple'::regconfig,
          ((((((((((((((((((((((COALESCE(unaccent_immutable("nameFirstName"), ''::text) || ' '::text)
            || COALESCE(unaccent_immutable("nameLastName"), ''::text)) || ' '::text)
            || COALESCE(unaccent_immutable("emailsPrimaryEmail"), ''::text)) || ' '::text)
            || COALESCE(unaccent_immutable(split_part("emailsPrimaryEmail", '@'::text, 2)), ''::text)) || ' '::text)
            || COALESCE(unaccent_immutable(translate(("emailsAdditionalEmails")::text, '[]",'::text, '    '::text)), ''::text)) || ' '::text)
            || COALESCE(unaccent_immutable(translate(replace(("emailsAdditionalEmails")::text, '@'::text, ' '::text), '[]",'::text, '    '::text)), ''::text)) || ' '::text)
            || COALESCE("phonesPrimaryPhoneNumber", ''::text)) || ' '::text)
            || COALESCE("phonesPrimaryPhoneCallingCode", ''::text)) || ' '::text)
            || COALESCE(("phonesPrimaryPhoneCallingCode" || "phonesPrimaryPhoneNumber"), ''::text)) || ' '::text)
            || COALESCE((replace("phonesPrimaryPhoneCallingCode", '+'::text, ''::text) || "phonesPrimaryPhoneNumber"), ''::text)) || ' '::text)
            || COALESCE(('0'::text || "phonesPrimaryPhoneNumber"), ''::text)) || ' '::text)
            || COALESCE(translate(regexp_replace(("phonesAdditionalPhones")::text, '"(number|countryCode|callingCode)"\s*:\s*'::text, ''::text, 'g'::text), '[]{}",:'::text, '        '::text), ''::text))
        )
      ) STORED$sv$,
      ws
    );
  END IF;

  -- Step 5: copy contactType → jobTitle for records that have contactType set
  -- and no jobTitle yet
  EXECUTE format(
    'UPDATE %I.person
     SET "jobTitle" = "contactType"::text::%I.%I
     WHERE "contactType" IS NOT NULL AND "jobTitle" IS NULL',
    ws, ws, 'person_jobTitle_enum'
  );

  RAISE NOTICE 'Migration 007 complete';
END $$;

-- Step 6: update fieldMetadata to mark jobTitle as SELECT with all 9 options
UPDATE core."fieldMetadata"
SET
  type = 'SELECT',
  options = '[
    {"id": "f4818edf-be39-48ed-91e1-896249f92834", "color": "blue",      "label": "Buyer",           "value": "BUYER",           "position": 0},
    {"id": "09fa2c27-1ce6-4059-b603-70c1c94f11c6", "color": "sky",       "label": "Assistant Buyer", "value": "ASSISTANT_BUYER", "position": 1},
    {"id": "8d8bf9bf-da25-4c49-be9d-2e191061e3d5", "color": "purple",    "label": "Planner",         "value": "PLANNER",         "position": 2},
    {"id": "e3e9986d-c38f-4d68-b840-e509cb58f090", "color": "orange",    "label": "China Office",    "value": "CHINA_OFFICE",    "position": 3},
    {"id": "95aed2b7-f7d4-4e1e-ab2e-5909b97717fc", "color": "green",     "label": "Logistics",       "value": "LOGISTICS",       "position": 4},
    {"id": "271d6ed3-812e-4452-8fef-6b9bc7274ba3", "color": "yellow",    "label": "Legal",           "value": "LEGAL",           "position": 5},
    {"id": "d588170a-50f5-437b-b5aa-edd0a07844ac", "color": "turquoise", "label": "Finance",         "value": "FINANCE",         "position": 6},
    {"id": "f4d8b1cb-993e-42db-9169-3dd8e36af740", "color": "gray",      "label": "Other",           "value": "OTHER",           "position": 7},
    {"id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d", "color": "red",      "label": "Former Contact",  "value": "FORMER_CONTACT",  "position": 8}
  ]'::jsonb,
  description = 'Role at this company. Controls email routing scope.'
WHERE name = 'jobTitle';
