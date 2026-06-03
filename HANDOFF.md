# HANDOFF

In-progress work that requires explicit user authorization or is blocked on an external step.
Delete this file when all items are resolved.

---

## Connected account re-auth

**Status:** open — personal email/calendar sync accounts must be created fresh.

**Context:** This is separate from workspace login SSO (which is now Microsoft Entra — fully working).
This is about Twenty's "Connected accounts" feature for syncing an individual user's personal Outlook
inbox and calendar into the CRM. The `connectedAccount` table is empty after the v2.7 migration
moved it to the core schema.

**Action required (Albert, Adam):** Go to **Settings → Connected accounts → connect Microsoft
account**. Do this for any personal `@popcre.com` Outlook account you want to use for email
ingestion or calendar sync through the Twenty UI.

The service-account ingestion (`AZURE_CLIENT_SECRET`-based `OutlookIngest` cron) is unaffected —
it uses env vars, not connected accounts, and is already running.
