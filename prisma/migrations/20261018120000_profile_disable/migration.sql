-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "disabledAt" TIMESTAMPTZ(3),
ADD COLUMN     "disabledById" UUID;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

