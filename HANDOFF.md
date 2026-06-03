# HANDOFF

In-progress work that requires explicit user authorization or is blocked on an external step.
Delete this file when all items are resolved.

---

## 4. Connected account re-auth

**Status:** open — accounts must be created fresh (table is empty after v2.7 migration moved connectedAccount to core schema)

**Action required (Albert):** Go to Settings → Connected accounts → connect Microsoft account(s).
This applies to any personal Outlook account used for email ingestion or calendar sync.
The service-account ingestion (`AZURE_CLIENT_SECRET`-based) is unaffected — it uses env vars, not connected accounts.
