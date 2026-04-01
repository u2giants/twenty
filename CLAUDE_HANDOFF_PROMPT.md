# CLAUDE_HANDOFF_PROMPT.md - POP Creations Twenty Fork

## Current Status (Updated 2026-04-01)

**COMPLETED PHASES:** 0, 1, 2, 3, 4

**IN PROGRESS:** None

**REMAINING:** 5, 6, 7, 8, 9

---

## What Was Done

### Phase 0: Backup ✅
- Database backup created: `/data/backups/twenty-backup-20260401-010600.sql`
- UUIDs verified and documented

### Phase 1: Fork Sync ✅
- Fork synced with upstream twentyhq/twenty
- All commits merged

### Phase 2: Custom Workspace Entities ✅
- 8 custom workspace entities created
- Custom fields added to standard objects (person, company, opportunity)

### Phase 3: Logic Functions ✅
- 11 NestJS logic functions implemented in `packages/twenty-server/src/modules/pop-creations/logic-functions/`
- Event listeners: fireflies-ingest, contact-auto-scope, lat-stage-follow-up, new-program-tasks, program-stage-change
- Cron jobs: clickup-sync, email-rerouter, email-contact-sync, outlook-ingest
- Install hooks: pre-install, post-install

### Phase 4: React Components ✅
- 5 UI components created in `packages/twenty-front/src/modules/pop-creations/components/`:
  - PersonDepartmentPicker
  - DepartmentDashboard
  - ProgramFolio
  - DomainManager
  - MondayMorningDashboard

---

## Critical Issue ⚠️

**Yarn Install Blocked on Windows**
- Yarn 4 PnP fails with symlink errors on Windows/WSL
- **Solution:** Move repo to Linux filesystem
  ```bash
  cp -r /mnt/d/twenty/twenty ~/src/twenty
  cd ~/src/twenty
  yarn install
  npx nx run twenty-server:typecheck
  ```

---

## Next Steps

1. **CRITICAL**: Run yarn install + typecheck on Linux filesystem
2. Fix any TypeScript errors found
3. Phase 5: Views, navigation, layouts
4. Phase 6: Build pipeline and Dockerfile
5. Phase 7: Test against database copy
6. Phase 8-9: Production deployment

---

## Key Files

### Backend Code
`packages/twenty-server/src/modules/pop-creations/logic-functions/`

### Frontend Code
`packages/twenty-front/src/modules/pop-creations/components/`

### Documentation
`PHASE0_STATUS.md` - Detailed status and remaining tasks

---

## Environment Info

| Item | Value |
|------|-------|
| Server | 178.156.180.212 |
| Workspace ID | `93r34ew9zc9644a9y5f1yeylz` |
| PostgreSQL | `g5j115bwrn8125ev6ap1tjrv` |
| Application ID | `b7ad46a7-1784-4fab-9f09-9eed6eedb0bf` |

---

## 8 Custom Objects

| Object | universalIdentifier |
|--------|---------------------|
| aiModelConfig | `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2` |
| department | `1b9e366d-b0a1-40e6-b253-115079fed63d` |
| emailMessage | `c0233f86-fdb6-4a32-9693-6c6fb1d5e740` |
| factory | `1e10f8ed-8571-48b8-8571-32e53b44d63e` |
| ignoreRule | `c0baf376-8e17-4d5b-b31a-39122aae9db5` |
| licensorApprovalThread | `b654e699-2912-433f-93dd-c97d9a5bb7e1` |
| meetingNote | `79e9be9f-d969-40f7-988d-efc83a8e7049` |
| meetingNoteAttendee | `78e3ad65-5495-461b-842e-672f1e10d78d` |
