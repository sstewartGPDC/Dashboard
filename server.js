const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) { /* .env not required in production */ }
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const { createDb } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Hosted (multi-user, internet/intranet-facing) vs. local desktop mode.
// The Electron wrapper leaves this unset; intranet deployments set NODE_ENV=production.
const IS_HOSTED = process.env.NODE_ENV === 'production' || process.env.GPDC_HOSTED === 'true';

// ─── Database ────────────────────────────────────────────────────────
// Driver selected by GPDC_DB_DRIVER (sqlite | postgres). SQLite is the default
// for local/desktop; hosted intranet uses postgres via DATABASE_URL.
const DB_DRIVER = process.env.GPDC_DB_DRIVER || 'sqlite';
let db;

function initDb() {
  if (DB_DRIVER === 'sqlite') {
    const DB_DIR = process.env.GPDC_DB_DIR || path.join(__dirname, 'db');
    const DB_PATH = path.join(DB_DIR, 'database.sqlite');
    if (!fs.existsSync(DB_PATH)) {
      console.error('Database not found. Run "npm run seed" first.');
      process.exit(1);
    }
    db = createDb({ driver: 'sqlite', file: DB_PATH });
  } else {
    db = createDb({
      driver: 'postgres',
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    });
  }
  app.locals.db = db;
}

// ─── Security secret ─────────────────────────────────────────────────
// In hosted mode a strong, explicit SESSION_SECRET is mandatory — never fall
// back to a hardcoded value, which would let anyone forge session cookies.
// We also reject the known placeholder values that have shipped in .env so a
// deploy can't accidentally go live with a guessable secret.
const SESSION_SECRET = process.env.SESSION_SECRET;
const INSECURE_SECRETS = new Set([
  'gpdc-fallback-secret',
  'gpdc-electron-local-session',
  'gpdc-fy25-dashboard-secret-change-in-production',
  'gpdc-local-desktop-only-secret',
]);
if (IS_HOSTED) {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32 || INSECURE_SECRETS.has(SESSION_SECRET)) {
    console.error('FATAL: SESSION_SECRET must be a strong, unique value (>=32 chars, not a shipped default) in hosted mode.');
    process.exit(1);
  }
}

// ─── Trust proxy / HTTPS ─────────────────────────────────────────────
// When deployed behind an intranet reverse proxy / load balancer that
// terminates TLS, trust X-Forwarded-* so secure cookies and client IPs work.
if (process.env.GPDC_TRUST_PROXY === 'true' || IS_HOSTED) {
  app.set('trust proxy', 1);
}

// Redirect http→https when TLS terminates upstream and we're told to enforce it.
if (process.env.GPDC_FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  });
}

// ─── Security headers (hand-rolled, zero deps) ───────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (process.env.GPDC_BEHIND_TLS === 'true' || process.env.GPDC_FORCE_HTTPS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session store: MemoryStore is fine for the single-user desktop app, but it
// leaks memory and can't be shared across instances — unacceptable for hosted
// multi-user use. In hosted+postgres mode, use a Postgres-backed store.
let sessionStore;
if (IS_HOSTED && (DB_DRIVER === 'postgres' || DB_DRIVER === 'pg')) {
  try {
    const pgSession = require('connect-pg-simple')(session);
    sessionStore = new pgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    });
  } catch (e) {
    console.error('FATAL: hosted mode requires connect-pg-simple for session storage. Run "npm install".');
    process.exit(1);
  }
}

app.use(session({
  name: 'gpdc.sid',
  store: sessionStore, // undefined → default MemoryStore (desktop/local only)
  secret: SESSION_SECRET || 'gpdc-local-desktop-only-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    httpOnly: true,
    sameSite: 'lax',
    // Require HTTPS-only cookies whenever we're behind TLS / hosted.
    secure: process.env.GPDC_BEHIND_TLS === 'true' || process.env.GPDC_FORCE_HTTPS === 'true' || IS_HOSTED,
  },
}));

// ─── Auth Routes (before static protection) ──────────────────────────
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ─── Data Routes ─────────────────────────────────────────────────────
const dataRoutes = require('./routes/data');
app.use('/api/data', dataRoutes);

// ─── Dashboard Routes ───────────────────────────────────────────────
const dashboardRoutes = require('./routes/dashboards');
app.use('/api/dashboards', dashboardRoutes);

// ─── Static File Serving with Auth ───────────────────────────────────
// Login page is always accessible
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protect all other static files
const { requireAuth } = require('./middleware/auth');

app.use((req, res, next) => {
  // Allow login page assets (CSS used by login)
  if (req.path === '/css/login.css' || req.path === '/css/dashboard.css') {
    return next();
  }
  // All other static files require auth
  if (req.path.startsWith('/api/')) return next(); // API routes handled separately
  requireAuth(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

// Root redirect
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────
function startServer(port) {
  if (!db) initDb();
  const actualPort = port || PORT;
  return new Promise((resolve, reject) => {
    const server = app.listen(actualPort, () => {
      console.log(`GPDC Dashboards running at http://localhost:${actualPort} [db=${DB_DRIVER}, hosted=${IS_HOSTED}]`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// When run directly (node server.js), start immediately
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
