/**
 * GPDC Dashboard — internal app on Cloudflare (Workers + D1 + KV + Access).
 *
 * The Worker handles /api/* (Hono router) and falls through to the static
 * frontend (public/) via the ASSETS binding. Cloudflare Access authenticates
 * users before requests arrive; accessMiddleware turns that into an app user.
 */
import { Hono } from 'hono';
import { createD1 } from './db-d1.js';
import { accessMiddleware } from './access.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import dashboardRoutes from './routes/dashboards.js';
import templateRoutes from './routes/templates.js';
import rosterRoutes from './routes/roster.js';

const app = new Hono();

// Per-request: attach the D1 adapter, then resolve the Access identity.
app.use('/api/*', async (c, next) => {
  c.set('db', createD1(c.env.DB));
  await next();
});
app.use('/api/*', accessMiddleware());

app.route('/api/auth', authRoutes);
app.route('/api/data', dataRoutes);
app.route('/api/dashboards', dashboardRoutes);
app.route('/api/templates', templateRoutes);
app.route('/api/roster', rosterRoutes);

// Unknown /api path → JSON 404 (not the SPA).
app.all('/api/*', (c) => c.json({ ok: false, error: 'Not found' }, 404));

// Everything else → static assets (index.html, /js, /css, login.html, ...).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

// Centralized error → JSON for API, rethrow otherwise.
app.onError((err, c) => {
  console.error('Unhandled error:', err && err.stack || err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ ok: false, error: 'Server error' }, 500);
  }
  return c.text('Server error', 500);
});

// Mount the app under a base path (e.g. /intranet/apps/dashboards) when BASE_PATH
// is set. We strip the prefix before routing so the Hono routes and ASSETS
// binding see root-relative paths; the frontend resolves its relative URLs via a
// <base> tag derived from the served path. BASE_PATH unset → app runs at root.
export default {
  async fetch(request, env, ctx) {
    const base = (env.BASE_PATH || '').replace(/\/$/, '');
    if (base) {
      const url = new URL(request.url);
      if (url.pathname === base) {
        // Canonicalize to a trailing slash so the <base> tag resolves correctly.
        url.pathname = base + '/';
        return Response.redirect(url.toString(), 301);
      }
      if (url.pathname.startsWith(base + '/')) {
        url.pathname = url.pathname.slice(base.length) || '/';
        request = new Request(url.toString(), request);
      } else if (url.pathname.startsWith(base)) {
        // e.g. "/intranet/apps/dashboardsX" — not ours; pass through unchanged.
      }
    }
    return app.fetch(request, env, ctx);
  },
};
