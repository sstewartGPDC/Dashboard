/**
 * /api/templates — data-collection template definitions (a named subset of
 * metric fields + scope/cadence/audience). Admins define them; everyone can
 * list them and download the per-template Excel.
 */
import { Hono } from 'hono';
import { requireAdmin } from '../access.js';
import { buildFieldsTemplate, CIRCUITS } from '../templates.js';

const templates = new Hono();

function parseTemplate(row) {
  if (!row) return row;
  let fields = [];
  try { fields = JSON.parse(row.fields || '[]'); } catch {}
  return { ...row, fields };
}

// GET /api/templates — list
templates.get('/', async (c) => {
  const db = c.get('db');
  const rows = await db.all('SELECT * FROM templates ORDER BY created_at DESC');
  return c.json({ ok: true, templates: rows.map(parseTemplate) });
});

// GET /api/templates/:id
templates.get('/:id', async (c) => {
  const db = c.get('db');
  const row = await db.get('SELECT * FROM templates WHERE id = ?', [c.req.param('id')]);
  if (!row) return c.json({ ok: false, error: 'Template not found' }, 404);
  return c.json({ ok: true, template: parseTemplate(row) });
});

// GET /api/templates/:id/xlsx — download the collection template as Excel
templates.get('/:id/xlsx', async (c) => {
  const db = c.get('db');
  const row = await db.get('SELECT * FROM templates WHERE id = ?', [c.req.param('id')]);
  if (!row) return c.json({ ok: false, error: 'Template not found' }, 404);
  const t = parseTemplate(row);
  const bytes = buildFieldsTemplate(t.fields);
  const safe = (t.name || 'Template').replace(/[^a-zA-Z0-9_ -]/g, '').trim().replace(/\s+/g, '_') || 'Template';
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="GPDC_${safe}_Template.xlsx"`,
    },
  });
});

// GET /api/templates/:id/status?fy=&period= — submitted vs outstanding circuits
templates.get('/:id/status', async (c) => {
  const db = c.get('db');
  const row = await db.get('SELECT * FROM templates WHERE id = ?', [c.req.param('id')]);
  if (!row) return c.json({ ok: false, error: 'Template not found' }, 404);
  const t = parseTemplate(row);

  const fy = parseInt(c.req.query('fy'), 10) || null;
  const period = c.req.query('period') || 'annual';

  // The shared (canonical) dataset for this fy/period.
  const dataset = await db.get(
    'SELECT id FROM upload_history WHERE is_shared = 1 AND fiscal_year = ? AND period = ? ORDER BY uploaded_at DESC LIMIT 1',
    [fy, period]
  );

  const submittedBy = {}; // circuit -> { by, at }
  const recent = [];
  if (dataset) {
    const subs = await db.all(
      'SELECT email, circuits, fields, submitted_at FROM submissions WHERE dataset_id = ? AND template_id = ? ORDER BY submitted_at',
      [dataset.id, t.id]
    );
    for (const s of subs) {
      let circuits = [];
      try { circuits = JSON.parse(s.circuits || '[]'); } catch {}
      circuits.forEach((circ) => { submittedBy[circ] = { by: s.email, at: s.submitted_at }; });
      recent.push({ email: s.email, count: circuits.length, at: s.submitted_at });
    }
  }

  const expected = t.scope === 'statewide' ? ['Statewide'] : CIRCUITS;
  const submitted = expected.filter((cir) => submittedBy[cir]).map((cir) => ({ circuit: cir, ...submittedBy[cir] }));
  const outstanding = expected.filter((cir) => !submittedBy[cir]);

  return c.json({
    ok: true,
    template: { id: t.id, name: t.name, cadence: t.cadence, scope: t.scope, fields: t.fields },
    fiscalYear: fy, period,
    expectedCount: expected.length,
    submittedCount: submitted.length,
    submitted, outstanding,
    recent: recent.slice(-10).reverse(),
  });
});

// POST /api/templates — create (admin)
templates.post('/', requireAdmin(), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ ok: false, error: 'Name is required' }, 400);
  const fields = Array.isArray(b.fields) ? b.fields : [];
  const db = c.get('db');
  const res = await db.run(
    'INSERT INTO templates (name, description, fields, scope, cadence, owner_role, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [b.name, b.description || '', JSON.stringify(fields), b.scope || 'circuit', b.cadence || 'annual', b.ownerRole || null, c.get('user').id]
  );
  return c.json({ ok: true, id: res.lastID });
});

// PUT /api/templates/:id — update (admin)
templates.put('/:id', requireAdmin(), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const existing = await db.get('SELECT id FROM templates WHERE id = ?', [id]);
  if (!existing) return c.json({ ok: false, error: 'Template not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const updates = [], params = [];
  if (b.name !== undefined) { updates.push('name = ?'); params.push(b.name); }
  if (b.description !== undefined) { updates.push('description = ?'); params.push(b.description); }
  if (b.fields !== undefined) { updates.push('fields = ?'); params.push(JSON.stringify(b.fields || [])); }
  if (b.scope !== undefined) { updates.push('scope = ?'); params.push(b.scope); }
  if (b.cadence !== undefined) { updates.push('cadence = ?'); params.push(b.cadence); }
  if (b.ownerRole !== undefined) { updates.push('owner_role = ?'); params.push(b.ownerRole); }
  if (!updates.length) return c.json({ ok: true });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  await db.run(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`, params);
  return c.json({ ok: true });
});

// DELETE /api/templates/:id (admin)
templates.delete('/:id', requireAdmin(), async (c) => {
  const db = c.get('db');
  const res = await db.run('DELETE FROM templates WHERE id = ?', [c.req.param('id')]);
  if (!res.changes) return c.json({ ok: false, error: 'Template not found' }, 404);
  return c.json({ ok: true });
});

export default templates;
