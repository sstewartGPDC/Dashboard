/**
 * Async database access layer with a swappable backend.
 *
 * Goal: a single async API the whole app uses, so the storage engine can move
 * from local SQLite (desktop/dev) to a central Postgres (hosted intranet) by
 * swapping ONE module — not by editing every route.
 *
 * Backends:
 *   - 'sqlite'   → better-sqlite3 (synchronous under the hood, wrapped as async)
 *   - 'postgres' → pg Pool (see ./db-postgres.js); selected via GPDC_DB_DRIVER=postgres
 *
 * Conventions shared by all backends:
 *   - Use `?` placeholders in SQL everywhere. The Postgres backend rewrites them
 *     to $1..$n. (Our SQL contains no literal `?` characters.)
 *   - To get the id of an inserted row, end the INSERT with `RETURNING id`.
 *     run() returns { lastID, changes } on every backend.
 *   - Boolean-ish flags (is_shared, is_active) are stored as integers 0/1 on
 *     every backend, so route code stays identical.
 *
 * API:
 *   await db.get(sql, params)        → first row or undefined
 *   await db.all(sql, params)        → array of rows
 *   await db.run(sql, params)        → { lastID, changes }
 *   await db.exec(sqlText)           → run a multi-statement script (schema)
 *   await db.tx(async (db) => {...}) → run callback in a transaction
 *   await db.close()
 *   db.driver                        → 'sqlite' | 'postgres'
 */

'use strict';

function createSqliteBackend(options) {
  const Database = require('better-sqlite3');
  const db = new Database(options.file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const hasReturning = (sql) => /\breturning\b/i.test(sql);

  function makeApi(handle) {
    return {
      driver: 'sqlite',
      _handle: handle,

      async get(sql, params = []) {
        return handle.prepare(sql).get(...params);
      },

      async all(sql, params = []) {
        return handle.prepare(sql).all(...params);
      },

      async run(sql, params = []) {
        const stmt = handle.prepare(sql);
        // RETURNING clauses produce rows, which better-sqlite3 refuses on .run()
        if (hasReturning(sql)) {
          const row = stmt.get(...params);
          return { lastID: row ? row.id : null, changes: row ? 1 : 0, row };
        }
        const info = stmt.run(...params);
        return { lastID: Number(info.lastInsertRowid), changes: info.changes };
      },

      async exec(sqlText) {
        handle.exec(sqlText);
      },

      async tx(callback) {
        handle.exec('BEGIN');
        try {
          const result = await callback(makeApi(handle));
          handle.exec('COMMIT');
          return result;
        } catch (err) {
          try { handle.exec('ROLLBACK'); } catch (_) { /* ignore */ }
          throw err;
        }
      },

      async close() {
        handle.close();
      },
    };
  }

  return makeApi(db);
}

/**
 * Build the database adapter. Driver is chosen by config.driver (defaults from
 * GPDC_DB_DRIVER env, falling back to 'sqlite').
 *
 *   createDb({ driver: 'sqlite', file: '/path/to/database.sqlite' })
 *   createDb({ driver: 'postgres', connectionString: process.env.DATABASE_URL })
 */
function createDb(config = {}) {
  const driver = config.driver || process.env.GPDC_DB_DRIVER || 'sqlite';

  if (driver === 'sqlite') {
    if (!config.file) throw new Error('sqlite backend requires { file }');
    return createSqliteBackend(config);
  }

  if (driver === 'postgres' || driver === 'pg') {
    // Lazy require so environments without `pg` installed (e.g. the desktop
    // build) don't need the dependency.
    const { createPostgresBackend } = require('./db-postgres');
    return createPostgresBackend(config);
  }

  throw new Error(`Unknown database driver: ${driver}`);
}

module.exports = { createDb };
