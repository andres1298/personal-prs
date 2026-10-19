-- DropIndex
DROP INDEX "Movement_name_key";

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "ownerId" UUID;

-- CreateTable
CREATE TABLE "HiddenMovement" (
    "profileId" UUID NOT NULL,
    "movementId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenMovement_pkey" PRIMARY KEY ("profileId","movementId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movement_ownerId_name_key" ON "Movement"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenMovement" ADD CONSTRAINT "HiddenMovement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenMovement" ADD CONSTRAINT "HiddenMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Prisma does not express partial indexes. Null owners are distinct in a composite
-- unique index, so this keeps shared movement names unique on their own.
CREATE UNIQUE INDEX "Movement_shared_name_key" ON "Movement"("name") WHERE "ownerId" IS NULL;

-- Deny Data API access, as for every other application table.
ALTER TABLE "HiddenMovement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "HiddenMovement" FROM PUBLIC;
