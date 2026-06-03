/**
 * Cloudflare Access identity middleware.
 *
 * Cloudflare Access authenticates the user BEFORE the request reaches this
 * Worker and injects their email in the `Cf-Access-Authenticated-User-Email`
 * header (and a signed JWT in `Cf-Access-Jwt-Assertion`). We trust the header
 * because Access sits in front; in a hardened setup you'd also verify the JWT
 * signature against your team's public keys.
 *
 * This middleware:
 *   1. Resolves the caller's email (falls back to 'dev@local' in local dev).
 *   2. Upserts a row in `users`, assigning 'admin' if the email is in ADMIN_EMAILS.
 *   3. Attaches { id, email, displayName, role } to the Hono context as 'user'.
 */

const localPart = (email) => (email && email.includes('@') ? email.split('@')[0] : email);

export function getAccessEmail(request) {
  return (
    request.headers.get('Cf-Access-Authenticated-User-Email') ||
    'dev@local' // local `wrangler dev` has no Access in front
  );
}

export function accessMiddleware() {
  return async (c, next) => {
    const db = c.get('db');
    const email = getAccessEmail(c.req.raw);

    const list = (v) => (c.env[v] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const adminList = list('ADMIN_EMAILS');
    const viewerList = list('VIEWER_EMAILS');
    const e = email.toLowerCase();
    // Roles: admin (full) > editor (build/edit + upload) > viewer (read-only).
    // Default for an authenticated user not on either list is DEFAULT_ROLE
    // (defaults to 'editor'; set to 'viewer' for view-by-default governance).
    const def = (c.env.DEFAULT_ROLE || 'editor').toLowerCase();
    const defaultRole = (def === 'viewer' || def === 'admin') ? def : 'editor';
    const role = adminList.includes(e) ? 'admin' : viewerList.includes(e) ? 'viewer' : defaultRole;

    // Upsert the user. On conflict, keep their role in sync with the allowlist.
    let user = await db.get('SELECT id, email, display_name, role FROM users WHERE email = ?', [email]);
    if (!user) {
      const res = await db.run(
        'INSERT INTO users (email, display_name, role) VALUES (?, ?, ?) RETURNING id',
        [email, localPart(email), role]
      );
      user = { id: res.lastID, email, display_name: localPart(email), role };
    } else if (user.role !== role) {
      await db.run('UPDATE users SET role = ? WHERE id = ?', [role, user.id]);
      user.role = role;
    }

    c.set('user', {
      id: user.id,
      email: user.email,
      username: user.email,            // frontend expects `username`
      displayName: user.display_name || localPart(email),
      role: user.role,
    });

    await next();
  };
}

/** Guard for admin-only routes. */
export function requireAdmin() {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      return c.json({ ok: false, error: 'Admin access required' }, 403);
    }
    await next();
  };
}

/** Guard for write routes — blocks read-only viewers. */
export function requireEditor() {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || user.role === 'viewer') {
      return c.json({ ok: false, error: 'Read-only access — editing is not permitted for your role.' }, 403);
    }
    await next();
  };
}
