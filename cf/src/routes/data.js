/**
 * /api/data — ported from routes/data.js to Hono + D1.
 *
 * The two-step upload (preview-headers -> upload-mapped) stores the raw file
 * bytes in KV (TEMP_UPLOADS) under a token with a 1-hour TTL, since Workers
 * have no local disk. Everything else maps directly to D1.
 */
import { Hono } from 'hono';
import { parseExcelBytes, getHeaderBytes, DEFAULT_MAPPINGS } from '../parse.js';
import { buildFullTemplate, buildDashboardTemplate } from '../templates.js';
import { audit } from '../audit.js';
import { requireEditor } from '../access.js';

const data = new Hono();

const TEMP_TTL = 3600; // seconds
const INSERT_CIRCUIT =
  `INSERT INTO circuit_data (upload_id, circuit, total_cases, new_cases, rollover_cases, closed_cases, state_attorneys_filled, state_attorneys_vacant, county_attorneys, conflict_new_cases, conflict_rollover_cases, total_contractors, capital_cases, felony_cases, misdemeanor_cases, juvenile_cases, appeals_cases, probation_cases, investigators, social_workers, paralegals, annual_budget, actual_spend)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function xlsxResponse(bytes, filename) {
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// Georgia fiscal year runs Jul 1–Jun 30; FY is labeled by the calendar year it
// ends in (e.g. Jul 2024–Jun 2025 = FY2025). Used as the default when an upload
// doesn't specify one.
function currentFiscalYear() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

// All upsertable metric columns on circuit_data.
const CIRCUIT_FIELDS = [
  'total_cases', 'new_cases', 'rollover_cases', 'closed_cases',
  'state_attorneys_filled', 'state_attorneys_vacant', 'county_attorneys',
  'conflict_new_cases', 'conflict_rollover_cases', 'total_contractors',
  'capital_cases', 'felony_cases', 'misdemeanor_cases', 'juvenile_cases', 'appeals_cases', 'probation_cases',
  'investigators', 'social_workers', 'paralegals', 'annual_budget', 'actual_spend',
];

// Find (or create) the single canonical dataset for a scope + fiscal year +
// period. Submissions merge into this rather than creating a new dataset each
// time, so different contributors' slices compose.
async function findOrCreateDataset(db, { userId, isShared, fiscalYear, period }) {
  const where = isShared ? 'is_shared = 1' : 'user_id = ? AND is_shared = 0';
  const baseParams = isShared ? [] : [userId];
  const row = await db.get(
    `SELECT id FROM upload_history WHERE ${where} AND fiscal_year = ? AND period = ? ORDER BY uploaded_at DESC LIMIT 1`,
    [...baseParams, fiscalYear, period]
  );
  if (row) return row.id;
  const res = await db.run(
    'INSERT INTO upload_history (user_id, filename, fiscal_year, period, is_shared) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [userId, 'merged', fiscalYear, period, isShared ? 1 : 0]
  );
  return res.lastID;
}

// Merge only `fields` for each row into the dataset's circuit rows. Existing
// values for fields not in `fields` are left untouched (the heart of compose-
// not-overwrite). Upserts on the (upload_id, circuit) unique index.
async function mergeRows(db, datasetId, fields, rows) {
  const cols = fields.filter((f) => CIRCUIT_FIELDS.includes(f));
  if (!rows.length || !cols.length) return 0;
  const colList = ['upload_id', 'circuit', ...cols].join(', ');
  const placeholders = ['?', '?', ...cols.map(() => '?')].join(', ');
  const updates = cols.map((f) => `${f} = excluded.${f}`).join(', ');
  const sql = `INSERT INTO circuit_data (${colList}) VALUES (${placeholders}) ON CONFLICT(upload_id, circuit) DO UPDATE SET ${updates}`;
  await db.batch(rows.map((r) => [sql, [datasetId, r.circuit, ...cols.map((f) => Number(r[f] ?? 0))]]));
  return rows.length;
}

async function logSubmission(c, db, { datasetId, templateId, fields, rowCount }) {
  const u = c.get('user') || {};
  await db.run(
    'INSERT INTO submissions (dataset_id, template_id, user_id, email, fields, row_count) VALUES (?, ?, ?, ?, ?, ?)',
    [datasetId, templateId || null, u.id || null, u.email || null, JSON.stringify(fields), rowCount]
  );
}

// Find the most recent upload id for a scope, optionally pinned to a fiscal
// year + period. Returns { id, fiscal_year, period } or null.
async function findUpload(db, { userId, scope, fy, period }) {
  const where = scope === 'shared' ? 'is_shared = 1' : 'user_id = ? AND is_shared = 0';
  const params = scope === 'shared' ? [] : [userId];
  let sql = `SELECT id, fiscal_year, period FROM upload_history WHERE ${where}`;
  if (fy != null) { sql += ' AND fiscal_year = ?'; params.push(fy); }
  if (period) { sql += ' AND period = ?'; params.push(period); }
  // Newest first: by fiscal_year, then most recent upload.
  sql += ' ORDER BY fiscal_year DESC, uploaded_at DESC LIMIT 1';
  return db.get(sql, params);
}

// GET /api/data?source=auto|personal|shared&fy=2025&period=annual
// Without fy/period, returns the latest dataset for the scope (default view).
data.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const source = c.req.query('source') || 'auto';
  const fy = c.req.query('fy') ? parseInt(c.req.query('fy'), 10) : null;
  const period = c.req.query('period') || null;

  let upload = null;
  let dataSource = 'sample';

  if (source === 'personal' || source === 'auto') {
    upload = await findUpload(db, { userId, scope: 'personal', fy, period });
    if (upload) dataSource = 'personal';
  }
  if (source === 'shared' || (source === 'auto' && !upload)) {
    const shared = await findUpload(db, { userId, scope: 'shared', fy, period });
    if (shared) { upload = shared; dataSource = 'shared'; }
  }
  if (!upload) return c.json({ ok: true, source: 'sample', circuits: [], fiscalYear: fy, period });

  const circuits = await db.all('SELECT * FROM circuit_data WHERE upload_id = ?', [upload.id]);
  let fieldLabels = null;
  const labelCfg = await db.get('SELECT config_json FROM dashboard_config WHERE user_id = ? AND config_key = ?', [userId, 'field_labels']);
  if (labelCfg) { try { fieldLabels = JSON.parse(labelCfg.config_json); } catch {} }
  return c.json({
    ok: true,
    source: dataSource,
    fiscalYear: upload.fiscal_year,
    period: upload.period,
    circuits,
    fieldLabels,
  });
});

// GET /api/data/periods?source=auto|personal|shared
// Lists the fiscal-year/period datasets available, newest first — drives the
// period selector and the "compare to" picker for year-over-year charts.
data.get('/periods', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const source = c.req.query('source') || 'auto';

  const scopes = source === 'shared' ? ['shared']
    : source === 'personal' ? ['personal']
    : ['personal', 'shared'];

  const seen = new Set();
  const periods = [];
  for (const scope of scopes) {
    const where = scope === 'shared' ? 'is_shared = 1' : 'user_id = ? AND is_shared = 0';
    const params = scope === 'shared' ? [] : [userId];
    const rows = await db.all(
      `SELECT fiscal_year, period, MAX(uploaded_at) AS uploaded_at,
              (SELECT COUNT(*) FROM circuit_data cd
                 JOIN upload_history u2 ON cd.upload_id = u2.id
                WHERE u2.fiscal_year IS uh.fiscal_year AND u2.period = uh.period AND ${where}) AS row_count
         FROM upload_history uh
        WHERE ${where} AND fiscal_year IS NOT NULL
        GROUP BY fiscal_year, period
        ORDER BY fiscal_year DESC, period`,
      [...params, ...params]
    );
    for (const r of rows) {
      const key = `${scope}:${r.fiscal_year}:${r.period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      periods.push({ scope, fiscalYear: r.fiscal_year, period: r.period, label: `FY${String(r.fiscal_year).slice(-2)}${r.period === 'annual' ? '' : ' ' + r.period}` });
    }
  }
  return c.json({ ok: true, periods });
});

// POST /api/data/preview-headers — multipart; stash bytes in KV, return headers
data.post('/preview-headers', requireEditor(), async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return c.json({ ok: false, error: 'No file uploaded' }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  let info;
  try { info = getHeaderBytes(bytes); }
  catch (e) { return c.json({ ok: false, error: 'Failed to read Excel: ' + e.message }, 500); }

  const token = crypto.randomUUID();
  await c.env.TEMP_UPLOADS.put(`u:${token}`, bytes, {
    expirationTtl: TEMP_TTL,
    metadata: { filename: file.name || 'upload.xlsx' },
  });
  return c.json({ ok: true, headers: info.headers, sheetName: info.sheetName, sheetNames: info.sheetNames, tempFile: token });
});

// POST /api/data/upload-mapped — read KV bytes, parse, MERGE into the period
// dataset. Only the fields present in the file (or the template's fields) are
// written, so a partial upload composes with others instead of overwriting.
data.post('/upload-mapped', requireEditor(), async (c) => {
  const { tempFile, mapping, shared, fiscalYear, period, templateId } = await c.req.json().catch(() => ({}));
  if (!tempFile) return c.json({ ok: false, error: 'No temp file specified' }, 400);

  const fy = fiscalYear != null && fiscalYear !== '' ? parseInt(fiscalYear, 10) : currentFiscalYear();
  const per = period || 'annual';

  const isShared = shared === true || shared === 'true';
  if (isShared && c.get('user').role !== 'admin') {
    return c.json({ ok: false, error: 'Only admins can upload shared data' }, 403);
  }

  const key = `u:${tempFile}`;
  const stored = await c.env.TEMP_UPLOADS.getWithMetadata(key, 'arrayBuffer');
  if (!stored || !stored.value) return c.json({ ok: false, error: 'Temp file not found. Please re-upload.' }, 404);

  const filename = (stored.metadata && stored.metadata.filename) || 'upload.xlsx';
  let rows, presentFields;
  try { ({ rows, presentFields } = parseExcelBytes(new Uint8Array(stored.value), mapping || {})); }
  catch (e) { return c.json({ ok: false, error: 'Failed to process file: ' + e.message }, 500); }
  if (!rows.length) return c.json({ ok: false, error: 'No circuit data found in file' }, 400);

  const db = c.get('db');
  // Fields to write: the template's fields if a template was used, else the
  // fields whose columns were actually in the file.
  let fields = presentFields;
  if (templateId) {
    const t = await db.get('SELECT fields FROM templates WHERE id = ?', [templateId]);
    if (t) { try { fields = JSON.parse(t.fields); } catch {} }
  }

  const datasetId = await findOrCreateDataset(db, { userId: c.get('user').id, isShared, fiscalYear: fy, period: per });
  const merged = await mergeRows(db, datasetId, fields, rows);
  await logSubmission(c, db, { datasetId, templateId, fields, rowCount: merged });
  await c.env.TEMP_UPLOADS.delete(key);
  await audit(c, 'data.upload', { datasetId, filename, rowCount: merged, fields, shared: isShared, fiscalYear: fy, period: per });
  return c.json({ ok: true, uploadId: datasetId, rowCount: merged, fields, source: isShared ? 'shared' : 'personal', fiscalYear: fy, period: per });
});

// POST /api/data/submit — in-app form submission (no Excel). Body:
// { templateId?, fiscalYear, period, shared, fields?, rows:[{circuit, <field>:val}] }
data.post('/submit', requireEditor(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows.filter((r) => r && r.circuit) : [];
  if (!rows.length) return c.json({ ok: false, error: 'No rows to submit' }, 400);

  const fy = body.fiscalYear != null && body.fiscalYear !== '' ? parseInt(body.fiscalYear, 10) : currentFiscalYear();
  const per = body.period || 'annual';
  const isShared = body.shared === true || body.shared === 'true';
  if (isShared && c.get('user').role !== 'admin') {
    return c.json({ ok: false, error: 'Only admins can submit shared data' }, 403);
  }

  const db = c.get('db');
  let fields = Array.isArray(body.fields) ? body.fields : null;
  if (body.templateId) {
    const t = await db.get('SELECT fields FROM templates WHERE id = ?', [body.templateId]);
    if (t) { try { fields = JSON.parse(t.fields); } catch {} }
  }
  if (!fields) {
    // Infer from the row payload (any metric keys present).
    const keys = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (k !== 'circuit') keys.add(k); }));
    fields = [...keys];
  }

  const datasetId = await findOrCreateDataset(db, { userId: c.get('user').id, isShared, fiscalYear: fy, period: per });
  const merged = await mergeRows(db, datasetId, fields, rows);
  await logSubmission(c, db, { datasetId, templateId: body.templateId, fields, rowCount: merged });
  await audit(c, 'data.submit', { datasetId, rowCount: merged, fields, shared: isShared, fiscalYear: fy, period: per });
  return c.json({ ok: true, datasetId, rowCount: merged, fields, source: isShared ? 'shared' : 'personal', fiscalYear: fy, period: per });
});

// GET /api/data/uploads — history
data.get('/uploads', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  let uploads;
  if (user.role === 'admin') {
    uploads = await db.all(`SELECT uh.*, u.display_name AS uploaded_by, (SELECT COUNT(*) FROM circuit_data WHERE upload_id = uh.id) AS row_count FROM upload_history uh JOIN users u ON uh.user_id = u.id ORDER BY uh.uploaded_at DESC LIMIT 50`);
  } else {
    uploads = await db.all(`SELECT uh.*, u.display_name AS uploaded_by, (SELECT COUNT(*) FROM circuit_data WHERE upload_id = uh.id) AS row_count FROM upload_history uh JOIN users u ON uh.user_id = u.id WHERE uh.user_id = ? OR uh.is_shared = 1 ORDER BY uh.uploaded_at DESC LIMIT 50`, [user.id]);
  }
  return c.json({ ok: true, uploads });
});

// GET /api/data/column-mappings
data.get('/column-mappings', async (c) => {
  const db = c.get('db');
  const mappings = await db.all('SELECT * FROM column_mappings WHERE user_id = ? ORDER BY created_at DESC', [c.get('user').id]);
  return c.json({ ok: true, mappings, expectedFields: Object.keys(DEFAULT_MAPPINGS) });
});

// POST /api/data/column-mappings
data.post('/column-mappings', requireEditor(), async (c) => {
  const { name, mapping } = await c.req.json().catch(() => ({}));
  if (!mapping) return c.json({ ok: false, error: 'Mapping required' }, 400);
  const db = c.get('db');
  const res = await db.run('INSERT INTO column_mappings (user_id, mapping_name, mapping_json) VALUES (?, ?, ?) RETURNING id', [c.get('user').id, name || 'Untitled', JSON.stringify(mapping)]);
  return c.json({ ok: true, id: res.lastID });
});

// GET /api/data/template
data.get('/template', (c) => xlsxResponse(buildFullTemplate(), 'GPDC_Dashboard_Template.xlsx'));

// GET /api/data/template-for-dashboard?fields=a,b&name=Foo
data.get('/template-for-dashboard', (c) => {
  const fieldKeys = (c.req.query('fields') || '').split(',').filter(Boolean);
  if (!fieldKeys.length) return xlsxResponse(buildFullTemplate(), 'GPDC_Dashboard_Template.xlsx');
  const bytes = buildDashboardTemplate(fieldKeys);
  if (!bytes) return xlsxResponse(buildFullTemplate(), 'GPDC_Dashboard_Template.xlsx');
  const dashName = (c.req.query('name') || 'Dashboard').replace(/[^a-zA-Z0-9_ -]/g, '');
  return xlsxResponse(bytes, `GPDC_${dashName}_Template.xlsx`);
});

// GET /api/data/config/:key
data.get('/config/:key', async (c) => {
  const db = c.get('db');
  const row = await db.get('SELECT config_json FROM dashboard_config WHERE user_id = ? AND config_key = ?', [c.get('user').id, c.req.param('key')]);
  if (!row) return c.json({ ok: true, value: null });
  try { return c.json({ ok: true, value: JSON.parse(row.config_json) }); }
  catch { return c.json({ ok: true, value: null }); }
});

// POST /api/data/config
data.post('/config', requireEditor(), async (c) => {
  const { key, value } = await c.req.json().catch(() => ({}));
  if (!key) return c.json({ ok: false, error: 'Config key required' }, 400);
  const db = c.get('db');
  await db.run(
    'INSERT INTO dashboard_config (user_id, config_key, config_json) VALUES (?, ?, ?) ON CONFLICT(user_id, config_key) DO UPDATE SET config_json = excluded.config_json, updated_at = CURRENT_TIMESTAMP',
    [c.get('user').id, key, JSON.stringify(value)]
  );
  return c.json({ ok: true });
});

// DELETE /api/data/clear
data.delete('/clear', requireEditor(), async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const personal = await db.all('SELECT id FROM upload_history WHERE user_id = ? AND is_shared = 0', [user.id]);
  for (const u of personal) await db.run('DELETE FROM circuit_data WHERE upload_id = ?', [u.id]);
  await db.run('DELETE FROM upload_history WHERE user_id = ? AND is_shared = 0', [user.id]);

  if (user.role === 'admin') {
    const shared = await db.all('SELECT id FROM upload_history WHERE is_shared = 1');
    for (const u of shared) await db.run('DELETE FROM circuit_data WHERE upload_id = ?', [u.id]);
    await db.run('DELETE FROM upload_history WHERE is_shared = 1');
  }
  await db.run('DELETE FROM dashboard_config WHERE user_id = ? AND config_key = ?', [user.id, 'field_labels']);
  await audit(c, 'data.clear', { clearedShared: user.role === 'admin' });
  return c.json({ ok: true });
});

export default data;
