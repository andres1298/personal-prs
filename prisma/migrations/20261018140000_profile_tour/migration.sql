-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "tourCompletedAt" TIMESTAMPTZ(3);

-- Existing members already know the app; only new members get the guided tour.
UPDATE "Profile" SET "tourCompletedAt" = CURRENT_TIMESTAMP;
