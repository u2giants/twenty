# Configuration

Environment variables, authentication setup, and feature flags.

Values live in **Coolify** (production) or `.env` files (local dev). They are never committed to git.

---

## Required variables

### Core database and cache

| Variable | Example | Purpose |
|---|---|---|
| `PG_DATABASE_URL` | `postgresql://twenty:…@localhost:5432/twenty` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379` | Queue and cache |

### Application

| Variable | Example | Purpose |
|---|---|---|
| `APP_SECRET` | random 64-char hex | Session signing; doubles as `ENCRYPTION_KEY` (v2.8 resolves `ENCRYPTION_KEY ?? APP_SECRET`) |
| `SERVER_URL` | `https://crm.designflow.app` | Base URL used in emails, OAuth redirects, webhooks |
| `FRONT_BASE_URL` | `https://crm.designflow.app` | Frontend URL (same as SERVER_URL in production) |
| `PORT` | `3000` | API server port |

### Authentication (Authentik SSO)

| Variable | Example | Purpose |
|---|---|---|
| `ENTERPRISE_KEY` | any non-empty string | Enables OIDC/SSO guard |
| `AUTH_GOOGLE_ENABLED` | `false` | Disable upstream Google OAuth |
| `AUTH_MICROSOFT_ENABLED` | `false` | Disable upstream Microsoft user-auth OAuth |
| `SIGN_IN_PREFILLED` | `false` | Disable prefilled dev credentials |

Authentik is configured as an OIDC provider. `ENTERPRISE_KEY` being set activates the SSO
middleware that redirects unauthenticated requests through Authentik.

### Microsoft Graph (Outlook ingestion)

| Variable | Purpose |
|---|---|
| `AZURE_TENANT_ID` | Azure AD tenant for the Outlook mailbox |
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_CLIENT_SECRET` | App registration secret |
| `OUTLOOK_MAILBOX` | Mailbox address to poll (e.g. `adweck@popcre.com`) |

These are used by the `OutlookIngestCronJob`. The connected-account OAuth flow for individual
users (personal calendar/email sync) uses separate values configured through the Twenty UI.

### AI and integrations

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | AI model calls (email routing fallback + opportunity summaries) |
| `CLICKUP_API_TOKEN` | ClickUp task status sync |
| `FIREFLIES_API_KEY` | Webhook receiver for meeting transcripts |

### Workspace

| Variable | Purpose |
|---|---|
| `POP_CREATIONS_WORKSPACE_ID` | Target workspace ID for cron jobs (`99c80ca1-610f-48b5-bd1f-9178201bdcb7`) |

### Worker mode

The worker container uses the same image but different env vars to disable server-only functions:

| Variable | Worker value | Purpose |
|---|---|---|
| `DISABLE_DB_MIGRATIONS` | `true` | Prevents worker from running migrations on startup |
| `DISABLE_CRON_JOBS_REGISTRATION` | `true` | Prevents worker from scheduling crons (server does this) |

---

## Optional variables

| Variable | Default | Purpose |
|---|---|---|
| `LOGIC_FUNCTION_TYPE` | `LOCAL` | Execution mode for Twenty logic functions; must be `LOCAL` in production |
| `SIGNING_KEY_ROTATION_DAYS` | unset | Enable automatic signing-key rotation; leave unset unless needed |
| `STORAGE_TYPE` | `local` | File storage backend (`local` or `s3`) |
| `EMAIL_DRIVER` | unset | Outbound email driver (`smtp`, `sendgrid`, etc.) |

---

## Local `.env` files

Each package has its own `.env`:

- `packages/twenty-server/.env` — server + worker config (all variables above)
- `packages/twenty-front/.env` — frontend env (mostly `SERVER_URL`)

`.env.example` files exist as templates. Ask a team member for actual values.

---

## Production config (Coolify)

Production environment variables are managed in the Coolify UI under the app
`rd261bt0wy7ifjrkoe1tkl92`. Changes to env vars in Coolify require a redeploy to take effect.

Do not `docker inspect` running containers to read env vars — that exposes secrets in shell
history and AI context. If a value is needed for debugging, read it through the Coolify API
(scoped to the specific key) or ask the team member who set it.

---

## `ENCRYPTION_KEY` / `APP_SECRET` note

v2.8 added `ENCRYPTION_KEY` as the primary encryption credential. The implementation resolves it as:

```typescript
ENCRYPTION_KEY ?? APP_SECRET
```

If `APP_SECRET` is already set (it is in production), no separate `ENCRYPTION_KEY` is needed.
**Do not add `ENCRYPTION_KEY` with a different value** — all stored OAuth tokens and credentials
were encrypted with `APP_SECRET` and would become unreadable.
