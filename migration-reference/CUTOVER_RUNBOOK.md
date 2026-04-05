# Production Cutover Runbook

## Overview

Replace the stock Twenty + SDK app deployment with the forked Twenty image that includes all POP Creations customizations natively.

**Estimated downtime:** 15-30 minutes  
**Best time:** Evening or weekend (small team)  
**Rollback path:** Restore database backup + revert Coolify to stock Twenty image

## Variables (fill before starting)

```bash
COOLIFY_BASE_URL="https://..."           # from GitHub secret COOLIFY_BASE_URL
COOLIFY_API_TOKEN="..."                  # from GitHub secret COOLIFY_API_TOKEN
SERVER_UUID="rd261bt0wy7ifjrkoe1tkl92"
WORKER_UUID="pkhhmt4r7n0xt25jmmlkkfi8"
PG_CONTAINER="g5j115bwrn8125ev6ap1tjrv"  # PostgreSQL container UUID in Coolify
DB_HOST="localhost"
DB_USER="twenty"
DB_NAME="default"

OPENROUTER_API_KEY="sk-or-v1-..."
AZURE_TENANT_ID="..."
AZURE_CLIENT_ID="..."
AZURE_CLIENT_SECRET="..."
CLICKUP_API_TOKEN="pk_..."
POP_CREATIONS_WORKSPACE_ID="..."
```

## Pre-cutover checklist

- [ ] GitHub Actions `build-and-push.yml` has successfully run and pushed `ghcr.io/u2giants/twenty:latest`
- [ ] All credentials listed above are available
- [ ] A database backup was taken recently (Step 2 will take a fresh one)

---

## Step 1: Announce maintenance

Notify team that CRM will be briefly unavailable.

---

## Step 2: Take database backup

Access PostgreSQL via Coolify API to exec into the database container:

```bash
# Get the container name via Coolify
curl -s "$COOLIFY_BASE_URL/api/v1/databases/$PG_CONTAINER" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" | jq '.name'

# SSH into server and run pg_dump
ssh root@178.156.180.212 \
  "docker exec \$(docker ps -qf name=twenty.*postgres) \
   pg_dump -U $DB_USER -d $DB_NAME -F c \
   -f /var/backups/twenty-cutover-\$(date +%Y%m%d-%H%M).dump"
```

Verify the backup exists:

```bash
ssh root@178.156.180.212 "ls -lh /var/backups/twenty-cutover-*.dump | tail -1"
```

---

## Step 3: Run ownership transfer SQL

Copy the SQL file to the server and execute it:

```bash
scp migration-reference/transfer-ownership.sql root@178.156.180.212:/tmp/

ssh root@178.156.180.212 \
  "docker exec -i \$(docker ps -qf name=twenty.*postgres) \
   psql -U $DB_USER -d $DB_NAME < /tmp/transfer-ownership.sql"
```

Verify — all 8 custom objects should show `58dd163b-...`:

```bash
ssh root@178.156.180.212 "docker exec \$(docker ps -qf name=twenty.*postgres) psql -U $DB_USER -d $DB_NAME -c \"
  SELECT \\\"nameSingular\\\", \\\"applicationId\\\"
  FROM core.\\\"objectMetadata\\\"
  WHERE \\\"universalIdentifier\\\" IN (
    '3b6c3623-dce6-4ae4-91a4-c212e5e9efe2',
    '1b9e366d-b0a1-40e6-b253-115079fed63d',
    'c0233f86-fdb6-4a32-9693-6c6fb1d5e740',
    '1e10f8ed-8571-48b8-8571-32e53b44d63e',
    'c0baf376-8e17-4d5b-b31a-39122aae9db5',
    'b654e699-2912-433f-93dd-c97d9a5bb7e1',
    '79e9be9f-d969-40f7-988d-efc83a8e7049',
    '78e3ad65-5495-461b-842e-672f1e10d78d'
  );
\""
```

---

## Step 4: Update Coolify deployment — server app

Update the Docker image and environment variables for the server app:

```bash
# Update image
curl -s -X PATCH "$COOLIFY_BASE_URL/api/v1/applications/$SERVER_UUID" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docker_image": "ghcr.io/u2giants/twenty:latest"
  }'

# Update environment variables
curl -s -X PATCH "$COOLIFY_BASE_URL/api/v1/applications/$SERVER_UUID/envs/bulk" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": [
      {\"key\": \"OPENROUTER_API_KEY\", \"value\": \"$OPENROUTER_API_KEY\"},
      {\"key\": \"AZURE_TENANT_ID\", \"value\": \"$AZURE_TENANT_ID\"},
      {\"key\": \"AZURE_CLIENT_ID\", \"value\": \"$AZURE_CLIENT_ID\"},
      {\"key\": \"AZURE_CLIENT_SECRET\", \"value\": \"$AZURE_CLIENT_SECRET\"},
      {\"key\": \"OUTLOOK_MAILBOX\", \"value\": \"adweck@popcre.com\"},
      {\"key\": \"CLICKUP_API_TOKEN\", \"value\": \"$CLICKUP_API_TOKEN\"},
      {\"key\": \"POP_CREATIONS_WORKSPACE_ID\", \"value\": \"$POP_CREATIONS_WORKSPACE_ID\"}
    ]
  }"

# Deploy server app
curl -s -X GET "$COOLIFY_BASE_URL/api/v1/applications/$SERVER_UUID/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

---

## Step 5: Update Coolify deployment — worker app

```bash
# Update image
curl -s -X PATCH "$COOLIFY_BASE_URL/api/v1/applications/$WORKER_UUID" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "docker_image": "ghcr.io/u2giants/twenty:latest"
  }'

# Same env vars needed on worker
curl -s -X PATCH "$COOLIFY_BASE_URL/api/v1/applications/$WORKER_UUID/envs/bulk" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": [
      {\"key\": \"OPENROUTER_API_KEY\", \"value\": \"$OPENROUTER_API_KEY\"},
      {\"key\": \"AZURE_TENANT_ID\", \"value\": \"$AZURE_TENANT_ID\"},
      {\"key\": \"AZURE_CLIENT_ID\", \"value\": \"$AZURE_CLIENT_ID\"},
      {\"key\": \"AZURE_CLIENT_SECRET\", \"value\": \"$AZURE_CLIENT_SECRET\"},
      {\"key\": \"OUTLOOK_MAILBOX\", \"value\": \"adweck@popcre.com\"},
      {\"key\": \"CLICKUP_API_TOKEN\", \"value\": \"$CLICKUP_API_TOKEN\"}
    ]
  }"

# Deploy worker app
curl -s -X GET "$COOLIFY_BASE_URL/api/v1/applications/$WORKER_UUID/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Wait for containers to be running (~2-3 minutes):

```bash
# Poll until both show "running"
for UUID in $SERVER_UUID $WORKER_UUID; do
  while true; do
    STATUS=$(curl -s "$COOLIFY_BASE_URL/api/v1/applications/$UUID" \
      -H "Authorization: Bearer $COOLIFY_API_TOKEN" | jq -r '.status')
    echo "$UUID: $STATUS"
    [ "$STATUS" = "running" ] && break
    sleep 5
  done
done
```

---

## Step 6: Run metadata sync

```bash
ssh root@178.156.180.212 \
  "docker exec \$(docker ps -qf name=twenty.*server) \
   node dist/main workspace:sync-metadata"
```

**Expected output:** Should recognize all 8 custom objects and ~90 custom fields without "dropping table" messages. If you see drop/recreate messages, STOP and investigate before proceeding — check that Step 3 completed correctly.

---

## Step 7: Register cron jobs

```bash
for JOB in outlook-ingest email-rerouter clickup-sync email-contact-sync; do
  echo "Registering cron:pop-creations:$JOB ..."
  ssh root@178.156.180.212 \
    "docker exec \$(docker ps -qf name=twenty.*server) \
     node dist/main cron:pop-creations:$JOB"
done
```

---

## Step 8: Verify

```bash
# Check server logs for errors
ssh root@178.156.180.212 \
  "docker logs \$(docker ps -qf name=twenty.*server) --tail 50 2>&1"
```

Manual checks:
- [ ] Login to https://crm.designflow.app — workspace loads correctly
- [ ] Company list shows all companies with customerStatus field
- [ ] Department records show DepartmentDashboard widget
- [ ] Opportunity records show ProgramFolio widget
- [ ] `/pop/dashboard` page loads MondayMorningDashboard
- [ ] `/pop/domains` page loads DomainManager
- [ ] Inline filter row toggles on record tables
- [ ] Create a test EmailMessage — verify routing status is set

---

## Step 9: Monitor for 24 hours

```bash
# Check cron output after 15 min (outlook-ingest should have run)
ssh root@178.156.180.212 \
  "docker logs \$(docker ps -qf name=twenty.*worker) 2>&1 | grep -i 'outlook\|cron'"
```

Watch for:
- Cron job execution (Outlook ingest every 15 min, rerouter every 6h)
- Error rates in container logs
- User reports of missing data or broken views

---

## Step 10: Decommission old SDK app

Once stable (24-48 hours after cutover):

1. Archive `u2giants/poc-twenty-app` repository on GitHub
2. Remove the SDK app's `installApplication` registration if desired (optional — harmless)
3. Update Coolify to remove the old `publish-custom-image` workflow trigger

---

## Rollback procedure

If critical issues are found before Step 9 (before confirming stable):

```bash
# 1. Stop both containers
for UUID in $SERVER_UUID $WORKER_UUID; do
  curl -s -X GET "$COOLIFY_BASE_URL/api/v1/applications/$UUID/stop" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN"
done

# 2. Restore database
ssh root@178.156.180.212 \
  "docker exec -i \$(docker ps -qf name=twenty.*postgres) \
   pg_restore -U $DB_USER -d $DB_NAME --clean \$(ls -t /var/backups/twenty-cutover-*.dump | head -1)"

# 3. Revert Coolify to stock image
for UUID in $SERVER_UUID $WORKER_UUID; do
  curl -s -X PATCH "$COOLIFY_BASE_URL/api/v1/applications/$UUID" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"docker_image": "twentycrm/twenty:latest"}'
  curl -s -X GET "$COOLIFY_BASE_URL/api/v1/applications/$UUID/start" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN"
done
```
