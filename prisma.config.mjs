import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

// Keep CI-provided values authoritative; local files are optional for generation.
if (existsSync('.env.local')) loadEnvFile('.env.local');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --conditions=react-server prisma/seed.mjs',
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
