# HANDOFF

In-progress work that requires explicit user authorization or is blocked on an external step.
Delete this file when all items are resolved.

---

## 1. Force-push `v28-refork` to `origin/main`

**Status:** waiting for user authorization

**What it does:**
```bash
git push origin v28-refork:main --force
```

**Why it's needed:**
- Coolify reads `docker-compose.yaml` from `origin/main`. The compose file exists on `origin/main`
  (v1.20 era) but not on `v28-refork`. Once `v28-refork` is `main`, the branch and the deployed
  image are aligned.
- The CI pipeline (item 2 below) can only trigger on pushes to `main`.
- The GitHub repo will correctly reflect the production codebase.

**What it destroys:**
- `origin/main` currently holds the v1.20 codebase. After the force-push it will be gone from `main`
  (it will still exist on the `v28-refork` branch's pre-push history, and v1.20 tags exist).
- The old `build-and-push.yml` CI workflow (wired to Twenty's infra) will be replaced.

**Pre-flight checklist (complete before authorizing):**
- [ ] Confirm `crm.designflow.app` is stable on the current v2.8 image
- [ ] Confirm nightly backup ran successfully in the last 24 hours
- [ ] Confirm no open PRs on `origin/main` that need preserving
- [ ] Have the Coolify token ready at `/tmp/coolify_token.txt` (chmod 600)

**Authorization required:** explicit "do it" from the user in this session.

---

## 2. Wire CI/CD pipeline for `v28-refork`

**Status:** blocked on item 1 (force-push to main)

**What it does:**
After the force-push, adapt the GitHub Actions workflow so that a push to `main` automatically:
1. Builds the Docker image from `packages/twenty-docker/twenty/Dockerfile`
2. Pushes it to `ghcr.io/u2giants/twenty:latest`
3. Triggers a Coolify redeploy via `http://localhost:8000/api/v1/deploy?uuid=rd261bt0wy7ifjrkoe1tkl92&force=true`

**Template:** `/worksp/twenty/fork/.github/workflows/build-and-push.yml`

**Secrets needed in GitHub repo settings:**
- `GHCR_TOKEN` (or use `GITHUB_TOKEN` with `packages: write` permission)
- `COOLIFY_TOKEN` (the Coolify personal access token)

**Note:** The Coolify API is accessible at `http://localhost:8000` only from the VPS itself. The
GitHub Actions runner cannot reach it directly. Options:
- Add a self-hosted runner on the VPS
- Use an SSH action step to trigger the Coolify API via SSH

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
