# CLAUDE.md

Claude Code-specific notes only. **[AGENTS.md](./AGENTS.md) is the primary operating guide — read it
first** (project summary, custom-code boundary, data model, deployment, quirks, pending work).
[README.md](./README.md) is the quick orientation. Allowed/disallowed operational actions:
see AGENTS.md §3 (prime directive) and the security notes below.

## Ignore files

`.claudeignore` (Claude Code) and `.cursorignore` (Cursor) exclude vendored/generated/build dirs from
AI context — see AGENTS.md §9. With any other AI tool, paste AGENTS.md as your first message.

## Local Memory

`/home/ai/.claude/projects/-worksp-twenty/memory/`

Only store facts there that are likely to matter across multiple sessions and are not already
captured in repo docs.

## Operational Assumptions

- Claude Code runs directly on the VPS (`178.156.180.212`) with access to the repo and production tooling
- Execute deploy, runtime verification, and production investigation tasks directly — do not hand back runbooks
- SSH into the VPS is allowed for inspection, log collection, and emergency debugging — it must not be
  used as a routine deployment path (use the Coolify API instead); SSH-editing source files on the server
  is forbidden

## Production Identifiers

Full set in AGENTS.md §6–§7. Operational quick-reference:

| Item | Value |
|---|---|
| Coolify app UUID | `rd261bt0wy7ifjrkoe1tkl92` |
| Server / worker container filter | `server-…` / `worker-rd261bt0wy7ifjrkoe1tkl92` |
| Postgres access | `docker exec -i twenty-postgres psql -U twenty -d twenty` |

## Commit Style

- explain why the change exists, not what it does
- do not use `--no-verify`
- do not push unless the user asked for it

## Security

- Secrets (APP_SECRET, DB URLs, tokens) must never be printed or appear in AI context — write to
  `chmod 600` files or pipe only
- Do not probe `core.personal_access_tokens` or any auth table to extract credentials
- Do not dump full container environment variables (`docker inspect` / `docker exec env`)
- Force-push to `main` requires explicit, separate user authorization each time
- `docker exec` into a running production container to execute commands requires explicit authorization

## Tooling Notes

- Prefer deterministic repo commands over ad hoc shell mutations
- When production state is involved, verify both server and worker containers
- Treat repo, image, Coolify config, and live runtime as four separate layers that may disagree
- The Postgres MCP server (`.mcp.json`) is read-only — use it for inspection; use CLI commands for writes
