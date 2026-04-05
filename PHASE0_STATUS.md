# POP Creations Twenty CRM Fork - Status

**Last Updated:** April 1, 2026
**Project:** Custom fork of [Twenty CRM](https://twenty.com) for POP Creations
**GitHub:** `https://github.com/u2giants/twenty`

---

## What Is This Project?

POP Creations has created a custom fork of Twenty CRM (an open-source CRM) with:
- **8 custom objects** (workspace entities stored in database)
- **NestJS backend services** for automation (email routing, Fireflies, ClickUp, cron jobs)
- **Native React components** embedded in Twenty's widget system

---

## Current Completion Status

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| 0 | Fork setup, branch structure | ✅ Done | `u2giants/twenty`, main + upstream branches |
| 1 | UID extraction from production DB | ✅ Done | All UIDs in `migration-reference/CRITICAL_UID_MAP.txt` |
| 2 | 8 Custom workspace entities (metadata system) | ✅ Done | Committed to main |
| 3 | 11 NestJS logic functions + cron jobs | ✅ Done | Committed to main |
| 4 | 5 native React front components | ✅ Done | Committed to main |
| 5 | AG Grid inline filters + computed fields | ✅ Done | Committed to main |
| 6 | GitHub Actions build pipeline + Dockerfile | ✅ Done | `.github/workflows/build-and-push.yml` |
| 7 | Database migration scripts | ✅ Done | `migration-reference/transfer-ownership.sql` |
| 8 | Production cutover runbook | ✅ Done | `migration-reference/CUTOVER_RUNBOOK.md` |
| — | **Production cutover execution** | ❌ Pending | Next step |

---

## Code Structure

### Backend (NestJS) — `packages/twenty-server/src/modules/pop-creations/`
```
├── pop-creations.module.ts
├── services/
│   └── email-router.service.ts      — Five-step routing cascade
├── controllers/
│   └── fireflies-webhook.controller.ts
├── listeners/
│   └── pop-creations-record.listener.ts  — All database event listeners
├── crons/
│   ├── jobs/
│   │   ├── outlook-ingest.cron.job.ts    — Every 15 min
│   │   ├── email-rerouter.cron.job.ts    — Every 6 hours
│   │   ├── clickup-sync.cron.job.ts      — Daily 7am
│   │   └── email-contact-sync.cron.job.ts — Daily 2am
│   └── commands/
│       ├── outlook-ingest.cron.command.ts
│       └── pop-creations-cron.commands.ts
└── standard-objects/                     — 8 workspace entity files
```

### Frontend (React) — `packages/twenty-front/src/modules/pop-creations/`
```
components/
├── DepartmentDashboardWidget.tsx   — Department record page widget
└── ProgramFolioWidget.tsx          — Opportunity record page widget

pages/pop-creations/
├── MondayMorningDashboardPage.tsx  — Route: /pop/dashboard
└── DomainManagerPage.tsx           — Route: /pop/domains
```

---

## 8 Custom Objects

| Object | Purpose | universalIdentifier |
|--------|---------|---------------------|
| aiModelConfig | AI model settings | `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2` |
| department | Company departments | `1b9e366d-b0a1-40e6-b253-115079fed63d` |
| emailMessage | Email message records | `c0233f86-fdb6-4a32-9693-6c6fb1d5e740` |
| factory | Factory/manufacturer info | `1e10f8ed-8571-48b8-8571-32e53b44d63e` |
| ignoreRule | Email ignore rules | `c0baf376-8e17-4d5b-b31a-39122aae9db5` |
| licensorApprovalThread | LAT approval tracking | `b654e699-2912-433f-93dd-c97d9a5bb7e1` |
| meetingNote | Meeting transcriptions | `79e9be9f-d969-40f7-988d-efc83a8e7049` |
| meetingNoteAttendee | Meeting participants | `78e3ad65-5495-461b-842e-672f1e10d78d` |

---

## Environment

| Item | Value |
|------|-------|
| Production URL | `https://crm.designflow.app` |
| Production Server IP | `178.156.180.212` |
| PostgreSQL Container UUID | `g5j115bwrn8125ev6ap1tjrv` |
| Coolify server UUID | `rd261bt0wy7ifjrkoe1tkl92` |
| Coolify worker UUID | `pkhhmt4r7n0xt25jmmlkkfi8` |
| GHCR image | `ghcr.io/u2giants/twenty:latest` |

---

## Database Backup

A full database backup exists at: `/data/backups/twenty-backup-20260401-010600.sql`

---

## Next Step: Production Cutover

See `migration-reference/CUTOVER_RUNBOOK.md` for the complete execution plan.

**Summary:**
1. Wait for `build-and-push.yml` GitHub Actions to succeed (image pushed to GHCR)
2. Run `transfer-ownership.sql` against production PostgreSQL
3. Update Coolify to deploy `ghcr.io/u2giants/twenty:latest`
4. Set environment variables (OPENROUTER_API_KEY, AZURE_*, CLICKUP_API_TOKEN)
5. Run `workspace:sync-metadata`
6. Register cron jobs
7. Verify and monitor
