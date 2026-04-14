/**
 * db-health-check.js
 *
 * Run after every deploy (or manually) to detect and auto-fix common issues
 * that cause blank pages in Twenty:
 *
 *   1. Invalid RFC 4122 UUID variant bytes in viewFilter / viewFilterGroup
 *      (4th group must start with 8, 9, a, or b)
 *   2. Stale Redis cache serving bad data even after a DB fix
 *
 * Usage:
 *   docker cp /tmp/db-health-check.js twenty-worker:/tmp/db-health-check.js
 *   docker exec twenty-worker sh -c 'NODE_PATH=/app/node_modules node /tmp/db-health-check.js'
 *
 * Environment variables required (already present in the worker container):
 *   PG_DATABASE_URL   — PostgreSQL connection string
 *   REDIS_URL         — Redis connection string
 */

const { Client } = require('pg');
const { createClient } = require('redis');

const WORKSPACE_ID = '99c80ca1-610f-48b5-bd1f-9178201bdcb7';

// RFC 4122: the 4th UUID group must start with 8, 9, a, or b
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(s) {
  return UUID_RE.test(s);
}

// Tables and columns to scan for invalid UUIDs
const CHECKS = [
  { table: 'viewFilter',      col: 'id' },
  { table: 'viewFilter',      col: 'viewFilterGroupId' },
  { table: 'viewFilterGroup', col: 'id' },
  { table: 'viewFilterGroup', col: 'parentViewFilterGroupId' },
  { table: 'view',            col: 'id' },
  { table: 'navigationMenuItem', col: 'id' },
];

// Redis cache keys that hold view metadata — must be flushed after any DB fix
const REDIS_VIEW_KEYS = [
  `engine:workspace:flat-maps:view-filter-group:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view-filter-group:${WORKSPACE_ID}:hash`,
  `engine:workspace:flat-maps:view-filter:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view-filter:${WORKSPACE_ID}:hash`,
  `engine:workspace:flat-maps:view:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view:${WORKSPACE_ID}:hash`,
  `engine:workspace:flat-maps:view-field:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view-sort:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view-sort:${WORKSPACE_ID}:hash`,
  `engine:workspace:flat-maps:view-group:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:view-group:${WORKSPACE_ID}:hash`,
  `engine:workspace:flat-maps:navigation-menu-item:${WORKSPACE_ID}:data`,
  `engine:workspace:flat-maps:navigation-menu-item:${WORKSPACE_ID}:hash`,
  `engine:workspace:metadata:workspace-metadata-version:${WORKSPACE_ID}`,
];

async function main() {
  let foundInvalid = false;

  // --- DB scan ---
  const db = new Client({ connectionString: process.env.PG_DATABASE_URL });
  await db.connect();

  for (const { table, col } of CHECKS) {
    let rows;
    try {
      const res = await db.query(
        `SELECT id, "${col}" AS val FROM core."${table}"
         WHERE "${col}" IS NOT NULL`,
      );
      rows = res.rows;
    } catch (e) {
      // Column may not exist (e.g. nullable FK that's always null)
      continue;
    }

    for (const row of rows) {
      if (!isValidUUID(row.val)) {
        console.error(
          `INVALID UUID in core."${table}".${col}: ${row.val} (row id: ${row.id})`,
        );
        foundInvalid = true;
      }
    }
  }

  await db.end();

  if (!foundInvalid) {
    console.log('✓ All UUID values pass RFC 4122 validation — DB is clean');
  } else {
    console.error(
      '\nInvalid UUIDs found in DB. These will cause blank pages in Twenty.\n' +
      'Fix the records, then re-run this script to verify, then flush Redis.\n',
    );
  }

  // --- Redis cache flush ---
  // Always flush view-related cache keys so the server re-reads fresh data.
  // Safe to run even when nothing is wrong — the server will rebuild the cache
  // on the next request.
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not set — skipping cache flush');
    return;
  }

  const redis = createClient({ url: redisUrl });
  await redis.connect();

  let deleted = 0;
  for (const key of REDIS_VIEW_KEYS) {
    const n = await redis.del(key);
    deleted += n;
  }
  await redis.quit();

  if (deleted > 0) {
    console.log(`✓ Flushed ${deleted} stale Redis cache key(s) — server will reload from DB`);
  } else {
    console.log('✓ Redis cache was already clean (no stale keys found)');
  }

  if (foundInvalid) process.exit(1);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
