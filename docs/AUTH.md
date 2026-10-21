# Supabase Auth and invitation-only access

Accounts use Supabase email/password sessions stored in cookies. There are two ways in: accepting a single-use invitation issued by an administrator, or signing up on `/register` with the shared **gym code**. Both end in a profile row, and access is always "enabled profile". Prisma accesses Postgres only on the server.

## Environment configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key | Public; never substitute a secret key |
| `SUPABASE_SECRET_KEY` | Admin client that creates invited accounts | Server secret; never `NEXT_PUBLIC_` |
| `SUPABASE_ADMIN_USER_IDS` | Comma-separated Auth UUIDs of administrators | Server only; empty means no administrators |
| `GYM_SIGNUP_CODE` | Shared code (poster/QR) that allows self-service sign-up; empty closes the form. Case-insensitive | Server secret; never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key rendered in the sign-up form | Public configuration |
| `TURNSTILE_SECRET_KEY` | Turnstile secret used to verify the CAPTCHA on the server; empty closes the form | Server secret |
| `DATABASE_URL` | Prisma runtime connection; falls back to `POSTGRES_PRISMA_URL` | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection; falls back to `POSTGRES_URL_NON_POOLING` | Private migration environment; unnecessary for runtime/build |

Vercel's Supabase integration installs the public Supabase variables, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` fallbacks. Only `SUPABASE_ADMIN_USER_IDS` must be added manually. Configure local values in ignored `.env.local`. Redeploy after changing variables.

## Configure Supabase

1. **Authentication → Sign In / Providers**: keep **Email** enabled, **enable "Allow new users to sign up"** and **"Confirm email"**, and disable any other provider (including Google). Sign-ups must stay on because `/auth/register` calls `auth.signUp()` (see "Gym sign-up" for why this is safe).
2. **Authentication → URL Configuration**: set **Site URL** to the production domain and add `https://<domain>/auth/callback` (and the preview/local equivalents you use) to **Redirect URLs**.
3. **Authentication → Emails → Templates → Confirm signup**: change the button link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. This form works even when the email is opened on another device; the default link needs the same browser that registered.
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

## Gym sign-up

1. A member opens **Crear cuenta con el código del gimnasio** on the sign-in screen (`/register`), enters name, email, password (with a show/hide button) and the gym code, and solves Turnstile.
2. `POST /auth/register` checks the origin, validates the inputs (name up to 80 characters, password 8–72), compares the code in constant time, verifies Turnstile on the server and only then calls `auth.signUp()` with the normal client, so Supabase's own limits and email confirmation apply. It never uses `auth.admin.createUser`.
3. The answer is the same ("Revisa tu correo") whether or not the email already has an account.
4. The email link opens `/auth/callback`, which verifies the token, signs the person in and sends them to `/`. Expired or invalid links return to the sign-in screen with an explanation; registering again with the same unconfirmed email sends a new link.
5. On first access after confirmation, `getAccess` creates the profile (name and email) if the user is confirmed, not anonymous, and carries a valid signup proof.

### Why a proof, and why sign-ups stay enabled

The publishable key is public, so anyone can call Supabase's `signUp` directly, skipping our code check and CAPTCHA. If "confirmed email" alone created a profile, that would bypass the gym code. Instead the server stores in `user_metadata.gym_signup_proof` an HMAC-SHA256 of the normalized email, keyed by a digest of `GYM_SIGNUP_CODE`. Anyone can write arbitrary metadata, but nobody can forge that value without the code, and it is bound to the user's own email. Disabling sign-ups was rejected because the alternative (`admin.createUser` or `inviteUserByEmail`) bypasses Supabase's sign-up limits and the password flow.

Residual risk: a direct `signUp` still creates an unconfirmed Auth user and sends a confirmation email to that address (bounded by Supabase's per-address and hourly email limits). It grants no access. Unconfirmed users without a profile can be deleted from **Authentication → Users**. Mail scanners that open links before the recipient can consume a one-time link; the person then registers again to get a fresh one.

### Rotate the gym code

1. Change `GYM_SIGNUP_CODE` in Vercel (Production, and Preview if used) and redeploy.
2. Print the new poster/QR.
3. Effects: the form accepts only the new code. Members who already have a profile are unaffected. People who registered but had not yet confirmed their email lose their proof and must register again with the new code. To close sign-up entirely, empty the variable and redeploy.

### Create the Turnstile site

In the Cloudflare dashboard open **Turnstile → Add widget**, add the production hostname (and `localhost` for development if wanted), choose **Managed**, and copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret key into `TURNSTILE_SECRET_KEY`. Redeploy after changing variables (the site key is embedded at build time).

### Rate limiting

Vercel Firewall rule on the `personal-prs` project: **Rate limit POST /auth/register and /auth/login** — fixed window, 60 s, 20 requests per IP, action Deny, matching `POST /auth/register` or `POST /auth/login`. The current Vercel plan allows a single rate-limit rule, so both routes share one budget (a second per-route rule returned "Rate limiting is not available for this plan"). If the plan changes, split it into stricter per-route rules (for example 5/min for register and 10/min for login). Turnstile, the code comparison and Supabase's own limits are the other layers; no in-app limiter exists.

## Recover a stuck invitation

If a network failure happens after Supabase created the account but before the app saved the profile, the invitee may see "Ya existe una cuenta con este correo" and a new invitation fails the same way. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user, then create a new invitation.

## Session and data boundaries

- Access is granted to administrators listed in `SUPABASE_ADMIN_USER_IDS` and to accounts with an enabled profile. Profiles are created by accepting an invitation, for administrators on first access, or for confirmed gym sign-ups carrying a valid signup proof; user-editable metadata alone never grants access, and a disabled profile is never recreated or re-enabled.
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
6. Gym sign-up: open `/register` in a private window, try a wrong code (rejected), then the right one; confirm the email arrives, open the link (also on another device) and land in the app. Register again with the same email and confirm the message is the same. Open a link twice or after it expires and check the message. Confirm a direct `signUp` call with the publishable key (no proof) produces a user who sees "no access".
7. Run `node --experimental-vm-modules --test scripts/test-access.mjs scripts/test-register-route.mjs scripts/test-turnstile.mjs scripts/test-record-routes.mjs scripts/test-invitations.mjs scripts/test-invitation-routes.mjs scripts/test-login-route.mjs scripts/test-accept-route.mjs scripts/test-members.mjs scripts/test-bulk-records.mjs scripts/test-bulk-record-route.mjs scripts/test-timer-engine.mjs`, `npm run build` and `git diff --check`. These tests isolate Auth and persistence; they do not replace the browser checks above.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [token-hash email links](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr), [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
