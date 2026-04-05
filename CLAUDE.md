# CLAUDE.md — Claude Code Specific Instructions

**Read `AGENTS.md` first.** That file contains the full developer guide: business context,
architecture rules, navigation map, custom objects, pending work, and everything else.
This file contains only Claude Code-specific settings and behaviors.

---

## Memory

Persistent memory for this project is stored at:
`/home/ai/.claude/projects/-worksp-twenty/memory/`

The `MEMORY.md` index in that directory is loaded into every session automatically.
When you learn something worth remembering across sessions, write it there.

---

## Context management

The `.claudeignore` file at the repo root lists directories Claude should not index.
When starting a new session, do not read files in those directories unless the task
explicitly requires it.

The packages we care about most are:
- `packages/twenty-server/src/modules/pop-creations/` — read freely
- `packages/twenty-front/src/modules/pop-creations/` — read freely
- `packages/twenty-front/src/pages/pop-creations/` — read freely

When you need to understand how a Twenty system works (e.g. how cron queues work,
how workspace entities are registered), read the relevant core file as a reference.
Do not modify it unless following the rules in `AGENTS.md` Section 3.

---

## Operations

The user has no devops background. Claude is the ops person.

- You CAN and SHOULD SSH into `root@178.156.180.212` when needed
- You CAN and SHOULD use the Coolify API (`COOLIFY_BASE_URL` + `COOLIFY_API_TOKEN` from GitHub Secrets)
- Coolify server UUID: `rd261bt0wy7ifjrkoe1tkl92`
- Coolify worker UUID: `pkhhmt4r7n0xt25jmmlkkfi8`
- PostgreSQL container UUID: `g5j115bwrn8125ev6ap1tjrv`
- Production URL: `https://crm.designflow.app`
- GHCR image: `ghcr.io/u2giants/twenty:latest`

When the user asks to deploy, run database migrations, register cron jobs, or check
server status — execute it. Do not write a runbook and hand it back.

---

## Commit style

- Commit message: one sentence describing the "why", not the "what"
- Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Never skip pre-commit hooks (`--no-verify`)
- Push to `main` after committing unless explicitly told not to

---

## Tool preferences

- Use `Read` / `Edit` / `Write` / `Grep` / `Glob` instead of bash equivalents
- Use `Agent` (Explore subtype) for broad codebase research
- Use `Agent` (Plan subtype) for complex multi-file implementation planning
- Run independent operations in parallel (multiple tool calls in one response)

---

## AI model notes

This repo uses OpenRouter for all AI calls. The model in `OPENROUTER_API_KEY` env var.
Do not suggest adding provider-specific API keys (OpenAI, Anthropic, Google) — the
architecture deliberately uses a single OpenRouter endpoint.
