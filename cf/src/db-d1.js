/**
 * D1 backend for the db adapter (Cloudflare migration target).
 *
 * Implements the same async surface as lib/db.js (sqlite/postgres):
 *   get(sql, params)  -> first row | undefined
 *   all(sql, params)  -> rows[]
 *   run(sql, params)  -> { lastID, changes }
 *   exec(sqlText)     -> run a schema script
 *   batch(items)      -> atomic bulk write (D1's transaction equivalent)
 *
 * D1 uses the same `?` positional placeholders our existing SQL already uses,
 * so route SQL transfers unchanged. RETURNING is supported (D1 is modern SQLite).
 */

export function createD1(DB) {
  const hasReturning = (sql) => /\breturning\b/i.test(sql);

  return {
    driver: 'd1',

    async get(sql, params = []) {
      const row = await DB.prepare(sql).bind(...params).first();
      return row == null ? undefined : row;
    },

    async all(sql, params = []) {
      const { results } = await DB.prepare(sql).bind(...params).all();
      return results || [];
    },

    async run(sql, params = []) {
      const stmt = DB.prepare(sql).bind(...params);
      if (hasReturning(sql)) {
        const { results } = await stmt.all();
        const row = results && results[0];
        return { lastID: row ? row.id : null, changes: results ? results.length : 0, row };
      }
      const res = await stmt.run();
      // D1 result meta: { changes, last_row_id, duration, ... }
      return { lastID: res.meta?.last_row_id ?? null, changes: res.meta?.changes ?? 0 };
    },

    async exec(sqlText) {
      // D1 .exec runs newline-separated statements; fine for schema scripts.
      return DB.exec(sqlText.replace(/\n\s*\n/g, '\n'));
    },

    /**
     * Atomic bulk write. `items` is an array of [sql, params].
     * D1 has no interactive transactions, but batch() runs all statements in
     * one implicit transaction — exactly what the bulk circuit insert needs.
     */
    async batch(items) {
      const stmts = items.map(([sql, params = []]) => DB.prepare(sql).bind(...params));
      return DB.batch(stmts);
    },
  };
}
