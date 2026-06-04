# Twenty CRM — Pop Creations Fork

Production CRM for Pop Creations (`popcre.com`) running at **[crm.designflow.app](https://crm.designflow.app)**.

This is a fork of [Twenty CRM](https://twenty.com) v2.8.3 with an inbound-email-routing business
system layered on top. Emails arrive in a shared Outlook mailbox, the system classifies them to the
correct customer company/department/program automatically, and surfaces them in the CRM timeline.

---

## Quick orientation

| Document | Purpose |
|---|---|
| **[AGENTS.md](./AGENTS.md)** | Primary developer and AI guide — read this first |
| **[docs/architecture.md](./docs/architecture.md)** | System design, components, data flow |
| **[docs/development.md](./docs/development.md)** | Local setup, run/test/lint |
| **[docs/configuration.md](./docs/configuration.md)** | Env vars, auth (Microsoft Entra SSO, Microsoft OAuth) |
| **[docs/deployment.md](./docs/deployment.md)** | Build, push, Coolify deploy, live hash verification, rollback |
| **[HANDOFF.md](./HANDOFF.md)** | Open work: connected account re-auth for Albert + Adam |
| **[CLAUDE.md](./CLAUDE.md)** | Claude Code-specific notes |

---

## What this adds to upstream Twenty

- **Outlook ingestion** — cron polls a shared mailbox via Microsoft Graph every 15 minutes
- **Email router** — multi-step pipeline (domain → thread → subject history → fuzzy match → AI fallback)
  routes each message to the correct company/department/opportunity
- **8 custom objects** — `department`, `emailMessage`, `factory`, `ignoreRule`,
  `licensorApprovalThread`, `meetingNote`, `meetingNoteAttendee`, `aiModelConfig`
- **Extended standard objects** — `company` (customerStatus, chainType, routing fields),
  `person` (contactType, scope), `opportunity` (~23 program fields: PO#, factory, season, stage, etc.)
- **ClickUp sync** — opportunity stage mirrored to ClickUp task status
- **Fireflies webhook** — meeting transcripts auto-attached to the relevant company
- **AI summaries** — opportunity summaries generated via OpenRouter

Custom code lives entirely in:
- `packages/twenty-server/src/modules/pop-creations/`
- `packages/twenty-front/src/modules/pop-creations/`
- `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` (POP entries)

---

## Repository layout

```
packages/
├── twenty-server/src/modules/pop-creations/   ← backend business logic
├── twenty-front/src/modules/pop-creations/    ← frontend hooks/components
├── twenty-shared/                             ← shared types; POP object metadata here
├── twenty-docker/twenty/Dockerfile            ← single image for server + worker
└── ... (upstream Twenty packages — do not modify without justification)
docker-compose.yaml                            ← lives on origin/main; read by Coolify
ops/backup/create-backup.sh                    ← nightly pg_dump (lives in fork worktree)
docs/                                          ← extended documentation
AGENTS.md                                      ← primary guide
HANDOFF.md                                     ← pending work
```

---

## Upstream Twenty

This project is based on [Twenty CRM](https://github.com/twentyhq/twenty) (MIT license). The upstream
documentation, roadmap, and community are at [twenty.com](https://twenty.com). This fork is not
affiliated with or endorsed by Twenty.
