/** Best-effort audit write to D1. Never throws. */
export async function audit(c, action, detail) {
  try {
    const db = c.get('db');
    const user = c.get('user') || {};
    const req = c.req.raw;
    const ip = req.headers.get('cf-connecting-ip') || null;
    const ua = req.headers.get('user-agent') || null;
    const detailStr = detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail));
    await db.run(
      'INSERT INTO audit_log (user_id, email, action, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id ?? null, user.email ?? null, action, detailStr, ip, ua]
    );
  } catch (err) {
    console.error('[audit] failed', action, err && err.message);
  }
}
