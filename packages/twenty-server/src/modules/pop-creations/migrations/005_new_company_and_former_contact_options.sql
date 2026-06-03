-- Migration 005: Fix SELECT field options for New Company and Former Contact
--
-- Applied manually to production on 2026-05-20. Documents three changes:
--
-- 1. customerStatus on Company — rename UNASSIGNED label from "Unassigned" to "New Company"
--    Reason: "New Company" better communicates that auto-imported companies are simply
--    unclassified, not deprecated.
--
-- 2. companyCustomerStatus on Person — add missing UNASSIGNED/"New Company" option
--    Reason: the option was entirely absent from the DB (TypeScript had an invalid UUID
--    d5e6f7a8-b9c0-4d1e-2f3a-... whose 4th group started with '2', not 8/9/a/b).
--    The metadata sync silently skipped inserting it. Fixed UUID:
--    d5e6f7a8-b9c0-4d1e-af3a-4b5c6d7e8f9a (4th group now 'af3a').
--    Without this option, people linked to New Company accounts were invisible in the
--    grouped People navigation view.
--
-- 3. contactType on Person — add FORMER_CONTACT option
--    Reason: marks contacts no longer active at their company; auto-sets scope to IGNORED
--    to exclude them from email routing.
--
-- All three statements are idempotent.
--
-- Apply with:
--   docker exec twenty-postgres psql -U twenty -d twenty \
--     -f 005_new_company_and_former_contact_options.sql

-- Fix 1: rename customerStatus UNASSIGNED label
UPDATE core."fieldMetadata"
SET options = (
  SELECT jsonb_agg(
    CASE
      WHEN opt->>'value' = 'UNASSIGNED'
      THEN opt || '{"label": "New Company"}'::jsonb
      ELSE opt
    END
  )
  FROM jsonb_array_elements(options) AS opt
)
WHERE name = 'customerStatus'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(options) o
    WHERE o->>'value' = 'UNASSIGNED' AND o->>'label' != 'New Company'
  );

-- Fix 2: add UNASSIGNED option to companyCustomerStatus on Person
UPDATE core."fieldMetadata"
SET options = options || '[{
  "id": "d5e6f7a8-b9c0-4d1e-af3a-4b5c6d7e8f9a",
  "color": "red",
  "label": "New Company",
  "value": "UNASSIGNED",
  "position": 3
}]'::jsonb
WHERE name = 'companyCustomerStatus'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(options) o WHERE o->>'value' = 'UNASSIGNED'
  );

-- Fix 3: add FORMER_CONTACT option to contactType on Person
UPDATE core."fieldMetadata"
SET options = options || '[{
  "id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
  "color": "red",
  "label": "Former Contact",
  "value": "FORMER_CONTACT",
  "position": 8
}]'::jsonb
WHERE name = 'contactType'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(options) o WHERE o->>'value' = 'FORMER_CONTACT'
  );
