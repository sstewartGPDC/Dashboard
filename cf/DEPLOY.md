# Deploy checklist — dashboard.gapubdef.org

The app code is ready. These steps need your Cloudflare login (they create real
resources / DNS / Access), so they can't be done from the dev sandbox. Run them
from the `cf/` directory.

## 1. Authenticate
```bash
npx wrangler login
```

## 2. Create the database + KV namespace
```bash
npx wrangler d1 create gpdc_dashboard
npx wrangler kv namespace create TEMP_UPLOADS
```
Copy the printed **`database_id`** and **KV `id`** into `wrangler.toml`
(replacing the `00000000...` placeholders).

## 3. Create the schema in the real D1
```bash
npm run db:init:remote      # wrangler d1 execute DB --remote --file=./schema.sql
```

## 4. Set the admin allowlist
Edit `[vars] ADMIN_EMAILS` in `wrangler.toml` to the real admin email(s),
comma-separated (these are the people who get the 'admin' role in-app).

## 5. Deploy
```bash
npx wrangler deploy
```
The `routes` entry creates `dashboard.gapubdef.org` (DNS + cert) automatically,
since the zone is in your account.

## 6. Gate it with Cloudflare Access  ← important
In the Cloudflare dashboard → **Zero Trust → Access → Applications**, add
`dashboard.gapubdef.org` as a hostname to the **same Access application** that
protects `/intranet` (or create one with the same policy). This makes it
staff-only and supplies the identity the app reads for login.

> Until this step is done the app is publicly reachable. Do it before sharing.

## 7. Verify
- Visit `https://dashboard.gapubdef.org` → Access prompts, then the dashboard loads.
- From the intranet launcher, the **Statewide Dashboard** tile
  (`/intranet/apps/dashboard`) redirects here.
- Upload a sample `.xlsx`, confirm the dashboard renders and `audit_log` records it.

## Notes
- **Login page:** with Access in front, `public/login.html` is bypassed — Access
  authenticates before the app loads. The frontend's logout currently sends users
  to `/login.html`; pointing it at `/cdn-cgi/access/logout` is a small optional
  follow-up for a clean sign-out.
- **Updates:** re-deploy with `npx wrangler deploy`; schema changes go through
  `wrangler d1 execute DB --remote`.
