/**
 * validate-uuids.js
 *
 * Include this at the top of any one-off setup/migration script that inserts
 * rows with hand-crafted UUIDs. Call validateUUIDs(YOUR_UUID_CONSTANTS)
 * before any DB writes. The script will exit(1) immediately if any UUID
 * fails RFC 4122 validation, preventing bad data from ever reaching the DB.
 *
 * Usage:
 *   const { validateUUIDs } = require('./validate-uuids');
 *
 *   const MY_IDS = {
 *     foo: '22222222-e1a1-4b00-8001-000000000001',  // valid
 *     bar: '22222222-e1a1-4b00-d001-000000000001',  // INVALID — will abort
 *   };
 *   validateUUIDs(MY_IDS); // call before any db.query()
 */

// RFC 4122 variant byte: 4th group must start with 8, 9, a, or b
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a flat object (or nested object) of UUID strings.
 * Logs all failures before exiting so you see every bad ID at once.
 *
 * @param {Record<string, string | Record<string, string>>} uuidMap
 * @param {string} [label] — optional label for the error message
 */
function validateUUIDs(uuidMap, label = 'UUID constants') {
  const failures = [];

  function check(key, value) {
    if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value)) check(`${key}.${k}`, v);
    } else if (typeof value === 'string') {
      if (!UUID_RE.test(value)) {
        failures.push(`  ${key}: '${value}'  ← 4th group must start with 8/9/a/b`);
      }
    }
  }

  for (const [key, value] of Object.entries(uuidMap)) {
    check(key, value);
  }

  if (failures.length > 0) {
    console.error(
      `\n[validate-uuids] INVALID RFC 4122 UUIDs found in ${label}:\n` +
      failures.join('\n') +
      '\n\nThese will cause blank pages in Twenty. Fix before inserting.\n',
    );
    process.exit(1);
  }

  console.log(`[validate-uuids] ✓ All ${label} pass RFC 4122 validation`);
}

module.exports = { validateUUIDs };
