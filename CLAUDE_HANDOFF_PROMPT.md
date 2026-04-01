# POP Creations Twenty Fork - Developer Handoff

## What Is This?
Custom fork of [Twenty CRM](https://twenty.com) for POP Creations with 8 custom objects, 11 backend logic functions, and 5 React components.

## Where Did We Leave Off?
**Status:** ~50% complete

### ✅ COMPLETED
1. Fork synced with upstream twentyhq/twenty
2. 8 custom workspace entities created
3. 11 NestJS logic functions implemented
4. 5 React UI components created

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
| Backend logic | `packages/twenty-server/src/modules/pop-creations/` |
| Frontend UI | `packages/twenty-front/src/modules/pop-creations/components/` |
| Documentation | `PHASE0_STATUS.md` |

## Key Files to Know

**Backend (11 functions):**
- `packages/twenty-server/src/modules/pop-creations/logic-functions/fireflies-ingest/` - Fireflies webhook
- `packages/twenty-server/src/modules/pop-creations/logic-functions/clickup-sync/` - ClickUp sync
- `packages/twenty-server/src/modules/pop-creations/logic-functions/email-rerouter/` - Email routing

**Frontend (5 components):**
- `packages/twenty-front/src/modules/pop-creations/components/person-department-picker/`
- `packages/twenty-front/src/modules/pop-creations/components/monday-morning-dashboard/`

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

See `PHASE0_STATUS.md` for full details.
