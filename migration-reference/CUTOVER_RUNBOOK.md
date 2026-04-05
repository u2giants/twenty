# Production Cutover Runbook

## Overview

Replace the stock Twenty + SDK app deployment with the forked Twenty image that includes all POP Creations customizations natively.

**Estimated downtime:** 15-30 minutes  
**Best time:** Evening or weekend (small team)  
**Rollback path:** Restore database backup + revert Coolify to stock Twenty image

## Pre-cutover checklist

- [ ] Phase 2 committed (custom objects in metadata system)
- [ ] Phase 3 committed (NestJS services)
- [ ] Phase 4 committed (frontend components)
- [ ] Phase 5 committed (inline filters, computed fields)
- [ ] Phase 6 committed (build pipeline)
- [ ] GitHub Actions workflow has successfully built and pushed image to `ghcr.io/u2giants/twenty:latest`
- [ ] Migration tested on database copy (MIGRATION_RUNBOOK.md Step 2-3)
- [ ] OpenRouter API key obtained and ready
- [ ] Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) documented
- [ ] ClickUp API token ready

## Cutover steps

### 1. Announce maintenance

Notify team that CRM will be briefly unavailable.

### 2. Take database backup

```bash
# On the database server or via Coolify's PostgreSQL access
pg_dump -h localhost -U twenty -d default -F c -f /var/backups/twenty-cutover-$(date +%Y%m%d-%H%M).dump
```

### 3. Run ownership transfer SQL

```bash
psql -h localhost -U twenty -d default -f transfer-ownership.sql
```

Verify all 8 objects show `applicationId = 58dd163b-...` (see MIGRATION_RUNBOOK.md verification queries).

### 4. Update Coolify deployment

In the Coolify dashboard:

1. Navigate to the Twenty service
2. Change the Docker image from `twentycrm/twenty:latest` to `ghcr.io/u2giants/twenty:latest`
3. Add/update environment variables:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   AZURE_TENANT_ID=...
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   OUTLOOK_MAILBOX=adweck@popcre.com
   CLICKUP_API_TOKEN=pk_...
   POP_CREATIONS_WORKSPACE_ID=...
   ```
4. Deploy

### 5. Run metadata sync

Once the container is running:

```bash
docker exec <container_id> node dist/main workspace:sync-metadata
```

**Expected output:** Should recognize all 8 custom objects and ~90 custom fields without dropping/recreating tables.

### 6. Register cron jobs

```bash
docker exec <container_id> node dist/main cron:pop-creations:outlook-ingest
docker exec <container_id> node dist/main cron:pop-creations:email-rerouter
docker exec <container_id> node dist/main cron:pop-creations:clickup-sync
docker exec <container_id> node dist/main cron:pop-creations:email-contact-sync
```

### 7. Verify

- [ ] Login to https://crm.designflow.app — workspace loads correctly
- [ ] Company list shows all companies with customerStatus field
- [ ] Department records show DepartmentDashboard widget
- [ ] Opportunity records show ProgramFolio widget
- [ ] `/pop/dashboard` page loads MondayMorningDashboard
- [ ] `/pop/domains` page loads DomainManager
- [ ] Inline filter row toggles on record tables
- [ ] Create a test EmailMessage — verify routing status is set
- [ ] Check container logs for cron job output: `docker logs <container_id> | grep outlook-ingest`

### 8. Monitor for 24 hours

Watch for:
- Cron job execution (Outlook ingest every 15 min, rerouter every 6h)
- Error rates in container logs
- User reports of missing data or broken views

### 9. Decommission old SDK app

Once stable:

1. Archive `u2giants/poc-twenty-app` repository
2. Remove the SDK app's `installApplication` registration if desired (optional — it's harmless)
3. Delete the old `Dockerfile.custom` overlay workflow

## Rollback procedure

If critical issues are found:

1. Stop the fork container
2. Restore database backup:
   ```bash
   pg_restore -h localhost -U twenty -d default --clean /var/backups/twenty-cutover-*.dump
   ```
3. Revert Coolify to `twentycrm/twenty:latest`
4. Redeploy
