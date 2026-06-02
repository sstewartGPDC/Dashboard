/**
 * /api/dashboards — CRUD, ported from routes/dashboards.js to Hono + D1.
 * Scoped to the Access-authenticated user (c.get('user')).
 */
import { Hono } from 'hono';

const dashboards = new Hono();

// GET /api/dashboards
dashboards.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const rows = await db.all(
    'SELECT id, name, is_active, created_at, updated_at FROM dashboards WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
  return c.json({ ok: true, dashboards: rows });
});

// POST /api/dashboards
dashboards.post('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const { name, layout, theme } = await c.req.json().catch(() => ({}));
  const res = await db.run(
    'INSERT INTO dashboards (user_id, name, layout_json, theme_json, is_active) VALUES (?, ?, ?, ?, 0) RETURNING id',
    [userId, name || 'New Dashboard', JSON.stringify(layout || []), theme ? JSON.stringify(theme) : null]
  );
  return c.json({ ok: true, id: Number(res.lastID) });
});

// GET /api/dashboards/:id
dashboards.get('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const row = await db.get('SELECT * FROM dashboards WHERE id = ? AND user_id = ?', [c.req.param('id'), userId]);
  if (!row) return c.json({ ok: false, error: 'Dashboard not found' }, 404);

  let layout = [], theme = null;
  try { layout = JSON.parse(row.layout_json); } catch {}
  try { if (row.theme_json) theme = JSON.parse(row.theme_json); } catch {}
  return c.json({ ok: true, dashboard: { id: row.id, name: row.name, layout, theme, is_active: row.is_active, created_at: row.created_at, updated_at: row.updated_at } });
});

// PUT /api/dashboards/:id
dashboards.put('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const dashId = c.req.param('id');

  const existing = await db.get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [dashId, userId]);
  if (!existing) return c.json({ ok: false, error: 'Dashboard not found' }, 404);

  const { name, layout, theme } = await c.req.json().catch(() => ({}));
  const updates = [], params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (layout !== undefined) { updates.push('layout_json = ?'); params.push(JSON.stringify(layout)); }
  if (theme !== undefined) { updates.push('theme_json = ?'); params.push(theme ? JSON.stringify(theme) : null); }
  if (updates.length === 0) return c.json({ ok: true });

  updates.push("updated_at = CURRENT_TIMESTAMP");
  params.push(dashId, userId);
  await db.run(`UPDATE dashboards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
  return c.json({ ok: true });
});

// DELETE /api/dashboards/:id
dashboards.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const res = await db.run('DELETE FROM dashboards WHERE id = ? AND user_id = ?', [c.req.param('id'), userId]);
  if (!res.changes) return c.json({ ok: false, error: 'Dashboard not found' }, 404);
  return c.json({ ok: true });
});

// POST /api/dashboards/:id/activate
dashboards.post('/:id/activate', async (c) => {
  const db = c.get('db');
  const userId = c.get('user').id;
  const dashId = c.req.param('id');

  const existing = await db.get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [dashId, userId]);
  if (!existing) return c.json({ ok: false, error: 'Dashboard not found' }, 404);

  await db.run('UPDATE dashboards SET is_active = 0 WHERE user_id = ?', [userId]);
  await db.run('UPDATE dashboards SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [dashId, userId]);
  return c.json({ ok: true });
});

export default dashboards;
