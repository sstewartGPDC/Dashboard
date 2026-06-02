# GPDC Dashboard — Cloudflare (internal app)

The internal staff dashboard, running on **Cloudflare Workers + D1 + KV**, with
authentication handled by **Cloudflare Access** (same gate as `/intranet`).
Serves the existing frontend in `../public` unchanged.

> Scope: this is the **internal** app (staff submit + view). The public
> "publish outputs" flow is intentionally not built yet — the data model carries
> an `upload_history.status` (pending|published) column ready for it.

## Architecture

| Concern | Implementation |
|---|---|
| Routing | Hono (`src/index.js`), `/api/*` → Worker, everything else → `ASSETS` (the `public/` frontend) |
| Database | D1, via `src/db-d1.js` (same async interface as the Node app's adapter) |
| Auth | Cloudflare Access identity → `src/access.js` (no passwords; admin via `ADMIN_EMAILS`) |
| Upload temp store | KV `TEMP_UPLOADS` holds the file between preview-headers → upload-mapped (1h TTL) |
| Excel parsing | SheetJS in-Worker (`src/parse.js`, `src/templates.js`) |
| Audit | `src/audit.js` → `audit_log` table |

## Local development

```bash
npm install
npm run db:init     # apply schema.sql to the local D1
npm run dev         # wrangler dev — visit http://127.0.0.1:8787
```

Locally there is no Access in front, so the identity falls back to `dev@local`,
which `ADMIN_EMAILS` grants admin. Override by sending a
`Cf-Access-Authenticated-User-Email` header.

## Deploy (when ready)

1. `wrangler d1 create gpdc_dashboard` → put the id in `wrangler.toml`.
2. `wrangler kv namespace create TEMP_UPLOADS` → put the id in `wrangler.toml`.
3. `npm run db:init:remote` to create the schema in the real D1.
4. Set `ADMIN_EMAILS` to the real admin addresses.
5. Put a **Cloudflare Access** policy in front of the deployed route (same as `/intranet`).
6. `npm run deploy`.

## Verified locally
Static frontend served; `/api/auth/me` (Access identity); template download;
two-step upload (preview-headers + upload-mapped via KV); data fetch;
dashboards CRUD; config get/set; admin user list; audit logging. All green
under `wrangler dev` (real `workerd` + simulated D1/KV).
