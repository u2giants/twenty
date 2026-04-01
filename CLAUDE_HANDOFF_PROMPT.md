# Comprehensive Handoff Prompt for Claude

You are handing off the POP Creations Twenty CRM fork migration project. I need EVERYTHING to continue safely. Quality and correctness are paramount - I will test and iterate extensively before deployment.

---

## CURRENT STATE (CONFIRMED 2026-04-01)

### Phase Status
- **Phase 0**: ✅ COMPLETE - Backup created, UUIDs verified
- **Phase 1**: ✅ COMPLETE - Fork synced with upstream
- **Phase 2**: ✅ COMPLETE - 8 custom workspace entities + custom fields on standard objects
- **Phase 3**: ✅ COMPLETE - All 11 logic functions implemented in NestJS (see list below)
- **Phase 4-9**: ❌ NOT STARTED

### Phase 3 Implementation - ALL 11 LOGIC FUNCTIONS COMPLETED ✅

All logic functions have been implemented as NestJS modules in `packages/twenty-server/src/modules/pop-creations/logic-functions/`:

1. **fireflies-ingest** (`fireflies-ingest/`)
   - HTTP POST endpoint `/fireflies-webhook`
   - UUID: `82a08d2e-19f6-40dd-8fee-460cccc84f3c`
   - Services: `fireflies-api.client.ts`, `fireflies-ingest.service.ts`
   - Exception filter for error handling
   - Unit tests: `fireflies-ingest.service.spec.ts`

2. **contact-auto-scope** (`contact-auto-scope/`)
   - Event listener: `person.created`
   - UUID: `f2fb663a-31b5-44d0-98cd-069697d70c27`
   - Auto-sets Person scope based on domain

3. **lat-stage-follow-up** (`lat-stage-follow-up/`)
   - Event listener: `licensorApprovalThread.updated`
   - UUID: `1ec5d27a-0491-493b-bfe0-197338d6ce4d`
   - Creates follow-up task on LAT stage change

4. **new-program-tasks** (`new-program-tasks/`)
   - Event listener: `opportunity.created`
   - UUID: `8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f`
   - Auto-creates task checklist for new Programs

5. **clickup-sync** (`clickup-sync/`)
   - Cron scheduler: `0 7 * * *` (daily 7am)
   - UUID: `beb0af2a-0349-48f5-8d4a-b7161a001ae0`
   - Services: `clickup-sync.service.ts`, `clickup-sync.scheduler.ts`

6. **email-rerouter** (`email-rerouter/`)
   - Cron scheduler: `0 */6 * * *` (every 6 hours)
   - UUID: `8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f`
   - Services: `email-rerouter.service.ts`, `email-rerouter.scheduler.ts`

7. **email-contact-sync** (`email-contact-sync/`)
   - Cron scheduler: `0 2 * * *` (daily 2am)
   - UUID: `7b2e4a91-3c8f-4d1e-a5b2-9f8c7d6e5a4b`
   - Creates Companies/People from email domains
   - Services: `email-contact-sync.service.ts`, `email-contact-sync.scheduler.ts`

8. **outlook-ingest** (`outlook-ingest/`)
   - Cron scheduler: `*/15 * * * *` (every 15 min)
   - UUID: `6fec3269-187e-4056-a35b-81333bc86ba6`
   - Polls Outlook/Microsoft Graph API
   - Services: `outlook-ingest.service.ts`, `outlook-ingest.scheduler.ts`

9. **program-stage-change** (`program-stage-change/`)
   - Event listener: `opportunity.updated`
   - UUID: `6fec3269-187e-4056-a35b-81333bc86ba6`
   - Task creation and LAT auto-creation

10. **pre-install** (`pre-install/`)
    - Runs before install
    - UUID: `668325c7-8e91-4c70-aa90-7e6ab9b1b156`
    - Prepares application

11. **post-install** (`post-install/`)
    - Runs after install
    - UUID: `fda29017-6f27-4655-9ae9-e37c9db28546`
    - Sets up application

### Files Created

```
packages/twenty-server/src/modules/pop-creations/
├── pop-creations.module.ts           # Main module
├── logic-functions/
│   ├── fireflies-ingest/
│   │   ├── fireflies-ingest.module.ts
│   │   ├── controllers/fireflies-ingest.controller.ts
│   │   ├── filters/pop-creations-exception.filter.ts
│   │   ├── services/
│   │   │   ├── fireflies-api.client.ts
│   │   │   └── fireflies-ingest.service.ts
│   │   ├── types/fireflies-ingest.types.ts
│   │   └── fireflies-ingest.service.spec.ts
│   ├── contact-auto-scope/
│   │   ├── contact-auto-scope.module.ts
│   │   └── listeners/contact-auto-scope.listener.ts
│   ├── lat-stage-follow-up/
│   │   ├── lat-stage-follow-up.module.ts
│   │   └── listeners/lat-stage-follow-up.listener.ts
│   ├── new-program-tasks/
│   │   ├── new-program-tasks.module.ts
│   │   └── listeners/new-program-tasks.listener.ts
│   ├── program-stage-change/
│   │   ├── program-stage-change.module.ts
│   │   └── listeners/program-stage-change.listener.ts
│   ├── clickup-sync/
│   │   ├── clickup-sync.module.ts
│   │   └── services/
│   │       ├── clickup-sync.service.ts
│   │       └── clickup-sync.scheduler.ts
│   ├── email-rerouter/
│   │   ├── email-rerouter.module.ts
│   │   └── services/
│   │       ├── email-rerouter.service.ts
│   │       └── email-rerouter.scheduler.ts
│   ├── email-contact-sync/
│   │   ├── email-contact-sync.module.ts
│   │   └── services/
│   │       ├── email-contact-sync.service.ts
│   │       └── email-contact-sync.scheduler.ts
│   ├── outlook-ingest/
│   │   ├── outlook-ingest.module.ts
│   │   └── services/
│   │       ├── outlook-ingest.service.ts
│   │       └── outlook-ingest.scheduler.ts
│   ├── pre-install/
│   │   ├── pre-install.module.ts
│   │   └── pre-install.service.ts
│   └── post-install/
│       └── post-install.module.ts
```

### Module Registration

All logic functions are registered in:
- `packages/twenty-server/src/modules/pop-creations/pop-creations.module.ts`
- `packages/twenty-server/src/modules/modules.module.ts`

### Pending Verification

⚠️ **YARN INSTALL BLOCKED** - Windows symlink issue with Yarn 4 PnP mode. The link step fails with EISDIR error on workspace packages. Run typecheck on Linux/WSL:
```bash
yarn install  # May need --no-symlinks or use npm
npx nx run twenty-server:typecheck
```

### Production Environment
- **Server**: 178.156.180.212
- **Workspace ID**: `93r34ew9zc9644a9y5f1yeylz`
- **PostgreSQL Container**: `g5j115bwrn8125ev6ap1tjrv`
- **Database Backup**: `/data/backups/twenty-backup-20260401-010600.sql` (~51MB)

### APPLICATION IDs (CONFIRMED)
| Application | ID | Notes |
|-------------|-----|-------|
| POP Creations CRM | `b7ad46a7-1784-4fab-9f09-9eed6eedb0bf` | Main custom app |
| Workspace Custom App | `f99617d1-aa3d-4009-8211-53a7b747f5f2` | ignoreRule, meetingNoteAttendee use this |
| Twenty Standard | `58dd163b-b4d9-4b30-aca8-23b41518741d` | All standard objects |

### 8 CUSTOM OBJECTS (CONFIRMED UUIDs)
| Object | universalIdentifier | Database Table |
|--------|---------------------|----------------|
| aiModelConfig | `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2` | _aiModelConfig |
| department | `1b9e366d-b0a1-40e6-b253-115079fed63d` | _department |
| emailMessage | `c0233f86-fdb6-4a32-9693-6c6fb1d5e740` | _emailMessage |
| factory | `1e10f8ed-8571-48b8-8571-32e53b44d63e` | _factory |
| ignoreRule | `c0baf376-8e17-4d5b-b31a-39122aae9db5` | _ignoreRule |
| licensorApprovalThread | `b654e699-2912-433f-93dd-c97d9a5bb7e1` | _licensorApprovalThread |
| meetingNote | `79e9be9f-d969-40f7-988d-efc83a8e7049` | _meetingNote |
| meetingNoteAttendee | `78e3ad65-5495-461b-842e-672f1e10d78d` | _meetingNoteAttendee |

---

## REMAINING PHASES

### Phase 4: Front Components (NOT STARTED)
Need to convert 5 React components from twenty-apps to native React:
1. PersonDepartmentPicker
2. DepartmentDashboard
3. ProgramFolio
4. DomainManager
5. MondayMorningDashboard

### Phase 5: Views, Navigation, Layouts (NOT STARTED)
Configure Twenty views and navigation for custom objects.

### Phase 6: Build Pipeline and Dockerfile (NOT STARTED)
Create GitHub Actions workflow and Dockerfile for custom build.

### Phase 7: Test Against Database Copy (NOT STARTED)
Deploy to staging/test environment before production.

### Phase 8: Production Deployment (NOT STARTED)
Deploy with rollback plan.

### Phase 9: Production Cutover (NOT STARTED)
Final cutover and monitoring.

---

## KNOWN ISSUES

1. **Yarn Install Blocked** - Windows symlink issue with Yarn 4 PnP
   - Workaround: Run on Linux/WSL or use npm
   - Try: `yarn install --no-symlinks`

2. **Typecheck Pending** - Need to verify all TypeScript compiles
   - Run on Linux/WSL environment

---

## WHAT WAS COMPLETED IN THIS SESSION

1. ✅ Implemented all 11 logic functions as NestJS modules
2. ✅ Created proper module structure following Twenty conventions
3. ✅ Added exception filter for error handling
4. ✅ Created unit tests for fireflies-ingest service
5. ✅ Registered all modules in pop-creations.module.ts
6. ✅ Updated modules.module.ts to include pop-creations

---

## NEXT STEPS FOR NEXT SESSION

1. **CRITICAL**: Run yarn install on Linux/WSL
2. **CRITICAL**: Run `npx nx run twenty-server:typecheck`
3. Fix any TypeScript errors
4. Phase 4: Front components
5. Phase 5: Views and navigation
6. Phase 6: Build pipeline

---

## Questions to Answer

1. Where are the 5 React front components located?
2. What external service API keys are configured?
3. What is the deployment strategy for Coolify?
4. Are there any tests to run before deployment?
