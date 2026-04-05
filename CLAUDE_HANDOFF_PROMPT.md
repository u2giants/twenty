# POP Creations Twenty Fork - Developer Handoff

## What Is This?
Custom fork of [Twenty CRM](https://twenty.com) for POP Creations with 8 custom objects, 11 backend logic functions, and 5 React UI components.

## Where Did We Leave Off?
**Status:** ~50% complete

### ✅ COMPLETED
1. Fork synced with upstream twentyhq/twenty
2. 8 custom workspace entities created
3. 11 NestJS logic functions implemented (Phase 3)
4. 5 React UI components created (Phase 4)

### ❌ NEXT UP
**You must run TypeScript validation on a Linux filesystem first!**

Yarn 4 PnP doesn't work on Windows/WSL due to symlink issues.

## Immediate Next Step

```bash
# Copy repo to Linux filesystem (not WSL)
cp -r /mnt/d/twenty/twenty ~/src/twenty
cd ~/src/twenty

# Install and validate
yarn install
npx nx run twenty-server:typecheck
npx nx run twenty-front:typecheck
```

Then fix any TypeScript errors and move on to **Phase 5: Views & Navigation**.

## Code Locations

| Type | Location |
|------|----------|
| Backend (NestJS) | `packages/twenty-server/src/modules/pop-creations/` |
| Frontend (React) | `packages/twenty-front/src/modules/pop-creations/components/` |
| Documentation | `CLAUDE.md` (comprehensive), `PHASE0_STATUS.md` (quick ref) |

## Key Files

### Backend (11 NestJS modules in `logic-functions/`):
- `fireflies-ingest/` - Fireflies webhook (HTTP POST)
- `clickup-sync/` - ClickUp daily sync
- `email-rerouter/` - Email routing engine
- `outlook-ingest/` - Outlook email ingestion
- `contact-auto-scope/` - Person scope auto-assignment
- `program-stage-change/` - Program stage automation
- `new-program-tasks/` - Auto-create tasks for new programs
- `lat-stage-follow-up/` - LAT stage follow-up tasks
- `email-contact-sync/` - Email-contact sync
- `pre-install/` & `post-install/` - Install hooks

### Frontend (5 React components):
- `person-department-picker/` - Links persons to departments
- `department-dashboard/` - Department view with tabs
- `program-folio/` - Program detail page
- `domain-manager/` - Domain management UI
- `monday-morning-dashboard/` - Weekly overview

## Environment

| Item | Value |
|------|-------|
| Production Server | 178.156.180.212 |
| Workspace ID | `93r34ew9zc9644a9y5f1yeylz` |
| Application ID | `b7ad46a7-1784-4fab-9f09-9eed6eedb0bf` |
| PostgreSQL | `g5j115bwrn8125ev6ap1tjrv` |

## Remaining Phases

1. **Phase 5**: Views, navigation, layouts
2. **Phase 6**: Build pipeline + Dockerfile
3. **Phase 7**: Testing
4. **Phase 8**: Production deployment

See `CLAUDE.md` for comprehensive developer guide with full schema, business context, and known bugs.
