# Phase Status - POP Creations Twenty Fork

## Current Phase Status (Updated 2026-04-01)

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ COMPLETE | Backup created, UUIDs verified |
| Phase 1 | ✅ COMPLETE | Fork synced with upstream |
| Phase 2 | ✅ COMPLETE | 8 custom workspace entities + custom fields |
| Phase 3 | ✅ COMPLETE | 11 logic functions implemented in NestJS |
| Phase 4 | ✅ COMPLETE | 5 React UI components created |
| Phase 5 | ❌ NOT STARTED | Views, navigation, layouts |
| Phase 6 | ❌ NOT STARTED | Build pipeline, Dockerfile |
| Phase 7 | ❌ NOT STARTED | Test against database copy |
| Phase 8 | ❌ NOT STARTED | Production deployment |
| Phase 9 | ❌ NOT STARTED | Production cutover |

---

## Completed Phases

### Phase 3 - Logic Functions (COMPLETE ✅)

All 11 logic functions have been implemented in NestJS.

**Event Listeners (5):**
1. **contact-auto-scope** - `person.created` event - Auto-sets Person scope based on domain
2. **lat-stage-follow-up** - `licensorApprovalThread.updated` event - Creates follow-up tasks on LAT stage changes
3. **new-program-tasks** - `opportunity.created` event - Auto-creates task checklist for new Programs
4. **program-stage-change** - `opportunity.updated` event - Task creation and LAT auto-creation
5. **fireflies-ingest** - HTTP POST `/fireflies-webhook` - Fireflies.ai meeting transcription webhook

**Cron Jobs (4):**
1. **clickup-sync** - Daily at 7am (`0 7 * * *`)
2. **email-contact-sync** - Daily at 2am (`0 2 * * *`)
3. **email-rerouter** - Every 6 hours (`0 */6 * * *`)
4. **outlook-ingest** - Every 15 minutes (`*/15 * * * *`)

**Install Hooks (2):**
1. **pre-install** - Runs before application install
2. **post-install** - Runs after application install

### Phase 4 - Front Components (COMPLETE ✅)

5 React UI components created in `packages/twenty-front/src/modules/pop-creations/components/`:

1. **PersonDepartmentPicker** - Custom picker for linking Person to Department
2. **DepartmentDashboard** - Dashboard with tabs for department members and programs
3. **ProgramFolio** - Dashboard for program (opportunity) details with documents and tasks
4. **DomainManager** - Domain management interface for email routing
5. **MondayMorningDashboard** - Weekly overview dashboard with metrics

---

## Production Environment

| Setting | Value |
|---------|-------|
| Server | 178.156.180.212 |
| Workspace ID | `93r34ew9zc9644a9y5f1yeylz` |
| PostgreSQL Container | `g5j115bwrn8125ev6ap1tjrv` |
| Database User | `twenty` |
| Database Backup | `/data/backups/twenty-backup-20260401-010600.sql` |

---

## Application IDs (CONFIRMED)

| Application | ID |
|-------------|-----|
| POP Creations CRM | `b7ad46a7-1784-4fab-9f09-9eed6eedb0bf` |
| Workspace Custom App | `f99617d1-aa3d-4009-8211-53a7b747f5f2` |
| Twenty Standard | `58dd163b-b4d9-4b30-aca8-23b41518741d` |

---

## 8 Custom Objects (CONFIRMED)

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

## Code Location

**Backend (Logic Functions):**
```
packages/twenty-server/src/modules/pop-creations/
├── pop-creations.module.ts
├── logic-functions/
│   ├── fireflies-ingest/
│   ├── contact-auto-scope/
│   ├── lat-stage-follow-up/
│   ├── new-program-tasks/
│   ├── program-stage-change/
│   ├── clickup-sync/
│   ├── email-rerouter/
│   ├── email-contact-sync/
│   ├── outlook-ingest/
│   ├── pre-install/
│   └── post-install/
```

**Frontend (React Components):**
```
packages/twenty-front/src/modules/pop-creations/components/
├── index.ts
├── person-department-picker/
│   ├── components/PersonDepartmentPicker.tsx
│   └── types/person-department-picker.types.ts
├── department-dashboard/
│   └── components/DepartmentDashboard.tsx
├── program-folio/
│   └── components/ProgramFolio.tsx
├── domain-manager/
│   └── components/DomainManager.tsx
└── monday-morning-dashboard/
    └── components/MondayMorningDashboard.tsx
```

---

## Known Issues

### Yarn Install Blocked ⚠️
- **Problem**: Yarn 4 PnP mode fails on Windows/WSL with symlink errors
- **Cause**: Windows symlink limitations with workspace packages in /mnt/d
- **Solution**: Move repo to Linux filesystem, run yarn install there
- **Commands for WSL:**
  ```bash
  cp -r /mnt/d/twenty/twenty ~/src/twenty
  cd ~/src/twenty
  yarn install
  npx nx run twenty-server:typecheck
  ```

### Typecheck Pending
- Need to run `npx nx run twenty-server:typecheck` after yarn install completes on Linux

---

## Remaining Phases

### Phase 5: Views, Navigation, Layouts
- Configure Twenty views for custom objects
- Set up navigation menu items
- Define page layouts

### Phase 6: Build Pipeline and Dockerfile
- Create GitHub Actions workflow
- Create custom Dockerfile
- Configure Coolify deployment

### Phase 7: Test Against Database Copy
- Deploy to staging environment
- Run integration tests
- Verify all logic functions

### Phase 8: Production Deployment
- Deploy with rollback plan
- Monitor for errors

### Phase 9: Production Cutover
- DNS switch
- Final verification
- Monitoring

---

## Next Steps

1. **CRITICAL**: Run yarn install on Linux/WSL (see Known Issues)
2. **CRITICAL**: Run `npx nx run twenty-server:typecheck`
3. Fix any TypeScript errors
4. Phase 5: Views and navigation
5. Phase 6: Build pipeline
6. Phase 7: Testing
7. Phase 8-9: Deployment
