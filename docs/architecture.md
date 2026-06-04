# Architecture

System design and data flow for the Pop Creations fork of Twenty CRM.

---

## System overview

```
Internet
  │
  ├─ crm.designflow.app (HTTPS) ──► Nginx (Coolify) ──► Twenty Server container
  │                                                           │
  │                                                    PostgreSQL (twenty-postgres)
  │                                                    Redis      (twenty-redis)
  │
  └─ Microsoft Graph API (Outlook polling)
       │
       └─► Worker container (BullMQ jobs + crons)
```

Two containers run from the same Docker image (`ghcr.io/u2giants/twenty:latest`):

| Container | Command | Role |
|---|---|---|
| `server-rd261bt0wy7ifjrkoe1tkl92` | `node dist/main` | GraphQL API, webhook receivers, SSE, auth |
| `worker-rd261bt0wy7ifjrkoe1tkl92` | `node dist/queue-worker/queue-worker` | BullMQ job processor, cron runner |

The server registers crons (schedules BullMQ jobs) at startup. The worker executes them.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Jotai (state), Linaria (CSS-in-JS), Vite |
| Backend | NestJS, TypeORM, GraphQL (GraphQL Yoga), code-first schema |
| Queue | BullMQ (Redis-backed) |
| Database | PostgreSQL — `core` schema (global) + `workspace_<id>` schema (per-workspace) |
| Cache / session | Redis |
| Auth | Microsoft Entra OIDC (workspace login SSO), Microsoft OAuth for connected accounts |
| Build | Nx monorepo, Yarn 4, SWC compiler |
| Deploy | Docker, GHCR, Coolify API |

---

## Database layout

PostgreSQL has two schema types:

**`core` schema** — global tables (users, workspaces, apps, upgrades):
- `core.workspace` — workspace registry; production has one row (`99c80ca1-…`)
- `core.user`, `core.userWorkspace`, `core.apiKey`, `core.appToken`
- `core.upgradeMigration` — tracks applied v2.x upgrade commands

**`workspace_93r34ew9zc9644a9y5f1yeylz` schema** — per-workspace tables:
- Standard objects: `company`, `person`, `opportunity`, `activity`, `note`, `task`, …
- POP custom objects: `emailMessage`, `department`, `factory`, `ignoreRule`,
  `licensorApprovalThread`, `meetingNote`, `meetingNoteAttendee`, `aiModelConfig`
- Every workspace table has an `__typename` discriminator column and soft-delete via `deletedAt`

The workspace schema name is derived from the workspace ID — do not assume it from env; query
`core.workspace` to find it.

---

## Custom object registration (v2.8 pattern)

Standard objects (both upstream and POP) are code-defined, not created via the UI.

1. **Metadata constant** — `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts`
   registers each object's name, singular, plural, and field UUIDs under `STANDARD_OBJECTS`.
   Every entry must have a `views: {}` key.

2. **Workspace entity** — `pop-creations/standard-objects/<name>.workspace-entity.ts` defines the
   TypeORM entity with `@WorkspaceObject` / `@WorkspaceField` decorators.

3. **Field metadata util** — `field-metadata/pop-creations/compute-<name>-standard-flat-field-metadata.util.ts`
   registers the field metadata so the GraphQL schema generator can emit the correct types.

4. **Schema sync** — running `run-instance-commands` (or the upgrade command) applies the metadata
   diff to the workspace Postgres schema.

Custom fields on upstream objects (company, person, opportunity) follow the same pattern but the
workspace entity and metadata util live in the upstream files (see AGENTS.md §4).

---

## Email ingestion and routing pipeline

```
Microsoft Graph API (Outlook)
    │  (polled every 15 min by OutlookIngestCronJob)
    ▼
emailMessage record created in workspace DB
    │  (@OnDatabaseBatchEvent → EmailRouterListener)
    ▼
EmailRouterService.route(emailMessage)
    │
    ├─ Step 1: domain lookup          (sender domain → company.routingDomain / domainNamePrimaryLinkUrl)
    │                                  skip if ACTIVE/POTENTIAL not found; skip if internal domain
    ├─ Step 2: department narrowing   (people on email scoped to exactly one department?
    │                                  requires person.scope === 'DEPARTMENT' && person.departmentId)
    ├─ Step 3: PO/SO regex            (subject/body contains PO# or SO# → map to opportunity)
    ├─ Step 4: fuzzy name match       (subject/body ~= opportunity.name, threshold ≥ 0.5)
    └─ Step 5: AI fallback            (OpenRouter call with active programs list; UUID response)
    │
    ▼
emailMessage.companyId, .departmentId, .programId, .routingStatus set
```

`routingStatus` values: `ROUTED` (program found), `COMPANY_DEPT` (company + department, no program),
`COMPANY_ONLY` (company matched, no department), `UNROUTED` (no match), `SKIPPED` (internal sender
or `OTHER`-status company).

**Department attribution depends on `person.scope`.** The Step 2 filter is
`p.scope === 'DEPARTMENT' && p.departmentId`. `ContactAutoScopeListener` sets this automatically on
`person.created` and `person.updated`. If `scope` is NULL (e.g. from a direct-SQL insert), the email
will never be attributed to a department even if `departmentId` is set on the person.

Only companies with `customerStatus` of `ACTIVE_CUSTOMER` or `POTENTIAL_CUSTOMER` are routing
candidates. `UNASSIGNED` and other statuses are excluded by design.

Internal senders (`@popcre.com`) skip routing.

---

## Cron jobs

All crons are registered by `CronRegisterAllCommand` (hardcoded list — not auto-discovered).

| Job | Schedule | Purpose |
|---|---|---|
| `OutlookIngestCronJob` | every 15 min | Poll Outlook mailbox via Microsoft Graph |
| `EmailRerouterCronJob` | every 6 hours | Re-attempt routing for unrouted/company-only messages |
| `ClickUpSyncCronJob` | 7am daily | Mirror opportunity stage to ClickUp task status |
| `EmailContactSyncCronJob` | 2am daily | Sync email sender contact info to Person records |
| `MessagingMessagesImportCronJob` | upstream | Gmail/OAuth message import |
| `CalendarEventListFetchCronJob` | upstream | Google Calendar sync |
| … (20+ upstream crons) | various | Upstream Twenty background tasks |

Adding a new cron requires edits to **4 files** — see AGENTS.md §5.

---

## Authentication

**User login (workspace SSO):** Microsoft Entra OIDC. The `ENTERPRISE_KEY` env var (any non-empty
value) enables the OIDC/SSO guard. Employees authenticate with their `@popcre.com` Microsoft
accounts; Twenty issues its own session token. The OIDC provider record lives in
`core.workspaceSSOIdentityProvider` — see `docs/configuration.md` for the tenant/client/redirect
details.

**Microsoft OAuth (connected accounts):** separate from SSO. `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` /
`AZURE_CLIENT_SECRET` grant service-account access to Outlook and Calendar for the ingestion cron.
Individual users can also connect personal accounts via Settings → Connected accounts for personal
email/calendar sync.

**API keys:** generated via `generate-api-key` CLI command; stored in `core.apiKey`.

---

## Frontend overlay

POP frontend code lives in `packages/twenty-front/src/modules/pop-creations/`. It adds:

- **`ParticipantChip` right-click menu** — navigate to the People record from any email participant chip
- **Company filter for People** — `ObjectFilterDropdownRecordSelect` scoped to customer companies when filtering People records (`useRecordsForSelect` `filterOverride`)
- **Company-scoped department picker** — on `emailMessage`, `meetingNote`, and `opportunity` records, the Department relation field only shows departments belonging to the selected company. If no company is selected, the field is greyed out and non-clickable.
  - `getPopCreationsRelationPickerFilterOverride` — computes the `{ companyId: { eq: companyId } }` filter
  - `usePopCreationsDepartmentReadOnly` — returns `isReadOnly = true` when `companyId` is absent
  - `filterOverride` is threaded through `RelationManyToOneFieldInput` → `SingleRecordPicker` → `SingleRecordPickerMenuItemsWithSearch` → `useSingleRecordPickerRecords` → `useSingleRecordPickerPerformSearch`
  - `RecordFieldList` applies `usePopCreationsDepartmentReadOnly` to each inline field's `FieldContext`

**i18n:** The fork is English-only. Lingui macros (`t\`...\``) remain in the codebase but compile
to English strings with no runtime cost. Non-English locale bundles and the `LocalePicker` component
have been removed. `initialI18nActivate` hardwires English with no locale detection.

The upstream Twenty frontend (React/Jotai/Apollo) is otherwise stock v2.8.3.

---

## Deployment topology

```
push to origin/main
    │
    ▼
GitHub Actions (.github/workflows/build-and-push.yml)
    lint → test → build Docker image → push ghcr.io/u2giants/twenty:latest → trigger Coolify API
    │
    ▼
Coolify reads docker-compose.yaml from origin/main (pull_policy: always)
    │
    ▼
Coolify recreates server + worker containers on VPS
```

`docker-compose.yaml` on `origin/main` references `ghcr.io/u2giants/twenty:latest`. Every push
to `main` builds a new image tagged both `latest` and `sha-<commit>` for auditability.
