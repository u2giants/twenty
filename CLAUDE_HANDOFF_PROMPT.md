# POP Creations Twenty Fork - Developer Handoff

## What Is This?

Custom fork of [Twenty CRM](https://twenty.com) for POP Creations with 8 custom objects, NestJS backend services, and native React UI components. All code customizations are in `packages/twenty-server/src/modules/pop-creations/` and `packages/twenty-front/src/modules/pop-creations/`.

## Status: ALL PHASES COMPLETE — AWAITING PRODUCTION CUTOVER

All 8 development phases have been committed to `main`. The fork is ready to deploy.

### ✅ COMPLETED (committed to main)

| Phase | Work |
|-------|------|
| 0 | Fork setup, upstream + main branches |
| 1 | UID extraction from production DB |
| 2 | 8 custom workspace entities in Twenty's native metadata system |
| 3 | 16 SDK logic functions → NestJS services + cron jobs |
| 4 | 5 front components → native React (DepartmentDashboard, ProgramFolio, MondayMorningDashboard, DomainManager) |
| 5 | AG Grid inline filters, computed fields (contactCount, departmentCount on Company) |
| 6 | GitHub Actions build pipeline → GHCR |
| 7 | Database migration scripts (`migration-reference/transfer-ownership.sql`) |
| 8 | Production cutover runbook (`migration-reference/CUTOVER_RUNBOOK.md`) |

### ❌ NEXT: Execute production cutover

See `migration-reference/CUTOVER_RUNBOOK.md`.

## Code Locations

| Type | Location |
|------|----------|
| NestJS module | `packages/twenty-server/src/modules/pop-creations/` |
| React components | `packages/twenty-front/src/modules/pop-creations/components/` |
| Page routes | `packages/twenty-front/src/pages/pop-creations/` |
| Migration SQL | `migration-reference/transfer-ownership.sql` |
| Documentation | `CLAUDE.md` (comprehensive), `PHASE0_STATUS.md` (status overview) |

## Environment

| Item | Value |
|------|-------|
| Production URL | `https://crm.designflow.app` |
| Server IP | `178.156.180.212` |
| PostgreSQL Container | `g5j115bwrn8125ev6ap1tjrv` |
| GHCR image | `ghcr.io/u2giants/twenty:latest` |

## Key architecture notes

- **AI routing:** Uses OpenRouter (`OPENROUTER_API_KEY`). Single endpoint for all models. Model IDs prefixed: `openai/gpt-5.4`, `google/gemini-3.1-pro-preview`, `anthropic/claude-sonnet-4-6`.
- **Email ingest:** Microsoft Graph API. Env vars: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `OUTLOOK_MAILBOX`.
- **ClickUp sync:** `CLICKUP_API_TOKEN`.
- **Custom widget rendering:** `WidgetContentRenderer.tsx` intercepts `FRONT_COMPONENT` widgets and dispatches by `frontComponentName` to native React components.
- **Cron registration:** Must run `node dist/main cron:pop-creations:*` commands after deploy to register cron jobs in the message queue.

See `CLAUDE.md` for full schema, business context, and developer advice.
