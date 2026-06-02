const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { audit, clientIp, checkLockout, recordFailure, clearFailures, MAX_FAILED, WINDOW_MIN } = require('../lib/security');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password required' });
  }
  const db = req.app.locals.db;
  const ip = clientIp(req);

  try {
    // Lockout check before doing any password work.
    const lock = await checkLockout(db, username, ip);
    if (lock.locked) {
      await audit(db, req, 'login.lockout', { username }, { username, userId: null });
      return res.status(429).json({
        ok: false,
        error: `Too many failed attempts. Try again in ${WINDOW_MIN} minutes.`,
      });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      await recordFailure(db, username, ip);
      await audit(db, req, 'login.failure', { username }, { username, userId: null });
      const after = await checkLockout(db, username, ip);
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials',
        attemptsRemaining: after.remaining,
      });
    }

    // Success — clear failures and start a fresh session (prevents fixation).
    await clearFailures(db, username, ip);
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate failed:', err);
        return res.status(500).json({ ok: false, error: 'Login failed' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.displayName = user.display_name;
      req.session.role = user.role;
      audit(db, req, 'login.success', null, { userId: user.id, username: user.username });
      res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const db = req.app.locals.db;
  const who = { userId: req.session ? req.session.userId : null, username: req.session ? req.session.username : null };
  req.session.destroy(() => {
    audit(db, req, 'logout', null, who);
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ ok: false });
  }
  res.json({
    ok: true,
    user: {
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName,
      role: req.session.role
    }
  });
});

// POST /api/auth/register (admin only)
router.post('/register', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password required' });
  }
  if (String(password).length < 10) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 10 characters' });
  }
  try {
    const db = req.app.locals.db;
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Username already exists' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?) RETURNING id',
      [username, hash, displayName || username, role || 'user']
    );
    await audit(db, req, 'user.create', { newUserId: result.lastID, username, role: role || 'user' });
    res.json({ ok: true, userId: result.lastID });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create user' });
  }
});

// GET /api/auth/users (admin only) - list all users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const users = await db.all('SELECT id, username, display_name, role, created_at FROM users');
    res.json({ ok: true, users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ ok: false, error: 'Failed to list users' });
  }
});

module.exports = router;
