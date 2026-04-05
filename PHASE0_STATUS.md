# POP Creations Twenty CRM Fork - Status

**Last Updated:** April 1, 2026
**Project:** Custom fork of [Twenty CRM](https://twenty.com) for POP Creations
**GitHub:** `https://github.com/u2giants/twenty`

---

## What Is This Project?

POP Creations has created a custom fork of Twenty CRM (an open-source CRM) with:
- **8 custom objects** (workspace entities stored in database)
- **11 backend logic functions** (NestJS services for automation)
- **5 React UI components** (custom user interface elements)

---

## Current Completion Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database backup | ✅ Done | Created April 1, 2026 |
| Fork sync with upstream | ✅ Done | Synced with twentyhq/twenty |
| 8 Custom workspace entities | ✅ Done | See Custom Objects section |
| 11 Logic functions (backend) | ✅ Done | See Backend Code section |
| 5 React components (frontend) | ✅ Done | See Frontend Code section |
| TypeScript validation | ❌ Pending | Must run on Linux filesystem |
| Views & navigation | ❌ Not started | Phase 5 |
| Build pipeline | ❌ Not started | Phase 6 |
| Testing | ❌ Not started | Phase 7 |
| Production deployment | ❌ Not started | Phase 8 |

---

## Quick Start for New Developers

### 1. Clone the repository
```bash
git clone https://github.com/u2giants/twenty.git
cd twenty
```

### 2. Install dependencies (IMPORTANT: Linux filesystem required)
```bash
# Yarn 4 PnP doesn't work on Windows/WSL due to symlink issues
# You MUST run on a Linux filesystem (native Linux, not WSL)

# If you have a Linux machine:
yarn install

# If you're on WSL but with a native Linux filesystem:
cp -r /mnt/d/twenty/twenty ~/src/twenty
cd ~/src/twenty
yarn install
```

### 3. Run TypeScript validation
```bash
npx nx run twenty-server:typecheck
npx nx run twenty-front:typecheck
```

### 4. Start development
```bash
npx nx run twenty-server:start     # Backend (port 3000)
npx nx run twenty-front:start       # Frontend (port 3001)
```

---

## Code Structure

### Backend Code Location
```
packages/twenty-server/src/modules/pop-creations/
├── pop-creations.module.ts
├── logic-functions/
│   ├── fireflies-ingest/           # Fireflies.ai webhook
│   ├── contact-auto-scope/        # Auto-sets person scope
│   ├── lat-stage-follow-up/       # LAT stage task creation
│   ├── new-program-tasks/          # Auto-creates tasks for new programs
│   ├── program-stage-change/       # Program stage automation
│   ├── clickup-sync/               # ClickUp daily sync
│   ├── email-rerouter/             # Email routing
│   ├── email-contact-sync/        # Email-contact sync
│   ├── outlook-ingest/             # Outlook integration
│   ├── pre-install/                # Pre-install hook
│   └── post-install/               # Post-install hook
```

### Frontend Code Location (SDK)
```
packages/twenty-front/src/modules/pop-creations/components/
├── index.ts
├── person-department-picker/        # Links persons to departments
├── department-dashboard/           # Department view with tabs
├── program-folio/                  # Program detail page
├── domain-manager/                 # Domain management UI
└── monday-morning-dashboard/       # Weekly overview
```

### NestJS Backend (Alternative to SDK)
```
packages/twenty-server/src/modules/pop-creations/
├── pop-creations.module.ts
├── logic-functions/                 # 11 NestJS modules (Phase 3 implementation)
```

---

## 8 Custom Objects

These are workspace entities (stored in Twenty's database with custom fields):

| Object | Purpose | Database Table |
|--------|---------|----------------|
| aiModelConfig | AI model settings | _aiModelConfig |
| department | Company departments | _department |
| emailMessage | Email message records | _emailMessage |
| factory | Factory/manufacturer info | _factory |
| ignoreRule | Email ignore rules | _ignoreRule |
| licensorApprovalThread | LAT approval tracking | _licensorApprovalThread |
| meetingNote | Meeting transcriptions | _meetingNote |
| meetingNoteAttendee | Meeting participants | _meetingNoteAttendee |

### Custom Fields Added to Standard Objects
- **Person**: departmentId, factoryId, etc.
- **Company**: factoryId, domain verification status
- **Opportunity**: departmentId, licensorApprovalThreadId

---

## 11 Logic Functions

### Event Listeners (respond to record changes)
1. **contact-auto-scope** - Triggered on `person.created` - Auto-sets person scope based on email domain
2. **lat-stage-follow-up** - Triggered on `licensorApprovalThread.updated` - Creates follow-up tasks
3. **new-program-tasks** - Triggered on `opportunity.created` - Auto-creates task checklist
4. **program-stage-change** - Triggered on `opportunity.updated` - Creates tasks and LATs based on stage
5. **fireflies-ingest** - HTTP POST `/fireflies-webhook` - Ingests Fireflies.ai meeting data

### Scheduled Cron Jobs
1. **clickup-sync** - Runs daily at 7am - Syncs with ClickUp
2. **email-contact-sync** - Runs daily at 2am - Email-contact sync
3. **email-rerouter** - Runs every 6 hours - Routes emails based on rules
4. **outlook-ingest** - Runs every 15 minutes - Ingests Outlook emails

### Install Hooks
1. **pre-install** - Runs before application install
2. **post-install** - Runs after application install

---

## Environment Configuration

### Production Server
- **IP:** 178.156.180.212
- **Workspace ID:** `93r34ew9zc9644a9y5f1yeylz`
- **PostgreSQL Container:** `g5j115bwrn8125ev6ap1tjrv`
- **Database User:** twenty

### Application IDs
| Application | ID |
|-------------|-----|
| POP Creations CRM | `b7ad46a7-1784-4fab-9f09-9eed6eedb0bf` |
| Workspace Custom App | `f99617d1-aa3d-4009-8211-53a7b747f5f2` |
| Twenty Standard | `58dd163b-b4d9-4b30-aca8-23b41518741d` |

### Custom Object UUIDs (universalIdentifier)
| Object | UUID |
|--------|------|
| aiModelConfig | `3b6c3623-dce6-4ae4-91a4-c212e5e9efe2` |
| department | `1b9e366d-b0a1-40e6-b253-115079fed63d` |
| emailMessage | `c0233f86-fdb6-4a32-9693-6c6fb1d5e740` |
| factory | `1e10f8ed-8571-48b8-8571-32e53b44d63e` |
| ignoreRule | `c0baf376-8e17-4d5b-b31a-39122aae9db5` |
| licensorApprovalThread | `b654e699-2912-433f-93dd-c97d9a5bb7e1` |
| meetingNote | `79e9be9f-d969-40f7-988d-efc83a8e7049` |
| meetingNoteAttendee | `78e3ad65-5495-461b-842e-672f1e10d78d` |

---

## Remaining Work

### Phase 5: Views & Navigation
- Configure Twenty views for custom objects
- Set up navigation menu items
- Define page layouts

### Phase 6: Build Pipeline
- Create GitHub Actions workflow
- Create custom Dockerfile
- Configure Coolify deployment

### Phase 7: Testing
- Deploy to staging
- Run integration tests
- Verify all logic functions

### Phase 8: Production Deployment
- Deploy with rollback plan
- Monitor for errors

---

## Important Notes

### Windows/WSL Yarn Issue
Yarn 4 PnP mode has symlink issues on Windows and WSL. The repository must be on a native Linux filesystem to run `yarn install`.

### Database Backup
A full database backup exists at: `/data/backups/twenty-backup-20260401-010600.sql`
