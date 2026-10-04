# Supabase Auth and authorized access

Google OAuth uses Supabase's PKCE flow and cookie sessions. Prisma accesses Postgres only on the server. Authentication establishes identity; a private allowlist authorizes access until invitations are implemented.

## Environment configuration

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL from the Connect dialog | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key | Public; never substitute a secret/service-role key |
| `SUPABASE_ALLOWED_USER_IDS` | Comma-separated Auth UUIDs approved by the administrator | Server only; empty denies all accounts |
| `DATABASE_URL` | Prisma runtime connection | Server secret |
| `DIRECT_DATABASE_URL` | Prisma migration connection | Private migration environment; unnecessary for runtime/build |

Configure local values in ignored `.env.local` and deployment values in Vercel's environment manager. Use a separate project for previews that write test data. Configure TLS trust as described in [SUPABASE.md](SUPABASE.md).

## Configure Google OAuth

1. In Google Cloud, create or select the application's project. Configure the OAuth consent screen and audience. If it remains in testing, add the intended accounts as test users.
2. Create an OAuth client of type **Web application**. Add the local origin and final HTTPS origin as authorized JavaScript origins.
3. In Supabase **Authentication → Sign In / Providers → Google**, copy the provider callback URL. Add that exact URL to Google's authorized redirect URIs. This callback belongs to Supabase, not `/auth/callback` in this app.
4. Save the Google client ID and client secret in Supabase's Google provider settings and enable the provider. Keep the secret there; never put it in source code or public configuration.
5. In Supabase **Authentication → URL Configuration**, set the Site URL for the intended environment. Add `http://localhost:3000/auth/callback` to Redirect URLs for local development and the final HTTPS application's `/auth/callback` URL for production. If you run the local server on another port, use that exact origin and port in both configurations. Add only the preview callbacks you intend to use.

The app starts OAuth through `POST /auth/login`, exchanges the code in `GET /auth/callback`, and redirects only to the home page. It does not accept arbitrary post-login destinations.

## Authorize the initial account

1. Select **Continuar con Google**. A new account initially sees an authorization message and cannot access records.
2. Find that account in Supabase **Authentication → Users** and verify the intended identity. Put its UUID in the private `SUPABASE_ALLOWED_USER_IDS` setting. Do not publish account details in issues.
3. Restart the local server or redeploy Vercel after updating configuration, then reload the app. Authorization is checked on every record request.
4. Approve additional UUIDs individually, separated by commas. Removing a UUID revokes application access on the next server request independently of token lifetime.

User-editable metadata cannot authorize an account. Anonymous accounts are rejected even if listed. Invitations and administration require separate implementation.

## Session and data boundaries

- The proxy refreshes sessions and propagates cookies and cache headers. Private responses use `Cache-Control: private, no-store`.
- The server calls `getUser()` to verify identity with Auth, including session revocation. It never trusts an unverified session's embedded user.
- Private records return 401 without a valid session and 403 without authorization. Writes and sign-out require the request's exact origin.
- The client cannot specify an owner or video reference when creating a record. The server assigns the verified user ID and validates fields through Prisma.
- Tables retain RLS and the initial deny-by-default Data API configuration. Prisma uses server access and explicit owner filters, not automatic JWT forwarding into RLS. Full role/policy verification is required before changing direct API privileges.
- Settings are device-local, scoped by account UUID, and separate from demo state. They are not synchronized to Postgres. Existing unscoped settings remain untouched.
- Live video upload is disabled pending private Storage integration. Historical import remains separate. No existing records or files are removed.

## Verify after setup

1. Sign in with an approved Google account and reload to confirm session persistence.
2. Read records, create an agreed test PR, and reload to verify persistence, units and date. Keep private data out of screenshots and logs.
3. Sign out and verify private operations reject requests. Check an unapproved account and a revoked authorization entry.
4. With two approved accounts, verify each sees only its records. Attempt owner injection and cross-origin writes. Complete database policy and video tests before declaring full isolation.
5. Run `node --experimental-vm-modules --test scripts/test-access.mjs scripts/test-record-routes.mjs`, `npm run build` and `git diff --check`. The route tests isolate Auth and persistence dependencies to verify ownership assignment and request rejection; they do not test real sessions or database writes. These checks do not replace real OAuth and browser verification.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
