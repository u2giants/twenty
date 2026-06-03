# HANDOFF

In-progress work that requires explicit user authorization or is blocked on an external step.
Delete this file when all items are resolved.

---

## 1. Get `v28-refork` onto `origin/main`

**Status:** waiting for branch protection to be disabled in GitHub repo settings

**Blocked by:** GitHub repo rule — "Cannot force-push to this branch" and "Cannot create ref due to creations being restricted"

**What needs to happen:**
1. Go to github.com/u2giants/twenty → Settings → Rules → disable/delete the ruleset blocking force-push and branch creation
2. Run: `git push origin v28-refork:main --force`
3. Re-enable branch protection if desired (but allow the `build-and-push.yml` workflow to push to GHCR)

**Why it's needed:**
- The GitHub repo currently shows v1.20 codebase on `main`. The production image is v2.8.3 but the repo doesn't reflect it.
- Once `main` is updated, the CI workflow (already committed at `.github/workflows/build-and-push.yml`) will trigger automatically on every future push.

**What it replaces on `origin/main`:**
- The v1.20 codebase and its old `build-and-push.yml` (which dispatched to Twenty's own infra)

**CI workflow is already committed and ready** — `.github/workflows/build-and-push.yml` and required GitHub Secrets (`COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_SERVER_UUID`) are already in place. The workflow will activate the moment this branch becomes `main`.

---

## 3. Phase E deferred frontend components (non-blocking)

**Status:** open, non-blocking — production is functional without these

Five frontend components were reset to v2.8.3 base during the re-fork because the diffs were
complex and the features weren't critical for launch:

- `packages/twenty-front/src/modules/object-metadata/components/FrontComponentRenderer.tsx`
- `packages/twenty-front/src/modules/object-record/hooks/useFrontComponentExecutionContext.ts`
- `packages/twenty-front/src/modules/object-record/field/hooks/useFieldListFieldMetadataItems.ts`
- `packages/twenty-front/src/modules/navigation/hooks/useNavigationMenuItemFolderOpenState.ts`
- `packages/twenty-front/src/modules/navigation/components/NavigationMenuItemFolderDnd.tsx`

These need to be re-ported from `/worksp/twenty/fork` with the v1.20 POP changes re-applied on
top of the v2.8.3 base. Behavior impact: some navigation folder state and field list ordering
may differ from the v1.20 UX.

---

## 4. Connected account re-auth (non-blocking)

**Status:** open, low priority

Two Microsoft connected accounts may need re-linking in the CRM UI. The v2.7 migration moved
`connectedAccount` from the workspace schema to the core schema — existing OAuth tokens may have
been invalidated. If Outlook ingestion or personal calendar sync stops working for a specific user,
have them go to Settings → Connected accounts → disconnect → reconnect.

This does not affect the service-account `AZURE_CLIENT_SECRET`-based ingestion (which uses env
vars, not connected accounts).
