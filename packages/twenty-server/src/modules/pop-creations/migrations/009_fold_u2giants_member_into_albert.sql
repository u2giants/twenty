-- Migration 009: Fold the u2giants@gmail.com workspace member into albert@popcre.com
--
-- albert@popcre.com and u2giants@gmail.com are the same person (Albert). The
-- Gmail account exists as a separate, low-activity "Albert Test" member and a
-- separate core.user. Twenty has no user-merge feature and authenticates by a
-- unique email, so the two logins cannot share one user object without an auth
-- code change (explicitly out of scope). Instead we consolidate ownership of all
-- workspace data onto Albert's member, and the Google SSO button is greyed out in
-- the frontend so the Gmail login can no longer be used. Nothing is deleted: the
-- u2giants core.user, userWorkspace, role assignment, and workspaceMember rows
-- are all left intact (dormant).
--
-- Blast radius (full uuid-column scan of the workspace schema, only these hold
-- the u2giants member id):
--   - messageParticipant.workspaceMemberId       : 115 rows -> reassign to Albert
--   - calendarEventParticipant.workspaceMemberId  :   2 rows -> reassign to Albert
--   - workspaceMember.id / .updatedByWorkspaceMemberId : the member row itself (kept)
-- No company/opportunity/task ownership, no connected account, no favorites.
-- Participant rows keep their original handle (u2giants@gmail.com); only the
-- workspaceMember link moves, attributing that activity to Albert.
--
-- Reversible: re-run the two UPDATEs swapping the ids
-- (ALBERT_MEMBER -> U2GIANTS_MEMBER) to undo, before any new sync repopulates.
--
-- Apply with:
--   docker exec -i twenty-postgres psql -U twenty -d twenty \
--     < packages/twenty-server/src/modules/pop-creations/migrations/009_fold_u2giants_member_into_albert.sql

DO $$
DECLARE
  ws             text := 'workspace_93r34ew9zc9644a9y5f1yeylz';
  albert_member  uuid := '9c336883-8834-4823-839e-5af5828910e3'; -- albert@popcre.com
  u2giants_member uuid := '80b8a522-e853-48a8-8b63-1f2c0d95765b'; -- u2giants@gmail.com ("Albert Test")
  moved_msg      bigint;
  moved_cal      bigint;
  residual       bigint;
BEGIN

  -- Step 1: reassign synced message participation to Albert's member.
  EXECUTE format(
    'UPDATE %I.%I SET "workspaceMemberId" = %L WHERE "workspaceMemberId" = %L',
    ws, 'messageParticipant', albert_member, u2giants_member
  );
  GET DIAGNOSTICS moved_msg = ROW_COUNT;

  -- Step 2: reassign synced calendar participation to Albert's member.
  EXECUTE format(
    'UPDATE %I.%I SET "workspaceMemberId" = %L WHERE "workspaceMemberId" = %L',
    ws, 'calendarEventParticipant', albert_member, u2giants_member
  );
  GET DIAGNOSTICS moved_cal = ROW_COUNT;

  RAISE NOTICE 'Reassigned % messageParticipant and % calendarEventParticipant rows to Albert.',
    moved_msg, moved_cal;

  -- Step 3: safety check — no relation FK should still point at the u2giants
  -- member (the workspaceMember row itself is intentionally retained, so it is
  -- excluded from this assertion).
  EXECUTE format(
    'SELECT count(*) FROM %I.%I WHERE "workspaceMemberId" = %L',
    ws, 'messageParticipant', u2giants_member
  ) INTO residual;
  IF residual <> 0 THEN
    RAISE EXCEPTION 'Residual messageParticipant rows still linked to u2giants: %', residual;
  END IF;

END $$;
