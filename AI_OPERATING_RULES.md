# AI Operating Rules

Operational decision rules for AI agents working on this repo. For architecture, see
[docs/architecture.md](./docs/architecture.md). For contributor working rules, see
[AGENTS.md](./AGENTS.md). For deployment details, see [docs/deployment.md](./docs/deployment.md).

## Sources of Truth

- **GitHub** — code, workflows, Dockerfiles, `docker-compose.yaml`
- **GHCR** — published application image (`ghcr.io/u2giants/twenty:latest`)
- **Coolify** — production runtime env vars and deployment target settings
- **VPS** — runtime host and investigation surface, not a configuration source

## Operating Model

The user does not perform low-level operator tasks. AI is the operator. AI has full access to the repo, containers, and production database and is expected to execute tasks end-to-end rather than producing runbooks for the user to follow.

## Allowed Actions

AI may:

- edit code, docs, workflows, Dockerfiles, and compose
- inspect containers, logs, and Coolify API responses
- run SQL (read or write) against the production database
- trigger a Coolify deploy via the standard API endpoint
- apply runtime env changes in Coolify when required

## Coolify Direct-Action Rule

Coolify is the source of truth for runtime configuration. Changes to runtime configuration must go through Coolify directly — not through GitHub. Routing them through GitHub would violate single source of truth, not protect it.

**AI may modify directly in Coolify (Coolify's authoritative domain):**

- runtime environment variables (e.g. `ISSUE_PIPELINE_V2=true`)
- feature flags and behavior switches that control runtime behavior without changing code
- domain bindings and port mappings
- health check settings
- restart policy
- container resource limits
- deployment target settings

**AI must not modify directly in Coolify (these belong in GitHub — modifying them outside the repo creates drift):**

- application source code
- Dockerfiles
- Docker Compose or infrastructure config
- GitHub Actions workflow changes
- build logic overrides that differ from the repo's approved pipeline
- production-only source files or Dockerfile variants not in the repo

The test: would putting this change in GitHub instead of Coolify make it more auditable and reproducible, with no loss of runtime flexibility? If yes, it belongs in GitHub. If the change is inherently runtime state with no meaningful repo representation (env values, switch states), it belongs in Coolify and must go there directly.

## Registry-Watch Caution

Do not configure Coolify to auto-deploy on any registry push unless all of these are guaranteed: the repo explicitly documents this as the approved release method; only images produced by the approved GitHub Actions workflow can trigger deployment; the image tag is explicit and auditable; manual pushes to the registry cannot accidentally deploy to production; required verification cannot be bypassed. The safer default is an explicit GitHub Actions deploy job that calls the Coolify API.

## Database Change Protocol

Write SQL first, apply second — never the reverse. The migration file is the permanent record; applying it before it exists leaves undocumented production drift.

1. Write the SQL as a numbered file in `packages/twenty-server/src/modules/pop-creations/migrations/`
2. Commit and push to `main`
3. Apply it:
   ```bash
   docker exec -i twenty-postgres psql -U twenty -d twenty \
     < packages/twenty-server/src/modules/pop-creations/migrations/NNN_name.sql
   ```

This applies to field metadata patches, schema DDL, data backfills, and any other database write.

## CI/CD Shape For This Repo

- `main` is the only release branch
- every push to `main` runs one GitHub Actions workflow graph:
  `lint → test → build/push image → deploy`
- the deploy job calls the Coolify API after the image is published — never SSH
- deployment gating uses native job `needs` dependencies, not workflow polling
- PR validation can stay separate because it does not own production deploys
- docs-only commits (AGENTS.md, CLAUDE.md, AI_OPERATING_RULES.md, docs/**, HANDOFF.md, README.md)
  skip the build via `paths-ignore` — no deploy needed for documentation changes

## Normal Deploy Path

```
push to main
  ↓
GitHub Actions
  lint → test → build Docker image → push to GHCR → trigger Coolify API
  ↓
Coolify
  pulls ghcr.io/u2giants/twenty:latest
  updates server + worker containers
  ↓
VPS
  runs the deployed containers (runtime host only)
```

GitHub Secrets required: `COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_SERVER_UUID`.

## Manual Deploy (Emergency Only)

Manual image builds on the VPS are **not the approved release path**. They produce artifacts that
are not traceable to a CI run and bypass all verification gates. Use only when:

- the GitHub Actions workflow is broken and production needs an urgent fix
- a CI regression blocks a critical hotfix

After any manual deploy, the permanent fix must come through the approved CI path and be committed
to the repo.

## Disallowed Defaults

Do not treat these as standard practice:

- SSH-only deployment as the normal release path
- server-side file edits as the final fix for any issue
- undocumented production drift
- parallel deployment systems outside GitHub Actions + GHCR + Coolify
- bypassing required CI checks to keep pipelines green
- moving runtime configuration out of Coolify and into GitHub Actions shell commands
- making Coolify rebuild the repo when the approved workflow is supposed to build and publish the image
- leaving legacy SSH deploy workflows active after replacing them with Coolify API deploys
- retaining production SSH credentials in GitHub Secrets after the deploy path no longer requires them
- building Docker images manually on the VPS as a routine deployment step

## Decision Preference

Prefer the approach that:

- keeps `main` authoritative
- makes production reproducible from the repo
- reduces hidden VPS state
- is understandable to a non-operator owner
- minimizes future recovery and debug cost
