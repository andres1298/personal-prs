# Prisma persistence

Prisma owns the application schema and server persistence. Supabase Auth owns identities, passwords and sessions. Auth and Storage schemas are never migrated by this repository. The browser must not import database modules or receive database credentials.

## Entities and units

| Model | Purpose |
| --- | --- |
| `Profile` | A UUID supplied by verified Supabase Auth, optional display name and audit timestamps. |
| `Movement` | Stable catalog slug, unique name, category, group and measurement type. |
| `PersonalRecord` | UUIDv7, required profile/movement, decimal measurement, practice date, repetition maximum, notes and optional video references. |

Weights use pounds; times use seconds. `value` is `Decimal(12,3)` (up to nine integer digits and three fractional digits). Server input validation rejects extra precision rather than silently rounding. Database constraints reject nonpositive measurements, NaN, invalid repetition maxima and out-of-range dates. Weight records require 1, 3 or 5 repetitions; time records require null. A composite movement foreign key enforces measurement type consistency.

`performedOn` uses PostgreSQL `date`. Audit timestamps use `timestamptz`. DTOs serialize measurements as decimal strings and practice dates as `YYYY-MM-DD`; `toLegacyRecord` converts the measurement to a JavaScript number for the existing interface. Video URL and external video ID remain separate optional fields. The model does not upload, move or authorize video files.

Profiles and movements with records cannot be deleted until their records are explicitly handled. Multiple records for the same movement on the same day are valid. Indexes support owner history and movement/repetition history and cover foreign keys.

## Identity and authorization boundary

`src/lib/server/records.js` is an internal persistence API, protected by `server-only`. Callers must obtain the owner ID from verified Auth on the server, never from a request's owner field. Reads, updates and deletes filter by that owner; creation always assigns it. Profiles must be provisioned after identity verification. There is no foreign key into `auth.users`: the application must coordinate profile provisioning and account deletion. The present module validates the UUID's shape, not the existence of an Auth account.

These operations are deliberately not exposed as routes or Server Actions yet. Authentication integration is #5, complete authorization and account lifecycle integration is #6, and interface integration/historical import is #7. The existing interface continues using its current source.

All three application tables enable RLS with no access policies. This initially denies access for roles subject to RLS. A database owner or role with bypass privileges can still access them: Prisma does not automatically forward the Supabase user's JWT or guarantee user isolation through RLS. Issue #6 must implement and verify the actual server identity boundary, role privileges and ownership policies before exposing authenticated data flows. Direct SQL access using privileged credentials remains server-only.

## Configuration

Use Node 24 or a supported Prisma 7 runtime. Prisma CLI, client and Postgres adapter are pinned to the same stable version. Generated TypeScript is stripped by Node 24 in scripts and compiled by Next.js; no generated files are committed.

The lockfile overrides the CLI's transitive `deepmerge-ts` and `mysql2` dependencies to patched versions. The application uses only Postgres; retain and review these overrides when upgrading Prisma.

- `DATABASE_URL`: server runtime connection, normally the transaction pooler.
- `DIRECT_DATABASE_URL`: migration connection, direct or session pooler.
- `SHADOW_DATABASE_URL`: an independent disposable database used by `migrate dev` when required. Never point it to an application database.

The CLI loads an optional `.env.local`; process environment values take precedence. Client creation is lazy and reused per process, with one connection and validated TLS. The `pg` adapter owns pooling. Do not copy engine-specific pool parameters from older Prisma releases; `pgbouncer=true` is not a substitute for the driver's configuration. Certificate trust must be configured privately in each environment.

Runtime SSL URL parameters are removed before passing the connection to `pg` so they cannot override certificate verification. Configure runtime trust through Node's certificate settings. Migration connections still use the Prisma CLI's connection configuration.

`DATABASE_SSL=disable` is accepted only for loopback hosts and is intended for disposable local Postgres tests. Remote connections always verify TLS. Do not disable TLS to work around certificate errors.

## Migration workflow

```bash
npm ci
npm run db:validate
npm run db:generate
npm run db:migrate:dev -- --name describe_change --create-only
# Review SQL before applying it to the isolated development database.
npm run db:migrate:dev
npm run db:seed
```

`migrate dev` and its shadow database must use isolated development databases. Never reset a database containing real data. Before adopting an existing application schema, inspect it and prepare a baseline; do not blindly apply the initial migration over existing tables. Supabase's internally managed schemas are excluded from application migrations.

The initial migration was generated by Prisma Migrate and augmented with CHECK constraints and RLS, which Prisma's schema language does not represent. Preserve these additions in versioned SQL. Do not use `db push`, manually create application tables in the dashboard or maintain a parallel Supabase migration history.

For a reviewed deployment:

```bash
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:seed
```

The catalog seed is transactional and repeatable. It does not import historical records or create Auth users. Migration application is a deliberate deployment step, never part of `postinstall`, `next build` or an HTTP request. Client generation runs during installation and build without requiring credentials or a database connection.

## Integration verification

After applying migrations to a disposable database, set `PRISMA_TEST_DATABASE=disposable` and run `npm run db:test`. For loopback Postgres without TLS, additionally set `DATABASE_SSL=disable`. Keep connection strings in private environment configuration.

The script exercises repeatable catalog seeding, profile upsert, record CRUD, owner filters, invalid measurements/dates/repetitions, foreign keys, deletion restrictions, RLS enablement and DTO/legacy serialization. It removes its own test records and profiles; the catalog stays seeded. It does not prove Supabase connectivity, Auth verification, complete RLS ownership policies or browser integration. Those require their own checks.

References: [Prisma configuration](https://www.prisma.io/docs/orm/reference/prisma-config-reference), [Supabase with Prisma](https://supabase.com/docs/guides/database/prisma).
