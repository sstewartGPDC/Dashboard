const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/dashboards — list all dashboards for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const dashboards = await db.all(
      'SELECT id, name, is_active, created_at, updated_at FROM dashboards WHERE user_id = ? ORDER BY updated_at DESC',
      [req.session.userId]
    );
    res.json({ ok: true, dashboards });
  } catch (err) {
    console.error('List dashboards error:', err);
    res.status(500).json({ ok: false, error: 'Failed to list dashboards' });
  }
});

// POST /api/dashboards — create a new dashboard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, layout, theme } = req.body;
    const db = req.app.locals.db;
    const userId = req.session.userId;

    const result = await db.run(
      'INSERT INTO dashboards (user_id, name, layout_json, theme_json, is_active) VALUES (?, ?, ?, ?, 0) RETURNING id',
      [userId, name || 'New Dashboard', JSON.stringify(layout || []), theme ? JSON.stringify(theme) : null]
    );

    res.json({ ok: true, id: Number(result.lastID) });
  } catch (err) {
    console.error('Create dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create dashboard' });
  }
});

// GET /api/dashboards/:id — get a single dashboard with full layout
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = await db.get(
      'SELECT * FROM dashboards WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );

    if (!row) return res.status(404).json({ ok: false, error: 'Dashboard not found' });

    let layout = [];
    let theme = null;
    try { layout = JSON.parse(row.layout_json); } catch {}
    try { if (row.theme_json) theme = JSON.parse(row.theme_json); } catch {}

    res.json({ ok: true, dashboard: { id: row.id, name: row.name, layout, theme, is_active: row.is_active, created_at: row.created_at, updated_at: row.updated_at } });
  } catch (err) {
    console.error('Get dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load dashboard' });
  }
});

// PUT /api/dashboards/:id — update a dashboard
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const dashId = req.params.id;

    // Verify ownership
    const existing = await db.get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [dashId, userId]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Dashboard not found' });

    const { name, layout, theme } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (layout !== undefined) { updates.push('layout_json = ?'); params.push(JSON.stringify(layout)); }
    if (theme !== undefined) { updates.push('theme_json = ?'); params.push(theme ? JSON.stringify(theme) : null); }

    if (updates.length === 0) return res.json({ ok: true });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(dashId, userId);

    await db.run(`UPDATE dashboards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Failed to update dashboard' });
  }
});

// DELETE /api/dashboards/:id — delete a dashboard
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const result = await db.run('DELETE FROM dashboards WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Dashboard not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete dashboard' });
  }
});

// POST /api/dashboards/:id/activate — set a dashboard as active
router.post('/:id/activate', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.session.userId;

    // Verify ownership
    const existing = await db.get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Dashboard not found' });

    // Deactivate all, then activate this one
    await db.run('UPDATE dashboards SET is_active = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE dashboards SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Activate dashboard error:', err);
    res.status(500).json({ ok: false, error: 'Failed to activate dashboard' });
  }
});

module.exports = router;
