/**
 * setup-people-views.js
 *
 * Converts the People nav item into a FOLDER and adds two sub-views:
 *   - Company   : person has company, no department (routing queue)
 *   - Department: person has department
 *
 * Idempotent: safe to re-run (uses ON CONFLICT DO NOTHING or DELETE+INSERT).
 */

const { Client } = require('pg');

const WS_ID  = '99c80ca1-610f-48b5-bd1f-9178201bdcb7';
const APP_ID  = '58dd163b-b4d9-4b30-aca8-23b41518741d';  // for views/nav
const APP_ID2 = 'f99617d1-aa3d-4009-8211-53a7b747f5f2'; // for filters

// Existing People nav item (currently VIEW — we'll convert it to FOLDER)
const PEOPLE_FOLDER_NAV_ID = 'b55f5094-60fe-45a5-b176-422002efff73';

// Person objectMetadataId
const PERSON_OBJ_ID = '59cfafd8-befe-42f3-8bf9-2c450c12d369';

// Person field metadata IDs
const F = {
  name:        'f690a1c6-04c7-4b12-b25f-169d27b99c0a',
  emails:      'f36856fd-d35b-4ba5-8281-bf53cc6f9bd0',
  company:     'fbabf8a8-d507-463c-8e76-6ae96e352764',  // RELATION
  department:  'a8846fa4-175f-4f7c-b727-43090338a0f4',  // RELATION
  jobTitle:    '3f4721b7-5492-45be-8bca-f123ad210b8a',
  phones:      '7cb621e6-2660-4e48-bc62-8742e30fc222',
  createdAt:   'afc41d65-ab09-470e-9d05-74eda7568b39',
  createdBy:   '5c298daf-b15a-40e8-9825-040cebfaa157',
};

// ── View IDs (4th group starts with b — valid RFC 4122) ─────────────────────
const V = {
  company: '33333333-e1a1-4b00-b001-000000000001',
  dept:    '33333333-e1a1-4b00-b001-000000000002',
};

// ── Nav child IDs ────────────────────────────────────────────────────────────
const NAV = {
  company: '33333333-e1a1-4b00-b002-000000000001',
  dept:    '33333333-e1a1-4b00-b002-000000000002',
};

// ── Filter group IDs (4th group 8 — valid) ───────────────────────────────────
const FG = {
  company: '33333333-e1a1-4b00-8001-000000000001', // AND group for Company view
};

// ── Filter IDs (4th group 9 — valid) ─────────────────────────────────────────
const VF = {
  company_company_notempty: '33333333-e1a1-4b00-9001-000000000001',
  company_dept_empty:       '33333333-e1a1-4b00-9001-000000000002',
  dept_dept_notempty:       '33333333-e1a1-4b00-9001-000000000003',
};

// Validate all UUIDs before touching the DB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(map, label) {
  const bad = Object.entries(map).filter(([, v]) => !UUID_RE.test(v));
  if (bad.length) {
    console.error(`INVALID UUIDs in ${label}:`, bad);
    process.exit(1);
  }
}
validate(V, 'V'); validate(NAV, 'NAV'); validate(FG, 'FG'); validate(VF, 'VF');
console.log('✓ All UUID constants pass RFC 4122 validation');

async function run() {
  const db = new Client({ connectionString: process.env.PG_DATABASE_URL });
  await db.connect();

  // ── 1. Convert People nav item to FOLDER ──────────────────────────────────
  await db.query(
    `UPDATE core."navigationMenuItem"
     SET type = 'FOLDER', name = 'People', "viewId" = NULL, "updatedAt" = NOW()
     WHERE id = $1`,
    [PEOPLE_FOLDER_NAV_ID],
  );
  console.log('✓ Converted People nav item to FOLDER');

  // ── 2. Create the two views ───────────────────────────────────────────────
  async function insertView(id, name, icon) {
    await db.query(
      `INSERT INTO core."view"
         (id, "universalIdentifier", name, "objectMetadataId", type, key, icon,
          position, "isCompact", "isCustom", "openRecordIn", "workspaceId",
          "applicationId", visibility, "createdAt", "updatedAt")
       VALUES ($1, gen_random_uuid(), $2, $3, 'TABLE', NULL, $4,
               0, false, true, 'SIDE_PANEL', $5,
               $6, 'WORKSPACE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, name, PERSON_OBJ_ID, icon, WS_ID, APP_ID],
    );
  }

  await insertView(V.company, 'Company',    'IconBuilding');
  await insertView(V.dept,    'Department', 'IconSitemap');
  console.log('✓ Created 2 views');

  // ── 3. Create nav child items ─────────────────────────────────────────────
  async function insertNav(id, name, viewId, position) {
    await db.query(
      `INSERT INTO core."navigationMenuItem"
         (id, "universalIdentifier", name, type, "viewId", "folderId",
          position, "workspaceId", "applicationId", "createdAt", "updatedAt")
       VALUES ($1, gen_random_uuid(), $2, 'VIEW', $3, $4,
               $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, name, viewId, PEOPLE_FOLDER_NAV_ID, position, WS_ID, APP_ID],
    );
  }

  await insertNav(NAV.company, 'Company',    V.company, 0);
  await insertNav(NAV.dept,    'Department', V.dept,    1);
  console.log('✓ Created 2 nav child items');

  // ── 4. Create viewFields for both views ───────────────────────────────────
  // Fields shown: name, emails, company, department, jobTitle, phones, createdAt, createdBy
  const fields = [
    { fid: F.name,       pos: 0, visible: true  },
    { fid: F.emails,     pos: 1, visible: true  },
    { fid: F.company,    pos: 2, visible: true  },
    { fid: F.department, pos: 3, visible: true  },
    { fid: F.jobTitle,   pos: 4, visible: true  },
    { fid: F.phones,     pos: 5, visible: true  },
    { fid: F.createdAt,  pos: 6, visible: false },
    { fid: F.createdBy,  pos: 7, visible: false },
  ];

  for (const viewId of [V.company, V.dept]) {
    // Clear existing viewFields for this view (idempotency)
    await db.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);
    for (const f of fields) {
      await db.query(
        `INSERT INTO core."viewField"
           (id, "universalIdentifier", "fieldMetadataId", "viewId", position,
            "isVisible", "workspaceId", "applicationId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [f.fid, viewId, f.pos, f.visible, WS_ID, APP_ID],
      );
    }
  }
  console.log(`✓ Created ${fields.length * 2} viewFields (${fields.length} per view)`);

  // ── 5. viewFilters + viewFilterGroups ─────────────────────────────────────
  // Clear old filters for these views
  await db.query(
    `DELETE FROM core."viewFilter" WHERE "viewId" = ANY($1::uuid[])`,
    [[V.company, V.dept]],
  );
  await db.query(
    `DELETE FROM core."viewFilterGroup" WHERE "viewId" = ANY($1::uuid[])`,
    [[V.company, V.dept]],
  );

  // Company view: AND group → company IS_NOT_EMPTY + department IS_EMPTY
  await db.query(
    `INSERT INTO core."viewFilterGroup"
       (id, "universalIdentifier", "parentViewFilterGroupId", "logicalOperator",
        "positionInViewFilterGroup", "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt")
     VALUES ($1, gen_random_uuid(), NULL, 'AND'::core."viewFilterGroup_logicaloperator_enum",
             NULL, $2, $3, $4, NOW(), NOW())`,
    [FG.company, V.company, WS_ID, APP_ID2],
  );

  async function insertFilter(id, viewId, fieldId, operand, groupId = null) {
    await db.query(
      `INSERT INTO core."viewFilter"
         (id, "universalIdentifier", "fieldMetadataId", operand, value,
          "viewFilterGroupId", "positionInViewFilterGroup", "subFieldName",
          "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt")
       VALUES ($1, gen_random_uuid(), $2, $3::core."viewFilter_operand_enum", '[]'::jsonb,
               $4, NULL, NULL, $5, $6, $7, NOW(), NOW())`,
      [id, fieldId, operand, groupId, viewId, WS_ID, APP_ID2],
    );
  }

  await insertFilter(VF.company_company_notempty, V.company, F.company,    'IS_NOT_EMPTY', FG.company);
  await insertFilter(VF.company_dept_empty,       V.company, F.department, 'IS_EMPTY',     FG.company);
  await insertFilter(VF.dept_dept_notempty,       V.dept,    F.department, 'IS_NOT_EMPTY');

  console.log('✓ Created 1 viewFilterGroup + 3 viewFilters');

  // ── 6. Verify ─────────────────────────────────────────────────────────────
  const { rows: navRows } = await db.query(
    `SELECT id, name, type FROM core."navigationMenuItem" WHERE id = $1 OR "folderId" = $1`,
    [PEOPLE_FOLDER_NAV_ID],
  );
  console.log('\nNav structure:');
  navRows.forEach(r => console.log(` ${r.type.padEnd(8)} ${r.name ?? '(unnamed)'} — ${r.id}`));

  const { rows: vfRows } = await db.query(
    `SELECT id FROM core."viewFilter" WHERE "viewId" = ANY($1::uuid[])`,
    [[V.company, V.dept]],
  );
  console.log(`\nviewFilters: ${vfRows.length} rows`);
  vfRows.forEach(r => console.log(' ', r.id));

  await db.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
