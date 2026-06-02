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

    const adminList = (c.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminList.includes(email.toLowerCase());
    const role = isAdmin ? 'admin' : 'user';

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
