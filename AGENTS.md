# AGENTS.md — POP Creations CRM Development Guide

This is the primary reference for any AI agent, developer, or tool working on this codebase.
Read this file before writing any code. For Claude Code-specific instructions, see `CLAUDE.md`.

> **Multi-model note:** There is no universal ignore-file standard across AI tools.
> `.claudeignore` works for Claude Code; `.cursorignore` for Cursor; `.copilotignore` for Copilot.
> When starting a session with any other AI tool (Gemini, ChatGPT, etc.), paste this file as
> initial context and tell the model to skip the directories listed in Section 9.

---

## Table of Contents

1. [Business Context](#1-business-context)
2. [Repository Structure](#2-repository-structure)
3. [The Prime Directive — Application Layer Boundary](#3-the-prime-directive--application-layer-boundary)
4. [Core Modification Inventory](#4-core-modification-inventory)
5. [Decision Tree — Where Does New Code Go?](#5-decision-tree--where-does-new-code-go)
6. [Task → File Navigation Map](#6-task--file-navigation-map)
7. [Custom Objects Reference](#7-custom-objects-reference)
8. [Field Extensions on Standard Objects](#8-field-extensions-on-standard-objects)
9. [What to Ignore](#9-what-to-ignore)
10. [Upstream Merge Guide](#10-upstream-merge-guide)
11. [Logic Functions Reference](#11-logic-functions-reference)
12. [Data Visibility Model](#12-data-visibility-model)
13. [Known Bugs and Hard Limits](#13-known-bugs-and-hard-limits)
14. [Critical Incident Log](#14-critical-incident-log)
15. [Developer Advice](#15-developer-advice)
16. [Pending Work](#16-pending-work)

---

## 1. Business Context

**POP Creations** is a small wholesale consumer goods company. They design and source seasonal
and everyday products (home decor, holiday items, outdoor goods) and sell to major retail chains:
Dollar General, Five Below, Dollar Tree, Walmart, Hobby Lobby.

### Vocabulary map

| CRM term | Business meaning |
|---|---|
| Opportunity | Program — a specific SKU or product line for a retailer/season |
| Company | Retailer / customer |
| Person | Buyer contact at a retailer |
| Department | Buying department within a retailer (e.g. "Dollar General — Seasonal") |
| EmailMessage | Ingested Outlook email |
| MeetingNote | Fireflies transcript / meeting record |
| LicensorApprovalThread | Licensing submission and approval workflow |
| Factory | Manufacturing partner |

### How the business works

**Programs** (Opportunities) travel through a lifecycle from initiation → design → buyer review →
pricing → production → delivery. Departments scope programs, contacts, and emails. Companies are
retailers; credit/customer status cascades to their Persons.

**Emails** arrive via Outlook into a shared mailbox. The pipeline ingests them via Microsoft Graph,
attempts to route each to the right Company/Department/Program, and surfaces unrouted ones in an
Inbox view for manual review.

**Meeting notes** are auto-imported from Fireflies AI. The webhook creates `MeetingNote` records
and links `@popcre.com` staff via `MeetingNoteAttendee`.

**ClickUp** is the production task management tool. Program status is synced into `clickupStatus`.

---

## 2. Repository Structure

This is a fork of [Twenty CRM](https://twenty.com) (`twentyhq/twenty` → `u2giants/twenty`).
We forked because the SDK approach had hard blockers (see Section 13). The fork lets us modify
Twenty's source directly while pulling upstream updates via `git merge upstream/main`.

### Packages we own / modify

| Package | Purpose |
|---|---|
| `packages/twenty-server/src/modules/pop-creations/` | All backend logic: NestJS services, cron jobs, event listeners, query hooks |
| `packages/twenty-front/src/modules/pop-creations/` | All frontend: React components, widget registry, route registry |
| `packages/twenty-front/src/pages/pop-creations/` | Standalone page components |

### Packages we use but do not modify

| Package | Notes |
|---|---|
| `packages/twenty-server/` (rest) | Twenty's NestJS backend — read as reference, do not modify |
| `packages/twenty-front/` (rest) | Twenty's React frontend — read as reference; we have 2 tiny surgical hooks (see Section 4) |
| `packages/twenty-shared/` | Shared types — we read this; AppPath.ts is 100% stock |
| `packages/twenty-ui/` | UI component library — read as reference, do not modify |
| `packages/twenty-emails/` | Email templates — do not modify |
| `packages/twenty-docker/` | Dockerfile — our build pipeline uses `twenty/Dockerfile` |

### Packages kept in git but irrelevant to our work

`twenty-companion` (Electron desktop app — kept for future use), `twenty-sdk`,
`twenty-client-sdk`, `twenty-front-component-renderer`, `twenty-oxlint-rules`.
Do not read or reference these unless specifically working on them.

### Branch strategy

- `main` — production branch with all POP Creations customizations. Deploys to `crm.designflow.app`.
- `upstream` — pure mirror of `twentyhq/twenty`. Never commit custom code here.
- `feature/*` — development branches merged to `main` via PR.

---

## 3. The Prime Directive — Application Layer Boundary

**This is the most important architectural rule in this codebase.**

```
packages/twenty-server/src/modules/pop-creations/    ← OUR territory
packages/twenty-front/src/modules/pop-creations/     ← OUR territory
packages/twenty-front/src/pages/pop-creations/       ← OUR territory

Everything else                                      ← Twenty's territory
                                                       Touch minimally and surgically
```

### Why this matters

Every file outside `pop-creations/` that we change is a potential merge conflict when we pull
a new Twenty release. We pull upstream changes frequently. The smaller our footprint in core
files, the easier every future upgrade is.

### The rule

**If something can be implemented inside `pop-creations/`, it must be.**

You only touch a core file when you need to *register* something with Twenty's system — connecting
our code to a Twenty extension point. When you do, the change must be:
- An **addition**, never a rewrite
- As **minimal** as possible (one import, one line of JSX, one case in a switch)
- Done **once**, not repeatedly (use registry/array patterns so the core file never changes again)

### The registration pattern

We use two self-contained registries so future additions never touch core:

**Widgets** → edit `pop-creations/registry/widgetRegistry.tsx` only.
`WidgetContentRenderer.tsx` (core) imports the registry and will never need changing again.

**Pages/routes** → edit `pop-creations/routes/popCreationsRoutes.tsx` and `popPaths.ts` only.
`useCreateAppRouter.tsx` (core) renders `<PopCreationsRoutes />` and will never need changing again.

### When core changes ARE acceptable

Some features genuinely cannot be done inside `pop-creations/`:

| Feature | Why core must change | How to minimize damage |
|---|---|---|
| New filter behavior in record tables | `RecordTableContent.tsx` controls the table structure | One import + one JSX element, as we did |
| New auth flow or middleware | Lives deep in `engine/core-modules/` | Avoid if possible; if unavoidable, add a hook point rather than rewriting |
| New GraphQL field type | `WidgetType` enum and schema | Add enum value only; don't change resolvers |
| Row-level security predicates | `engine/permissions/` | Create predicates as data configs, not code changes |

---

## 4. Core Modification Inventory

These are the **only** files outside `pop-creations/` that we have modified. This list must be
kept current. Every upstream merge should check only these files for conflicts.

### `packages/twenty-front/src/modules/page-layout/widgets/components/WidgetContentRenderer.tsx`

**Change:** Added one import + replaced two hard-coded if-chains with a registry lookup.
```typescript
// Added import:
import { POP_CREATIONS_WIDGET_REGISTRY } from '@/pop-creations/registry/widgetRegistry';

// Modified FRONT_COMPONENT case to:
const PopWidget = componentName ? POP_CREATIONS_WIDGET_REGISTRY[componentName] : undefined;
if (PopWidget) return <PopWidget />;
```
**Future additions:** Edit `widgetRegistry.tsx` only — this file is now frozen for POP changes.

### `packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx`

**Change:** Added one import + one JSX element replacing two individual route definitions.
```typescript
// Added import:
import { PopCreationsRoutes } from '@/pop-creations/routes/popCreationsRoutes';

// In route tree: replaced two <Route> elements with:
<PopCreationsRoutes />
```
**Future additions:** Edit `popCreationsRoutes.tsx` and `popPaths.ts` only — this file is frozen.

### `packages/twenty-front/src/modules/object-record/record-table/components/RecordTableContent.tsx`

**Change:** Added one import + one JSX element after `<RecordTableHeader />`.
```typescript
import { RecordTableFilterRow } from '@/object-record/record-table/record-table-filter-row/components/RecordTableFilterRow';
// ...
<RecordTableHeader />
<RecordTableFilterRow />   ← added
```
**Status:** This is unavoidable for the inline filter feature. The filter row manages its own
visibility via Jotai state (`isRecordTableFilterRowVisibleComponentState`).

### `packages/twenty-shared/src/types/AppPath.ts`

**Change:** None. AppPath.ts is 100% stock. Our routes use `popPaths.ts` in our own module.

---

## 5. Decision Tree — Where Does New Code Go?

```
New feature needed
        │
        ▼
Can it live entirely in packages/twenty-server/src/modules/pop-creations/
or packages/twenty-front/src/modules/pop-creations/ ?
        │
       YES ──────────────────────────────────────────────────────────────►  Do it there.
        │                                                                   No core changes needed.
        NO
        │
        ▼
Does it need to show up in a record page widget?
        │
       YES ──► Create component in pop-creations/components/
               Register in pop-creations/registry/widgetRegistry.tsx
               No other files need changing.
        │
        NO
        │
        ▼
Does it need its own page/route?
        │
       YES ──► Create page in pages/pop-creations/
               Add path to pop-creations/routes/popPaths.ts
               Add route to pop-creations/routes/popCreationsRoutes.tsx
               No other files need changing.
        │
        NO
        │
        ▼
Does it need backend automation (event-driven or scheduled)?
        │
       YES ──► Add to pop-creations NestJS module:
               - Event listener → pop-creations-record.listener.ts
               - Cron job → crons/jobs/ + crons/commands/
               - New service → services/
               No core changes needed.
        │
        NO
        │
        ▼
Does it require modifying Twenty's record table layout/behavior?
        │
       YES ──► Modify RecordTableContent.tsx with a single surgical addition.
               Document the change in Section 4 of this file.
        │
        NO
        │
        ▼
Does it require a new field type or new metadata enum value?
        │
       YES ──► Modify the specific enum file only. Document in Section 4.
        │
        NO
        │
        ▼
Think carefully. If it truly requires a deep core change, document WHY here
and minimize the change to a single addition (never a rewrite).
```

### What belongs where in the backend

| Task | Location |
|---|---|
| New custom object | `standard-objects/` + field builder in `engine/.../pop-creations/` + UID in `twenty-shared` |
| New field on existing object | Field builder file for that object + workspace entity class |
| New event listener | `pop-creations-record.listener.ts` |
| New cron job | `crons/jobs/` + `crons/commands/` + register in `pop-creations.module.ts` |
| New HTTP webhook endpoint | `controllers/` + register in `pop-creations.module.ts` |
| New computed field | `query-hooks/` + register in `pop-creations.module.ts` |
| Email routing changes | `services/email-router.service.ts` |

### What belongs where in the frontend

| Task | Location |
|---|---|
| New record page widget | `pop-creations/components/` + entry in `widgetRegistry.tsx` |
| New standalone page | `pages/pop-creations/` + entry in `popCreationsRoutes.tsx` + path in `popPaths.ts` |
| New sidebar nav item | Metadata API call (no code change) |
| New view or filter preset | Metadata API call (no code change) |
| Modify record table behavior | `record-table/` — surgical addition only, document in Section 4 |

---

## 6. Task → File Navigation Map

### Email routing

Touch ONLY:
- `packages/twenty-server/src/modules/pop-creations/services/email-router.service.ts`

The five-step cascade (domain → department → PO/SO regex → fuzzy → AI) is all in this file.
AI model config is read from the `AiModelConfig` workspace object (one record named "Default").
Uses `OPENROUTER_API_KEY`. Single OpenRouter endpoint for all models.

### Adding a new event handler (e.g. "when X record is created, do Y")

Touch ONLY:
- `packages/twenty-server/src/modules/pop-creations/listeners/pop-creations-record.listener.ts`

Add a new `@OnDatabaseBatchEvent('objectName', DatabaseEventAction.X)` method.

### Adding a new cron job

Touch these files IN ORDER:
1. Create `packages/twenty-server/src/modules/pop-creations/crons/jobs/[name].cron.job.ts`
2. Add command to `packages/twenty-server/src/modules/pop-creations/crons/commands/pop-creations-cron.commands.ts`
3. Register both in `packages/twenty-server/src/modules/pop-creations/pop-creations.module.ts`

### Adding a new custom object

Touch these files IN ORDER:
1. Add UUID to `packages/twenty-shared/src/metadata/constants/` (the standardId constants file)
2. Create field builder at `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/pop-creations/compute-[name]-standard-flat-field-metadata.util.ts`
3. Register builder in `build-standard-flat-field-metadata-maps.util.ts`
4. Add object entry in `create-standard-flat-object-metadata.util.ts`
5. Create workspace entity at `packages/twenty-server/src/modules/pop-creations/standard-objects/[name].workspace-entity.ts`

Do not touch anything else.

### Adding a new field to an existing custom object

Touch these files IN ORDER:
1. Add UUID to `packages/twenty-shared/src/metadata/constants/` (standardId constants)
2. Add field definition to the object's field builder in `field-metadata/pop-creations/`
3. Add TypeScript property to the workspace entity in `pop-creations/standard-objects/`

### Adding a new page/route

Touch these files ONLY (no core files needed):
1. Create page component in `packages/twenty-front/src/pages/pop-creations/`
2. Add path to `packages/twenty-front/src/modules/pop-creations/routes/popPaths.ts`
3. Add route to `packages/twenty-front/src/modules/pop-creations/routes/popCreationsRoutes.tsx`

### Adding a new record page widget

Touch these files ONLY (no core files needed):
1. Create component in `packages/twenty-front/src/modules/pop-creations/components/`
2. Add entry to `packages/twenty-front/src/modules/pop-creations/registry/widgetRegistry.tsx`

### Upstream Twenty merge (pulling new Twenty release)

The ONLY files that may have conflicts are those listed in Section 4:
- `WidgetContentRenderer.tsx` — check the FRONT_COMPONENT case
- `useCreateAppRouter.tsx` — check for `<PopCreationsRoutes />` placement
- `RecordTableContent.tsx` — check for `<RecordTableFilterRow />` placement

AppPath.ts is 100% stock and will not conflict.

---

## 7. Custom Objects Reference

All UIDs are authoritative — they match the production database exactly. Never change a UID.

| Object | universalIdentifier | Purpose |
|---|---|---|
| AiModelConfig | `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2` | Workspace-level AI model selection |
| Department | `1b9e366d-b0a1-40e6-b253-115079fed63d` | Buying departments within retailers |
| EmailMessage | `c0233f86-fdb6-4a32-9693-6c6fb1d5e740` | Ingested Outlook emails |
| Factory | `1e10f8ed-8571-48b8-8571-32e53b44d63e` | Manufacturing partners |
| IgnoreRule | `c0baf376-8e17-4d5b-b31a-39122aae9db5` | Email subject patterns to auto-skip |
| LicensorApprovalThread | `b654e699-2912-433f-93dd-c97d9a5bb7e1` | Licensing approval workflow |
| MeetingNote | `79e9be9f-d969-40f7-988d-efc83a8e7049` | Fireflies transcripts / meeting records |
| MeetingNoteAttendee | `78e3ad65-5495-461b-842e-672f1e10d78d` | Junction: internal staff ↔ meeting notes |

Full field definitions: `CLAUDE.md` Section 3, or read the workspace entity files in `standard-objects/`.

---

## 8. Field Extensions on Standard Objects

We added custom fields to these standard Twenty objects:

| Object | Custom fields added |
|---|---|
| Person | `contactType`, `department` (relation), `scope`, `companyCustomerStatus` |
| Company | `customerStatus`, `creditStatus`, `chainType`, `primarySalesperson`, `departments` (relation) |
| Opportunity | `programType`, `seasonYear`, `department` (relation), `factory` (relation), `licensed`, `hardDeliveryDate`, `clickupStatus`, and ~15 more |
| Note | `firefliesTranscriptId`, `actionItems`, `source` |
| WorkspaceMember | `primarySalespersonCompanies` (relation) |

---

## 9. What to Ignore

When working in this codebase, do not read or reference these unless the task specifically involves them:

**Not relevant to POP Creations work:**
- `packages/twenty-companion/` — Electron desktop app (kept for future use, not active)
- `packages/twenty-sdk/` — Twenty SDK (used internally by server build; we don't write SDK apps)
- `packages/twenty-client-sdk/` — Client SDK (same)
- `packages/twenty-front-component-renderer/` — SDK front component renderer (same)
- `packages/twenty-oxlint-rules/` — Linting rules for Twenty's own CI

**Large Twenty core areas we never modify:**
- `packages/twenty-front/src/pages/settings/` — Settings UI
- `packages/twenty-front/src/modules/workflow/` — Workflow engine UI
- `packages/twenty-front/src/modules/auth/` — Authentication UI
- `packages/twenty-server/src/engine/core-modules/` — Core engine (message queue, auth, billing, etc.)
- `packages/twenty-server/src/engine/metadata-modules/` — Metadata system internals
- `packages/twenty-server/src/engine/api/` — GraphQL API layer

**Build artifacts:** `dist/`, `node_modules/`, `.twenty/`, `.nx/cache/`, `.yarn/cache/`

---

## 10. Upstream Merge Guide

Pulling a new Twenty release into our fork:

```bash
# 1. Fetch upstream
git fetch upstream

# 2. Create a merge branch
git checkout -b feature/upstream-sync-$(date +%Y-%m-%d) main

# 3. Merge
git merge upstream/main

# 4. Resolve conflicts — ONLY these files will have conflicts:
#    - packages/twenty-front/src/modules/page-layout/widgets/components/WidgetContentRenderer.tsx
#      → Preserve the POP_CREATIONS_WIDGET_REGISTRY import and lookup in the FRONT_COMPONENT case
#    - packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx
#      → Preserve the PopCreationsRoutes import and <PopCreationsRoutes /> in the route tree
#    - packages/twenty-front/src/modules/object-record/record-table/components/RecordTableContent.tsx
#      → Preserve the RecordTableFilterRow import and <RecordTableFilterRow /> after <RecordTableHeader />

# 5. Test, PR to main
```

If Twenty adds new packages or scripts that conflict with our `package.json`, keep our slimmed
workspaces list and discard the new Twenty packages we don't need.

---

## 11. Logic Functions Reference

All backend automation lives in `packages/twenty-server/src/modules/pop-creations/`.

### Email pipeline

- **`email-router.service.ts`** — Five-step routing cascade: domain→company, department narrowing, SO/PO regex, fuzzy token match, AI call
- **`outlook-ingest.cron.job.ts`** — Every 15 min, polls Microsoft Graph, deduplicates by `outlookMessageId`
- **`email-rerouter.cron.job.ts`** — Every 6 hours, re-routes UNROUTED and partial emails
- **`email-contact-sync.cron.job.ts`** — Daily 2am, syncs email addresses to Person records

### Event listeners (in `pop-creations-record.listener.ts`)

| Trigger | Action |
|---|---|
| Company `customerStatus` updated | Sync to all linked Persons |
| Person created | Set `companyCustomerStatus` + auto-set `scope` |
| Person `companyId` updated | Re-sync `companyCustomerStatus` |
| EmailMessage `ignoreSubject` set to true | Create IgnoreRule, bulk-skip matching emails |
| IgnoreRule created | Bulk-skip UNROUTED emails matching pattern |
| Opportunity stage changed | Create follow-up tasks + LAT if licensed |
| Opportunity created | Create standard task checklist |
| LicensorApprovalThread stage changed | Create follow-up tasks |

### Scheduled cron jobs

| Job | Schedule |
|---|---|
| outlook-ingest | Every 15 minutes |
| email-rerouter | Every 6 hours |
| clickup-sync | Daily 7am |
| email-contact-sync | Daily 2am |

### HTTP endpoints

- `POST /webhooks/fireflies` — Fireflies webhook (controller: `fireflies-webhook.controller.ts`)

---

## 12. Data Visibility Model

**Intended model (partially enforced — see Section 16):**

- **Companies:** Shared — all users see all companies
- **Emails and Contacts:** Private to the workspace member whose mailbox was the ingestion source
- **Meeting Notes:** Shared between all attendees + all users linked to the associated Opportunity
- **Opportunities:** Visible to all users linked to the Opportunity

Row-level security predicates are not yet implemented. Current state: all roles have
`canReadAllObjectRecords: true`. Implementing predicates is in Section 16 pending work.

---

## 13. Known Bugs and Hard Limits

### `installApplication` fails for non-empty manifests (SDK-era bug, now irrelevant)

This was the bug that drove the fork decision. In the fork, all customizations are compiled
directly into the server binary. `installApplication` is no longer part of our workflow.

> **NEVER call `installApplication` with the Workspace App registration ID
> `6ed66b1d-7d0e-49b1-bc9b-be860464e8cf`.** This is the ID that owns all custom schema.
> Calling it with any manifest will delete all custom objects. See Section 14.

### Production cutover not yet executed

The fork image (`ghcr.io/u2giants/twenty:latest`) has not been deployed to production yet.
The running system at `crm.designflow.app` is still the stock Twenty + SDK app combination.
See `migration-reference/CUTOVER_RUNBOOK.md` for the execution plan.

### Row-level security not implemented

See Section 12 and Section 16.

---

## 14. Critical Incident Log

### 2026-03-31: Workspace destroyed by incorrect installApplication call

An AI assistant called `installApplication` with the Workspace App registration ID
(`6ed66b1d-...`) and an empty manifest. Because `inferDeletionFromMissingEntities: true`,
all 8 custom objects and all custom fields were deleted. The API key lost its role assignment.

**Recovery:** Workspace restored by re-creating schema via direct metadata API calls.

**Rule going forward:**
> Only ever call `installApplication` (if at all) with the POP Creations CRM registration ID:
> `bdc3bca3-d392-419b-aa6a-3c7d105cc305`

---

## 15. Developer Advice

### GraphQL filter syntax

```graphql
# Correct
person(filter: { id: { eq: $id } }) { ... }
departments(filter: { name: { ilike: $q } }) { ... }   # ilike = case-insensitive

# Wrong — returns null silently
person(id: $id) { ... }
```

### Universal identifiers are permanent

Every object, field, view, and component has a `universalIdentifier` UUID. Once synced to any
environment, these must never change. The full UID map is in `migration-reference/CRITICAL_UID_MAP.txt`.

### Two deployment paths (backend vs. frontend)

After any code change, both must be rebuilt and deployed:
- **Server** — NestJS; changes to `twenty-server/` require a server rebuild
- **Frontend** — React; changes to `twenty-front/` require a frontend rebuild

The GitHub Actions workflow `build-and-push.yml` builds both from the same Dockerfile.

### AI routing

All AI calls use OpenRouter. Single endpoint, single API key:
```
https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer $OPENROUTER_API_KEY
```
Model IDs are prefixed: `openai/gpt-5.4`, `google/gemini-3.1-pro-preview`, `anthropic/claude-sonnet-4-6`.
Model selection is read at runtime from the `AiModelConfig` workspace record.

### Direct API access

```bash
# Data API
curl -X POST https://crm.designflow.app/graphql \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ people { edges { node { id } } } }"}'

# Metadata API
curl -X POST https://crm.designflow.app/metadata \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ objects { edges { node { nameSingular } } } }"}'
```

---

## 16. Pending Work

### CRITICAL: Execute production cutover

All development phases (0-8) are committed to `main`. Deployment is pending.
See `migration-reference/CUTOVER_RUNBOOK.md`. Requires:
- GitHub Actions build to succeed (image pushed to `ghcr.io/u2giants/twenty:latest`)
- Coolify API access to update both server and worker apps
- Database ownership transfer SQL (`migration-reference/transfer-ownership.sql`)
- Environment variables: `OPENROUTER_API_KEY`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
  `AZURE_CLIENT_SECRET`, `OUTLOOK_MAILBOX`, `CLICKUP_API_TOKEN`

### Row-level security for Emails and Contacts

After cutover, implement permission predicates:
- `EmailMessage`: restrict to workspace member whose mailbox ingested them (`createdBy`)
- `Person`: same restriction for contacts created during email ingest
- `MeetingNote`: visible to attendees + users linked to associated Opportunity
