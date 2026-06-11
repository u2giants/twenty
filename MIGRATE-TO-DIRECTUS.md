# MIGRATE-TO-DIRECTUS.md — Migrate the POP CRM off Twenty onto the shared Directus backend

> **Audience:** a brand-new AI coding session (or senior engineer) with **zero prior context**.
> Everything you need to plan and execute the migration is in this one file plus the repos and
> infrastructure it points you to. Read this top-to-bottom once before touching anything.
>
> **Status of this document:** written 2026-06-10 from the *actual* state of the repos and live
> infra (verified facts are marked; everything I could not verify is flagged as an explicit
> **UNKNOWN** with how to verify it). No IDs, schema, or behavior here is invented — where I did
> not confirm something against a live system, I say so.

---

## 0. TL;DR — what you are doing and why

**POP Creations** runs three internal apps — **PIM** (product/project management), **CRM**, and
**DAM** (digital asset management). The company is consolidating all three onto **one shared,
self-hosted Directus backend** (one Postgres database) so their data interlinks ("super-app"). The
PIM app is already built this way.

**This migration** does two things:

1. **Move the CRM's data and model off the current Twenty stack onto the shared Directus backend**
   (`u2giants/directus`, live at `https://data.designflow.app`). The CRM becomes a set of Directus
   collections in the *same* Postgres database the PIM already uses, so CRM companies/opportunities
   can link to PIM retailers/products.
2. **Replace Twenty's frontend with a new React app `popcmr-web`** — built with the *same recipe*
   as the PIM frontend (`u2giants/poppim-web`) — served at **`https://crm.designflow.app`** (the
   domain Twenty currently occupies). The new frontend stores **no data**; it calls the Directus API.

**Why** (owner context): the owner is a **non-programmer who works with AI agents and dislikes
forking**. Twenty is a *fork* (of `twentyhq/twenty` v2.8.3) carrying ~39 commits of project-specific
changes that must be re-applied on every upstream upgrade — exactly the maintenance burden they want
to escape. Directus runs as a **stock image** (`directus/directus:11`), and all customization is
*configuration* (collections/fields/Flows/roles via API scripts) — no fork to maintain.

**End state:** `crm.designflow.app` serves `popcmr-web`; CRM data lives in the shared Directus
Postgres; Twenty (server + worker + its own Postgres + Redis) is decommissioned after a verified
backup.

---

## 1. The three repos and their roles (orient here first)

| Repo | Local clone | Role | Read first |
|---|---|---|---|
| **`u2giants/directus`** | `/worksp/directus` | **Shared backend.** Stock `directus/directus:11` + Postgres on Coolify, live at `https://data.designflow.app`. Owns the schema, roles, Flows, SSO, Entra role-sync. | `AGENTS.md` (very detailed), `pm-system/` |
| **`u2giants/twenty`** | `/worksp/twenty/fork` (root-owned; `sudo` to read) | **The CRM being retired.** A fork of Twenty v2.8.3, live at `https://crm.designflow.app`. This is the **source schema + source data**. | `AGENTS.md`, `packages/twenty-server/src/modules/pop-creations/` |
| **`u2giants/poppim-web`** | `/worksp/poppim-web` | **The PIM frontend** — the *recipe* `popcmr-web` must copy. React + Vite + TS + Tailwind v4 + shadcn/ui + `@directus/sdk` (session-cookie SSO). | `AGENTS.md`, `src/lib/directus.ts`, `src/auth/auth.tsx`, `Dockerfile`, `nginx.conf` |

**New repo you will create:** `u2giants/popcmr-web` — the CRM frontend (sibling to `poppim-web`).

> **VERIFIED:** `/worksp/twenty/fork` is the working clone of `u2giants/twenty`. Its `.git/index` is
> **root-owned** (read it with `sudo git -C /worksp/twenty/fork ...`; you cannot commit from it as the
> `ai` user). `/worksp/twenty` itself is **not writable** by `ai`. To push to `u2giants/twenty`, clone
> fresh into a writable dir with `gh repo clone u2giants/twenty` (the `gh` CLI is authed as `u2giants`).
> There is also a second worktree `/worksp/twenty/refork` and a `v28-refork` branch — historical;
> ignore unless told otherwise.

---

## 2. Established architecture you MUST preserve (verified against live infra)

### 2.1 Domain plan (permanent)
Humans use **app subdomains**; the backend is API-only.

| Domain | Serves | State today (VERIFIED) |
|---|---|---|
| `pm.designflow.app` | PIM frontend (`poppim-web`) | 302 redirect; currently still points at the Directus backend, rebinds to the frontend at launch |
| **`crm.designflow.app`** | **CRM frontend (`popcmr-web`) — the target of this work** | **Currently serves the live Twenty fork** (build hash `bc96454eeb…`, 2026-06-04). Cutover repoints it to `popcmr-web`. |
| `dam.designflow.app` | DAM frontend (`popdam-web`) | future |
| `data.designflow.app` | **Directus backend API only** (Data Studio + REST/GraphQL) | live; `/server/ping` → `pong` |

> Frontends own **no data**. One shared Postgres behind Directus serves all three apps.

### 2.2 Shared backend (the directus repo) — how it builds schema
The directus repo customizes Directus purely as **configuration via the Directus API**, in idempotent
Node scripts under `pm-system/`. Study these (they are the templates for the CRM schema script):

- **`pm-system/apply-schema.mjs`** — creates the 14 PIM collections, fields, relations, the Designer
  role/policy + field-level permissions, and a Flow. **Key patterns to copy** (all VERIFIED in the file):
  - Auth: `POST /auth/login {email,password}` → `access_token`; all calls send `Authorization: Bearer`.
  - **Create a collection as a real table** with `POST /collections { collection, meta, fields, schema: {} }`.
    The `schema: {}` is *mandatory* — without it Directus creates a **folder**, not a table.
  - Primary key pattern: `{ field:'id', type:'uuid', schema:{is_primary_key:true,has_auto_increment:false},
    meta:{ special:['uuid'], hidden:true, readonly:true } }`.
  - **M2O relation:** first add a `uuid` field with `interface:'select-dropdown-m2o'`, then
    `POST /relations { collection, field, related_collection, schema:{on_delete:'SET NULL'}, meta:{} }`.
  - **Select/dropdown field:** `type:'string'`, `interface:'select-dropdown'`,
    `options:{choices:[{text,value}, …]}`.
  - The script is **re-runnable**: it deletes the business collections in reverse order, then recreates.
- **`pm-system/setup-roles-and-flows.mjs`** — creates Sales / Licensing / Viewer / Vendor roles, each
  with a **policy** (`admin_access:false, app_access:true`), per-collection **permissions**
  (`POST /permissions {policy, collection, action:'read'|'create'|'update', fields:[…], permissions:{}, validation:{}}`),
  a `POST /access {role, policy}` link, and an admin-notify Flow. Field-level hiding is done by listing
  the visible `fields` (e.g. pricing columns omitted for non-pricing roles).
- **`pm-system/add-collaboration-model.mjs`** — adds `checklist_item`, `subtask`, and the
  `product_assignee` M2M plus per-role permissions. Template for **M2M** and for **adding to an existing
  schema** without a full rebuild.
- **`pm-system/migration/clickup-import.mjs`** — the **migration pattern** to mirror: read from a source
  API, **upsert by `external_id`** (provenance fields `external_id` + `external_source` on each collection),
  resolve reference rows by name (`getOrCreateRef`), preload existing `external_id`→Directus-id maps to make
  re-runs idempotent, two-pass (parents first, then children referencing the parent map). Supports `DRY=1`.
- **`pm-system/sync/entra-role-sync.mjs`** — the hourly Directus→Entra role mirror (Model B, §2.4).

> **To re-apply any schema script** (from `AGENTS.md` §13, VERIFIED):
> ```bash
> DX_URL=https://data.designflow.app \
> DX_ADMIN_EMAIL=Albert@popcre.com \
> DX_ADMIN_PASSWORD=*** \
> node pm-system/<script>.mjs
> # then RESTART the Directus service in Coolify (event-trigger Flows only register at boot)
> ```
> The script admin used by automation is **`svc@popcre.com`** (provider `default`, password in Coolify
> `DX_ADMIN_PASSWORD`; local copy `DX_ADMIN_EMAIL`/`DX_ADMIN_PASSWORD` in `/home/ai/.directus-deploy.env`).
> `Albert@popcre.com` is the **SSO** admin (provider `microsoft`) — do not use it for password login.
> Do not invent the password; read it from the secrets file or Coolify.

### 2.3 Frontend recipe (the poppim-web pattern — VERIFIED)
`popcmr-web` copies `poppim-web` exactly:

- **Stack:** React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui
  (`new-york` style, Radix primitives) + `@directus/sdk` (`^18`) + `lucide-react`. Path alias `@/* → src/*`.
- **SDK client (`src/lib/directus.ts`):**
  ```ts
  export const directus = createDirectus<Schema>(DIRECTUS_URL)
    .with(authentication('session', { credentials: 'include', autoRefresh: true }))
    .with(rest({ credentials: 'include' }))
  ```
  `DIRECTUS_URL` defaults to `https://data.designflow.app`, overridable via `VITE_DIRECTUS_URL`.
  Microsoft SSO hand-off: `${DIRECTUS_URL}/auth/login/microsoft?redirect=<frontend-origin>`.
- **Auth (`src/auth/auth.tsx`):** `AuthProvider` + `useAuth()` — session check via `readMe`,
  email/password `login`, `logout`, `refresh`.
- **Build/serve:** `Dockerfile` (node:20-alpine build → nginx:alpine serve), `nginx.conf` with SPA
  fallback (`try_files $uri $uri/ /index.html`). `npm run build` = `tsc -b && vite build` (must stay green).
- **Structure to mirror:** `src/lib/{directus.ts,types.ts,utils.ts}`, `src/auth/auth.tsx`,
  `src/pages/LoginPage.tsx`, `src/components/AppShell.tsx`, `src/components/ui/` (shadcn), `src/features/<x>/`.

**Backend env to add for a new frontend origin** (VERIFIED requirement from directus `AGENTS.md` §11
"Cross-subdomain SSO"): add the new origin to **`CORS_ORIGIN`** (specific allow-list, never `*` with
credentials) and to **`AUTH_MICROSOFT_REDIRECT_ALLOW_LIST`** on the directus Coolify service. Session
cookies are scoped to `.designflow.app` (`SESSION_COOKIE_DOMAIN`, `REFRESH_TOKEN_COOKIE_DOMAIN`,
`*_SECURE=true`, `*_SAME_SITE=lax`, `CORS_CREDENTIALS=true`) so login works across sibling subdomains.
> **VERIFIED:** `https://crm.designflow.app` is the domain Twenty holds today, so once `popcmr-web`
> deploys, the **same origin** `https://crm.designflow.app` must be in `CORS_ORIGIN` /
> `AUTH_MICROSOFT_REDIRECT_ALLOW_LIST`. For a **preview** origin (e.g. `crm-dev.designflow.app`), add it
> too. **UNKNOWN:** the current exact value of `CORS_ORIGIN` on the directus service — verify in Coolify
> before editing (don't assume `crm.designflow.app` is already present; the PIM app uses `pm-dev`).

### 2.4 SSO + roles (Model B — shared, VERIFIED in directus AGENTS.md §8/§11)
- **One Entra SSO**, **one role model**, reused by all apps. Roles are **edited in Directus** and
  **mirrored outbound to Entra** groups (the six `POP PIM ·` groups) by an hourly host systemd timer
  `directus-entra-sync.timer` running `pm-system/sync/entra-role-sync.mjs` (one-way Directus→Entra; the
  Graph write credential lives **only** in `/home/ai/.directus-deploy.env`, never in the container).
- SSO auto-registration is **ON**: any `@popcre.com` tenant user who signs in is auto-provisioned as a
  non-admin **Designer** (`AUTH_MICROSOFT_DEFAULT_ROLE_ID = 7c7299c9-bf6c-44f6-b952-b6983a3ca6e8`);
  admins re-assign the real role afterward.
- **Directus OIDC matches a user by `LOWER(external_identifier)` AND `provider='microsoft'`.** A
  password user (`provider='default'`) can never be matched by SSO. Keep `albert@popcre.com` on
  `microsoft` and `svc@popcre.com` on `default`.

### 2.5 Coolify owns runtime (VERIFIED)
Everything runs on **one VPS** (`178.156.180.212`, Coolify server UUID `onwp0kd7w1w74w9yeotnoihp`) via
**Coolify** (API + bearer token in `/worksp/directus/CLAUDE.md`; **do not paste the token into any
committed file**). Coolify owns env, domains, SSL, restart. Deploy via Coolify, **not** SSH/raw-docker
(raw-docker is a documented temporary preview deviation only — directus `AGENTS.md` §11).

| Thing | Identifier (VERIFIED) |
|---|---|
| Coolify API base | `http://178.156.180.212:8000/api/v1` (bearer in `/worksp/directus/CLAUDE.md`) |
| Coolify server (this VPS) | `onwp0kd7w1w74w9yeotnoihp` |
| Directus Coolify service | `nzli85mk3luzb6u7cnq5fidu` (project "POP PIM" `jdq36h5dq74o6ddhich9l796`) |
| **Twenty Coolify app** | **`rd261bt0wy7ifjrkoe1tkl92`** (server `server-rd261…` + worker `worker-rd261…`) |
| Cloudflare zone `designflow.app` | `921eb133a3f7d5802780445b283f84ce` — DNS via `CF_API_TOKEN` (+ `CF_ZONE_ID`) in `/home/ai/.directus-deploy.env` |

> **Note on the secrets-file path.** The orchestrating prompt referenced `/home/ai/.directus-deploy.env`
> for `CF_API_TOKEN`; the directus `CLAUDE.md` confirms `CF_API_TOKEN`/`CF_ZONE_ID` live there. (An older
> name `~/.poppim-deploy.env` was renamed to `~/.directus-deploy.env` on 2026-06-10.) Use the current
> file `/home/ai/.directus-deploy.env`.

---

## 3. Current Twenty state (the source you are migrating FROM) — VERIFIED

### 3.1 What Twenty is, structurally
A **fork of `twentyhq/twenty` v2.8.3** (Nx + Yarn monorepo). Live at `https://crm.designflow.app`.
The business purpose is an **inbound-email-routing CRM**: a cron polls a shared Outlook mailbox via
Microsoft Graph every 15 min, creates `emailMessage` records, and an **email router** classifies each
to the right company/department/opportunity.

- **Backend:** NestJS + GraphQL, a **metadata-driven custom-objects ORM** (Twenty's "workspace" engine).
  Standard objects are code-defined; custom objects/fields are registered in framework constant files.
- **Frontend:** React (Recoil/Apollo, Twenty's own UI) — this is what `popcmr-web` replaces.
- **Its own Postgres + Redis** (separate from the shared Directus Postgres).
- **Project-owned code** lives under `pop-creations/` subtrees (kept out of upstream files where possible).

### 3.2 Fork divergence from upstream (the maintenance burden being escaped) — VERIFIED
- **~39 commits** ahead of `upstream/main` (`git rev-list --count upstream/main..HEAD` = 39; merge-base
  `bb5c2bd00c…`). Remote `upstream` = `https://github.com/twentyhq/twenty.git`.
- Per `AGENTS.md` §4, the fork edits **~25 upstream framework files** (custom-object registration, field
  metadata pipeline, cron registration in 4 places, company/person/opportunity entity fields, Gmail
  display-name parsing, several frontend pickers, build-badge + cache-header changes, English-only i18n
  stripping). Every one is flagged "re-apply after upstream merge" — this is precisely the fork debt the
  move to stock Directus removes.

### 3.3 How Twenty is deployed (VERIFIED)
- **GHCR image:** `ghcr.io/u2giants/twenty:latest` (single image runs both server and worker; the worker
  diverges only by command `node dist/queue-worker/queue-worker` + `DISABLE_DB_MIGRATIONS=true` +
  `DISABLE_CRON_JOBS_REGISTRATION=true`).
- **Coolify app** `rd261bt0wy7ifjrkoe1tkl92`. Authoritative compose is `docker-compose.yaml` on
  `origin/main`; Coolify reads it each deploy. Traefik routes `Host(crm.designflow.app)` → container port
  3000, cert resolver `letsencrypt`.
- **CI:** `.github/workflows/build-and-push.yml` (lint → test → build → GHCR → Coolify). The upstream
  `cd-deploy-main.yaml` always fails on the fork (dispatches to a repo POP doesn't own) — harmless.
- **Live containers (VERIFIED via `docker ps`):** `server-rd261bt0wy7ifjrkoe1tkl92-*`,
  `worker-rd261bt0wy7ifjrkoe1tkl92-*` (both `ghcr.io/u2giants/twenty:latest`), `twenty-postgres`
  (`postgres:16-alpine`), `twenty-redis` (`redis:7-alpine`), `twenty-favicon`.

### 3.4 Where Twenty's data lives (VERIFIED + one UNKNOWN)
- Postgres container **`twenty-postgres`** (host Docker, `postgres:16-alpine`), DB `twenty`, user `twenty`
  (per `AGENTS.md` §5 migration command: `docker exec -i twenty-postgres psql -U twenty -d twenty`).
- Multi-tenant: core tables in schema `core`; **per-workspace data lives in schema
  `workspace_93r34ew9zc9644a9y5f1yeylz`** (VERIFIED identifier from `AGENTS.md` §6).
  Production workspace id `99c80ca1-610f-48b5-bd1f-9178201bdcb7`.
- **UNKNOWN — exact on-disk volume path & whether `twenty-postgres` is Coolify-managed or plain host
  Docker.** `AGENTS.md` §7 calls Postgres/Redis "external (not in compose)… host Docker." Verify before
  backup: `sudo docker inspect twenty-postgres --format '{{json .Mounts}}'` and
  `sudo docker inspect twenty-postgres --format '{{.Config.Image}}'`.
  (There are symlinks `/worksp/twenty/postgres → /data/coolify/databases/g5j115bwrn8125ev6ap1tjrv` and
  `/worksp/twenty/redis → …/jht51gt0biykivnama17crlt`, suggesting they may in fact be Coolify-managed DBs —
  confirm with `docker inspect` and the Coolify API before assuming.)

---

## 4. Twenty's CRM data model (the SOURCE schema) — VERIFIED from code

Twenty objects map to two groups: **standard objects** (some extended with POP fields) and **8
code-defined custom objects**. Field lists below are read from
`packages/twenty-server/src/modules/.../*.workspace-entity.ts` (entity TypeScript). The authoritative
field UUIDs/labels are in `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts`
and, at runtime, in `core.fieldMetadata` — extract those live when you need exact column names (§6.2).

### 4.1 Standard objects in use
- **company** (= CRM account / "customer company") — standard fields (name, domainName, address,
  employees, accountOwner, linkedinLink, xLink, annualRecurringRevenue, idealCustomerProfile, …) **plus
  POP fields**: `soPatterns`, `customerStatus`, `routingDomain`, `routingAliases`, `chainType`, and
  relations `departments[]`, `emailMessages[]`, `meetingNotes[]`, `primarySalesperson`.
- **person** (= contact) — standard fields (name {first,last}, emails, phones, jobTitle, city,
  company, …) **plus POP fields**: `contactType`, `scope` (drives email-router department attribution —
  must be `'DEPARTMENT'` to attribute), `department` (M2O), `departmentsAsPrimaryBuyer[]`.
- **opportunity** (= "program" / deal) — standard: `name`, `amount`(currency), `closeDate`, `stage`,
  `probability`, `pointOfContact`(person), `company`, `owner`(member) **plus ~23 POP fields**:
  `programType`, `seasonYear`, `directiveSource`, `division`, `originCountry`, `licensed`(bool),
  `productionPoNumber`, `salesOrderNumber`, `importPoNumber`, `customerIncoterms`, `factoryIncoterms`,
  `hardDeliveryDate`, `sampleRequired`(bool), `sampleApprovalMethod`, `requiresNewPricing`(bool),
  `clickupTaskId`, `clickupStatus`, `plmProjectId`, `aiSummary`, `aiState`, `department`(M2O),
  `factory`(M2O), `licensorApprovalThreads[]`, `emailMessages[]`, `meetingNotes[]`.
- **note**, **task**, **noteTarget**, **taskTarget** (Twenty's polymorphic activity model — notes/tasks
  attach to records via `*Target` join rows), **attachment**, **timelineActivity**,
  **workspaceMember** (= internal user), **favorite**, **view**/**viewField**/**viewFilter** (saved views).
  > Twenty has **no single "opportunity stage" object** — stage is an enum on `opportunity.stage`. Same
  > for `probability`. POP also added saved views (`Needs Routing`, `Unrouted Emails`, `Unrouted Notes`)
  > via migrations `010`/`011`.

### 4.2 POP custom objects (8, code-defined — VERIFIED field lists)
| Object | Key fields | Relations |
|---|---|---|
| **department** | name, category, division, active(bool), position | company (M2O), primaryBuyer (person M2O), people[], programs[](opportunity), meetingNotes[], emails[] |
| **emailMessage** | name, subject, sender, recipients, receivedAt, bodyPreview, outlookMessageId, routingStatus, routingMethod, detectedSoNumbers, detectedPoNumbers | program (opportunity), company, department, mailboxOwner (member) |
| **factory** | name, location, contactName, capabilities, notes | programs[] (opportunity) |
| **ignoreRule** | name, pattern, matchType, emailsSkipped(int) | — |
| **licensorApprovalThread** | name, propertyName, stage, submittedDate, responseDate, dueDate, licensorComments | program (opportunity) |
| **meetingNote** | name, date, participants, summary, actionItems, source, firefliesTranscriptId | company, department, program, person, attendees[] |
| **meetingNoteAttendee** | name | meetingNote (M2O), person (M2O) |
| **aiModelConfig** | name, emailRoutingModel, firefliesRoutingModel, transcriptSplitModel, opportunitySummaryModel | — |

> **Migration scope decision (flag for the owner):** the email-routing machinery (`emailMessage`,
> `ignoreRule`, `aiModelConfig`, the Outlook-ingest/router/ClickUp-sync crons, Fireflies webhook) is the
> *most fork-specific* part of Twenty and the **hardest to reproduce on Directus** (Directus has Flows but
> not Twenty's multi-step router pipeline). **UNKNOWN / DECISION NEEDED:** does the new CRM keep automated
> email routing in v1, or is v1 a clean records CRM (companies/people/opportunities/notes/tasks/meeting
> notes) with email routing deferred? This materially changes scope. **Default recommendation:** migrate
> the *records* model first (companies, people, opportunities, departments, factories, meeting notes,
> notes/tasks); treat email routing as a **Phase 2** Directus-Flow/worker re-implementation, and **keep
> the old `emailMessage` rows as historical data** imported read-only. Get the owner's call before building.

---

## 5. Target Directus model (the CRM collections to CREATE) — PROPOSED

Build this with a new **`pm-system/crm-schema.mjs`** in the directus repo, mirroring `apply-schema.mjs`
patterns exactly (`schema:{}` on create, uuid PK, M2O via `/relations`, `external_id`+`external_source`
on every collection). **Naming:** Directus collections are `snake_case`. To avoid clashing with PIM
collections in the shared DB, **decide a prefix convention with the owner** — recommended `crm_` prefix
(e.g. `crm_company`) so PIM `retailer`/`buyer` and CRM `crm_company`/`crm_contact` coexist clearly.
(**UNKNOWN:** the owner may prefer reusing PIM's `retailer`/`buyer` directly instead of new CRM tables —
see §5.2; confirm before creating collections.)

### 5.1 Proposed CRM collections (with the recommended `crm_` prefix)
| Collection | Purpose (← Twenty source) | Core fields | M2O relations |
|---|---|---|---|
| `crm_company` | ← company | name, domain, customer_status (select), chain_type (select), routing_domain, routing_aliases, so_patterns, address, notes, external_id, external_source | account_owner→directus_users, primary_salesperson→directus_users |
| `crm_contact` | ← person | first_name, last_name, email, phone, job_title, contact_type (select), scope (select), external_id, external_source | company→crm_company, department→crm_department |
| `crm_department` | ← department | name, category, division, active(bool), sort | company→crm_company, primary_buyer→crm_contact |
| `crm_opportunity` | ← opportunity ("program") | name, amount(decimal), close_date, stage (select), probability, program_type, season_year, division, origin_country, licensed(bool), production_po_number, sales_order_number, import_po_number, customer_incoterms, factory_incoterms, hard_delivery_date, sample_required(bool), sample_approval_method, requires_new_pricing(bool), clickup_task_id, clickup_status, plm_project_id, ai_summary, ai_state, external_id, external_source | company→crm_company, contact→crm_contact (point of contact), department→crm_department, factory→crm_factory, owner→directus_users |
| `crm_factory` | ← factory | name, location, contact_name, capabilities, notes, external_id | — |
| `crm_meeting_note` | ← meetingNote | name, date, participants, summary, action_items, source, fireflies_transcript_id, external_id | company, department, opportunity, contact |
| `crm_meeting_note_attendee` | ← meetingNoteAttendee | name | meeting_note→crm_meeting_note, contact→crm_contact |
| `crm_licensor_approval_thread` | ← licensorApprovalThread | name, property_name, stage, submitted_date, response_date, due_date, licensor_comments, external_id | opportunity→crm_opportunity |
| `crm_email_message` *(Phase 2 / historical)* | ← emailMessage | subject, sender, recipients, received_at, body_preview, outlook_message_id, routing_status, routing_method, detected_so_numbers, detected_po_numbers, external_id | company, department, opportunity |
| `crm_ignore_rule` *(Phase 2)* | ← ignoreRule | name, pattern, match_type, emails_skipped(int) | — |
| `crm_ai_model_config` *(Phase 2)* | ← aiModelConfig | name + 4 model fields | — |

**Notes / activities / tasks:** Directus has **native `directus_comments`** (used by `poppim-web` for
comments) and a native `directus_activity` audit log. For CRM **notes** and **tasks**, the simplest path
is dedicated collections `crm_note` (title, body(md), external_id, M2O links) and `crm_task` (title,
status, due_date, assignee→directus_users, external_id) each with an M2O to the parent record — rather
than reproducing Twenty's polymorphic `*Target` join model. Confirm with the owner; the PIM app used
`directus_comments` for comments + collaboration collections, which is the precedent.

### 5.2 Cross-app interlinking (the whole point of the shared DB)
The reason CRM lives in the same Postgres as PIM is so records link across apps. Wire these (after
confirming naming with the owner):

- **CRM company ↔ PIM retailer/buyer.** PIM already has `retailer` ("A store / account (future CRM
  company)" — VERIFIED note in `apply-schema.mjs`) and `buyer` ("Named buyer at a retailer (future CRM
  contact)"). **Two options:**
  1. **Reuse PIM tables directly** — make the CRM treat `retailer` as the company and `buyer` as the
     contact (no new `crm_company`/`crm_contact`). Cleanest interlink, but couples CRM-specific fields
     onto PIM tables.
  2. **New CRM tables + a link field** — `crm_company.retailer → retailer` (M2O) and
     `crm_contact.buyer → buyer` (M2O), so a CRM company points at its PIM retailer. Keeps concerns
     separate at the cost of a mapping step.
  **Recommendation:** Option 2 for v1 (lower blast radius on the live PIM data), with the explicit goal
  of de-duping later. **DECISION NEEDED from owner.**
- **CRM opportunity ↔ PIM product/project.** Add `crm_opportunity.project → project` (M2O to PIM
  `project`) and/or an M2M `crm_opportunity ↔ product` so a CRM deal links to the PIM offer/SKUs it
  concerns. (PIM `project` note: "An offer (POP) / account project"; `product`: "Executable item: SKU".)
- **Factory:** PIM already has a `factory` collection — **reuse it** rather than creating `crm_factory`,
  if the owner agrees (Twenty's factory fields are a near-superset; add any missing columns to PIM
  `factory`).

> Every cross-link above is **PROPOSED**, not yet built. Confirm collection-naming + reuse-vs-new with
> the owner **before** running any schema script against the live shared DB (it already holds 651 PIM
> projects + 16,534 products — VERIFIED in directus `AGENTS.md` §15; do not disturb them).

### 5.3 Stage/select values
Twenty `opportunity.stage`, `licensorApprovalThread.stage`, `department.category`, `person.scope`,
`company.customerStatus`/`chainType`, etc. are **enums** in the metadata. Extract the exact allowed
values from the live workspace metadata (§6.2) and reproduce them as Directus `select-dropdown` choices —
**do not guess the enum values.** Routing depends on `customerStatus ∈ {ACTIVE_CUSTOMER, POTENTIAL_CUSTOMER}`
and `person.scope = 'DEPARTMENT'` (VERIFIED behavior in Twenty `AGENTS.md` §10) — preserve those strings
if email routing is ported.

---

## 6. Data migration plan (extract from Twenty → load into Directus)

Mirror `pm-system/migration/clickup-import.mjs`: a new **`pm-system/migration/twenty-import.mjs`** that
**upserts by `external_id`** and is `DRY=1`-safe and re-runnable.

### 6.1 Choose an extraction method
**Option A — Twenty GraphQL API (recommended for fidelity).** Twenty exposes a per-object GraphQL API
(custom fields included). You need a Twenty API token. **UNKNOWN:** the exact GraphQL endpoint path and
how to mint a workspace API key on this fork — verify by logging into `https://crm.designflow.app` →
Settings → Developers / API keys, and read `packages/twenty-server` GraphQL routing. Pros: clean typed
records, relations resolvable; Cons: pagination + rate handling.

**Option B — direct Postgres dump of the workspace schema (recommended for a one-shot cutover).** Read
straight from `twenty-postgres`, schema `workspace_93r34ew9zc9644a9y5f1yeylz`:
```bash
# discover table names (workspace tables are GUID-suffixed)
sudo docker exec -i twenty-postgres psql -U twenty -d twenty -c \
  "select table_name from information_schema.tables where table_schema='workspace_93r34ew9zc9644a9y5f1yeylz' order by 1;"
# export one object to JSON/CSV for the importer
sudo docker exec -i twenty-postgres psql -U twenty -d twenty -c \
  "\copy (select * from workspace_93r34ew9zc9644a9y5f1yeylz.\"company\") to stdout with csv header"
```
Pros: complete, no rate limits, exact column values (incl. enum strings, custom fields); Cons: you must
resolve relation columns (`companyId`, `departmentId`, etc.) yourself. **UNKNOWN:** exact table names in
that schema (Twenty may name tables by label or by id) — list them first with the query above. The
record id columns are UUIDs — use them as `external_id` in Directus for a stable mapping.

### 6.2 Extract the metadata (to build §5 accurately)
Before writing collections, pull the **authoritative field list + enum values** from the live workspace:
```bash
sudo docker exec -i twenty-postgres psql -U twenty -d twenty -c \
  "select o.\"nameSingular\", f.\"name\", f.\"type\", f.\"options\" \
   from core.\"objectMetadata\" o join core.\"fieldMetadata\" f on f.\"objectMetadataId\"=o.\"id\" \
   where o.\"workspaceId\"='99c80ca1-610f-48b5-bd1f-9178201bdcb7' order by 1,2;"
```
> **UNKNOWN:** exact `core` table/column names (`objectMetadata`/`fieldMetadata` and column casing) on
> v2.8 — verify with `\dt core.*` and `\d core."fieldMetadata"`. This query is the source of truth for
> select options used in §5.3.

### 6.3 Load order (two-pass, like the ClickUp importer)
1. Ensure `external_id`/`external_source` (`='twenty'`) fields exist on every CRM collection (the
   importer can `POST /fields/<col>` them if missing — see `clickup-import.mjs` `ensureFields()`).
2. **Pass 1 (parents, no FK deps):** `crm_company`, `crm_factory`, `crm_ai_model_config`,
   `crm_ignore_rule`. Build an `external_id → directus_id` map per collection (`preloadExternalIds`).
3. **Pass 2 (children):** `crm_department` (→company), `crm_contact` (→company, →department),
   `crm_opportunity` (→company, →contact, →department, →factory), `crm_meeting_note`,
   `crm_meeting_note_attendee`, `crm_licensor_approval_thread`, then `crm_email_message`,
   `crm_note`/`crm_task`. Resolve each Twenty relation id through the map built in Pass 1/earlier.
4. **Cross-app links (§5.2):** match `crm_company.routing_domain`/name to a PIM `retailer` (fuzzy, like
   the ClickUp importer's `getOrCreateRef`) and set the link M2O. Log unmatched for manual review.
5. **Idempotency:** upsert by `external_id` (PATCH if present, POST otherwise). Run `DRY=1` first; diff
   counts against the source before going live.
6. **Owner/member mapping:** Twenty `workspaceMember` → Directus user. Map by email
   (`Albert@popcre.com`, etc.). **UNKNOWN:** the full member↔Directus-user mapping — extract Twenty
   members (`core.userWorkspace` / workspace member table) and match to `directus_users` by email; flag
   unmatched.

### 6.4 Attachments / files
Twenty stores attachments (`STORAGE_TYPE`, possibly S3 — compose references `STORAGE_S3_*`). **UNKNOWN:**
whether Twenty attachments are on local disk or S3, and whether the CRM v1 needs them. Directus uses
local storage today (R2 is a pending backend item — directus `AGENTS.md` §15). **Defer file migration to
a later phase** unless the owner needs historical attachments in v1; if so, plan a separate
files-import pass uploading to Directus `/files` and linking.

---

## 7. Frontend `popcmr-web` plan (scaffold per the poppim-web recipe)

### 7.1 Scaffold
1. Create `u2giants/popcmr-web` (new repo). Easiest start: copy the `poppim-web` skeleton (everything
   except `src/features/` and `src/lib/types.ts`, which are PIM-specific): `package.json`, `vite.config.ts`,
   `tsconfig*.json`, `Dockerfile`, `nginx.conf`, `eslint.config.js`, `components.json`, `index.html`,
   `.env.example` (`VITE_DIRECTUS_URL=https://data.designflow.app`), `src/main.tsx`, `src/index.css`,
   `src/lib/{directus.ts,utils.ts}`, `src/auth/auth.tsx`, `src/pages/LoginPage.tsx`,
   `src/components/AppShell.tsx`, `src/components/ui/*`.
2. Replace `src/lib/types.ts` with a typed slice of the **CRM** collections (companies, contacts,
   opportunities, departments, etc.).
3. Write CRM `src/features/`:
   - `features/companies/` — list + detail (POP fields, departments, contacts, opportunities tabs).
   - `features/contacts/` — list + detail.
   - `features/opportunities/` — **pipeline kanban grouped by `stage`** (this is the core CRM screen;
     reuse the board pattern from `poppim-web/src/features/board/` — the PIM app already groups cards by a
     status/stage field and has a detail drawer with assignees/checklist/subtasks/comments).
   - `features/record-detail/` — notes/tasks/activity (use `directus_comments` for comments as PIM does).
4. Keep `npm run build` (`tsc -b && vite build`) green; English-only; shadcn `new-york`.

### 7.2 Auth (reuse shared SSO)
Identical to `poppim-web`: session-cookie SSO across `.designflow.app`. The Microsoft button hits
`${DIRECTUS_URL}/auth/login/microsoft?redirect=<frontend-origin>`; email/password also works. **Backend
prerequisite:** the frontend origin must be in `CORS_ORIGIN` + `AUTH_MICROSOFT_REDIRECT_ALLOW_LIST` on
the directus service (§2.3). Note `poppim-web`'s own `AGENTS.md` warns full cross-subdomain SSO return
was still being finalized for PIM — confirm the session-cookie round-trip works end-to-end on a real
`@popcre.com` login before declaring SSO done.

---

## 8. SSO / roles for the CRM

- **Reuse the shared Entra SSO + Model B role hub** (§2.4) — do **not** create a second SSO app. New
  staff auto-provision as Designer; admins assign the real role.
- **CRM-specific roles/permissions:** add CRM read/write policies on the new `crm_*` collections,
  following `setup-roles-and-flows.mjs`. Suggested (confirm with owner):
  - **Sales** (existing role) → read/write `crm_company`, `crm_contact`, `crm_opportunity`,
    `crm_department`, `crm_meeting_note`, `crm_note`, `crm_task`.
  - **Viewer** (existing) → read-only on CRM collections.
  - A new **CRM-only** policy if some staff should see CRM but not PIM pricing (or vice-versa) — Directus
    policies are additive per role, so you can grant CRM collections to existing roles via a new policy +
    `POST /access` without disturbing PIM permissions.
- **Entra mirror:** the existing six `POP PIM ·` groups already cover the role taxonomy; CRM/DAM are
  meant to **read** those groups (directus `AGENTS.md` §15 "CRM/DAM read Entra groups", pending). Do not
  add a second *writer* to Entra (avoids sync loops) — Directus stays the single writer.
- Write the CRM policy/role script as **`pm-system/crm-roles.mjs`** (idempotent, same shape as
  `setup-roles-and-flows.mjs`). Restart Directus after, if it adds any Flow.

---

## 9. Deployment of `popcmr-web` at `crm.designflow.app`

**Standard path (preferred): a Coolify app** (Coolify owns runtime; raw-docker is only a temporary
preview deviation).

1. **DNS:** `crm.designflow.app` already resolves (Twenty uses it). At cutover it stays the same name —
   you are repointing the Traefik route from the Twenty app to the new app, not changing DNS. If you want
   a **preview** first, add `crm-dev.designflow.app` via the Cloudflare API using `CF_API_TOKEN` +
   `CF_ZONE_ID` from `/home/ai/.directus-deploy.env` against
   `https://api.cloudflare.com/client/v4/zones/921eb133a3f7d5802780445b283f84ce/dns_records` (A →
   `178.156.180.212`, DNS-only). **Never put the token in a committed file or this doc.**
2. **Build/serve:** the `popcmr-web` `Dockerfile` (node build → nginx) is the artifact. Per the POP
   standard, wire **GitHub Actions → build image → registry → Coolify app**. (`poppim-web`'s deploy
   pipeline was still pending at the time of writing — directus `AGENTS.md` §15 — so you may be the first
   to wire a frontend through Coolify properly; if you must preview fast, the **temporary raw-docker**
   pattern is documented in directus `AGENTS.md` §11 "Frontend preview runs as a raw Docker container":
   `docker build` then `docker run` with Traefik labels on the `coolify` network — but treat it as
   temporary and convert to a Coolify app.)
3. **Backend env (do in Coolify on the directus service `nzli85mk3luzb6u7cnq5fidu`):** add the frontend
   origin(s) to `CORS_ORIGIN` and `AUTH_MICROSOFT_REDIRECT_ALLOW_LIST`; redeploy/restart Directus.
4. **Coolify access:** API base + token + server UUID are in `/worksp/directus/CLAUDE.md` (do not copy
   them here). Create/point the new app to `Host(crm.designflow.app)` with `letsencrypt` (see Twenty's
   `docker-compose.yaml` Traefik labels for the exact label shape, swapping the app uuid).

---

## 10. Cutover & decommission (do this carefully, backup first)

**Order matters. Do not delete Twenty until the new CRM is verified on real data.**

1. **Back up Twenty first (mandatory):**
   ```bash
   sudo docker exec -i twenty-postgres pg_dump -U twenty -d twenty -Fc \
     > /worksp/twenty/fork/backups/twenty-precutover-$(date +%F).dump   # backups/ is gitignored
   ```
   Also snapshot the GHCR image tag in use and the Coolify env (export from Coolify). Twenty already has
   an `ops/backup/create-backup.sh` + nightly timer — confirm the latest backup is good.
2. **Back up the shared Directus DB before importing** (no automated backup exists yet — directus
   `AGENTS.md` §15): `pg_dump` the `directus-db-nzli85mk3luzb6u7cnq5fidu` container.
3. **Apply CRM schema** (`crm-schema.mjs`) + **roles** (`crm-roles.mjs`) to Directus; restart Directus.
4. **Run the import `DRY=1`**, review counts, then live. Verify cross-app links.
5. **Deploy `popcmr-web`** to a preview (`crm-dev.designflow.app`) and validate the core screens against
   migrated data with a real SSO login.
6. **Cutover the domain:** repoint `crm.designflow.app` from the Twenty Coolify app
   (`rd261bt0wy7ifjrkoe1tkl92`) to the `popcmr-web` app (move the Traefik `Host(crm.designflow.app)` route;
   in practice: set the domain on the new Coolify app and remove it from Twenty, or stop Twenty's
   server/worker). Verify SSL + login + data.
7. **Soak**, then **decommission Twenty:** stop & remove the Coolify app `rd261bt0wy7ifjrkoe1tkl92`
   (server+worker), and — only after the backup is verified and the owner signs off — the
   `twenty-postgres`/`twenty-redis` containers and their volumes. Disable the Twenty crons (Outlook ingest,
   etc.) so they stop polling. Update the Entra SSO app's redirect/allow-list to drop the Twenty callback
   if it's no longer used. Archive the `u2giants/twenty` repo.
8. **Update docs:** mark the CRM "done" in directus `AGENTS.md` §15; flip the directus AGENTS "Domain
   plan" note for `crm`.

---

## 11. Risks & UNKNOWNS (verify before asserting; resolve before/with the owner)

| # | Risk / Unknown | How to verify / resolve |
|---|---|---|
| 1 | **Email-routing scope.** Twenty's router/Outlook-ingest/Fireflies/ClickUp-sync are the hardest to reproduce on Directus. | Decide with the owner: clean records CRM v1 (routing deferred) vs full port. Default: defer routing to Phase 2 (§4.2). |
| 2 | **Collection naming & reuse vs new** (`crm_*` prefix; reuse PIM `retailer`/`buyer`/`factory` vs new CRM tables). | Owner decision (§5.1/§5.2). Do not create collections in the live shared DB until confirmed. |
| 3 | **Exact Twenty schema/enum values** (table names in `workspace_93r34ew9zc9644a9y5f1yeylz`, `core` metadata casing, select options). | Run the §6.2 metadata query + `\dt`/`\d` against `twenty-postgres`. Source of truth — never guess. |
| 4 | **Twenty Postgres ownership** (host Docker vs Coolify-managed; volume path). | `sudo docker inspect twenty-postgres` + check Coolify API; symlinks under `/worksp/twenty/{postgres,redis}` hint Coolify-managed DBs. |
| 5 | **Twenty API token / GraphQL endpoint** for Option-A extraction. | Log into the CRM → Settings → API; read `twenty-server` GraphQL routing. Or use Option B (direct SQL). |
| 6 | **Current `CORS_ORIGIN` value** on the directus service. | Read it in Coolify before editing; append, don't replace. `crm.designflow.app` may not yet be present. |
| 7 | **Cross-subdomain SSO round-trip** not yet fully confirmed even for PIM (`poppim-web`/directus AGENTS notes). | Test a real `@popcre.com` SSO login end-to-end on a preview before cutover. |
| 8 | **Member → Directus user mapping** (Twenty `workspaceMember` ↔ `directus_users`). | Extract members, match by email; flag unmatched (§6.3). |
| 9 | **Attachments/files** location & whether v1 needs them. | `docker inspect`/env for `STORAGE_*`; defer unless owner needs history (§6.4). |
| 10 | **Live shared DB safety** — 651 PIM projects + 16,534 products live in the same Postgres. | Back up Directus first (§10.2); run all schema scripts idempotently; never delete PIM collections. |
| 11 | **No automated Directus backups yet.** | Add a `pg_dump` before/around the import; longer-term it's a pending directus item. |
| 12 | **`/worksp/twenty` is root-owned / fork git index root-owned.** | Push via a fresh `gh repo clone` in a writable dir (this doc was committed that way). |

---

## 12. Step-by-step execution plan (in order, with verification gates)

Each step has a **GATE** — do not proceed until it passes.

1. **Read & confirm context.** Read this file, directus `/worksp/directus/AGENTS.md` + `pm-system/`,
   `poppim-web` `AGENTS.md` + recipe files, Twenty `/worksp/twenty/fork/AGENTS.md`.
   **GATE:** you can name the 3 repos, the shared backend URL, and the domain plan from memory.
2. **Confirm scope with the owner** (§4.2 email routing, §5.1/§5.2 naming & reuse).
   **GATE:** written decisions on prefix, reuse-vs-new, and v1 routing scope.
3. **Extract Twenty metadata + a sample of data** (§6.1/§6.2) read-only.
   **GATE:** you have the exact object/field/enum lists and table names from the live DB.
4. **Back up both databases** (§10.1/§10.2). **GATE:** restorable `.dump` files exist and are verified.
5. **Write `pm-system/crm-schema.mjs`** (collections/fields/relations + cross-app links per confirmed
   §5). Run against Directus; restart Directus. **GATE:** collections exist as real tables (not folders);
   relations resolve in Data Studio; PIM collections untouched (`product` count still 16,534).
6. **Write `pm-system/crm-roles.mjs`** (CRM policies/perms). Run; restart if it adds a Flow.
   **GATE:** a Sales/Viewer test user sees the right CRM collections; pricing/PIM perms unchanged.
7. **Write & run `pm-system/migration/twenty-import.mjs`** with `DRY=1`, review counts, then live (§6.3).
   **GATE:** record counts match source within tolerance; cross-app links populated; re-run is idempotent.
8. **Scaffold `popcmr-web`** from the poppim-web recipe; build companies/contacts/opportunity-kanban/
   record-detail (§7). **GATE:** `npm run build` green; runs locally against live Directus with real data.
9. **Add the CRM origin to backend `CORS_ORIGIN` + `AUTH_MICROSOFT_REDIRECT_ALLOW_LIST`** in Coolify;
   restart Directus. **GATE:** a real `@popcre.com` SSO login completes in the SPA; data loads.
10. **Deploy `popcmr-web`** to a preview (Coolify app, or temporary raw-docker per directus AGENTS §11) at
    `crm-dev.designflow.app`. **GATE:** preview works end-to-end on migrated data.
11. **Cutover** `crm.designflow.app` to `popcmr-web`; disable Twenty crons (§10.6). **GATE:** the live
    domain serves the new app over SSL with working SSO; Twenty no longer ingesting.
12. **Soak, then decommission Twenty** (§10.7) after owner sign-off + verified backup. **GATE:** owner
    confirms; backups verified; Coolify app + DB containers removed; repo archived.
13. **Update docs** in the directus repo (§10.8). **GATE:** AGENTS reflects CRM live on Directus.

---

## 13. Quick reference (all VERIFIED unless marked)

```
Shared backend API   : https://data.designflow.app   (/server/ping → pong)
CRM frontend target  : https://crm.designflow.app     (today: live Twenty fork, build bc96454eeb @ 2026-06-04)
PIM frontend         : https://pm.designflow.app       (302; points at backend until poppim-web launch)
VPS / Coolify server : 178.156.180.212  (UUID onwp0kd7w1w74w9yeotnoihp)
Coolify API          : http://178.156.180.212:8000/api/v1   (bearer in /worksp/directus/CLAUDE.md)
Directus service     : nzli85mk3luzb6u7cnq5fidu   (Coolify project POP PIM jdq36h5dq74o6ddhich9l796)
Twenty Coolify app   : rd261bt0wy7ifjrkoe1tkl92   (server-… + worker-… on ghcr.io/u2giants/twenty:latest)
Twenty Postgres      : container twenty-postgres (postgres:16-alpine), db twenty, user twenty
Twenty workspace     : id 99c80ca1-610f-48b5-bd1f-9178201bdcb7, schema workspace_93r34ew9zc9644a9y5f1yeylz
Cloudflare zone      : designflow.app  921eb133a3f7d5802780445b283f84ce
Secrets (host-only)  : /home/ai/.directus-deploy.env  (CF_API_TOKEN, CF_ZONE_ID, DX_ADMIN_*, GRAPH_*) — chmod 600, never commit
Schema script tmpl   : /worksp/directus/pm-system/apply-schema.mjs , setup-roles-and-flows.mjs , add-collaboration-model.mjs
Migration tmpl       : /worksp/directus/pm-system/migration/clickup-import.mjs  (upsert by external_id)
Frontend recipe      : /worksp/poppim-web  (src/lib/directus.ts, src/auth/auth.tsx, Dockerfile, nginx.conf)
Re-apply schema      : DX_URL=… DX_ADMIN_EMAIL=svc@popcre.com DX_ADMIN_PASSWORD=… node pm-system/<script>.mjs  → restart Directus
```

**Never** commit secrets/tokens. They live in `/home/ai/.directus-deploy.env` and Coolify; operator
tokens (Coolify, GitHub PAT) are referenced from `/worksp/directus/CLAUDE.md`.

— end —
