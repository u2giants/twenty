# Deployment

Build, push, deploy, rollback, and verification for the Pop Creations fork.

---

## Infrastructure summary

| Component | Value |
|---|---|
| Host VPS | `178.156.180.212` |
| Coolify app UUID | `rd261bt0wy7ifjrkoe1tkl92` |
| GHCR image | `ghcr.io/u2giants/twenty:latest` |
| Coolify API (on-host) | `http://localhost:8000/api/v1` |
| Production URL | `https://crm.designflow.app` |
| Workspace DB schema | `workspace_93r34ew9zc9644a9y5f1yeylz` |

Coolify reads `docker-compose.yaml` from `origin/main` and deploys the GHCR image referenced in
it. Because the compose uses `pull_policy: always`, every Coolify deploy pulls the latest image.

---

## Normal deploy (manual)

There is no CI pipeline yet. All deploys are manual from the VPS.

```bash
# 1. Build image from the refork source
cd /worksp/twenty/refork
docker build -f packages/twenty-docker/twenty/Dockerfile --target twenty \
  -t ghcr.io/u2giants/twenty:latest .

# 2. Push to GHCR (requires docker login — done once per session)
docker push ghcr.io/u2giants/twenty:latest

# 3. Trigger Coolify redeploy
TOKEN=$(cat /tmp/coolify_token.txt)
curl -s -X POST "http://localhost:8000/api/v1/deploy?uuid=rd261bt0wy7ifjrkoe1tkl92&force=true" \
  -H "Authorization: Bearer $TOKEN"
```

The Coolify token is stored at `/tmp/coolify_token.txt` (chmod 600). It does not survive reboots —
if it is missing, ask for a new token.

---

## Verify deploy

```bash
# Cron registration log — expect "27 successful, 0 failed, 1 skipped"
docker logs $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92) 2>&1 | \
  grep "Cron job registration completed"

# Confirm all 4 POP crons registered
docker logs $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92) 2>&1 | \
  grep -E "OutlookIngest|EmailRerouter|ClickUpSync|EmailContactSync"

# Check server and worker are up
docker ps --filter name=rd261bt0wy7ifjrkoe1tkl92

# Tail server logs
docker logs -f $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92) 2>&1 | tail -50
```

---

## Rollback

A pre-cutover backup image is tagged `rollback-v120-20260603` in GHCR.

```bash
# Re-tag the rollback image as latest
docker pull ghcr.io/u2giants/twenty:rollback-v120-20260603
docker tag ghcr.io/u2giants/twenty:rollback-v120-20260603 ghcr.io/u2giants/twenty:latest
docker push ghcr.io/u2giants/twenty:latest

# Redeploy
TOKEN=$(cat /tmp/coolify_token.txt)
curl -s -X POST "http://localhost:8000/api/v1/deploy?uuid=rd261bt0wy7ifjrkoe1tkl92&force=true" \
  -H "Authorization: Bearer $TOKEN"
```

Do not re-tag images by running `docker tag` on the production VPS for images already in
the running containers — use GHCR as the source of truth, push to GHCR, then redeploy.

---

## Database migrations

**POP migrations** are hand-applied SQL. The protocol:

1. Write a new numbered SQL file in `packages/twenty-server/src/modules/pop-creations/migrations/`
2. Make it idempotent (safe to run twice)
3. **Commit the file first**
4. Apply to production:
   ```bash
   docker exec -i twenty-postgres psql -U twenty -d twenty \
     < packages/twenty-server/src/modules/pop-creations/migrations/NNN_name.sql
   ```

**Upgrade commands** (framework schema changes) run automatically on server startup if
`DISABLE_DB_MIGRATIONS` is not set. The worker sets this to `true` — migrations only run in
the server container.

**To run an upgrade manually:**
```bash
docker exec $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92) \
  node dist/main run-instance-commands
```

---

## Backup

Nightly pg_dump at 23:15 UTC via systemd:

```
Timer:   popcre-twenty-backup.timer
Service: popcre-twenty-backup.service
Script:  /worksp/twenty/fork/ops/backup/create-backup.sh
Output:  /worksp/twenty/fork/backups/twenty_nightly_<YYYYMMDD_HHMMSS>.dump
```

14-day rolling retention. Dumps are uncompressed PostgreSQL custom format (`-Fc`).

Manual backup:
```bash
bash /worksp/twenty/fork/ops/backup/create-backup.sh
```

Check backup health:
```bash
systemctl status popcre-twenty-backup.timer
journalctl -u popcre-twenty-backup.service --since "2 days ago"
ls -lh /worksp/twenty/fork/backups/
```

Restore:
```bash
# Stop server to prevent writes during restore
docker stop $(docker ps -qf name=server-rd261bt0wy7ifjrkoe1tkl92)

docker exec -i twenty-postgres pg_restore -U twenty -d twenty --clean \
  < /worksp/twenty/fork/backups/twenty_nightly_TIMESTAMP.dump

docker start $(docker ps -aqf name=server-rd261bt0wy7ifjrkoe1tkl92)
```

---

## SSH access

SSH to the VPS is allowed for:
- Inspecting container state and logs
- Emergency debugging
- Running one-off maintenance commands

SSH is **not** the deploy path (use Coolify API). SSH-editing source files on the server is
**forbidden** — changes don't survive the next image deploy.

---

## CI pipeline (pending)

No CI pipeline is currently wired to `v28-refork`. The old `build-and-push.yml` on `origin/main`
dispatches to Twenty's own infrastructure and does not apply here. After the force-push to main
(see HANDOFF.md), the workflow will be adapted to: push to `main` → GitHub Actions builds the
image → pushes to GHCR → triggers Coolify deploy. The workflow template is at
`/worksp/twenty/fork/.github/workflows/build-and-push.yml`.
