/**
 * /api/auth — identity is provided by Cloudflare Access, so there is no
 * password login here. These endpoints expose the Access identity to the
 * frontend and let admins manage roles.
 */
import { Hono } from 'hono';
import { requireAdmin } from '../access.js';

const auth = new Hono();

// GET /api/auth/me — the frontend calls this on boot.
auth.get('/me', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: false });
  return c.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } });
});

// POST /api/auth/logout — real sign-out is Cloudflare Access's logout URL.
// We return it so the frontend can redirect there instead of /login.html.
auth.post('/logout', (c) => c.json({ ok: true, redirect: '/cdn-cgi/access/logout' }));

// GET /api/auth/users — list staff (admin only).
auth.get('/users', requireAdmin(), async (c) => {
  const db = c.get('db');
  const users = await db.all('SELECT id, email AS username, display_name, role, created_at FROM users ORDER BY created_at');
  return c.json({ ok: true, users });
});

// POST /api/auth/register — with Access there is no password. Admins use this
// to pre-register a teammate's email and role; the row is created/updated and
// takes effect when that person signs in through Access.
auth.post('/register', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.username || body.email || '').trim().toLowerCase();
  const role = body.role === 'admin' ? 'admin' : 'user';
  const displayName = body.displayName || (email.includes('@') ? email.split('@')[0] : email);
  if (!email) return c.json({ ok: false, error: 'Email is required' }, 400);

  const db = c.get('db');
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    await db.run('UPDATE users SET role = ?, display_name = ? WHERE id = ?', [role, displayName, existing.id]);
    return c.json({ ok: true, userId: existing.id, updated: true });
  }
  const res = await db.run(
    'INSERT INTO users (email, display_name, role) VALUES (?, ?, ?) RETURNING id',
    [email, displayName, role]
  );
  return c.json({ ok: true, userId: res.lastID });
});

export default auth;
