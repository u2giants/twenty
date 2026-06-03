-- Migration 006: Rename "Unassigned" People nav item to "No Company"; fix companyCustomerStatus description
--
-- The "Unassigned" view and nav menu item were created by migration 004. They show
-- people with no company assigned (company IS_EMPTY filter). "No Company" is clearer.
--
-- The companyCustomerStatus field description was a stale technical string. Replace
-- with a user-facing explanation so it appears as a helpful tooltip in the record view.
--
-- All statements are idempotent.
--
-- Apply with:
--   docker exec twenty-postgres psql -U twenty -d twenty \
--     -f 006_rename_unassigned_nav_item_and_fix_field_description.sql

-- Fix 1: rename the People view
UPDATE core.view
SET name = 'No Company'
WHERE id = '44444444-e1a1-4b00-a001-000000000001'
  AND name = 'Unassigned';

-- Fix 2: rename the navigation menu item
UPDATE core."navigationMenuItem"
SET name = 'No Company'
WHERE id = '44444444-e1a1-4b00-b001-000000000001'
  AND name = 'Unassigned';

-- Fix 3: update companyCustomerStatus field description
UPDATE core."fieldMetadata"
SET description = 'Auto-synced from the linked Company. Set the Company''s status to route this person''s emails correctly.'
WHERE name = 'companyCustomerStatus';
