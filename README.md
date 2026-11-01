# personal-prs

Personal CrossFit PR tracker with progress charts and a plate calculator. Next.js uses Supabase Auth for invitation-only email/password sign-in and Prisma for server access to Supabase Postgres.

## Development

Requires Node.js 24. Install dependencies and create private configuration:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure the project URL, publishable key, secret key, database connection and administrator IDs in `.env.local`. Follow [Auth setup](docs/AUTH.md) for the first administrator and invitations, and [database setup](docs/SUPABASE.md) for connections and TLS trust.

The root `/` is the public landing page: static, indexed, with the real Execute screen running inside a phone in the app's light theme (autoplaying in the hero, interactive with sample data in the demo), a progress chart and a Tabata that counts down by itself, built on the same `src/lib` logic (`src/app/page.jsx`, `src/components/landing`). The app itself lives at `/app`, which requests sign-in; installed phones that still open `/` are sent there. `/app?demo=1` explicitly opens sample data (older `/?demo=1` and `/?authError=` links redirect to `/app`); demo records stay in memory and are never written to Supabase. Authorized sessions read and create personal records through `/api/records`. The server derives ownership from verified Auth. Failed live requests show an error rather than replacing real records with samples. Settings stay on the device, separately for each account and demo mode.

Apps Script is no longer used by Next.js. The original `index.html` remains as a historical reference. Historical records have not been imported automatically. Videos are no longer part of the app; legacy video columns remain in the database but are neither read nor written.

## Search and sharing

`SITE_URL` (or Vercel's production domain) sets the absolute URLs for the canonical link, Open Graph, `robots.txt` and `sitemap.xml`, so set it before publishing on a custom domain. The landing page carries structured data (`WebApplication` and `FAQPage`) and the share image `public/og-image.png` (1200×630). `/app` and invitation pages ask search engines not to index them; the API, auth routes and invitations are disallowed in `robots.txt`.

## Database and verification

Prisma owns application models and migrations. See [Prisma persistence](docs/PRISMA.md). Generate the client during installation/build; apply reviewed migrations separately. Never run development resets against a database with real data.

The interface follows iPhone conventions (system colors in light and dark mode, large titles, grouped lists, sheets and alerts) and is built entirely from React components: `src/components/ui` holds the shared controls, and the pure catalog, plate and timer logic lives in `src/lib`.

The workout timer (AMRAP, EMOM, TABATA, FOR TIME), its sound cues and iOS limitations are described in [Workout timer](docs/TIMER.md).

```bash
npm run db:check
npm test
npm run build
```

`npm test` runs every offline test in `scripts/test-*.mjs`; the database integration test (`npm run db:test`) is left out because it needs a disposable database. Access tests check default denial, admin and invited-profile access, single-use invitations, editable metadata and cross-origin mutations. They do not prove real sessions, complete database isolation or historical import.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` with a read-only token and actions pinned by commit SHA: `npm ci`, `npm test`, `npx prisma validate`, `npm run build` and `git diff --check`, plus an informational `npm audit --omit=dev`. It needs no secrets or database. Dependabot (`.github/dependabot.yml`) proposes weekly npm and GitHub Actions updates, grouping minor and patch releases. The Node.js version for CI comes from `.nvmrc`.

## Vercel deployment

Import the repository with the Next.js preset and Node.js 24. `vercel.json` sets the install command to `npm ci`, so deployments install exactly the lockfile; do not override it in the dashboard. The build command is `npm run build`. Configure the variables in [Auth setup](docs/AUTH.md) for the intended environment. Database credentials and the authorization list are server-only; only the project URL and publishable key may use `NEXT_PUBLIC_`.

Add the final HTTPS callback to Supabase Auth's redirect allowlist and redeploy after environment changes. Apply reviewed migrations separately from the build. See [mobile installation](docs/INSTALACION.md) after publication.

## Task tracking

[GitHub Issues](https://github.com/andres1298/personal-prs/issues) is the only task and progress record. Follow [the repository workflow](docs/GITHUB_ISSUES.md).
