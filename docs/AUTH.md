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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key rendered in the sign-up form (and, in `provider` mode, in the sign-in and invitation forms); in `provider` mode, empty closes registration | Public configuration |
| `TURNSTILE_SECRET_KEY` | Turnstile secret the register route uses to verify the CAPTCHA in `app` mode; empty closes registration in that mode. Unused by the app in `provider` mode | Server secret |
| `AUTH_CAPTCHA_MODE` | Who verifies the Turnstile token: `app` (default; also any other value) or `provider` (Supabase CAPTCHA protection). See "CAPTCHA modes" before changing it | Server only |
| `DATABASE_URL` | Prisma runtime connection; falls back to `POSTGRES_PRISMA_URL` | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection; falls back to `POSTGRES_URL_NON_POOLING` | Private migration environment; unnecessary for runtime/build |

Vercel's Supabase integration installs the public Supabase variables, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` fallbacks. Only `SUPABASE_ADMIN_USER_IDS` must be added manually. Configure local values in ignored `.env.local`. Redeploy after changing variables.

## Configure Supabase

1. **Authentication → Sign In / Providers**: keep **Email** enabled, **enable "Allow new users to sign up"** and **"Confirm email"**, and disable any other provider (including Google). Sign-ups must stay on because `/auth/register` calls `auth.signUp()` (see "What protects an open sign-up").
2. **Authentication → URL Configuration**: set **Site URL** to the production domain and add `https://<domain>/auth/callback` (and the preview/local equivalents you use) to **Redirect URLs**.
3. **Authentication → Emails → Templates → Confirm signup**: the button link must be `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`. `{{ .RedirectTo }}` is the `/auth/callback` URL the server sends (always the public site, see `SITE_URL`), so the link never depends on which deployment served the form; it must be in the Redirect URLs list or Supabase falls back to the Site URL. Only this `token_hash` form is accepted: it works when the email is opened on another device, and opening it calls nothing in Supabase (see "Self-service sign-up"). The default template link (a Supabase verify URL that comes back with a `code`) is rejected as an invalid link.
4. **Authentication → Attack Protection**: keep **CAPTCHA protection off** while `AUTH_CAPTCHA_MODE` is `app` (the default). To move the CAPTCHA check to Supabase, follow the order in "CAPTCHA modes".
5. **Authentication → SMTP**: enable custom SMTP. The built-in sender only mails project team members and has a very low hourly limit, so real members would not receive confirmations. Without a domain of your own, Gmail works: host `smtp.gmail.com`, port `465`, username the full Gmail address, password an [app password](https://myaccount.google.com/apppasswords) (requires 2-step verification), sender the same address. Paste the app password only into Supabase; never into issues, PRs or logs. Before opening sign-up to the public, move to a transactional email provider (for example Resend) on a domain of your own with SPF, DKIM and DMARC configured, and set up alerts for sending quota and bounces; only these SMTP fields change.
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

Anyone can create an account; there is no shared code. Access requires confirming the email and choosing the password on the confirmation page.

1. A person opens **Crear cuenta** on the landing page or the sign-in screen (`/register`), enters name and email, and solves Turnstile. The form does not ask for a password.
2. `POST /auth/register` checks the origin, validates the inputs (name up to 80 characters), checks the CAPTCHA according to `AUTH_CAPTCHA_MODE` and only then calls `auth.signUp()` with the normal client, so Supabase's own limits and email confirmation apply. It never uses `auth.admin.createUser`. The account is created with a random server-generated password (256 random bits plus one upper-case letter, lower-case letter, digit and symbol, so any password policy accepts it) that is never stored, shown or sent anywhere. Whoever submits the form, and however Supabase treats a repeated sign-up of an unconfirmed email, nobody knows a password for the pending account. Without the configuration the CAPTCHA mode needs, the form is closed.
3. The answer is the same ("Revisa tu correo") whether or not the email already has an account.
4. Opening the email link (`GET /auth/callback?token_hash=…&type=signup`) makes no Supabase call: it validates the parameters and redirects to the confirmation page `/auth/confirm`. Mail scanners and link previews therefore cannot consume the link or start a session.
5. The confirmation page asks for **Contraseña** and **Repite la contraseña** and has a **Continuar** button. It loads no third-party scripts and sends the token only to this site (referrer policy `same-origin`; `no-referrer` would make browsers send `Origin: null` and fail the origin check). If the browser already has a session (of any account, because the link's account is unknown until the token is used), the page shows "Hay una sesión abierta como <correo>" and requires ticking a checkbox to replace it.
6. **Continuar** posts to `POST /auth/callback`, which in this order: requires the exact origin; validates the link type (`signup` or `email`) and token format; validates the password (8–72 characters) and that both fields match; re-checks the open session on the server and refuses without the checkbox; and only then calls `verifyOtp`, sets the chosen password with `updateUser`, revokes every other session of the account with `signOut({ scope: 'others' })`, creates the member profile (name and email) and opens `/app`. Errors return to the confirmation page with a message and never show internal details; while the link is unused the form stays available.
7. After confirmation only the chosen password works. `getAccess` never creates member profiles, so a confirmed email alone grants no access. A disabled member keeps their profile, so confirming or registering again never re-enables them. **Ajustes** shows the email of the signed-in account.

Expired or used links show an explanation; registering again with the same unconfirmed email sends a new link. Accounts confirmed with the previous flow already have their profile.

### Recover a stuck sign-up

If a step fails after the link was used (setting the password, closing other sessions or saving the profile), the page says the account could not be activated and the person sees "Tu cuenta todavía no tiene acceso" if they sign in. The same happens if an administrator deleted the person's profile row but not their Auth user. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user and ask the person to register again (or send an invitation).

### What protects an open sign-up

The publishable key is public, so anyone can also call Supabase's `signUp` directly, skipping our form. What remains:

- The pending password is random and unknown, and the real one is chosen only by whoever opens the link from the inbox; at that moment every other session of the account is revoked. A direct `signUp` with a password of the caller's choice still creates no access: the profile is created only by the confirmation step, which replaces that password.
- Email confirmation, Supabase's per-address and hourly email limits, and per-account data isolation (each account sees only its own records). Administrators can disable an account from **Administración → Usuarios**.
- With `AUTH_CAPTCHA_MODE=app` the CAPTCHA protects only our form; a direct call to Supabase skips it. With Supabase CAPTCHA protection on and `AUTH_CAPTCHA_MODE=provider`, a sign-up or password sign-in without a valid token fails both from the app and outside it.
- The Vercel rate limit on `/auth/register` and `/auth/login` (see "Rate limiting"); a direct call goes to Supabase, not through it.

The fallback is going back to invitations only (disable sign-ups in Supabase and remove `/register`).

Vercel puts deployment-specific URLs (previews and `*-<team>.vercel.app` aliases) behind its own login, which is why confirmation links must never point there. Unconfirmed users can be deleted from **Authentication → Users**.

### CAPTCHA modes

A Turnstile token can be redeemed only once, so exactly one party may verify it:

- `app` (default): `/auth/register` verifies the token with `TURNSTILE_SECRET_KEY` and does not pass it to Supabase. Sign-in and invitation forms have no widget. Supabase CAPTCHA protection must be off.
- `provider`: the app never calls Turnstile itself. It passes the token as `captchaToken` to `signUp`, and also to `signInWithPassword` on sign-in and invitation acceptance, because Supabase's protection covers those actions too; those forms then show the widget. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is required or registration stays closed. If Supabase rejects the token, the form shows the CAPTCHA message. If an invited account was created but its sign-in is rejected, the person is sent to the sign-in screen with "Tu cuenta quedó creada".

Mismatched states: Supabase protection on with `app` mode fails closed (our check spends the token, so every sign-up and sign-in fails); `provider` mode with Supabase protection off is the only unsafe state, because nobody verifies the token. Switch in this order:

1. In **Authentication → Attack Protection**, enable CAPTCHA protection with provider **Turnstile** and the same Turnstile secret key. Sign-up and sign-in fail until step 2 is live, so do both back to back.
2. Set `AUTH_CAPTCHA_MODE=provider` in Vercel and redeploy.
3. Confirm that registering, signing in and accepting an invitation work from the app, and that a direct `signUp` call to Supabase without a token is rejected.

To go back, set `AUTH_CAPTCHA_MODE=app` (or remove it), redeploy, then disable the protection in Supabase.

### Create the Turnstile site

In the Cloudflare dashboard open **Turnstile → Add widget**, add the production hostname (and `localhost` for development if wanted), choose **Managed**, and copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret key into `TURNSTILE_SECRET_KEY` (in `provider` mode the secret goes into Supabase instead). Redeploy after changing variables (the site key is embedded at build time).

### Rate limiting

Vercel Firewall rule on the `personal-prs` project: **Rate limit POST /auth/register and /auth/login** — fixed window, 60 s, 20 requests per IP, action Deny, matching `POST /auth/register` or `POST /auth/login`. The current Vercel plan allows a single rate-limit rule, so both routes share one budget (a second per-route rule returned "Rate limiting is not available for this plan"). If the plan changes, split it into stricter per-route rules (for example 5/min for register and 10/min for login). Turnstile, the code comparison and Supabase's own limits are the other layers; no in-app limiter exists.

## Recover a stuck invitation

If a network failure happens after Supabase created the account but before the app saved the profile, the invitee may see "Ya existe una cuenta con este correo" and a new invitation fails the same way. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user, then create a new invitation.

## Session and data boundaries

- Access is granted to administrators listed in `SUPABASE_ADMIN_USER_IDS` and to accounts with an enabled profile. Profiles are created by accepting an invitation, for administrators on first access, or by the confirmation step of a self-service sign-up after the chosen password is set and other sessions are revoked; user-editable metadata never grants access, and a disabled profile is never recreated or re-enabled.
- The server calls `getUser()` on every private request, which includes session revocation. Private records return 401 without a valid session and 403 without access. Invitation and user-management operations re-check the administrator role on every request.
- Writes, sign-in, registration, email confirmation, invitation acceptance and sign-out require the request's exact origin. Private responses use `Cache-Control: private, no-store`.
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
6. Sign-up: open `/register` in a private window, register, confirm the email arrives, open the link (also on another device), choose a password, select **Continuar** and land in the app; **Ajustes** shows the account's email. Sign out and sign in with the chosen password. Register again with the same email and confirm the message is the same. Open a link twice or after it expires and check the message. With another account signed in, open a fresh link and confirm the page warns and requires the checkbox.
7. Run `npm test`, `npm run build` and `git diff --check`. These tests isolate Auth and persistence; they do not replace the browser checks above.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [token-hash email links](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr), [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
