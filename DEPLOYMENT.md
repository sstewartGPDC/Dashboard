# GPDC Dashboard — Hosted Intranet Deployment

This app now runs in two modes from one codebase:

| Mode | How | Storage | Audience |
|------|-----|---------|----------|
| **Desktop** | `npm run start:electron` / packaged DMG | local SQLite | single user, one machine |
| **Hosted web** | `npm run start:web` behind a reverse proxy | central Postgres | all employees over the intranet |

The hosted web mode is the one that meets the goal of employees **submitting data to a central place you control**. The desktop build remains useful for local development/preview.

---

## What changed (architecture)

- **Async DB access layer** (`lib/db.js`) with swappable backends. All routes use
  `await db.get/all/run/tx`. Switching SQLite → Postgres is a config change
  (`GPDC_DB_DRIVER`), not a code change.
- **Postgres backend** (`lib/db-postgres.js`) + Postgres schema (`db/schema.pg.sql`).
- **Security hardening** (`server.js`, `routes/auth.js`, `lib/security.js`):
  - Strong `SESSION_SECRET` required in hosted mode; shipped placeholder values rejected.
  - Secure/HttpOnly/SameSite cookies; HSTS + security headers; optional HTTPS redirect; proxy trust.
  - Login **rate-limiting + lockout** (5 failures / 15 min, configurable).
  - Session fixation prevented (`session.regenerate` on login).
  - Persistent Postgres-backed session store in hosted mode (no leaky MemoryStore).
- **Audit log** (`audit_log` table): login success/failure/lockout, logout, uploads,
  data clears, user creation — with user, IP, and user-agent.

---

## ⚠️ Before you deploy: data classification

This app collects data from public-defender circuits. **Confirm with IT/legal/compliance**
whether that data falls under **CJIS** or Georgia confidential-data rules *before* choosing
where to host. That answer governs:

- **Where** it can live (generic commercial cloud is often not permitted without a compliant environment).
- **Required controls**: MFA, audit logging, encryption at rest/in transit, access management.

This guide gets you to a hardened baseline; it does **not** by itself make you CJIS-compliant.
MFA in particular is not yet implemented (see Roadmap).

---

## Hosted setup (Postgres)

1. **Provision Postgres** in your approved environment. Enable encryption at rest; require TLS.
2. **Install deps** (includes the optional `pg` / `connect-pg-simple`):
   ```
   npm install
   ```
3. **Configure** — copy `.env.example` → `.env` and set at minimum:
   ```
   NODE_ENV=production
   SESSION_SECRET=<openssl rand -base64 48>
   GPDC_DB_DRIVER=postgres
   DATABASE_URL=postgres://user:pass@host:5432/gpdc
   GPDC_BEHIND_TLS=true        # if TLS terminates at your proxy
   GPDC_ADMIN_PASSWORD=<strong initial admin password>
   ```
4. **Create schema + admin**:
   ```
   npm run seed:pg
   ```
5. **Run behind a TLS-terminating reverse proxy** (nginx/IIS/ALB) that forwards to `PORT`:
   ```
   npm run start:web
   ```
   Use a process manager (systemd / pm2) to keep it alive.

### Verify the Postgres backend
`lib/db-postgres.js` mirrors the SQLite semantics but **must be smoke-tested against your
real Postgres** (the SQLite path is verified; the Postgres path has not been run here). After
`seed:pg`, confirm: login, an Excel upload, dashboard create/list, and that rows land in
`audit_log`. The placeholder-rewriting (`?` → `$n`) and `RETURNING id` inserts are the areas
to watch first.

---

## Roadmap / not yet done

- **MFA** (likely required for CJIS) — not implemented.
- **Content-Security-Policy** — security headers are set, but a strict CSP isn't (needs a pass
  over the frontend's inline scripts / CDN usage so it doesn't break the UI).
- **At-rest encryption of uploaded files** in `uploads/` (currently parsed then deleted; confirm
  the temp window is acceptable for your classification).
- **Backups / retention policy** for Postgres and `audit_log`.
- **Per-user password reset / account disable** UI (admin can create users via `/api/auth/register`).
