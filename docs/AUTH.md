# Supabase Auth and invitation-only access

Accounts use Supabase email/password sessions stored in cookies. Members who forget their password can reset it by email (see "Password recovery"). There are two ways in: accepting a single-use invitation issued by an administrator, or signing up on `/register` with the shared **gym code**. Both end in a profile row, and access is always "enabled profile". Prisma accesses Postgres only on the server.

## Environment configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key | Public; never substitute a secret key |
| `SUPABASE_SECRET_KEY` | Admin client that creates invited accounts | Server secret; never `NEXT_PUBLIC_` |
| `SUPABASE_ADMIN_USER_IDS` | Comma-separated Auth UUIDs of administrators | Server only; empty means no administrators |
| `GYM_SIGNUP_CODE` | Shared code (poster/QR) that allows self-service sign-up; empty closes the form. Case-insensitive | Server secret; never `NEXT_PUBLIC_` |
| `SITE_URL` | Public origin placed in confirmation links. Optional: falls back to Vercel's production domain, then to the request origin | Server only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key rendered in the sign-up form | Public configuration |
| `TURNSTILE_SECRET_KEY` | Turnstile secret used to verify the CAPTCHA on the server; empty closes the form | Server secret |
| `DATABASE_URL` | Prisma runtime connection; falls back to `POSTGRES_PRISMA_URL` | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection; falls back to `POSTGRES_URL_NON_POOLING` | Private migration environment; unnecessary for runtime/build |

Vercel's Supabase integration installs the public Supabase variables, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` fallbacks. Only `SUPABASE_ADMIN_USER_IDS` must be added manually. Configure local values in ignored `.env.local`. Redeploy after changing variables.

## Configure Supabase

1. **Authentication → Sign In / Providers**: keep **Email** enabled, **enable "Allow new users to sign up"** and **"Confirm email"**, and disable any other provider (including Google). Sign-ups must stay on because `/auth/register` calls `auth.signUp()` (see "Gym sign-up" for why this is safe).
2. **Authentication → URL Configuration**: set **Site URL** to the production domain and add `https://<domain>/auth/callback` and `https://<domain>/reset-password` (and the preview/local equivalents you use) to **Redirect URLs**.
3. **Authentication → Emails → Templates**: paste the **Confirm signup** and **Reset password** templates from "Email templates". The email texts live only in the Supabase dashboard, not in this repository, so keep that section in sync when you edit them there.
4. **Authentication → Attack Protection**: leave **CAPTCHA protection off**. A Turnstile token can be redeemed once and the server already verifies it; enabling Supabase's check would make one of the two verifications fail.
5. **Authentication → Emails → SMTP Settings**: enable custom SMTP with Gmail, following "Gmail SMTP". The built-in sender only mails project team members and has a very low hourly limit, so real members would not receive confirmations or recovery links.
6. Apply migrations and the movement catalog to the linked database: `npm run db:migrate:deploy` and `npm run db:seed`.

## Gmail SMTP

Supabase sends every Auth email (sign-up confirmation, password recovery) through a Gmail account. There is no domain or other provider.

**Use a Gmail account dedicated to the app** (for example a new `mispr…@gmail.com`), never a personal one. An app password grants full SMTP access to the account, bypasses 2-step verification, and is stored in Supabase: anyone who obtains it can send mail as that account. A dedicated account limits the damage to the app's mailbox, keeps the sending quota for the app only, and lets you revoke or rotate without touching personal mail.

1. Create the dedicated Gmail account and sign in to it.
2. Open **Google Account → Security → 2-Step Verification** and turn it on (app passwords do not exist without it). Store the recovery codes somewhere safe.
3. Open **Google Account → Security → App passwords** (or `https://myaccount.google.com/apppasswords`), name it `Supabase`, and create it. Google shows a 16-character password once. Do not save it in a file, chat, issue, PR or log.
4. In Supabase open **Authentication → Emails → SMTP Settings** and enable **Custom SMTP**:
   - **Sender email**: the dedicated Gmail address (Gmail rewrites any other From address to this one).
   - **Sender name**: `Mis PRs`.
   - **Host**: `smtp.gmail.com`. **Port**: `465` (SSL). `587` (STARTTLS) also works if 465 is blocked.
   - **Username**: the full Gmail address.
   - **Password**: paste the app password directly from Google's dialog, then save. Supabase does not show it again.
   - **Minimum interval between emails**: keep the default (60 s per user).
5. Open **Authentication → Rate Limits** and set **Rate limit for sending emails** to `30` per hour. That covers about 20 members confirming or recovering at once and keeps a sustained burst well under Gmail's daily limit.
6. Open **Authentication → Sign In / Providers → Email** and keep **Email OTP Expiration** at `3600` seconds; the recovery screen tells members the link lasts 1 hour.
7. Send yourself a recovery email from `/forgot-password` and check that it arrives, from `Mis PRs`, outside spam.

Rotate the app password if it may have leaked or someone who had it leaves: create a new one, paste it in Supabase, then revoke the old one in **App passwords**. Changing the Google account password revokes every app password, so update Supabase right after.

### Known limits

| Limit | Value | Effect |
| --- | --- | --- |
| Gmail daily sending | About 500 recipients per rolling 24 h for a free account | Further sends fail until the window rolls over |
| Supabase email rate | Configured above (30/h) | Further Auth emails fail with a rate-limit error |
| Supabase per-user interval | 60 s | A second request for the same address within a minute is ignored |
| App recovery limit | 3 requests per email and 10 per IP per hour | The form shows "Demasiadas solicitudes" |
| Recovery link | Single use, 1 hour | Expired or used links show a message with a button to ask for a new one |

### If Gmail blocks sending

Symptoms: members report no email, and **Logs → Auth** in Supabase shows SMTP errors.

1. **Credentials rejected** (the log mentions authentication or "Username and Password not accepted"): the app password was revoked, often by a Google password change. Create a new one and paste it in Supabase.
2. **Daily limit exceeded**: Gmail stops sending for up to 24 h. Wait; meanwhile, admins can bring people in with invitation links, which need no email.
3. **Account locked or "suspicious activity"**: sign in to the dedicated account in a browser, review **Security → Recent security activity**, confirm it was you, and wait for Google to lift the restriction.
4. **Emails land in spam**: ask members to mark the message as "No es spam" and add the sender to contacts; keep the templates short, without images or shortened links.
5. If blocks repeat or the group grows beyond what Gmail allows, buy a domain and move to a transactional provider (for example Resend) by changing only the SMTP fields.

## Email templates

Paste these in **Authentication → Emails → Templates**. They are short, plain and name the app in the subject, which keeps them recognizable and less likely to be filtered. Both links use `{{ .TokenHash }}` so they work on any device, and `{{ .RedirectTo }}`, the public URL sent by the server (it must be in **Redirect URLs**, or Supabase falls back to the Site URL).

**Confirm signup** — subject: `Confirma tu cuenta de Mis PRs`

```html
<h2>Confirma tu cuenta</h2>
<p>Hola, usa este enlace para activar tu cuenta de Mis PRs:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Confirmar mi correo</a></p>
<p>Si no creaste una cuenta, ignora este correo.</p>
```

**Reset password** — subject: `Restablece tu contraseña de Mis PRs`

```html
<h2>Restablece tu contraseña</h2>
<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de Mis PRs.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Crear una contraseña nueva</a></p>
<p>El enlace caduca en 1 hora y solo funciona una vez. Si no lo pediste, ignora este correo; tu contraseña no cambia.</p>
```

## Password recovery

1. The sign-in screen links **¿Olvidaste tu contraseña?** to `/forgot-password`, which asks for the email.
2. `POST /auth/forgot-password` checks the origin, validates the email, records the attempt in the rate limiter (3 per email and 10 per IP per hour) and calls `resetPasswordForEmail` with `redirectTo` set to the public `/reset-password` (see `SITE_URL`). The answer is identical whether or not the account exists; Supabase errors are only logged, without the email. If the limiter cannot reach the database, the request is refused rather than sent unlimited.
3. The email link opens `/reset-password?token_hash=…&type=recovery`, which asks for the new password twice, with the same length policy as sign-up (`MIN_PASSWORD_LENGTH` to `MAX_PASSWORD_LENGTH` in `src/lib/password-policy.js`). A missing or malformed link shows the invalid-link message instead of the form.
4. `POST /auth/reset-password` checks the origin and validates both fields first, so typing mistakes do not spend the link. Then it verifies the token (`verifyOtp`, type `recovery`), sets the password (`updateUser`), ends every other session of the account (`signOut` with scope `others`) and opens the app signed in.
5. Expired links show "El enlace caducó"; used or invalid ones "no es válido o ya se usó"; both offer **Pedir un enlace nuevo**. If saving the password fails after the link was spent, the temporary session is closed and the person asks for a new link.

The token is verified only on submit, never when the page loads, so mail scanners that open links do not consume it. `/auth/callback` keeps rejecting recovery tokens, so a recovery link can never sign someone in without choosing a password. The reset page sends a same-origin referrer only, keeping the token out of third-party requests.

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

Residual risk: a direct `signUp` still creates an unconfirmed Auth user and sends a confirmation email to that address (bounded by Supabase's per-address and hourly email limits). It grants no access. Unconfirmed users without a profile can be deleted from **Authentication → Users**. Vercel puts deployment-specific URLs (previews and `*-<team>.vercel.app` aliases) behind its own login, which is why links must never point there. Mail scanners that open links before the recipient can consume a one-time link; the person then registers again to get a fresh one.

### Rotate the gym code

1. Change `GYM_SIGNUP_CODE` in Vercel (Production, and Preview if used) and redeploy.
2. Print the new poster/QR.
3. Effects: the form accepts only the new code. Members who already have a profile are unaffected. People who registered but had not yet confirmed their email lose their proof and must register again with the new code. To close sign-up entirely, empty the variable and redeploy.

### Create the Turnstile site

In the Cloudflare dashboard open **Turnstile → Add widget**, add the production hostname (and `localhost` for development if wanted), choose **Managed**, and copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret key into `TURNSTILE_SECRET_KEY`. Redeploy after changing variables (the site key is embedded at build time).

### Rate limiting

Password recovery has its own limiter in the app (`src/lib/server/rate-limit.js`): every request records the SHA-256 of the email and of the client IP in the `RateLimitEvent` table, never the values themselves, and is refused past 3 per email or 10 per IP in the last hour. Counters live in Postgres because serverless instances share no memory; rows older than a day are deleted on each write. A third party's address can be blocked for an hour by someone requesting it repeatedly; that only delays their recovery and protects their inbox.

Vercel Firewall rule on the `personal-prs` project: **Rate limit POST /auth/register and /auth/login** — fixed window, 60 s, 20 requests per IP, action Deny, matching `POST /auth/register` or `POST /auth/login`. The current Vercel plan allows a single rate-limit rule, so both routes share one budget (a second per-route rule returned "Rate limiting is not available for this plan"). If the plan changes, split it into stricter per-route rules (for example 5/min for register and 10/min for login). Turnstile, the code comparison and Supabase's own limits are the other layers for sign-up and sign-in.

## Recover a stuck invitation

If a network failure happens after Supabase created the account but before the app saved the profile, the invitee may see "Ya existe una cuenta con este correo" and a new invitation fails the same way. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user, then create a new invitation.

## Session and data boundaries

- Access is granted to administrators listed in `SUPABASE_ADMIN_USER_IDS` and to accounts with an enabled profile. Profiles are created by accepting an invitation, for administrators on first access, or for confirmed gym sign-ups carrying a valid signup proof; user-editable metadata alone never grants access, and a disabled profile is never recreated or re-enabled.
- The server calls `getUser()` on every private request, which includes session revocation. Private records return 401 without a valid session and 403 without access. Invitation and user-management operations re-check the administrator role on every request.
- Writes, sign-in, registration, password recovery and reset, invitation acceptance and sign-out require the request's exact origin. Private responses use `Cache-Control: private, no-store`.
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
7. Password recovery (on the published domain): from the sign-in screen open **¿Olvidaste tu contraseña?**, request a link for your account and for an unknown email (same message), confirm the email arrives from `Mis PRs` and whether it lands in spam. Open the link, try mismatched passwords (the link still works), then set a new one and land in the app. Check that another signed-in device loses access on reload, that the old password fails and the new one works, and that reopening the link shows the used-link message. Request four links for the same email within an hour and confirm the fourth is refused.
8. Run `node --experimental-vm-modules --test scripts/test-rate-limit.mjs scripts/test-password-recovery-routes.mjs scripts/test-access.mjs scripts/test-register-route.mjs scripts/test-turnstile.mjs scripts/test-record-routes.mjs scripts/test-invitations.mjs scripts/test-invitation-routes.mjs scripts/test-login-route.mjs scripts/test-accept-route.mjs scripts/test-members.mjs scripts/test-bulk-records.mjs scripts/test-bulk-record-route.mjs scripts/test-timer-engine.mjs`, `npm run build` and `git diff --check`. These tests isolate Auth and persistence; they do not replace the browser and email checks above.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [token-hash email links](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Gmail app passwords](https://support.google.com/accounts/answer/185833), [Gmail sending limits](https://support.google.com/mail/answer/22839), [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
