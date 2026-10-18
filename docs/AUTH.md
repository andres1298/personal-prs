# Supabase Auth and invitation-only access

Accounts use Supabase email/password sessions stored in cookies. Nobody can sign up on their own: an account is created only when someone accepts a single-use invitation issued by an administrator. Prisma accesses Postgres only on the server.

## Environment configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key | Public; never substitute a secret key |
| `SUPABASE_SECRET_KEY` | Admin client that creates invited accounts | Server secret; never `NEXT_PUBLIC_` |
| `SUPABASE_ADMIN_USER_IDS` | Comma-separated Auth UUIDs of administrators | Server only; empty means no administrators |
| `DATABASE_URL` | Prisma runtime connection; falls back to `POSTGRES_PRISMA_URL` | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection; falls back to `POSTGRES_URL_NON_POOLING` | Private migration environment; unnecessary for runtime/build |

Vercel's Supabase integration installs the public Supabase variables, `SUPABASE_SECRET_KEY` and the `POSTGRES_*` fallbacks. Only `SUPABASE_ADMIN_USER_IDS` must be added manually. Configure local values in ignored `.env.local`. Redeploy after changing variables.

## Configure Supabase

1. **Authentication → Sign In / Providers**: keep **Email** enabled, disable **Allow new users to sign up**, and disable any other provider (including Google). Server-side account creation through the secret key still works with sign-ups disabled.
2. Apply migrations and the movement catalog to the linked database: `npm run db:migrate:deploy` and `npm run db:seed`.

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

## Recover a stuck invitation

If a network failure happens after Supabase created the account but before the app saved the profile, the invitee may see "Ya existe una cuenta con este correo" and a new invitation fails the same way. In **Authentication → Users**, find that email: if its UUID has no row in `Profile`, delete the Auth user, then create a new invitation.

## Session and data boundaries

- Access is granted to administrators listed in `SUPABASE_ADMIN_USER_IDS` and to accounts with an enabled profile. Profiles are created only by accepting an invitation (or for administrators on first access); user-editable metadata never grants access.
- The server calls `getUser()` on every private request, which includes session revocation. Private records return 401 without a valid session and 403 without access. Invitation and user-management operations re-check the administrator role on every request.
- Writes, sign-in, invitation acceptance and sign-out require the request's exact origin. Private responses use `Cache-Control: private, no-store`.
- Acceptance claims the invitation with a conditional update, so concurrent submissions create at most one account. If account creation fails, the claim is released.
- Tables retain RLS with no policies; Prisma uses server access with explicit owner filters.
- Settings are device-local, scoped by account UUID, and separate from demo state.
- Live video upload remains disabled pending private Storage integration.

## Verify after setup

1. Sign in as the administrator and reload to confirm session persistence.
2. Create an invitation, open it in a private window, set a password and confirm you land in the app.
3. Reopen the same link: it must show that the link is no longer valid. Revoke another pending link and confirm it stops working.
4. With two accounts, verify each sees only its records.
5. In **Administración → Usuarios**, disable the second account, confirm it loses access on reload, then re-enable it. Generate a **Nuevo link** for a pending invitation and confirm the previous link no longer works.
6. Run `node --experimental-vm-modules --test scripts/test-access.mjs scripts/test-record-routes.mjs scripts/test-invitations.mjs scripts/test-invitation-routes.mjs scripts/test-login-route.mjs scripts/test-accept-route.mjs scripts/test-members.mjs scripts/test-bulk-records.mjs scripts/test-bulk-record-route.mjs scripts/test-timer-engine.mjs`, `npm run build` and `git diff --check`. These tests isolate Auth and persistence; they do not replace the browser checks above.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password sign-in](https://supabase.com/docs/guides/auth/passwords), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
