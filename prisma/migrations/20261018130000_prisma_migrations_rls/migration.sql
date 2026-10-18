-- Prisma Migrate creates its history table in the public schema, which the
-- Supabase Data API exposes. Enable RLS with no policies so API roles cannot
-- read it; Prisma connects as the table owner and is unaffected.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
