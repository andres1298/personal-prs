# personal-prs

Personal CrossFit PR tracker with progress charts and a plate calculator. Next.js uses Supabase Auth for Google sign-in and Prisma for server access to Supabase Postgres.

## Development

Requires Node.js 24. Install dependencies and create private configuration:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure the project URL, publishable key, database connection and approved user IDs in `.env.local`. Follow [Auth setup](docs/AUTH.md) for Google OAuth and account authorization, and [database setup](docs/SUPABASE.md) for connections and TLS trust.

The home page requests sign-in. `/?demo=1` explicitly opens sample data; demo records stay in memory and are never written to Supabase. Authorized sessions read and create personal records through `/api/records`. The server derives ownership from verified Auth. Failed live requests show an error rather than replacing real records with samples. Settings stay on the device, separately for each account and demo mode.

Apps Script is no longer used by Next.js. The original `index.html` remains as a historical reference. Historical records have not been imported automatically. Live video upload is temporarily disabled pending private Storage integration; existing database video references are retained.

## Database and verification

Prisma owns application models and migrations. See [Prisma persistence](docs/PRISMA.md). Generate the client during installation/build; apply reviewed migrations separately. Never run development resets against a database with real data.

```bash
npm run db:check
node --experimental-vm-modules --test scripts/test-access.mjs scripts/test-record-routes.mjs
npm run build
```

Access tests check default denial, authorization removal, editable metadata and cross-origin mutations. They do not prove real Google sessions, complete database isolation or historical import.

## Vercel deployment

Import the repository with the Next.js preset and Node.js 24. Use `npm ci` and `npm run build`. Configure the variables in [Auth setup](docs/AUTH.md) for the intended environment. Database credentials and the authorization list are server-only; only the project URL and publishable key may use `NEXT_PUBLIC_`.

Add the final HTTPS callback to Supabase Auth's redirect allowlist and redeploy after environment changes. Apply reviewed migrations separately from the build. See [mobile installation](docs/INSTALACION.md) after publication.

## Task tracking

[GitHub Issues](https://github.com/andres1298/personal-prs/issues) is the only task and progress record. Follow [the repository workflow](docs/GITHUB_ISSUES.md).
