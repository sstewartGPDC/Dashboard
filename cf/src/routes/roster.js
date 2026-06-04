/**
 * /api/roster — employee directory collection (a "roster" template kind).
 *
 * Unlike the numeric metric model (one row per circuit, merged field-by-field),
 * a roster is MANY people per circuit, refreshed on a cadence (typically
 * monthly). To keep it simple and decoupled, circuit_employees carries its own
 * (fiscal_year, period, is_shared) columns — no upload_history involvement — and
 * a submission REPLACES that circuit's people for the period (so monthly
 * re-submits and corrections are idempotent).
 */
import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { requireEditor } from '../access.js';
import { audit } from '../audit.js';
import { CIRCUITS } from '../templates.js';

const roster = new Hono();

// Roster columns: field key -> spreadsheet label + aliases for import.
export const ROSTER_FIELDS = [
  { key: 'first_name', label: 'First Name', aliases: ['First Name', 'First', 'first_name', 'FirstName'] },
  { key: 'last_name', label: 'Last Name', aliases: ['Last Name', 'Last', 'last_name', 'LastName', 'Surname'] },
  { key: 'title', label: 'Title', aliases: ['Title', 'Position', 'Job Title', 'title'] },
  { key: 'email', label: 'Email', aliases: ['Email', 'Email Address', 'email', 'E-mail'] },
  { key: 'work_phone', label: 'Work Phone', aliases: ['Work Phone', 'Phone', 'Phone Number', 'work_phone', 'Telephone'] },
  { key: 'status', label: 'Status', aliases: ['Status', 'Employment Status', 'status'] },
];
const ROSTER_KEYS = ROSTER_FIELDS.map((f) => f.key);
const CIRCUIT_ALIASES = ['Circuit', 'circuit', 'Judicial Circuit', 'Office'];

function fy(c) {
  const v = c.req.query('fy');
  return v != null && v !== '' ? parseInt(v, 10) : null;
}

function cleanEmployee(r) {
  const e = {};
  for (const k of ROSTER_KEYS) e[k] = r[k] != null ? String(r[k]).trim() : '';
  return e;
}

// Replace a circuit's roster for a period: delete then insert the given people.
async function replaceCircuit(db, { fiscalYear, period, isShared, circuit, people, by }) {
  await db.run(
    'DELETE FROM circuit_employees WHERE is_shared = ? AND fiscal_year IS ? AND period = ? AND circuit = ?',
    [isShared ? 1 : 0, fiscalYear, period, circuit]
  );
  const valid = people
    .map(cleanEmployee)
    .filter((e) => e.first_name || e.last_name || e.email);
  if (!valid.length) return 0;
  const sql =
    'INSERT INTO circuit_employees (fiscal_year, period, is_shared, circuit, first_name, last_name, title, email, work_phone, status, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  await db.batch(
    valid.map((e) => [
      sql,
      [fiscalYear, period, isShared ? 1 : 0, circuit, e.first_name, e.last_name, e.title, e.email, e.work_phone, e.status || 'Active', by || null],
    ])
  );
  return valid.length;
}

// GET /api/roster?fy=&period=&circuit= — list employees
roster.get('/', async (c) => {
  const db = c.get('db');
  const period = c.req.query('period') || null;
  const circuit = c.req.query('circuit') || null;
  let sql = 'SELECT * FROM circuit_employees WHERE is_shared = 1';
  const params = [];
  const y = fy(c);
  if (y != null) { sql += ' AND fiscal_year IS ?'; params.push(y); }
  if (period) { sql += ' AND period = ?'; params.push(period); }
  if (circuit) { sql += ' AND circuit = ?'; params.push(circuit); }
  sql += ' ORDER BY circuit, last_name, first_name';
  const employees = await db.all(sql, params);
  return c.json({ ok: true, employees });
});

// GET /api/roster/periods — distinct fiscal_year/period that have roster rows
roster.get('/periods', async (c) => {
  const db = c.get('db');
  const rows = await db.all(
    `SELECT fiscal_year, period, COUNT(*) AS employee_count, COUNT(DISTINCT circuit) AS circuit_count
       FROM circuit_employees WHERE is_shared = 1
       GROUP BY fiscal_year, period ORDER BY fiscal_year DESC, period`
  );
  return c.json({
    ok: true,
    periods: rows.map((r) => ({
      fiscalYear: r.fiscal_year, period: r.period,
      employeeCount: r.employee_count, circuitCount: r.circuit_count,
      label: `FY${String(r.fiscal_year).slice(-2)}${r.period && r.period !== 'annual' ? ' ' + r.period : ''}`,
    })),
  });
});

// GET /api/roster/status?fy=&period= — which circuits have submitted a roster
roster.get('/status', async (c) => {
  const db = c.get('db');
  const period = c.req.query('period') || 'annual';
  const y = fy(c);
  const rows = await db.all(
    `SELECT circuit, COUNT(*) AS n, MAX(submitted_by) AS by, MAX(created_at) AS at
       FROM circuit_employees WHERE is_shared = 1 AND fiscal_year IS ? AND period = ?
       GROUP BY circuit`,
    [y, period]
  );
  const byCirc = {};
  rows.forEach((r) => { byCirc[r.circuit] = { count: r.n, by: r.by, at: r.at }; });
  const expected = CIRCUITS;
  const submitted = expected.filter((cir) => byCirc[cir]).map((cir) => ({ circuit: cir, ...byCirc[cir] }));
  const outstanding = expected.filter((cir) => !byCirc[cir]);
  return c.json({
    ok: true, fiscalYear: y, period,
    expectedCount: expected.length, submittedCount: submitted.length,
    submitted, outstanding,
    recent: submitted.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10)
      .map((s) => ({ email: s.by, count: s.count, at: s.at, circuit: s.circuit })),
  });
});

// GET /api/roster/blank.xlsx — a blank roster template (all columns)
roster.get('/blank.xlsx', (c) => {
  const cols = ['Circuit', ...ROSTER_FIELDS.map((f) => f.label)];
  const rows = [
    cols,
    ['Atlanta', 'Jane', 'Doe', 'Assistant Public Defender', 'jdoe@example.org', '404-555-0101', 'Active'],
    ['Atlanta', 'John', 'Smith', 'Investigator', 'jsmith@example.org', '404-555-0102', 'Active'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="GPDC_Employee_Roster_Template.xlsx"',
    },
  });
});

// POST /api/roster/submit — JSON rows from the in-app roster grid.
// Body: { fiscalYear, period, circuit, people: [{first_name,...}] }
// Replaces the named circuit's roster for the period.
roster.post('/submit', requireEditor(), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const circuit = (b.circuit || '').trim();
  if (!circuit) return c.json({ ok: false, error: 'A circuit is required' }, 400);
  const people = Array.isArray(b.people) ? b.people : [];
  const fiscalYear = b.fiscalYear != null && b.fiscalYear !== '' ? parseInt(b.fiscalYear, 10) : null;
  const period = b.period || 'annual';
  const db = c.get('db');
  const n = await replaceCircuit(db, {
    fiscalYear, period, isShared: true, circuit, people, by: (c.get('user') || {}).email,
  });
  await audit(c, 'roster.submit', { circuit, fiscalYear, period, count: n });
  return c.json({ ok: true, circuit, fiscalYear, period, count: n });
});

// POST /api/roster/upload-mapped — parse a previously-previewed Excel file
// (tempFile token from /api/data/preview-headers) and replace rosters per
// circuit found in the sheet. Body: { tempFile, mapping?, fiscalYear, period }
roster.post('/upload-mapped', requireEditor(), async (c) => {
  const { tempFile, mapping, fiscalYear, period } = await c.req.json().catch(() => ({}));
  if (!tempFile) return c.json({ ok: false, error: 'Missing tempFile' }, 400);
  const stored = await c.env.TEMP_UPLOADS.getWithMetadata(`u:${tempFile}`, 'arrayBuffer');
  if (!stored || !stored.value) return c.json({ ok: false, error: 'Temp file not found. Please re-upload.' }, 404);

  let jsonRows;
  try {
    const wb = XLSX.read(new Uint8Array(stored.value), { type: 'array' });
    const sheetName = wb.SheetNames.find((n) => /roster|staff|employ/i.test(n)) || wb.SheetNames[0];
    jsonRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  } catch (e) {
    return c.json({ ok: false, error: 'Failed to read file: ' + e.message }, 500);
  }
  if (!jsonRows.length) return c.json({ ok: false, error: 'No rows found in file' }, 400);

  const headers = Object.keys(jsonRows[0]);
  const pick = (aliases, custom) => {
    if (custom && headers.includes(custom)) return custom;
    return aliases.find((a) => headers.includes(a)) || null;
  };
  const circuitCol = pick(CIRCUIT_ALIASES, mapping && mapping.circuit);
  if (!circuitCol) return c.json({ ok: false, error: 'No "Circuit" column found in the file.' }, 400);
  const colFor = {};
  ROSTER_FIELDS.forEach((f) => { colFor[f.key] = pick(f.aliases, mapping && mapping[f.key]); });

  // Group people by circuit.
  const byCircuit = {};
  for (const row of jsonRows) {
    const circ = String(row[circuitCol] || '').trim();
    if (!circ) continue;
    const person = {};
    ROSTER_KEYS.forEach((k) => { person[k] = colFor[k] ? row[colFor[k]] : ''; });
    (byCircuit[circ] = byCircuit[circ] || []).push(person);
  }

  const fyNum = fiscalYear != null && fiscalYear !== '' ? parseInt(fiscalYear, 10) : null;
  const per = period || 'annual';
  const db = c.get('db');
  const by = (c.get('user') || {}).email;
  let total = 0;
  const circuits = Object.keys(byCircuit);
  for (const circ of circuits) {
    total += await replaceCircuit(db, { fiscalYear: fyNum, period: per, isShared: true, circuit: circ, people: byCircuit[circ], by });
  }
  await c.env.TEMP_UPLOADS.delete(`u:${tempFile}`);
  await audit(c, 'roster.upload', { fiscalYear: fyNum, period: per, circuits, count: total });
  return c.json({ ok: true, fiscalYear: fyNum, period: per, circuits, count: total });
});

export default roster;
