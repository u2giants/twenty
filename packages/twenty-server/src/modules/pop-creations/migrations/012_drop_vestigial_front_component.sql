-- Migration 012: Drop the vestigial PersonDepartmentPicker front-component row
--
-- WHY: production-drift audit (2.8_upgrade.md §12) found a `core.frontComponent` row
-- "PersonDepartmentPicker" (6c302daf-4568-49ef-a5db-fb3765ccc78f) owned by the
-- "POP Creations CRM" app that is referenced by NOTHING — no page-layout widget, no
-- command-menu item, no app setting — and has no corresponding code (its function was
-- absorbed into the native relation/department picker during the SDK→native conversion).
-- It is a leftover from the old SDK front-component approach. Remove it.
--
-- This deletes a single orphaned row. It intentionally does NOT touch the other three
-- front components (DepartmentDashboard / ProgramFolio back live page-layout widgets;
-- MondayMorningDashboard is referenced by a command-menu item).
--
-- Idempotent (guarded by id + "no references" check). Apply with:
--   docker exec -i twenty-postgres psql -U twenty -d twenty \
--     < packages/twenty-server/src/modules/pop-creations/migrations/012_drop_vestigial_front_component.sql

DO $$
DECLARE
  fc_id uuid := '6c302daf-4568-49ef-a5db-fb3765ccc78f';
  ref_count int;
BEGIN
  -- Safety: only delete if genuinely unreferenced
  SELECT
    (SELECT count(*) FROM core."pageLayoutWidget" w WHERE w.configuration::text LIKE '%'||fc_id::text||'%')
  + (SELECT count(*) FROM core."commandMenuItem" c WHERE c."frontComponentId" = fc_id)
  + (SELECT count(*) FROM core.application a WHERE a."settingsCustomTabFrontComponentId" = fc_id)
  INTO ref_count;

  IF ref_count > 0 THEN
    RAISE NOTICE 'PersonDepartmentPicker (%) is referenced (% refs) — NOT deleting', fc_id, ref_count;
  ELSE
    DELETE FROM core."frontComponent" WHERE id = fc_id;
    RAISE NOTICE 'Dropped vestigial front-component PersonDepartmentPicker (%)', fc_id;
  END IF;
END $$;
