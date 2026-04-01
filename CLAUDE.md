# CLAUDE.md — POP Creations CRM

This file is for Claude Code (and any developer who wants the full picture). It covers business context, custom schema, automation logic, known bugs, and hard-won developer advice that is not in README.md or docs/HANDOFF.md.

Read docs/HANDOFF.md for infrastructure and deployment operations. Read this file for "what does this system actually do and why."

---

## Table of Contents

1. [Business Context](#1-business-context)
2. [Application Identity](#2-application-identity)
3. [Custom Objects](#3-custom-objects)
4. [Field Extensions on Standard Objects](#4-field-extensions-on-standard-objects)
5. [Logic Functions](#5-logic-functions)
6. [Front Components](#6-front-components)
7. [Views, Navigation, Page Layouts](#7-views-navigation-page-layouts)
8. [Data Visibility and Permissions](#8-data-visibility-and-permissions)
9. [Known Bugs and Hard Limits](#9-known-bugs-and-hard-limits)
10. [Critical Incident Log](#10-critical-incident-log)
11. [Pending Work](#11-pending-work)
12. [Developer Advice](#12-developer-advice)

---

## 1. Business Context

**POP Creations** is a small wholesale consumer goods company. They design and source seasonal and everyday products (home decor, holiday items, outdoor goods, etc.) and sell them to major retail chains including Dollar General, Five Below, Dollar Tree, Walmart, Hobby Lobby, and similar.

### How the business works

**Programs** (called Opportunities in Twenty) are individual product programs — a specific SKU or product line sold to a retailer for a specific season. Each program has a season/year, a factory, a department contact, and travels through a lifecycle from initiation through production to delivery.

**Departments** are buying departments within retail chains. Dollar General has a Seasonal department, an Everyday department, etc. Each department has a primary buyer (Person) and is associated with a Company. Programs, contacts, and emails are scoped to departments.

**Companies** are the retailers. Credit status and customer status on a Company cascade to their Persons.

**Factories** are manufacturing partners, primarily in China and India.

**Licensed programs** require going through a licensor approval process — concept submission, revisions, production pre-sample (PPS) approval, etc. The `LicensorApprovalThread` object tracks this workflow.

**Emails** arrive via Outlook into a shared mailbox. An automated pipeline ingests them via Microsoft Graph, attempts to route each one to the right Company/Department/Program, and surfaces unrouted ones in an "Inbox" view for manual review.

**Meeting notes** are auto-imported from Fireflies AI (call recording/transcription). The webhook creates `MeetingNote` records and links the POP Creations staff who attended via `MeetingNoteAttendee`.

**ClickUp** is the production task management tool. Program status is synced from ClickUp into the CRM's Opportunity `clickupStatus` field.

### Vocabulary map

| CRM | Business meaning |
|---|---|
| Opportunity | Program (product program for a retailer) |
| Company | Retailer / customer |
| Person | Buyer contact at a retailer |
| Department | Buying department within a retailer |
| EmailMessage | Ingested Outlook email |
| MeetingNote | Fireflies transcript / meeting record |
| LicensorApprovalThread | Licensing submission and approval workflow |
| Factory | Manufacturing partner |

---

## 2. Application Identity

- **App display name:** POP Creations CRM
- **universalIdentifier:** `8f8664b5-d25d-4e82-a979-bb61728c0706`
- **App registration ID:** `bdc3bca3-d392-419b-aa6a-3c7d105cc305`
- **Production URL:** `https://crm.designflow.app`
- **SDK version:** `twenty-sdk@0.7.0`
- **Node version:** 24.5.0
- **Package manager:** yarn@4.9.2

### Workspace application registry

The Twenty workspace has three registered applications:

| Name | universalIdentifier | registrationId | Owns |
|---|---|---|---|
| Workspace App (system) | `f99617d1-aa3d-4009-8211-53a7b747f5f2` | `6ed66b1d-7d0e-49b1-bc9b-be860464e8cf` | All custom objects/fields created via direct API |
| Twenty Standard App | `58dd163b-b4d9-4b30-aca8-23b41518741d` | (internal) | Person, Company, Opportunity, Note, Task, etc. |
| POP Creations CRM | `8f8664b5-d25d-4e82-a979-bb61728c0706` | `bdc3bca3-d392-419b-aa6a-3c7d105cc305` | Managed by SDK manifest |

> **WARNING — see Critical Incident Log:** Never call `installApplication` on the Workspace App registration ID `6ed66b1d-7d0e-49b1-bc9b-be860464e8cf`. It owns all custom schema. Calling it with a partial manifest will delete everything not listed.

---

## 3. Custom Objects

All UIDs are in `src/objects/identifiers.ts` (centralized to avoid circular imports).

### Department — `1b9e366d-b0a1-40e6-b253-115079fed63d`

Buying departments within retail chains (e.g., "Dollar General — Seasonal"). Central hub: programs, contacts, emails, and meetings all scope to a department.

| Field | Type | Notes |
|---|---|---|
| name | TEXT | Label field |
| category | SELECT | SEASONAL, EVERYDAY, SOFT_HOME, OUTDOOR, HOLIDAY, OTHER |
| active | BOOLEAN | |
| company | MANY_TO_ONE | → Company |
| primaryBuyer | MANY_TO_ONE | → Person |
| people | ONE_TO_MANY | → Person |
| programs | ONE_TO_MANY | → Opportunity |
| meetingNotes | ONE_TO_MANY | → MeetingNote |
| emailMessages | ONE_TO_MANY | → EmailMessage |

### EmailMessage — `c0233f86-fdb6-4a32-9693-6c6fb1d5e740`

Ingested Outlook emails. The routing pipeline fills in company/department/program. Unrouted ones surface in the Inbox view.

| Field | Type | Notes |
|---|---|---|
| subject | TEXT | Label field |
| sender | TEXT | Sender email address |
| recipients | TEXT | To/CC, comma-separated |
| receivedAt | DATE | |
| bodyPreview | TEXT | First ~500 chars |
| outlookMessageId | TEXT | Microsoft Graph ID — deduplication key |
| routingStatus | SELECT | ROUTED, COMPANY_DEPT, COMPANY_ONLY, UNROUTED, SKIPPED |
| routingMethod | SELECT | PO_NUMBER, SO_NUMBER, EMAIL_DOMAIN, FUZZY_NAME, AI, MANUAL, AUTO_SKIP |
| program | MANY_TO_ONE | → Opportunity |
| company | MANY_TO_ONE | → Company |
| department | MANY_TO_ONE | → Department |

### MeetingNote — `79e9be9f-d969-40f7-988d-efc83a8e7049`

Meeting records, primarily auto-imported from Fireflies webhooks. Linked to company, department, program, and individual attendees.

| Field | Type | Notes |
|---|---|---|
| name | TEXT | Label field — auto-generated from date + participants |
| date | DATE | |
| participants | TEXT | Comma-separated names |
| summary | TEXT | AI summary |
| actionItems | TEXT | Extracted action items |
| source | SELECT | FIREFLIES_AUTO_IMPORT, MANUAL |
| firefliesTranscriptId | TEXT | Deduplication key |
| company | MANY_TO_ONE | → Company |
| department | MANY_TO_ONE | → Department |
| program | MANY_TO_ONE | → Opportunity |
| person | MANY_TO_ONE | → Person |
| attendees | ONE_TO_MANY | → MeetingNoteAttendee |

### MeetingNoteAttendee — `7f5dae81-9c27-4fcf-a2ac-e858abc99c01`

Junction linking internal `@popcre.com` staff to meeting notes. Both relations are CASCADE delete.

### Factory — `1e10f8ed-8571-48b8-8571-32e53b44d63e`

Manufacturing partners. Linked to programs.

| Field | Type | Notes |
|---|---|---|
| name | TEXT | Label field |
| location | TEXT | City and country |
| contactName | TEXT | |
| contactEmail | EMAILS | |
| capabilities | TEXT | |
| notes | TEXT | |
| programs | ONE_TO_MANY | → Opportunity |

### IgnoreRule — `5585f204-dfa5-4672-a970-930791aed8de`

Subject patterns to auto-skip during email routing. Prevents shipping confirmations, OOO replies, etc. from filling the inbox.

| Field | Type | Notes |
|---|---|---|
| pattern | TEXT | Label field — subject text to match |
| matchType | SELECT | CONTAINS, EXACT, STARTS_WITH |
| emailsSkipped | NUMBER | Running counter |

### LicensorApprovalThread — `b654e699-2912-433f-93dd-c97d9a5bb7e1`

Multi-stage licensing approval workflow. CASCADE deletes when parent program is deleted.

| Field | Type | Notes |
|---|---|---|
| propertyName | TEXT | e.g., "Mickey Mouse", "Snoopy" |
| stage | SELECT | CONCEPT_SUBMIT → CONCEPT_REVISIONS → RESUBMIT → CONCEPT_APPROVED_WITH_COMMENTS → CONCEPT_APPROVED → PPS_SUBMIT → PPS_APPROVED |
| submittedDate | DATE | |
| responseDate | DATE | |
| dueDate | DATE | |
| licensorComments | TEXT | |
| program | MANY_TO_ONE | → Opportunity (CASCADE) |

### AiModelConfig — `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2`

Workspace-level config for AI model selection. One record named "Default" controls which model is used in email routing and meeting note processing. Supported models: GPT 5.4, GPT 5.4 Mini, GPT 5.4 Nano, Gemini 3.1 Pro, Gemini 3 Flash, Gemini 3.1 Flash Lite, Gemini 3.1 Flash Image, Claude Sonnet 4.6, Claude Haiku 4.5.

---

## 4. Field Extensions on Standard Objects

### On Person

| Field | Notes |
|---|---|
| contactType | SELECT: BUYER, ASSISTANT_BUYER, PLANNER, CHINA_OFFICE, LOGISTICS, LEGAL, FINANCE, OTHER |
| department | MANY_TO_ONE → Department (primary scoping) |
| scope | SELECT: DEPARTMENT, COMPANY_WIDE, IGNORED — controls email routing behavior |
| companyCustomerStatus | Auto-synced from parent Company |
| departmentsAsPrimaryBuyer | ONE_TO_MANY → Department |
| meetingNoteAttendances | ONE_TO_MANY → MeetingNoteAttendee |
| meetingNotes | ONE_TO_MANY → MeetingNote |

### On Company

| Field | Notes |
|---|---|
| customerStatus | SELECT: ACTIVE_CUSTOMER, POTENTIAL_CUSTOMER, OTHER, UNASSIGNED — new companies default to UNASSIGNED |
| creditStatus | SELECT: GOOD, WATCH, HOLD |
| chainType | SELECT: OFF_PRICE, SPECIALTY, VALUE, MASS, CLUB, HOME_IMPROVEMENT |
| primarySalesperson | MANY_TO_ONE → WorkspaceMember |
| departments | ONE_TO_MANY → Department |
| emailMessages | ONE_TO_MANY → EmailMessage |
| meetingNotes | ONE_TO_MANY → MeetingNote |

### On Opportunity (Program)

| Field | Notes |
|---|---|
| programType | SELECT: LICENSED_PROGRAM, REGULAR_ORDER, FLOOR_RESET, REORDER |
| seasonYear | SELECT: SPRING_2026, BACK_TO_SCHOOL_2026, HOLIDAY_2026, SPRING_2027, BACK_TO_SCHOOL_2027, HOLIDAY_2027 |
| directiveSource | SELECT: BUYER_INITIATED, INTERNAL |
| department | MANY_TO_ONE → Department |
| factory | MANY_TO_ONE → Factory |
| originCountry | SELECT: CHINA, INDIA, OTHER |
| licensed | BOOLEAN — if true, triggers licensor approval workflow |
| licensorApprovalThreads | ONE_TO_MANY → LicensorApprovalThread |
| productionPoNumber | TEXT — format D#### or S#### |
| salesOrderNumber | TEXT — retailer-issued SO# |
| importPoNumber | TEXT — from ColdLion ERP |
| customerIncoterms | SELECT: FOB_CHINA, FOB_INDIA, POE_LA, POE_NJ, DDP_CHINA, WHSE_LA, WHSE_NJ, WHSE_SPIRIT |
| factoryIncoterms | SELECT: FOB_CHINA, FOB_INDIA, LDP_LA, LDP_NJ |
| hardDeliveryDate | DATE — critical deadline |
| sampleRequired | BOOLEAN |
| sampleApprovalMethod | SELECT: IN_PERSON, PHOTO, NA |
| requiresNewPricing | BOOLEAN |
| clickupTaskId | TEXT — ClickUp sync reference |
| clickupStatus | TEXT — read-only, synced from ClickUp |
| plmProjectId | TEXT — PLM system reference |
| emailMessages | ONE_TO_MANY → EmailMessage |
| meetingNotes | ONE_TO_MANY → MeetingNote |

### On Note

| Field | Notes |
|---|---|
| firefliesTranscriptId | TEXT — deduplication key |
| actionItems | TEXT |
| source | SELECT: FIREFLIES_AUTO_IMPORT, MANUAL, EMAIL |

### On WorkspaceMember

| Field | Notes |
|---|---|
| primarySalespersonCompanies | ONE_TO_MANY → Company |

---

## 5. Logic Functions

All in `src/logic-functions/`. Serverless-style functions bundled to `.mjs` by the Twenty CLI.

### Email pipeline

**`email-router.ts`** — Core routing engine. Five-step cascade:
1. Email domain → Company match
2. Department narrowing via Person `scope` field
3. SO/PO number regex match against programs
4. Fuzzy token match against program names
5. AI model call (reads `AiModelConfig.emailRoutingModel`)

Returns `RoutingResult: { companyId, departmentId, programId, routingStatus, routingMethod, confidence }`.

**`outlook-ingest.ts`** — Cron job. Polls Microsoft Graph for recent emails, deduplicates by `outlookMessageId`, creates `EmailMessage` records, calls the router.

**`apply-ignore-rule.ts` / `ignore-subject-trigger.ts`** — Applies IgnoreRule patterns before routing. Matching emails get `routingStatus: SKIPPED`, `routingMethod: AUTO_SKIP`. Increments `emailsSkipped` on the rule.

**`email-rerouter.ts`** — Re-routes existing EmailMessage records (manual or rule-triggered).

**`email-contact-sync.ts`** — Maintains email address → Person mappings for routing lookups.

### Meeting notes

**`fireflies-ingest.ts`** — HTTP webhook endpoint. Receives Fireflies payload, deduplicates by `firefliesTranscriptId`, creates `MeetingNote`, identifies `@popcre.com` participants and creates `MeetingNoteAttendee` records.

### Status synchronization

**`sync-company-status-to-people.ts`** — When Company `customerStatus` changes, updates all linked Persons.

**`sync-person-company-status.ts` / `sync-person-company-status-on-update.ts`** — When a Person's company changes, syncs `companyCustomerStatus` from the company.

**`contact-auto-scope.ts`** — Auto-assigns `Person.scope` based on department membership.

### Program lifecycle

**`program-stage-change.ts`** — Handles stage transitions; creates tasks when entering certain stages.

**`new-program-tasks.ts`** — Auto-creates ClickUp tasks and internal records on new program creation.

**`lat-stage-follow-up.ts`** — Manages `LicensorApprovalThread` stage transitions.

### ClickUp sync

**`clickup-sync.ts`** — Reads ClickUp task status, writes to `Opportunity.clickupStatus`.

### Installation hooks

**`pre-install.ts`** — Placeholder, runs before app deployment.

**`post-install.ts`** — Cleans up unnamed Department records. Ensures Department field is visible in Person record panel via metadata API.

---

## 6. Front Components

React widgets embedded in record pages. Built with `defineFrontComponent()` from `twenty-sdk`.

| Component | File | universalIdentifier |
|---|---|---|
| PersonDepartmentPicker | `person-department-picker.tsx` | `d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80` |
| DepartmentDashboard | `department-dashboard.tsx` | `5fae5406-dd4c-4668-a585-5fb114b2399c` |
| ProgramFolio | `program-folio.tsx` | `e889e47d-2fca-432d-8321-655349e27740` |
| DomainManager | `domain-manager.tsx` | (see source) |
| MondayMorningDashboard | `monday-morning-dashboard.tsx` | (see source) |

### PersonDepartmentPicker implementation notes

This component was debugged over multiple sessions. Key points:

- Uses `useRecordId()` from `twenty-sdk` to get the current Person ID.
- Fetches current department: `person(filter: { id: { eq: $id } }) { department { id name } }` — must use `filter:` syntax; `person(id: $id)` returns null silently.
- Searches departments: `departments(filter: { name: { ilike: $q } })` — must use `ilike:` for case-insensitive match.
- Can create new departments inline via `createDepartment` mutation.
- Built `.mjs` MD5: `f5a77bc23f0d3012fc0e179556f4ecfc`.

**Status:** Built but not yet registered with the server (blocked by `installApplication` bug — see section 8).

---

## 7. Views, Navigation, Page Layouts

### Sidebar navigation (defined in `src/navigation-menu-items/`)

| Position | Label | Target |
|---|---|---|
| 0 | Inbox | EmailMessage inbox view (UNROUTED filter) |
| 1 | Meeting Notes | MeetingNote list view |
| 2 | Ignore Rules | IgnoreRule list view |

### Default views (defined in `src/views/`)

| Object | View | Default filter |
|---|---|---|
| EmailMessage | Inbox | routingStatus = UNROUTED |
| Department | All Departments | none |
| MeetingNote | All Meeting Notes | none |
| Factory | All Factories | none |
| IgnoreRule | All Ignore Rules | none |
| LicensorApprovalThread | All Licensor Approvals | none |

### Record page layouts (defined in `src/page-layouts/`)

| Record | Tab 1 | Tab 2 |
|---|---|---|
| Person | Home (Fields + PersonDepartmentPicker) | Activity (Timeline) |
| Opportunity | Folio (ProgramFolio component) | Activity (Timeline) |
| Department | Overview (DepartmentDashboard component) | Activity (Timeline) |

**Status:** Page layouts are defined in source but have not been synced to the server (blocked by the same `installApplication` bug).

---

## 8. Data Visibility and Permissions

Record visibility is NOT "everyone sees everything." The intended access model:

### Companies
Shared between everyone in the workspace. All users can see all companies.

### Contacts (People) and Emails (EmailMessage)
**Restricted to the user from whose mailbox they were ingested**, plus admins. The `outlook-ingest` function sets `createdBy` with the workspace member ID corresponding to the polled mailbox. Other users should not see raw emails or contacts that were ingested from someone else's mailbox.

### Meeting Notes
Shared between everyone who attended the meeting (linked via `MeetingNoteAttendee`) plus everyone attached to the Opportunities that the meeting is associated with.

### Opportunities (Programs)
When analysis is drawn from emails and attached to an Opportunity, everyone linked to that Opportunity can see the analysis — but **not** the raw underlying emails.

### Implementation status
As of 2026-03-31, the roles in the workspace (Admin, Member, POP Creations CRM function role) all have `canReadAllObjectRecords: true` with no row-level permission predicates. **The intended visibility model described above is not yet enforced.** Row-level security predicates need to be created and assigned to the Member role to restrict Email and Contact visibility.

---

## 9. Known Bugs and Hard Limits

### Email routing not executing

**Status:** Unresolved as of 2026-03-31.

Logic functions are registered on the server (metadata records exist for all 11 functions) but their compiled `.mjs` code was never uploaded via `installApplication`'s `writeFilesToStorage` step. Cron triggers fire but the handlers have no code to execute. As a result, all 7,195 ingested emails have `routingStatus: UNROUTED` with no company/department/program assigned.

**Impact:** The entire email routing pipeline (domain matching, department narrowing, PO/SO matching, fuzzy match, AI matching) does not run. The `email-rerouter` (every 6 hours) also does not execute.

### Field applicationId mismatch (resolved 2026-03-31)

The `company` and `department` relation fields on `emailMessage` were created via direct API calls, giving them Workspace App ownership and random `universalIdentifier` values instead of the source-code UIDs. This prevented adding them to views. Fixed by updating `applicationId` and `universalIdentifier` in the database to match the POP Creations CRM app and source-code values.

### `installApplication` fails for any non-empty manifest

**Status:** Unresolved as of 2026-03-31. This is the largest blocker.

Any manifest that includes objects, fields, views, logic functions, or front components causes `installApplication` to return `INTERNAL_SERVER_ERROR`: "Validation errors occurred while syncing application manifest metadata."

**Root cause:** `computeAllInvolvedApplicationIds()` in Twenty's migration service throws when processing entities — it cannot find expected entries in `flatApplicationMaps`. This appears to be a systemic issue with this Twenty instance.

**Impact:**
- Logic functions, front components, views, navigation items, and page layouts from `src/` have never been synced to the server via the standard SDK flow.
- The custom schema (objects and fields) was created via direct GraphQL API calls before this limitation was discovered.

**Empty manifests succeed.** You can call `installApplication` with an empty manifest (no objects, fields, etc.) without error. This is how the workspace was partially reset during debugging.

### Front component registration blocked downstream

Front components require their built `.mjs` to exist in the server's `BuiltFrontComponent` file storage. Files only reach that storage via `installApplication`'s `writeFilesToStorage` step. The alternatives (`uploadApplicationFile`, `syncApplication`) are dev/test-only and return FORBIDDEN in production.

`createFrontComponent` mutation also checks for the built file before creating the record and throws `FRONT_COMPONENT_CREATE_FAILED` if it's not there.

### `inferDeletionFromMissingEntities: true`

`installApplication` uses this flag. All app-managed entities **not** in the incoming manifest are deleted. DB tables are dropped for deleted custom objects. Never upload a partial manifest thinking "this will just add the new things" — it will delete everything not listed.

---

## 10. Critical Incident Log

### 2026-03-31: Workspace destroyed by incorrect installApplication call

**What happened:** An AI assistant (Claude) during debugging called `installApplication` with the **Workspace App** registration ID (`6ed66b1d-7d0e-49b1-bc9b-be860464e8cf`) instead of the POP Creations app ID. The tarball had an empty manifest. Because `inferDeletionFromMissingEntities: true`, this deleted every entity owned by the Workspace App:

- All 8 custom objects: Department, EmailMessage, MeetingNote, MeetingNoteAttendee, Factory, IgnoreRule, LicensorApprovalThread, AiModelConfig
- All custom fields on Person, Company, Opportunity, Note, WorkspaceMember
- Custom roles

The API key lost its role assignment. The workspace stopped loading after Microsoft sign-in.

**Current state (as of 2026-03-31):** Broken. Users can authenticate but see a blank dark screen.

**Recovery path:** PostgreSQL schema namespace is `99c80ca1610f48b5bd1f9178201bdcb7`. Need Coolify → PostgreSQL shell access. Options:
1. Restore from a database backup (check `/var/backups/popcreations`)
2. Re-create schema from scratch via the metadata API (all definitions exist in `src/objects/` and `src/fields/`)

**Rule going forward:**
> NEVER call `installApplication` on the Workspace App registration ID `6ed66b1d-7d0e-49b1-bc9b-be860464e8cf`.
>
> Only ever use the POP Creations CRM registration ID: `bdc3bca3-d392-419b-aa6a-3c7d105cc305`.

---

## 11. Pending Work

### RESOLVED: Workspace restored (2026-03-31)

Custom schema was re-created via direct metadata API calls. The workspace loads and is functional. View fields for Company, Department, and Program on EmailMessage were fixed by correcting `applicationId` and `universalIdentifier` in the database.

### CRITICAL: Get logic function code executing

Logic function metadata records exist on the server but the compiled `.mjs` code was never uploaded. The entire email routing pipeline, Fireflies ingest, ClickUp sync, and status synchronization are non-functional. Requires either:
1. Fix `installApplication` for non-empty manifests (upstream Twenty bug)
2. Find alternative mechanism to upload `.mjs` files to server storage
3. Run routing logic externally as a standalone cron job outside Twenty

### Implement row-level security for Emails and Contacts

The intended visibility model (see Section 8) is not enforced. Need to:
- Create row-level permission predicates on `EmailMessage` and `Person` objects
- Restrict visibility to the workspace member whose mailbox was the ingestion source (`createdBy.workspaceMemberId`)
- Meeting Notes need predicates based on attendee membership and linked Opportunity associations

### Deploy front components and page layouts

Blocked by `installApplication` bug:
- Register all 5 front components (PersonDepartmentPicker, DepartmentDashboard, ProgramFolio, DomainManager, MondayMorningDashboard)
- Sync page layouts for Person, Opportunity, Department records
- Sync navigation menu items and views

---

## 12. Developer Advice

### GraphQL filter syntax

Twenty's data API requires filter objects, not positional arguments:

```graphql
# Correct
person(filter: { id: { eq: $id } }) { ... }
departments(filter: { name: { ilike: $q } }) { ... }

# Wrong — returns null silently
person(id: $id) { ... }
```

Always use `ilike` (not `like`) for user-facing string search.

### Direct API access

```bash
# Data API
curl -X POST https://crm.designflow.app/graphql \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ people { edges { node { id name { firstName lastName } } } } }"}'

# Metadata API (schema)
curl -X POST https://crm.designflow.app/metadata \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ objects { edges { node { nameSingular } } } }"}'
```

API key is in Claude Code memory at `/home/ai/.claude/projects/-worksp-twenty/memory/reference_twenty_api_key.md`.

### Universal identifiers are permanent

Every object, field, view, component, role has a `universalIdentifier` UUID. Once synced to any environment, these must never change. A UID change means the server treats it as a new entity and deletes the old one.

All custom object UIDs are centralized in `src/objects/identifiers.ts` to prevent circular import issues.

### The generate-manifest.mts fallback

When `npx twenty app:build --tarball` fails at the sync step (expected in production), the deploy workflow runs `scripts/generate-manifest.mts`. This script:
- Reads all TypeScript source files via dynamic ESM imports
- Reads built `.mjs` output from `.twenty/output/src/`
- Writes `manifest.json` to `.twenty/output/`

It may silently skip files that fail to import — watch for "Skipping X:" warnings in CI output.

### The createRequire patch in CI

Logic function `.mjs` bundles include `createRequire(import.meta.url)` which throws on the Twenty server when `import.meta.url` is undefined. The deploy workflow patches this with `sed`. If logic functions crash after deployment with a "path argument must be of type string" error, check that the sed substitution in `.github/workflows/deploy-sdk-app.yml` is still working.

### Two completely separate deployment paths

As noted in README.md, this repo has two distinct deployment flows that do not overlap:

1. **Docker/runtime overlay** (`Dockerfile`, `autocomplete.js`): deployed via `publish-image.yml` → GHCR → server auto-deploy timer.
2. **SDK app** (`src/`): deployed via `deploy-sdk-app.yml` → `uploadAppTarball` → `installApplication`.

A git push alone will not sync workspace metadata. You must also trigger or wait for the SDK deploy workflow.

### installApplication behavior summary

- Reads the uploaded tarball
- Calls `writeFilesToStorage` to extract logic function and front component `.mjs` files to server storage
- Calls `syncMetadataFromManifest` with `inferDeletionFromMissingEntities: true`
- Deletes all app-managed entities not present in the manifest
- Drops DB tables for deleted custom objects

This is destructive. Always include the complete manifest. Never pass the Workspace App registration ID.
