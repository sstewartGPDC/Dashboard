/**
 * Security helpers: audit logging and login lockout.
 * Backend-agnostic — they take the async db adapter from lib/db.js.
 */

'use strict';

// Lockout policy (overridable via env).
const MAX_FAILED = parseInt(process.env.GPDC_LOGIN_MAX_FAILED || '5', 10);
const WINDOW_MIN = parseInt(process.env.GPDC_LOGIN_WINDOW_MIN || '15', 10);

/** Best-effort client IP, honoring a trusted reverse proxy (X-Forwarded-For). */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

/**
 * Write an audit record. Never throws — auditing must not break the request,
 * but failures are logged to the server console.
 */
async function audit(db, req, action, detail, overrides = {}) {
  try {
    const userId = overrides.userId !== undefined
      ? overrides.userId
      : (req && req.session ? req.session.userId : null) || null;
    const username = overrides.username !== undefined
      ? overrides.username
      : (req && req.session ? req.session.username : null) || null;
    const detailStr = detail == null
      ? null
      : (typeof detail === 'string' ? detail : JSON.stringify(detail));
    await db.run(
      'INSERT INTO audit_log (user_id, username, action, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        username,
        action,
        detailStr,
        req ? clientIp(req) : null,
        req ? (req.headers['user-agent'] || null) : null,
      ]
    );
  } catch (err) {
    console.error('[audit] failed to record', action, err.message);
  }
}

/**
 * Returns { locked: boolean, remaining: number } for a username+ip pair within
 * the rolling window. `remaining` is attempts left before lockout.
 */
async function checkLockout(db, username, ip) {
  // Compute the window cutoff in JS so the query is dialect-portable.
  // SQLite stores timestamps as ISO-ish text (lexicographically comparable);
  // Postgres casts the ISO string to timestamptz. We pass UTC to match
  // CURRENT_TIMESTAMP, which both engines store in UTC.
  const cutoff = new Date(Date.now() - WINDOW_MIN * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, '');
  const row = await db.get(
    `SELECT COUNT(*) AS n FROM login_attempts
       WHERE username = ? AND ip = ? AND attempted_at > ?`,
    [username, ip, cutoff]
  );
  const n = row ? Number(row.n) : 0;
  return { locked: n >= MAX_FAILED, remaining: Math.max(0, MAX_FAILED - n), count: n };
}

async function recordFailure(db, username, ip) {
  await db.run('INSERT INTO login_attempts (username, ip) VALUES (?, ?)', [username, ip]);
}

async function clearFailures(db, username, ip) {
  await db.run('DELETE FROM login_attempts WHERE username = ? AND ip = ?', [username, ip]);
}

module.exports = {
  audit,
  clientIp,
  checkLockout,
  recordFailure,
  clearFailures,
  MAX_FAILED,
  WINDOW_MIN,
};
