/**
 * Seed / migrate the database. Works against either backend via lib/db.js.
 *
 *   SQLite (local/desktop):  node db/seed.js
 *   Postgres (hosted):       GPDC_DB_DRIVER=postgres DATABASE_URL=... node db/seed.js
 *
 * Initial admin password:
 *   - Set GPDC_ADMIN_PASSWORD to choose it.
 *   - In hosted/postgres mode it is REQUIRED (no insecure default).
 *   - In local sqlite mode it defaults to 'gpdc2025' with a warning.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { createDb } = require('../lib/db');

async function main() {
  const driver = process.env.GPDC_DB_DRIVER || 'sqlite';
  const isPostgres = driver === 'postgres' || driver === 'pg';

  // ── Open adapter ──
  let db;
  if (isPostgres) {
    db = createDb({
      driver: 'postgres',
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    });
  } else {
    const dbDir = process.env.GPDC_DB_DIR || __dirname;
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    db = createDb({ driver: 'sqlite', file: path.join(dbDir, 'database.sqlite') });
  }

  // ── Apply schema ──
  const schemaFile = isPostgres
    ? path.join(__dirname, 'schema.pg.sql')
    : path.join(__dirname, 'schema.sql');
  await db.exec(fs.readFileSync(schemaFile, 'utf8'));
  console.log(`Database tables created (${driver}).`);

  // ── Legacy migration: chart_layout config → dashboards row ──
  try {
    const legacyConfigs = await db.all(`
      SELECT dc.user_id, dc.config_json
      FROM dashboard_config dc
      WHERE dc.config_key = 'chart_layout'
        AND NOT EXISTS (SELECT 1 FROM dashboards d WHERE d.user_id = dc.user_id)
    `);
    for (const lc of legacyConfigs) {
      await db.run(
        `INSERT INTO dashboards (user_id, name, layout_json, is_active) VALUES (?, 'My Dashboard', ?, 1)`,
        [lc.user_id, lc.config_json]
      );
      console.log(`Migrated chart_layout for user ${lc.user_id} into dashboards table.`);
    }
  } catch (e) {
    // Table may not exist yet on a brand-new DB — fine.
  }

  // ── Default admin ──
  const existing = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!existing) {
    let adminPw = process.env.GPDC_ADMIN_PASSWORD;
    if (!adminPw) {
      if (isPostgres) {
        console.error('FATAL: set GPDC_ADMIN_PASSWORD to create the initial admin in hosted mode.');
        process.exit(1);
      }
      adminPw = 'gpdc2025';
      console.warn('WARNING: using default admin password "gpdc2025". Change it immediately after first login.');
    }
    const hash = bcrypt.hashSync(adminPw, 10);
    await db.run(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      ['admin', hash, 'Administrator', 'admin']
    );
    console.log('Default admin created: admin');
  } else {
    console.log('Admin user already exists.');
  }

  await db.close();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
