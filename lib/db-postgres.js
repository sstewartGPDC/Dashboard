/**
 * Postgres backend for the db adapter (see ./db.js).
 *
 * Implements the same async API as the SQLite backend so route code is identical.
 * Requires the `pg` package (added to package.json as an optionalDependency) and
 * a DATABASE_URL / connection config. This is the hosted-intranet target.
 *
 * NOTE: This backend must be verified against a real Postgres instance during
 * deployment (see DEPLOYMENT.md). It is written to mirror the SQLite semantics
 * but has not been run in this environment.
 */

'use strict';

/**
 * Rewrite `?` placeholders to Postgres `$1..$n`.
 * Our SQL contains no literal `?` characters, so a positional pass is safe.
 */
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function createPostgresBackend(config) {
  const { Pool } = require('pg');

  const pool = new Pool(
    config.connectionString
      ? {
          connectionString: config.connectionString,
          // TLS is required for sensitive data in transit. Allow an explicit
          // CA bundle; otherwise enable TLS with verification unless opted out.
          ssl: config.ssl !== undefined ? config.ssl : { rejectUnauthorized: true },
          max: config.poolMax || 10,
        }
      : {
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: config.ssl !== undefined ? config.ssl : { rejectUnauthorized: true },
          max: config.poolMax || 10,
        }
  );

  // Build an API bound to a specific executor (pool for normal calls, a
  // dedicated client inside a transaction).
  function makeApi(executor) {
    return {
      driver: 'postgres',

      async get(sql, params = []) {
        const r = await executor.query(toPgPlaceholders(sql), params);
        return r.rows[0];
      },

      async all(sql, params = []) {
        const r = await executor.query(toPgPlaceholders(sql), params);
        return r.rows;
      },

      async run(sql, params = []) {
        const r = await executor.query(toPgPlaceholders(sql), params);
        const lastID = r.rows && r.rows[0] && r.rows[0].id != null ? r.rows[0].id : null;
        return { lastID, changes: r.rowCount, rows: r.rows };
      },

      async exec(sqlText) {
        // Multi-statement schema scripts run fine as a single query string in pg.
        await executor.query(sqlText);
      },

      async tx(callback) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback(makeApi(client));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
          throw err;
        } finally {
          client.release();
        }
      },

      async close() {
        await pool.end();
      },
    };
  }

  return makeApi(pool);
}

module.exports = { createPostgresBackend };
