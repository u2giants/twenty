# Development

Local setup, run/test/lint workflow for the Pop Creations fork.

---

## Prerequisites

- Node.js 20+, Yarn 4 (via `corepack enable`)
- Docker (for Postgres + Redis)
- Access to `.env` files (ask for values — not in git)

---

## Setup

```bash
# Install dependencies
yarn install

# Start Postgres + Redis (Docker)
docker compose -f packages/twenty-docker/docker-compose.dev.yml up -d

# Seed the workspace schema
npx nx run twenty-server:database:init:prod

# Copy environment files (values not in git — see docs/configuration.md for the list)
cp packages/twenty-server/.env.example packages/twenty-server/.env
# edit .env with real values
```

The setup script in upstream `packages/twenty-utils/setup-dev-env.sh` handles the Docker +
database steps automatically and is idempotent:

```bash
bash packages/twenty-utils/setup-dev-env.sh
```

Use `--docker` to force Docker mode, `--reset` to wipe and restart fresh.

---

## Running

```bash
# All three at once (frontend + backend + worker)
yarn start

# Individually
npx nx start twenty-front     # React dev server (Vite) — http://localhost:3001
npx nx start twenty-server    # NestJS API — http://localhost:3000
npx nx run twenty-server:worker  # BullMQ worker
```

---

## Building

```bash
# Build order: shared first, then server/front
npx nx build twenty-shared
npx nx build twenty-server
npx nx build twenty-front
```

The Docker image builds the server only — see `packages/twenty-docker/twenty/Dockerfile`.

---

## Testing

```bash
# Preferred: single test file (fastest)
cd packages/twenty-server && npx jest path/to/test.spec.ts

# All tests for a package
npx nx test twenty-server
npx nx test twenty-front

# Integration tests (requires live DB)
npx nx run twenty-server:test:integration:with-db-reset

# Frontend stories
npx nx storybook:build twenty-front
npx nx storybook:test twenty-front
```

`@/` in `twenty-front` test files maps to `src/modules/` — not `src/`. A wrong path produces
a misleading "Vitest cannot be imported in a CommonJS module" error; fix the path, not the phantom
ESM problem.

---

## Linting and type checking

```bash
# Lint only changed files vs main (fastest, always run this first)
npx nx lint:diff-with-main twenty-server
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-front --configuration=fix  # auto-fix

# Full lint (slower)
npx nx lint twenty-server

# Type check
npx nx typecheck twenty-server
npx nx typecheck twenty-front

# Format
npx nx fmt twenty-server
npx nx fmt twenty-front
```

---

## Database operations

```bash
# Reset workspace schema (wipes workspace data, keeps core)
npx nx database:reset twenty-server

# Apply all pending upgrade commands
npx nx run twenty-server:database:migrate:prod

# Run a specific instance command (fast-only)
npx nx run twenty-server:database:migrate:prod

# Generate a new instance command
npx nx run twenty-server:database:migrate:generate --name my-change --type fast
```

**POP migrations** are hand-applied SQL, not TypeORM. Commit the file to
`packages/twenty-server/src/modules/pop-creations/migrations/` first, then apply:

```bash
docker exec -i twenty-postgres psql -U twenty -d twenty \
  < packages/twenty-server/src/modules/pop-creations/migrations/NNN_name.sql
```

Migrations must be idempotent (re-runnable). See AGENTS.md §5 for the full protocol.

---

## GraphQL

```bash
# Regenerate frontend types after schema changes
npx nx run twenty-front:graphql:generate
npx nx run twenty-front:graphql:generate --configuration=metadata
```

---

## Database inspection (Postgres MCP)

A read-only Postgres MCP server is configured in `.mcp.json`. Use it to inspect workspace data,
verify migration results, and debug raw data issues. For write operations, use the CLI commands above.

---

## Code conventions

- **No default exports** — named exports only
- **No class components** — functional components only
- **No `any`** — strict TypeScript enforced
- **Prefer `isDefined()`, `isNonEmptyString()`, `isNonEmptyArray()`** from `twenty-shared/utils`
- **No comments explaining what the code does** — only WHY (hidden constraints, non-obvious invariants)
- **Linaria** for CSS-in-JS (zero-runtime, styled-components pattern)
- **Jotai** for global state; local state with `useState`/`useReducer`
- **Event handlers over `useEffect`** for state updates

See `.cursor/rules/` for detailed guidelines on naming, file structure, testing strategy, etc.

---

## Adding a cron job

Requires edits to **4 files** (v2.8 does not auto-discover):

1. `pop-creations/crons/jobs/<name>.cron.job.ts` — job implementation
2. `pop-creations/crons/commands/<name>.cron.command.ts` — command wrapper
3. `pop-creations.module.ts` — declare provider + export
4. `engine/core-modules/message-queue/jobs.module.ts` — import `PopCreationsModule`
5. `database/commands/cron-register-all.command.ts` — add to hardcoded execution list
6. `database/commands/database-command.module.ts` — declare provider in CLI context

See AGENTS.md §5 for the exact pattern.

---

## Adding a custom object

1. Create `pop-creations/standard-objects/<name>.workspace-entity.ts`
2. Create `field-metadata/pop-creations/compute-<name>-standard-flat-field-metadata.util.ts`
3. Register in `STANDARD_OBJECTS` in `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts`
   (include `views: {}` key — required even if empty)
4. Register field metadata util in the metadata pipeline
5. Run `npx nx run twenty-server:database:migrate:prod` to sync schema
