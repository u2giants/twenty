# AGENTS.md

Primary operating guide for developers and AI coding sessions on this repo. Read this first.
Then read the relevant file in `docs/` for the area you are working in.

> There is no universal ignore-file standard across AI coding tools.
>
> `.claudeignore` works for Claude Code. `.cursorignore` works for Cursor.
>
> When using any other AI tool, paste this file as your first message and follow the instructions
> in the **"9. What to ignore"** section below.

---

## 1. Project summary

This is a **production fork of [Twenty CRM](https://twenty.com) v2.8.3** operated by Pop Creations
(`popcre.com`) under the designflow brand. It is live at **`https://crm.designflow.app`**.

The business purpose is an **inbound-email-routing CRM**. A cron job polls a shared Outlook mailbox
via Microsoft Graph every 15 minutes, creates an `emailMessage` record for each message, and the
**email router** classifies it to the correct customer **company / department / program (opportunity)**
using a multi-step pipeline: domain lookup → thread scan → subject history → company name fuzzy →
department narrowing → SO/PO regex → AI fallback. Around that core the fork adds custom objects
(factories, licensor-approval threads, meeting notes), AI opportunity summaries, a Fireflies
meeting-transcript webhook, and a ClickUp status sync.

All project-specific code lives in `pop-creations/` subtrees, leaving upstream Twenty files as close
to stock as possible. The outcome that matters: emails land on the right customer record automatically.

---

## 2. Repository structure

This is the upstream Twenty monorepo (Nx + Yarn workspaces) with a project-owned overlay.

| Area | Path | Ownership |
|---|---|---|
| **Our backend code** | `packages/twenty-server/src/modules/pop-creations/` | project-owned |
| **Our custom-object metadata** | `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` (POP entries) + `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/pop-creations/` | project-owned (lives in framework files) |
| **Our frontend code** | `packages/twenty-front/src/modules/pop-creations/` | project-owned |
| **Our SQL migrations** | `packages/twenty-server/src/modules/pop-creations/migrations/` | project-owned (hand-applied) |
| **Docs** | `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/`, `HANDOFF.md` | project-owned |
| **Deployment** | `docker-compose.yaml` (on `origin/main`), `packages/twenty-docker/twenty/Dockerfile` | project-owned |
| **Ops scripts** | `ops/backup/create-backup.sh` (lives in `fork` worktree, not refork) | project-owned |
| Upstream framework code | everything else under `packages/twenty-*` | third-party (Twenty) |
| Generated code | `packages/twenty-front/src/generated*/`, `**/locales/generated/`, `*/metadata/generated/` | generated — do not hand-edit |
| Build artifacts | `dist/`, `.nx/cache/`, `node_modules/`, `.twenty/` | not in scope (see §9) |

**Branch status:** this codebase lives on the `v28-refork` git branch, which has not yet been
force-pushed to `origin/main`. The Coolify deploy reads `docker-compose.yaml` from `origin/main`
(v1.20 era) but the compose file only references the GHCR image — production is running this v2.8
code via `ghcr.io/u2giants/twenty:latest`. See §14 (pending: force-push to main).

---

## 3. Prime Directive: custom-code boundary

**Our custom code lives here:**

- `packages/twenty-server/src/modules/pop-creations/`
- `packages/twenty-front/src/modules/pop-creations/`
- `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` (POP entries only)
- `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/pop-creations/`
- `docs/`, deployment files

**Everything else is upstream Twenty and requires justification before touching.** When a framework
file must change, make it **additive**, keep the diff **small**, and record it in §4. Do not spread
project logic across unrelated framework files — that is the most expensive upgrade-debt a session
can incur.

Trust **active entry points** over directory shape: Nest module registration (`pop-creations.module.ts`),
`STANDARD_OBJECTS` in `standard-object.constant.ts`, and `CronRegisterAllCommand` tell you what
actually runs. The repo may contain historical artifacts — do not infer behavior from a folder alone.

---

## 4. Core modification inventory

Files **outside** project-owned areas that were modified, and why.

| File | Change | Why necessary | Upgrade risk |
|---|---|---|---|
| `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` | Added 8 POP objects (aiModelConfig, department, emailMessage, factory, ignoreRule, licensorApprovalThread, meetingNote, meetingNoteAttendee) + POP fields on company/person/opportunity | Only way to register standard objects in v2.8 | Re-apply POP entries after upstream merge |
| `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/compute-company-standard-flat-field-metadata.util.ts` (+ person, opportunity) | Register custom fields in the metadata pipeline | Fields must be in metadata maps to exist in the GraphQL schema | Merge conflict; re-apply field block |
| `packages/twenty-server/src/engine/core-modules/message-queue/jobs.module.ts` | Import `PopCreationsModule` to make POP cron services injectable | Without this, cron job classes are not in the DI container | Re-add import after upstream merge |
| `packages/twenty-server/src/database/commands/cron-register-all.command.ts` | Add 4 POP cron commands (OutlookIngest, EmailRerouter, ClickUpSync, EmailContactSync) | `CronRegisterAllCommand` is a hardcoded list — not auto-discovered | Re-add entries after upstream merge |
| `packages/twenty-server/src/database/commands/database-command.module.ts` | Import `PopCreationsModule` + declare 4 POP cron command providers | Database CLI module must declare all providers it uses | Re-add after upstream merge |
| `packages/twenty-server/src/modules/company/standard-objects/company.workspace-entity.ts` | Added custom fields (`customerStatus`, `chainType`, `routingAliases`, `routingDomain`, etc.) | No extension point for standard-object fields | Merge conflict; re-apply field block |
| `packages/twenty-server/src/modules/person/standard-objects/person.workspace-entity.ts` | Added `contactType`, `scope`, department relations | same | Merge conflict |
| `packages/twenty-server/src/modules/opportunity/standard-objects/opportunity.workspace-entity.ts` | Added ~23 program fields (PO#, factory, season, stage, etc.) | same | Merge conflict |
| `packages/twenty-server/src/modules/messaging/message-import-manager/drivers/gmail/utils/parse-gmail-message.util.ts` (+ `parse-and-format-gmail-message.util.ts`) | Preserve display names from RFC 2822 `From:` header (use `safeParseEmailAddresses` not `safeParseEmailAddressAddress`) | Router uses display names to disambiguate shared-domain senders | Merge conflict |
| `packages/twenty-front/src/modules/object-record/object-filter-dropdown/components/ObjectFilterDropdownRecordSelect.tsx` | Restrict company filter to customer companies when filtering People records | No extension point | Merge conflict |
| `packages/twenty-front/src/modules/object-record/select/hooks/useRecordsForSelect.ts` | Added `filterOverride` param for scoped dropdown | Required by the company-filter restriction above | Merge conflict |
| `packages/twenty-front/src/modules/activities/components/ParticipantChip.tsx` | Right-click context menu to open People record | No extension point | Low risk |

---

## 5. Task-to-file navigation

| Task | Files to touch | Files NOT to touch |
|---|---|---|
| Change email-routing logic | `pop-creations/services/email-router.service.ts` | core messaging engine |
| Change Outlook ingestion | `pop-creations/crons/jobs/outlook-ingest.cron.job.ts` | native `message-import-manager` |
| Add a custom object | New `pop-creations/standard-objects/<obj>.workspace-entity.ts` + new `field-metadata/pop-creations/compute-<obj>-standard-flat-field-metadata.util.ts` + register in `STANDARD_OBJECTS` in `standard-object.constant.ts` | other standard objects' metadata |
| Add a field to company/person/opportunity | The upstream `*.workspace-entity.ts` + matching `compute-*-standard-flat-field-metadata.util.ts` (see §4) | unrelated standard objects |
| Schema / data change | A **new numbered SQL file** in `pop-creations/migrations/` (applied manually; see protocol below) | already-applied migration files |
| Add a cron job | New `crons/jobs/<name>.cron.job.ts` + `crons/commands/<name>.cron.command.ts` → register in ALL THREE: `pop-creations.module.ts`, `jobs.module.ts`, AND `cron-register-all.command.ts` + `database-command.module.ts` | other cron jobs' logic |
| Add/modify an automation listener | `pop-creations/listeners/` or `pop-creations/logic-functions/*/listeners/` — use `@OnDatabaseBatchEvent` (v2.8); register in `pop-creations.module.ts` | upstream listeners |
| Add a frontend hook | `pop-creations/hooks/` | core hooks |
| Change deploy/build | `docker-compose.yaml` (on `origin/main` — see §12), `packages/twenty-docker/twenty/Dockerfile` | production `.env` (lives in Coolify) |
| Add an env var | `docs/configuration.md` + the consuming code | production env directly (set it in Coolify) |

**Migration protocol (strict):** schema/data changes go into a **new numbered SQL file** in
`pop-creations/migrations/`. **Commit the file first, then apply it** with:
```bash
docker exec -i twenty-postgres psql -U twenty -d twenty \
  < packages/twenty-server/src/modules/pop-creations/migrations/NNN_name.sql
```
Migrations are **hand-applied SQL, not TypeORM**. Write idempotently (every migration here is re-runnable).

**Cron registration is THREE places in v2.8** (unlike v1.20 which only needed `jobs.module.ts`):
1. `pop-creations.module.ts` — declares the provider
2. `engine/core-modules/message-queue/jobs.module.ts` — imports `PopCreationsModule` so the DI container can resolve the command
3. `database/commands/cron-register-all.command.ts` — adds the command to the hardcoded execution list
4. `database/commands/database-command.module.ts` — declares the provider for the database CLI context

---

## 6. Data model and external identifiers

**Custom workspace objects** (8 code-defined in `pop-creations/standard-objects/`):
`department`, `emailMessage`, `factory`, `ignoreRule`, `licensorApprovalThread`,
`meetingNote`, `meetingNoteAttendee`, `aiModelConfig`.

**Standard objects extended with POP fields:**
`company` (customerStatus, chainType, routingAliases, routingDomain, etc.),
`person` (contactType, scope, department relation),
`opportunity` (~23 program fields: PO#, factory, season, stage, buyer name, etc.)

| Entity / System | Identifier | Where defined | Notes |
|---|---|---|---|
| Production workspace | `99c80ca1-610f-48b5-bd1f-9178201bdcb7` | DB `core.workspace` | the only active workspace |
| Workspace DB schema | `workspace_93r34ew9zc9644a9y5f1yeylz` | Postgres | per-workspace tables live here |
| "Twenty Standard" app | `58dd163b-b4d9-4b30-aca8-23b41518741d` | `core.application` | hosts code-defined custom objects |
| Internal email domain | `popcre.com` | email-router / crons | sender from this domain = internal |
| Coolify app | `rd261bt0wy7ifjrkoe1tkl92` | Coolify | production deploy target |
| Production VPS | `178.156.180.212` | Coolify host | SSH for inspection only — not a deploy path |
| GHCR image | `ghcr.io/u2giants/twenty:latest` | GHCR | single image for server + worker |

Saved views and sidebar nav (`Needs Routing`, `Unrouted Emails`, `Unrouted Notes`) are reproduced by
migrations `010`/`011`. Do not casually rename or regenerate workspace identifiers — migrations and
views key off them.

---

## 7. Container and service inventory

| Container / service | Purpose | Managed by | Image / source |
|---|---|---|---|
| `server-rd261bt0wy7ifjrkoe1tkl92-*` | NestJS API, GraphQL, static frontend, DB migrations on startup, cron registration | Coolify | `ghcr.io/u2giants/twenty:latest` |
| `worker-rd261bt0wy7ifjrkoe1tkl92-*` | BullMQ queue/cron processor | Coolify | **same image** (diverges by command: `node dist/queue-worker/queue-worker`) |
| `twenty-postgres` | PostgreSQL 16 | host Docker | `postgres:16-alpine` |
| `twenty-redis` | queue/cache backend | host Docker | `redis:7-alpine` |

The container name suffix (e.g. `-142630522776`) changes each Coolify redeploy. Filter by
`server-rd261bt0wy7ifjrkoe1tkl92` or `worker-rd261bt0wy7ifjrkoe1tkl92` prefix.

`docker-compose.yaml` declares `server` + `worker`. Postgres and Redis are external (not in compose);
reached via `PG_DATABASE_URL` / `REDIS_URL` env vars.

Cron schedules (all run in the **worker** container):

| Cron job | Schedule | What it does |
|---|---|---|
| `OutlookIngest` | every 15 min | Polls `OUTLOOK_MAILBOX` via Microsoft Graph; creates `emailMessage` records |
| `EmailRerouter` | every 6 hours | Re-evaluates `UNROUTED` emailMessage records against current data |
| `ClickUpSync` | 7am daily | Syncs opportunity stage from ClickUp API |
| `EmailContactSync` | 2am daily | Syncs person email addresses to contact records |

---

## 8. Local development

Full detail: [docs/development.md](./docs/development.md). Quick form:

```bash
yarn install
npx nx reset:env twenty-server   # scaffold packages/twenty-server/.env
npx nx reset:env twenty-front    # scaffold packages/twenty-front/.env
yarn start                        # server + worker + front (all three)
```

Typecheck before committing:
```bash
npx nx typecheck twenty-server
npx nx typecheck twenty-front
```

---

## 9. What to ignore

These exist but are not relevant to active development (mirrored in `.claudeignore`):

- `dist/`, `node_modules/`, `.nx/cache/`, `.yarn/cache/`, `coverage/`, `.twenty/`
- Generated: `**/generated*/`, `**/locales/generated/`, `*/metadata/generated/`
- Unused packages: `twenty-companion`, `twenty-sdk`, `twenty-client-sdk`,
  `twenty-front-component-renderer`, `twenty-oxlint-rules`, `twenty-website`, `twenty-docs`,
  `twenty-zapier`, `twenty-e2e-testing`, `twenty-claude-skills`
- Large upstream core dirs (never modify): `twenty-front/src/pages/settings/`,
  `twenty-front/src/modules/{workflow,auth,ui}/`,
  `twenty-server/src/engine/{core-modules,metadata-modules,api}/` (except the specific files in §4)

---

## 10. Intentional quirks and non-obvious decisions

### Server and worker share one image

Looks like: they should be separate images.
Actually: one image, diverging by command and env. The server runs the default entrypoint; the worker
runs `node dist/queue-worker/queue-worker`. Worker has `DISABLE_DB_MIGRATIONS=true` and
`DISABLE_CRON_JOBS_REGISTRATION=true` to avoid duplicate startup side effects.
Why: simpler single-image build; upstream supports it.
Do not change because: it would double the build and break the current single-image deploy.

### Cron registration requires THREE separate file edits in v2.8

Looks like: registering in `pop-creations.module.ts` or `jobs.module.ts` should be enough.
Actually: `CronRegisterAllCommand` is a hardcoded list, not auto-discovery. Adding a cron command
requires it to be a provider in the DI container (via `jobs.module.ts`) AND explicitly listed in
`cron-register-all.command.ts` AND declared in `database-command.module.ts`.
Why: that is how upstream v2.8 wired the cron registry — it was not auto-discovered in this version.
Do not change because: changing the list mechanically removes the POP crons from registration.

### Standard object IDs in `standard-object.constant.ts`, not entity files

Looks like: field UUIDs should be in the `workspace-entity.ts` files.
Actually: In v2.8, every standard object and its field UUIDs are registered in
`packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` under `STANDARD_OBJECTS`.
Each entry requires a `views: {}` key even if empty. Without it the metadata pipeline crashes.
Why: v2.8 moved field IDs to a shared constant to support cross-package metadata sharing.
Do not change because: removing or renaming entries breaks the workspace schema sync.

### `@OnDatabaseBatchEvent` — not `@OnEvent`

Looks like: `@OnEvent('opportunity.created')` from `@nestjs/event-emitter` should work.
Actually: v2.8 uses a workspace-event bus that batches records. The listener must use
`@OnDatabaseBatchEvent('opportunity', DatabaseEventAction.CREATED)` and read
`payload.events[].recordId` + `payload.events[].properties.after`. The old pattern silently no-ops.
Why: v2.8 changed the internal event architecture for multi-tenant workspace event dispatch.
Do not change because: reverting to `@OnEvent` means listeners never fire.

### Routing only considers `ACTIVE_CUSTOMER` / `POTENTIAL_CUSTOMER` companies

Looks like: a bug that excludes valid companies.
Actually: deliberate — routing against all companies produces mis-routing.
Do not change because: `UNASSIGNED` and other statuses must be excluded from routing candidates.

### `docker-compose.yaml` lives on `origin/main`, not `v28-refork`

Looks like: the deployment file is missing from the active branch.
Actually: Coolify reads `docker-compose.yaml` from `origin/main` (git branch). The compose file
points to `ghcr.io/u2giants/twenty:latest` with `pull_policy: always`, so it always runs whatever
image was last pushed — the branch the image was built from is irrelevant to Coolify's compose read.
Do not change because: when v28-refork is force-pushed to main (§14), the compose file will be there.

### `ENCRYPTION_KEY` is satisfied by `APP_SECRET`

Looks like: v2.8 requires a new `ENCRYPTION_KEY` env var.
Actually: `resolve-encryption-keys-or-throw.util.ts` resolves as `ENCRYPTION_KEY ?? APP_SECRET`.
If `APP_SECRET` is set (it is), no new variable is needed.
Do not change because: if someone adds `ENCRYPTION_KEY` separately, it must match the value used to
encrypt existing data or all encrypted fields (credentials, OAuth tokens) become unreadable.

### Raw SQL in some pop-creations code paths

Looks like: an ORM anti-pattern.
Actually: an intentional escape hatch. The TypeORM/workspace-ORM path silently returns 0 results for
cross-workspace queries initiated from the worker context. Raw SQL is the only reliable path there.
Do not change because: switching back to ORM silently no-ops.

### `@/` in twenty-front tests maps to `src/modules/`, not `src/`

Jest `moduleNameMapper` maps `@/` → `packages/twenty-front/src/modules/`. Import a file at
`src/modules/object-record/foo/bar.ts` as `@/object-record/foo/bar`. The wrong path surfaces as
a misleading "Vitest cannot be imported in a CommonJS module" error — fix the path, not the phantom
ESM problem.

---

## 11. Credentials and environment

Full list: [docs/configuration.md](./docs/configuration.md). Values live in Coolify, not in git.

| Variable | Purpose | Dev | Prod |
|---|---|---|---|
| `PG_DATABASE_URL` | Postgres connection | yes | yes |
| `REDIS_URL` | queue/cache | yes | yes |
| `APP_SECRET` | session signing + encryption key fallback | yes | yes |
| `SERVER_URL` | base URL (`https://crm.designflow.app`) | yes | yes |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Microsoft Graph (Outlook ingest) | for ingest | yes |
| `OUTLOOK_MAILBOX` | mailbox polled (`adweck@popcre.com`) | for ingest | yes |
| `OPENROUTER_API_KEY` | AI model calls (routing + summaries) | for AI | yes |
| `CLICKUP_API_TOKEN` | ClickUp status sync | for sync | yes |
| `POP_CREATIONS_WORKSPACE_ID` | target workspace for crons | yes | yes |
| `FIREFLIES_API_KEY` | Fireflies webhook receiver | optional | yes |
| `LOGIC_FUNCTION_TYPE` | must be `LOCAL` in production | — | yes |
| `ENTERPRISE_KEY` | enables OIDC/SSO guard (any non-empty value) | — | yes |

---

## 12. Deployment

**Current state:** manual build + push + Coolify API trigger. No CI pipeline is wired to this
branch yet (the old `build-and-push.yml` is on `origin/main`/v1.20 and dispatches to Twenty's own
infra — it does not apply here).

**Deploy steps:**
```bash
# From /worksp/twenty/refork
docker build -f packages/twenty-docker/twenty/Dockerfile --target twenty \
  -t ghcr.io/u2giants/twenty:latest .
docker push ghcr.io/u2giants/twenty:latest

# Trigger Coolify redeploy
curl -s -X POST "http://localhost:8000/api/v1/deploy?uuid=rd261bt0wy7ifjrkoe1tkl92&force=true" \
  -H "Authorization: Bearer <COOLIFY_TOKEN>"
```

**Coolify reads from `origin/main`** to get the `docker-compose.yaml`, then pulls `ghcr.io/u2giants/twenty:latest`.
The compose's `pull_policy: always` ensures the newly-pushed image is used every deploy.

**Rollback:** push the rollback tag (`rollback-v120-20260603` exists in GHCR) as `latest` and
redeploy via Coolify API. Do not run docker commands on the production VPS to re-tag.

**Verify deploy:**
```bash
docker logs $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92) 2>&1 | \
  grep "Cron job registration completed"
# Expect: 27 successful, 0 failed, 1 skipped (OutlookIngest, EmailRerouter, ClickUpSync, EmailContactSync included)
```

**SSH:** allowed for inspection and emergency log collection only. Never the deploy path. Never
edit source files on the server — changes won't survive the next image deploy.

**Backup:** nightly pg_dump at 23:15 UTC via systemd timer `popcre-twenty-backup.timer`.
Script: `/worksp/twenty/fork/ops/backup/create-backup.sh`
Output: `/worksp/twenty/fork/backups/twenty_nightly_<timestamp>.dump` (14-day rolling retention)

---

## 13. Critical incidents

### 2026-06-03 — OOM crash from stale staging containers

What happened: During the v1.20→v2.8 upgrade, staging containers (`twenty-staging-server`,
`twenty-staging-postgres`, `twenty-staging-redis`) were left running alongside production after
cutover. Combined memory pressure (prod + staging + several other services) caused an OOM kill.
Impact: server unreachable for ~10 minutes; auto-restarted cleanly on reboot.
Root cause: multiple full Twenty stacks running on a 16 GB VPS.
Recovery: removed stale containers; server recovered automatically.
Rule added: after any staging work, `docker rm -f` all staging containers immediately on cutover.

### 2026-06-03 — Backup service broken since 2026-05-14

What happened: `popcre-twenty-backup.service` had `ExecStart` pointing to
`/worksp/twenty/app/ops/backup/create-backup.sh` — a path from a previous directory layout
that no longer existed. Exit 127 on every scheduled run.
Recovery: wrote new script at `/worksp/twenty/fork/ops/backup/create-backup.sh`, updated the
systemd unit, re-enabled timer. Confirmed working with a manual test run.
Rule added: after any directory reorganization, check systemd unit paths.

### 2026-06-03 — POP cron jobs not scheduling (v2.8 registration gap)

What happened: All 4 POP cron jobs (`OutlookIngest`, `EmailRerouter`, `ClickUpSync`,
`EmailContactSync`) were absent from `CronRegisterAllCommand`'s list. The server started fine
but logged only 23 crons registered — the 4 POP jobs were never scheduled.
Root cause: `CronRegisterAllCommand` is a hardcoded list, not auto-discovery. Adding
`PopCreationsModule` to `jobs.module.ts` alone (commit `5ebe86cc1d`) was necessary but not
sufficient — the commands also needed to be added to `cron-register-all.command.ts` and
`database-command.module.ts` (commit `eef74bd935`).
Rule added: see §5 cron registration note; §4 inventories both required file sets.

### 2026-06-02/03 — v1.20 → v2.8 upgrade (re-fork + re-apply)

What happened: straight merge of upstream v2.8.3 into the v1.20 fork produced 1,437 conflicts (88%
from upstream file deletions). Used a "re-fork" strategy instead: pinned v2.8.3 SHA as the new base,
then ported POP code on top.
Impact: production upgraded from v1.20 to v2.8.3 with zero data loss.
Recovery: two-step `run-instance-commands --force --include-slow` then `upgrade` (v1.20 chicken-and-
egg: `upgrade` queries `core.upgradeMigration` before it exists; `--force` skips that check).
Pre-upgrade backup: `twenty_preupgrade_20260602_204355.dump`; pre-cutover backup:
`twenty_cutover_20260603_075513.dump`. Both at `/worksp/twenty/fork/backups/`.

### Invalid-variant UUIDs caused blank-page crash (pre-2026)

What happened: hand-crafted UUIDs whose 4th group did not start with `8/9/a/b` were inserted,
crashing the frontend to a blank page.
Recovery: migration `001_enforce_uuid_variant.sql`. Rule: all hand-written UUIDs must be RFC-4122-valid.

---

## 14. Pending work

| Status | Item | Next action |
|---|---|---|
| **open** | **Force-push `v28-refork` to `origin/main`** | Requires explicit user authorization; see `HANDOFF.md` |
| **open** | **Wire CI/CD pipeline for v28-refork** | After force-push: adapt `build-and-push.yml` from `/worksp/twenty/fork/.github/workflows/build-and-push.yml` so pushes to `main` auto-build + push + deploy |
| open | Connected account re-auth | 2 Microsoft accounts may need re-linking in the UI (v2.7 moved `connectedAccount` to core schema) |
| open | Phase E deferred frontend components | 5 UX components reset to v2.8.3 base: `FrontComponentRenderer.tsx`, `useFrontComponentExecutionContext.ts`, `useFieldListFieldMetadataItems.ts`, `useNavigationMenuItemFolderOpenState.ts`, `NavigationMenuItemFolderDnd.tsx` — non-blocking |
| done | v1.20 → v2.8.3 upgrade | Completed 2026-06-03; crm.designflow.app live on v2.8.3 |
| done | POP cron registration | All 4 crons registered; confirmed in server logs (27 successful) |
| done | Backup service fix | Nightly backup confirmed working; 14-day rolling retention |
| done | Staging container cleanup | All staging/cutover containers removed |

---

## Documentation map

- `README.md` — entry point and quick orientation
- `AGENTS.md` (this file) — primary developer/AI operating guide
- `CLAUDE.md` — Claude Code-specific notes only; points here
- `docs/architecture.md` — system design, components, data flow
- `docs/development.md` — local setup, run/test/lint workflow
- `docs/configuration.md` — env vars, auth, feature flags
- `docs/deployment.md` — deploy process, rollback, verification
- `HANDOFF.md` — in-progress work handoff (delete when resolved)

Put guidance in one place and link to it. If a code change affects docs, update them in the same commit.
