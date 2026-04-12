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

**POP Creations** is a small wholesale consumer goods company. They design, source, and sell
seasonal and everyday products (home decor, holiday items, outdoor goods) to major retail chains.
Their buyers are at Dollar General, Five Below, Dollar Tree, Walmart, Hobby Lobby, Burlington,
Ross Stores, and a growing list of potential customers.

The CRM exists to track every buyer relationship, every product program, and every piece of
communication — from initial pitch to delivery confirmation.

### Vocabulary map

| CRM term | Business meaning |
|---|---|
| Opportunity | Program — a specific SKU or product line pitched to a specific retailer for a specific season |
| Company | Retailer or vendor |
| Person | A buyer, manager, or contact at a retailer |
| Department | A buying department within a retailer (e.g. "Dollar General — Seasonal", "Walmart — Home") |
| EmailMessage | An ingested Outlook email from a POP staff mailbox |
| MeetingNote | A Fireflies AI transcript or manually created meeting record |
| LicensorApprovalThread | A licensing approval workflow — required when a product uses licensed artwork (Disney, etc.) |
| Factory | A manufacturing partner who produces POP's products |
| AiModelConfig | The workspace's AI model selection (single record named "Default") |

### The retail buying cycle — how programs work

A **Program** (Opportunity) typically follows this lifecycle:

1. **Initiation** — POP identifies a product idea for a retailer/season. An Opportunity is created.
2. **Design** — POP's design team creates samples. Files are shared with the buyer.
3. **Buyer review** — The buyer reviews samples. Meetings happen (tracked as MeetingNotes). Emails fly.
4. **Pricing** — POP submits costs; the buyer negotiates. Eventually a price is agreed.
5. **Purchase Order issued** — The retailer issues a PO (Purchase Order). This has a PO number.
   - The PO number is the retailer's identifier for this order
   - POP's internal tracking uses a Sales Order (SO) number
6. **Production** — Factory manufactures the product. Factory is linked to the Opportunity.
7. **Delivery** — Product ships to the retailer's DC by the `hardDeliveryDate`. This is a hard deadline — missing it means chargebacks or order cancellation.
8. **Closed / Shipped** — Program is complete.

### Departments — how they work at retailers

Large retailers (Walmart, Dollar General, etc.) organize their buying into departments. A department
is a buying team focused on a specific product category:
- "Dollar General — Seasonal" buys Halloween, Christmas, Easter merchandise
- "Dollar General — Home" buys home decor year-round
- "Walmart — Patio" buys outdoor/patio products

Each department has its own buyers (People in the CRM). POP's salespeople manage relationships at
the department level, not just the company level. When an email comes in, it belongs to a specific
department based on which buyers are on it.

### What "customer status" means on a Company

| Status | Meaning |
|---|---|
| `ACTIVE_CUSTOMER` | Currently doing business — POP has active or recent programs with them |
| `POTENTIAL_CUSTOMER` | In conversation or prospecting — no confirmed orders yet |
| `PAST_CUSTOMER` | Had programs before, not active now |
| `OTHER` | Vendor, supplier, freight company, or other non-retailer relationship |

**This status drives email routing.** Only ACTIVE_CUSTOMER and POTENTIAL_CUSTOMER companies are
candidates for automatic routing. An email from a vendor (OTHER) does not get routed to a customer.

### Emails — the core workflow

POP's primary communication channel is email. All buyer communication happens in Outlook.
The CRM ingests emails from connected Outlook accounts and routes them to the right Program.

When an email comes in from a buyer at Walmart:
1. The system recognizes the `@walmart.com` domain
2. Assigns the email to the Walmart Company
3. Looks at which specific buyers are on the email to determine the Department
4. Looks for SO/PO numbers or program name mentions to determine the Opportunity

Emails that can't be automatically routed go to an "Unrouted" inbox for manual review.

### Sales Order (SO) numbers and Purchase Order (PO) numbers

These are the critical identifiers that link an email to a specific Program.

- **PO number** — issued by the retailer when they place an order. The buyer mentions it in emails.
- **SO number** — POP's internal tracking number for the same order.

Each retailer has their own format for PO numbers. These appear in email subjects and bodies and
are the most reliable way to connect a vendor email (like Fine Line Technologies) to the right Program.

### Licensors — when a product uses IP

Some products use licensed artwork (e.g. a Disney character on a decoration). These require
**licensor approval** before production can begin. Each approval is tracked as a
`LicensorApprovalThread` with its own stage and due date. Missing a licensor deadline can
block production and miss the delivery date.

### Fine Line Technologies — special vendor

Fine Line Technologies (finelinetech.com) is a **tagging/ticketing vendor** that serves many of
POP's retail customers. They produce the price tags, hang tags, and barcodes that go on products.

They communicate directly with POP about tag specifications for each order. Their emails almost
never include a customer email address — they are purely vendor-to-POP communications. The only
way to link their emails to the right Program is:
- The customer company name mentioned in the body
- The SO/PO number mentioned in the body

**Fine Line emails will never be auto-routed by domain.** They require SO/PO matching or body
text matching to connect to a Program.

### Salespersons and territories

POP has multiple salespeople, each responsible for different accounts. The `primarySalesperson`
field on Company determines who owns an account. In meetings and program tracking, the relevant
salesperson is a key attribute.

### ClickUp — task management

ClickUp is POP's external task management tool. Program (Opportunity) status is synced from
ClickUp into the CRM via the `clickupStatus` field. The `clickup-sync` cron runs daily at 7am
to pull the latest status.

---

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

**Change:** Added one import + one JSX interpolation for route elements.
```typescript
// Added import:
import { popCreationsRouteElements } from '@/pop-creations/routes/popCreationsRoutes';

// In route tree (as JSX interpolation, NOT as a component — see Idiosyncratic Decisions):
{popCreationsRouteElements}
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

### `packages/twenty-front/src/modules/ui/layout/page/components/DefaultLayout.tsx`

**Change:** Added one import + one JSX element (admin version banner at very top of every page).
```typescript
// Added import:
import { AdminVersionBanner } from '@/pop-creations/components/AdminVersionBanner';

// In JSX, first child inside AppErrorBoundary:
<AdminVersionBanner />   ← added (renders nothing for non-admins)
<InformationBannerIsImpersonating />
```
**Future changes:** Do not add more banners here. Use the pop-creations widget/route system instead.

### `packages/twenty-front/src/modules/object-record/hooks/useHandleFindManyRecordsError.ts`

**Change:** Added `isSchemaMismatchError()` helper + early-return guard before the toast call.
```typescript
// Added helper (checks GraphQL error extension codes, not message text):
const isSchemaMismatchError = (error: ErrorLike): boolean => { ... };

// Added guard inside handleFindManyRecordsError, before enqueueErrorSnackBar:
if (isSchemaMismatchError(error)) {
  handleError?.(error as Error);
  return;   // suppress toast — schema mismatch is a pre-cutover condition, not a user error
}
```
**Why this was necessary:** After the fork image was deployed, the workspace sync added new custom
fields (e.g. `soPatterns` on Company) to the metadata. The frontend queries include those fields,
but the production DB columns don't exist yet (cutover migration pending). This caused 3
`FIELD_NOT_FOUND` GraphQL errors on every login, each showing an "An error occurred." toast.
**Remove this change after the production cutover migration runs** — at that point the DB will
have all columns and the errors will stop occurring naturally.
**Future changes:** Do not add more suppression logic here. Fix the root cause (run the cutover).

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
- `useHandleFindManyRecordsError.ts` — check for `isSchemaMismatchError` guard (remove after cutover)

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

## 11a. Email Routing — Full Business Logic

This section documents all routing rules so future sessions don't have to reverse-engineer the code.

### Routing statuses (EmailMessage.routingStatus field)

| Status | Meaning |
|---|---|
| `ROUTED` | Company + Department + Opportunity all assigned. Fully processed. |
| `COMPANY_DEPT` | Company and Department assigned, but no matching Opportunity found yet. |
| `COMPANY_ONLY` | Company assigned, but no Department or Opportunity. |
| `CUSTOMER_EMAIL_NO_COMPANY` | A known customer email address is on the email, but it couldn't be matched to a Company record. This is unusual and worth reviewing manually. |
| `UNROUTED` | No company assigned. Domain didn't match any known customer. Needs manual review or wait for rerouter. |
| `SKIPPED` | Deliberately ignored (matches an IgnoreRule pattern or flagged manually). |

The rerouter cron (every 6 hours) re-processes UNROUTED, COMPANY_ONLY, and COMPANY_DEPT emails. It only upgrades status — never downgrades.

### Step 1: Domain → Company matching

The router extracts every email address from the email (from, to, cc, bcc). For each domain:
- Strip the domain from the email address
- Look up Companies whose `domainName.primaryLinkUrl` matches
- **Only match ACTIVE_CUSTOMER or POTENTIAL_CUSTOMER companies** — ignore OTHER, PAST_CUSTOMER, etc.

**Multi-party rule (critical):** An email is routed to customer X only if:
- At least one customer domain is present, AND
- No OTHER customer domain is also present (two different customers on the same email = ambiguous, do not assign to either)
- Vendor domains (companies with `customerStatus = OTHER`) do NOT block routing — they are ignored in this check

**Result:** Sets `companyId` on the EmailMessage.

### Step 2: Department narrowing

Once a Company is assigned, look up all Person records associated with that Company who appear on the email. Check their `department` relations.
- If all identified contacts belong to the SAME department → assign that department
- If contacts span multiple departments → treat as companywide, do not assign a department
- If all contacts are in non-departmental roles (logistics, compliance, general) → treat as neutral, look at the departmental contacts only for assignment

**Result:** Sets `departmentId` on the EmailMessage.

### Step 3: SO/PO number extraction

Extract Sales Order (SO) and Purchase Order (PO) numbers from the email body using regex patterns. Match against `Opportunity.soNumber` / `Opportunity.poNumber` fields.

If a match is found, assign that Opportunity regardless of domain or department.

**Result:** Sets `opportunityId` on the EmailMessage (overrides steps 1-2 if match found).

### Step 4: Fuzzy name matching

Tokenize the email subject and body. Look for mentions of known Opportunity names or Department names. Use token overlap scoring to find the best match above a confidence threshold.

**Result:** Sets `opportunityId` if confidence is high enough.

### Step 5: AI matching (fallback)

If steps 1-4 didn't find an Opportunity, call OpenRouter with the email content + a list of active Opportunities for the matched Company. The AI returns the most likely Opportunity or "none."

Model selection: read at runtime from the `AiModelConfig` workspace record (field: `model`).

**Result:** Sets `opportunityId` if AI is confident.

### Fine Line Technologies — special case

**Domain:** `finelinetech.com`
**Company status:** `OTHER` (vendor — serves multiple retail customers, not a POP customer)

Fine Line Technologies emails almost never have a customer email address in the headers. The only routing signals are:
- Company/retailer name mentioned in the email body (fuzzy match against customer company names)
- SO numbers in the body that match an existing Opportunity

**Do not** route Fine Line emails by domain — the domain is a vendor, not a customer. The system correctly skips them at Step 1 (OTHER status excluded). They will remain UNROUTED unless Step 3 (SO match) or Step 4 (body fuzzy match) succeeds.

### Known customer domains (as of 2026-04-06)

| Company | Domain | Status |
|---|---|---|
| Dollar General | dollargeneralcorp.com, dollargeneral.com | ACTIVE_CUSTOMER |
| Five Below | fivebelow.com | ACTIVE_CUSTOMER |
| Dollar Tree | dollartree.com | ACTIVE_CUSTOMER |
| Walmart | walmart.com | ACTIVE_CUSTOMER |
| Hobby Lobby | hobbylobby.com | ACTIVE_CUSTOMER |
| Burlington Stores | burlington.com | ACTIVE_CUSTOMER |
| Ross Stores | ros.com | ACTIVE_CUSTOMER |
| Forman Mills | formanmills.com | POTENTIAL_CUSTOMER |
| BoxLunch | boxlunch.com | POTENTIAL_CUSTOMER |
| Ollie's Bargain Outlet | ollies.us | POTENTIAL_CUSTOMER |
| Spirit Halloween | spirithalloween.com | POTENTIAL_CUSTOMER |
| Spencer Gifts | spencergifts.com | POTENTIAL_CUSTOMER |
| Hot Topic | hottopic.com | POTENTIAL_CUSTOMER |
| Fine Line Technologies | finelinetech.com | OTHER (vendor) |

**Important about ros.com:** This is Ross Stores' corporate email domain, NOT a generic domain. Do not mistake it for something unrelated. The company is "Ross Stores" and the domain is `ros.com`.

**Burlington merge note:** `burlingtonstores.com` was merged into `burlington.com` — only `burlington.com` exists as the canonical domain.

**Walmart merge note:** `wal-mart.com` was merged into `walmart.com` — only `walmart.com` is canonical.

### M365 Email Sync — status as of 2026-04-06

Email ingestion uses Twenty's built-in Microsoft Graph sync (BullMQ worker). Two connected accounts:
- **albert@popcre.com** — last synced March 29, no emails newer than March 26. Needs monitoring.
- **adweck@popcre.com** — was stuck in `ONGOING` sync state (never completed first sync). Reset to `ACTIVE` + worker restarted on 2026-04-06. Needs monitoring to confirm.

If email sync appears stuck: check `messageChannel.syncStatus` via the API. If `ONGOING` with `syncedAt=null`, reset to `ACTIVE, MESSAGE_LIST_FETCH_PENDING`.

**OAuth expiry alerting (pending):** A cron job needs to be created that checks `connectedAccount.authFailedAt` for all accounts and alerts (via email or in-CRM notification) when M365 OAuth tokens have expired.

### API rate limits

The Twenty GraphQL API rate limit was `100 mutations/60s` by default. This has been overridden via Coolify environment variables:
- `API_RATE_LIMITING_LONG_LIMIT=100000` (was 100)
- `API_RATE_LIMITING_SHORT_LIMIT=10000` (was 100)

This is our own server. There is no need to batch or throttle API calls.

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

### Apollo Client import — CRITICAL for frontend builds

In Twenty's Rollup build, `@apollo/client` only exports `gql` and types. React hooks (`useQuery`, `useMutation`, `useApolloClient`, etc.) must come from `@apollo/client/react`.

```typescript
// CORRECT
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

// WRONG — causes "X is not exported by core/index.js" at build time
import { useQuery, gql } from '@apollo/client';
```

This is especially easy to get wrong when writing new pop-creations pages since external docs show the unified import.

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

### Coolify deployment

- **Panel:** http://178.156.180.212:8000/
- **API token:** in GitHub Secrets as `COOLIFY_API_TOKEN`; also in Claude's memory at `/home/ai/.claude/projects/-worksp-twenty/memory/reference_coolify.md`
- **Server UUID:** `rd261bt0wy7ifjrkoe1tkl92` (main app)
- **Worker UUID:** `pkhhmt4r7n0xt25jmmlkkfi8` (background worker)
- **PostgreSQL UUID:** `g5j115bwrn8125ev6ap1tjrv`
- **Target image:** `ghcr.io/u2giants/twenty:latest`
- **Current running image** (pre-cutover): `ghcr.io/u2giants/twenty-deploy/twenty-custom:main`

Coolify is a consumer of pre-built images. It never builds from source. GitHub Actions builds and pushes to GHCR; Coolify just pulls `:latest` and restarts.

---

## 16. Pending Work

### CRITICAL: Execute production cutover

All development phases (0-8) are committed to `main`. Deployment is pending.
See `migration-reference/CUTOVER_RUNBOOK.md`. Requires:
- ✅ GitHub Actions build fix (Apollo import fix pushed 2026-04-06 — build now in progress)
- Coolify API: update both server (`rd261bt0wy7ifjrkoe1tkl92`) and worker (`pkhhmt4r7n0xt25jmmlkkfi8`) to pull `ghcr.io/u2giants/twenty:latest`
- Database ownership transfer SQL (`migration-reference/transfer-ownership.sql`)
- Environment variables: `OPENROUTER_API_KEY`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
  `AZURE_CLIENT_SECRET`, `OUTLOOK_MAILBOX`, `CLICKUP_API_TOKEN`

### M365 OAuth expiry alerting

Build a cron job (e.g. `oauth-health-check.cron.job.ts`) that:
- Queries all `connectedAccount` records
- Checks `authFailedAt` field — if non-null and recent, the token has expired
- Sends an alert (email to admin, or creates a high-priority Task record in Twenty) when any account token has expired

Both albert@popcre.com and adweck@popcre.com are connected. More accounts may be added in future.

### SO number extraction / routing inbox

Extract Sales Order numbers (pattern: `SO-XXXXXX` or `SO #XXXXXX` or similar) from ALL email bodies during ingestion. Store extracted SO numbers on the EmailMessage record. Create a custom view ("SO Inbox") showing emails with detected SOs that aren't yet linked to an Opportunity. This allows manual or semi-automatic association of Fine Line Technologies emails and other vendor emails to their correct Programs.

Requires: new field `detectedSoNumbers` (array of strings) on EmailMessage, plus indexing in the ingest job and a frontend view.

### Fine Line Technologies body-based routing

Once the fork is deployed and SO extraction is in place, add Step 3a to the routing pipeline: for emails where `finelinetech.com` is a sender, search the body for customer company name mentions and SO numbers, then route accordingly.

### Row-level security for Emails and Contacts

After cutover, implement permission predicates:
- `EmailMessage`: restrict to workspace member whose mailbox ingested them (`createdBy`)
- `Person`: same restriction for contacts created during email ingest
- `MeetingNote`: visible to attendees + users linked to associated Opportunity

### Verify M365 email sync is working

After the worker restart on 2026-04-06, confirm:
- adweck@popcre.com begins receiving new emails (sync was stuck ONGOING since initial setup)
- albert@popcre.com resumes (last sync was March 29, no emails since March 26)

If sync is still stuck after 24 hours, check BullMQ queue status via Coolify logs.
