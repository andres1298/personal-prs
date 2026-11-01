# Supabase Auth and invitation-only access

Accounts use Supabase email/password sessions stored in cookies. There are two ways in: accepting a single-use invitation issued by an administrator, or signing up on `/register` and confirming their email. Both end in a profile row, and access is always "enabled profile". Prisma accesses Postgres only on the server.

## Environment configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key | Public; never substitute a secret key |
| `SUPABASE_SECRET_KEY` | Admin client that creates invited accounts | Server secret; never `NEXT_PUBLIC_` |
| `SUPABASE_ADMIN_USER_IDS` | Comma-separated Auth UUIDs of administrators | Server only; empty means no administrators |
| `SITE_URL` | Public origin placed in confirmation links, canonical URLs, Open Graph, robots and sitemap. Optional: falls back to Vercel's production domain, then to the request origin | Server only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key rendered in the sign-up form | Public configuration |
| `TURNSTILE_SECRET_KEY` | Turnstile secret used to verify the CAPTCHA on the server; empty closes the form | Server secret |
| `RATE_LIMIT_SECRET` | Random value (for example `openssl rand -hex 32`) that turns rate-limit keys into HMACs. Optional: without it keys are plain SHA-256 hashes. Changing it only restarts the current windows | Server secret |
| `DATABASE_URL` | Prisma runtime connection; falls back to `POSTGRES_PRISMA_URL` | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection; falls back to `POSTGRES_URL_NON_POOLING` | Private migration environment; unnecessary for runtime/build |

Vercel's Supabase integration installs the public Supabase variables, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` fallbacks. Only `SUPABASE_ADMIN_USER_IDS` must be added manually; add `RATE_LIMIT_SECRET` too to harden the rate-limit keys. Configure local values in ignored `.env.local`. Redeploy after changing variables.

## Configure Supabase

1. **Authentication → Sign In / Providers**: keep **Email** enabled, **enable "Allow new users to sign up"** and **"Confirm email"**, and disable any other provider (including Google). Sign-ups must stay on because `/auth/register` calls `auth.signUp()` (see "What protects an open sign-up").
2. **Authentication → URL Configuration**: set **Site URL** to the production domain and add `https://<domain>/auth/callback` (and the preview/local equivalents you use) to **Redirect URLs**.
3. **Authentication → Emails → Templates → Confirm signup**: change the button link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`. `{{ .RedirectTo }}` is the `/auth/callback` URL the server sends (always the public site, see `SITE_URL`), so the link never depends on which deployment served the form; it must be in the Redirect URLs list or Supabase falls back to the Site URL. This form works even when the email is opened on another device; the default link needs the same browser that registered.
4. **Authentication → Attack Protection**: leave **CAPTCHA protection off**. A Turnstile token can be redeemed once and the server already verifies it; enabling Supabase's check would make one of the two verifications fail.
5. **Authentication → SMTP**: enable custom SMTP. The built-in sender only mails project team members and has a very low hourly limit, so real members would not receive confirmations. Without a domain of your own, Gmail works: host `smtp.gmail.com`, port `465`, username the full Gmail address, password an [app password](https://myaccount.google.com/apppasswords) (requires 2-step verification), sender the same address. Paste the app password only into Supabase; never into issues, PRs or logs. If confirmation emails land in spam or the group outgrows Gmail's daily limit, buy a domain and move to a provider such as Resend by changing only these fields.
6. Apply migrations and the movement catalog to the linked database: `npm run db:migrate:deploy` and `npm run db:seed`.

## Create the first administrator

1. In **Authentication → Users → Add user**, create your account with email, password and **Auto Confirm User**.
2. Copy its UUID into `SUPABASE_ADMIN_USER_IDS` and redeploy (or restart the local server).
3. Sign in with that email and password. The administrator's profile is created on first access.

## Invite someone

1. Open **Ajustes → Invitaciones**, enter the person's name and email, and select **Crear link**. Copy the link and send it privately.
2. The person opens the link, sees their name and email, chooses a password (minimum 8 characters, entered twice) and is signed in.
3. Each link is tied to that email, expires after 7 days, works once and can be revoked from the same list while pending. Inviting an email that already has access is rejected.

Only the SHA-256 hash of each link token is stored. Treat a link like a password until it is used or revoked.

## Administration window

Administrators see **Ajustes → Administración → Abrir**, a small window with two tabs:

- **Usuarios**: every profile with name, email, join date, status and how many records it has. Only the count is exposed; record values never leave the server. Each non-admin account has a switch to disable or re-enable access. Disabling stores when and by which administrator; re-enabling clears both.
- **Invitaciones**: create links, and for each unaccepted link (expired ones included) generate a **Nuevo link** or **Revocar**. A new link replaces the previous token, so the old link stops working, and the 7-day expiry restarts.

A disabled account keeps its Auth session but is treated as having no access on every private request, including records. Administrators listed in `SUPABASE_ADMIN_USER_IDS` cannot be disabled from the window; remove them from that variable instead.

## Self-service sign-up

Anyone can create an account; there is no shared code. Access still requires a confirmed email.

1. A person opens **Crear cuenta** on the landing page or the sign-in screen (`/register`), enters name, email and password (with a show/hide button), and solves Turnstile.
2. `POST /auth/register` checks the origin, validates the inputs (name up to 80 characters, password 8–72), verifies Turnstile on the server and only then calls `auth.signUp()` with the normal client, so Supabase's own limits and email confirmation apply. It never uses `auth.admin.createUser`. Without `TURNSTILE_SECRET_KEY` the form is closed.
3. The answer is the same ("Revisa tu correo") whether or not the email already has an account.
4. The email link opens `/auth/callback`, which verifies the token, signs the person in and sends them to the app at `/app`. Expired or invalid links return to the sign-in screen with an explanation; registering again with the same unconfirmed email sends a new link.
5. On first access after confirmation, `getAccess` creates the profile (name and email) for a confirmed, non-anonymous user. A disabled member keeps their profile, so confirming again or registering again never re-enables them.

### What protects an open sign-up

The publishable key is public, so anyone can also call Supabase's `signUp` directly, skipping our form and Turnstile; after confirming their email that account gets access too. What remains: email confirmation, Supabase's per-address and hourly email limits, the Vercel rate limit on `/auth/register` and `/auth/login` (the direct call goes to Supabase, not through it), and per-account data isolation (each account sees only its own records). Administrators can disable an account from **Administración → Usuarios**. If spam appears, options are enabling **Authentication → Attack Protection → CAPTCHA** in Supabase with the same Turnstile secret (then pass the token to `signUp` instead of verifying it in the route, because a token can be redeemed once), or going back to invitations only (disable sign-ups in Supabase and remove `/register`).

Vercel puts deployment-specific URLs (previews and `*-<team>.vercel.app` aliases) behind its own login, which is why confirmation links must never point there. Mail scanners that open links before the recipient can consume a one-time link; the person then registers again to get a fresh one. Unconfirmed users can be deleted from **Authentication → Users**.

### Create the Turnstile site

In the Cloudflare dashboard open **Turnstile → Add widget**, add the production hostname (and `localhost` for development if wanted), choose **Managed**, and copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret key into `TURNSTILE_SECRET_KEY`. Redeploy after changing variables (the site key is embedded at build time).

### Rate limiting

The app limits requests itself (`src/lib/server/rate-limit.js`). Vercel instances share no memory, so the counters live in Postgres (`RateLimitBucket`, migration `20261101120000_rate_limits`): one atomic upsert per request in a fixed window. Raw client IPs and user ids are never stored: each row's key is a hash of the policy and the subject, and the row expires with its window. The keys are pseudonymous, not anonymous: a plain SHA-256 of a known IP or user id can be recomputed, so set `RATE_LIMIT_SECRET` to make them HMACs that cannot be matched without that secret. About 1% of checks also delete expired rows.

| Policy | Applies to | Subject | Limit |
| --- | --- | --- | --- |
| `login` | `POST /auth/login` | Client IP | 20 per 10 min |
| `logout` | `POST /auth/logout` | Client IP | 30 per 10 min |
| `inviteAccept` | `POST /auth/invite` | Client IP | 10 per 10 min |
| `invitePage` | `GET /invite/[token]` | Client IP | 60 per 10 min |
| `apiRead` | `GET` on every `/api/*` route | Verified user id | 120 per min |
| `apiWrite` | `POST`, `PATCH` and `DELETE` on every `/api/*` route | Verified user id | 30 per min |

The client IP comes from `x-real-ip` (or the first `x-forwarded-for` entry), which Vercel sets; requests without one share a single bucket. IPv6 clients are counted per `/64` prefix, because one host usually controls the whole prefix and could otherwise rotate addresses for fresh budgets; IPv4-mapped addresses count as their IPv4 address. API limits apply after the session is verified and before any other work. When a limit is hit:

- The API answers `429` with `Retry-After` and "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.", which the app shows in its alert.
- Sign-in returns to `/app?authError=rate_limited`, shown as a rate limit, not as wrong credentials. A provider limit from Supabase (HTTP 429 or an `over_*_rate_limit` code) maps to the same message.
- Invitation acceptance returns to the invitation page with the same message; the invitation page itself shows it instead of looking up the token. A limited sign-out skips the Supabase call but still expires this browser's `sb-*-auth-token` cookies and lands on the home page, so the limit never keeps a session open on the device.

**Fails open.** If the limiter cannot reach the table (for example, the migration is not applied yet or the database is unavailable), the request is allowed and the server logs only the error code, never the IP or user id. That keeps sign-in working during a migration; the layers below still apply. Apply the migration with `npm run db:migrate:deploy` before relying on these limits.

Vercel Firewall rule on the `personal-prs` project, kept as the outer backstop: **Rate limit POST /auth/register and /auth/login**, a fixed window of 60 s, 20 requests per IP, action Deny, matching `POST /auth/register` or `POST /auth/login`. The current Vercel plan allows a single rate-limit rule, so both routes share one budget (a second per-route rule returned "Rate limiting is not available for this plan"). The firewall blocks floods before they reach a function or the database; the in-app limiter covers every other public auth and invitation route and the authenticated API. Turnstile and Supabase's own limits are the remaining layers. `/auth/register` and the confirmation callback get their in-app limits with the sign-up changes (#78, #79).

## Quotas

Each account has fixed quotas, so one account cannot grow the shared database or its cost without bound (`src/lib/server/records.js`):

| Quota | Value | Behavior |
| --- | --- | --- |
| Records per account (`MAX_RECORDS_PER_ACCOUNT`) | 5000 | Saving answers `409` with "Alcanzaste el límite de 5000 registros de tu cuenta. No se pueden guardar más." |
| Notes per record (`NOTES_MAX`) | 1000 characters | The form stops typing at 1000; the API rejects longer notes with `400` |
| Records per quick upload (`MAX_BULK_RECORDS`) | 153 | Larger batches are rejected with `400` |
| Custom movements per account | 30 | See [PRISMA.md](PRISMA.md) |

The record quota is counted in the same serializable transaction as the insert, for single records and quick uploads (a batch counts its own size). Two concurrent saves cannot both take the last free slot: one fails with a serialization error, which answers `409` asking to try again. Nothing is written past the quota.

**Database-size alert (to configure in the provider).** Quotas bound each account, not the number of accounts. In the Supabase dashboard, check **Reports → Database** for the current size and configure an alert on database size (or disk usage) at about 80% of the plan's included space, sent to the project owner. If the plan offers no configurable alert, review the size there weekly and keep spend caps on. Record where the alert lives in the issue, never its credentials.

## Recover a stuck invitation

If a network failure happens after Supabase created the account but before the app saved the profile, the invitee may see "Ya existe una cuenta con este correo" and a new invitation fails the same way. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user, then create a new invitation.

## Session and data boundaries

- Access is granted to administrators listed in `SUPABASE_ADMIN_USER_IDS` and to accounts with an enabled profile. Profiles are created by accepting an invitation, for administrators on first access, or for confirmed self-service sign-ups; user-editable metadata never grants access, and a disabled profile is never recreated or re-enabled.
- The server calls `getUser()` on every private request, which includes session revocation. Private records return 401 without a valid session and 403 without access. Invitation and user-management operations re-check the administrator role on every request.
- Writes, sign-in, registration, invitation acceptance and sign-out require the request's exact origin. Private responses use `Cache-Control: private, no-store`.
- Acceptance claims the invitation with a conditional update, so concurrent submissions create at most one account. If account creation fails, the claim is released.
- Tables retain RLS with no policies; Prisma uses server access with explicit owner filters.
- Settings are device-local, scoped by account UUID, and separate from demo state.
- Videos are not supported; legacy database columns are ignored.

## Verify after setup

1. Sign in as the administrator and reload to confirm session persistence.
2. Create an invitation, open it in a private window, set a password and confirm you land in the app.
3. Reopen the same link: it must show that the link is no longer valid. Revoke another pending link and confirm it stops working.
4. With two accounts, verify each sees only its records.
5. In **Administración → Usuarios**, disable the second account, confirm it loses access on reload, then re-enable it. Generate a **Nuevo link** for a pending invitation and confirm the previous link no longer works.
6. Sign-up: open `/register` in a private window, register, confirm the email arrives, open the link (also on another device) and land in the app. Register again with the same email and confirm the message is the same. Open a link twice or after it expires and check the message.
7. Run `node --experimental-vm-modules --test scripts/test-access.mjs scripts/test-register-route.mjs scripts/test-turnstile.mjs scripts/test-record-routes.mjs scripts/test-invitations.mjs scripts/test-invitation-routes.mjs scripts/test-login-route.mjs scripts/test-accept-route.mjs scripts/test-members.mjs scripts/test-bulk-records.mjs scripts/test-bulk-record-route.mjs scripts/test-timer-engine.mjs`, `npm run build` and `git diff --check`. These tests isolate Auth and persistence; they do not replace the browser checks above.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [token-hash email links](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr), [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
