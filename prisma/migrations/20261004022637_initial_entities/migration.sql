-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('WEIGHT', 'TIME');

-- CreateEnum
CREATE TYPE "MovementCategory" AS ENUM ('LIFT', 'CARDIO', 'BENCHMARK');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MovementCategory" NOT NULL,
    "groupName" TEXT NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "movementId" TEXT NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,
    "value" DECIMAL(12,3) NOT NULL,
    "performedOn" DATE NOT NULL,
    "repetitionMax" SMALLINT,
    "notes" TEXT,
    "videoUrl" TEXT,
    "videoId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movement_name_key" ON "Movement"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Movement_id_measurementType_key" ON "Movement"("id", "measurementType");

-- CreateIndex
CREATE INDEX "PersonalRecord_profileId_performedOn_idx" ON "PersonalRecord"("profileId", "performedOn");

-- CreateIndex
CREATE INDEX "PersonalRecord_profileId_movementId_repetitionMax_performed_idx" ON "PersonalRecord"("profileId", "movementId", "repetitionMax", "performedOn");

-- CreateIndex
CREATE INDEX "PersonalRecord_movementId_measurementType_idx" ON "PersonalRecord"("movementId", "measurementType");

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_movementId_measurementType_fkey" FOREIGN KEY ("movementId", "measurementType") REFERENCES "Movement"("id", "measurementType") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma does not express CHECK constraints; keep them in migration history.
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_positive_value_check"
    CHECK ("value" > 0 AND "value" <> 'NaN'::numeric);
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_repetition_max_check"
    CHECK (
        ("measurementType" = 'WEIGHT' AND "repetitionMax" IS NOT NULL AND "repetitionMax" IN (1, 3, 5))
        OR ("measurementType" = 'TIME' AND "repetitionMax" IS NULL)
    );
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_performed_on_check"
    CHECK ("performedOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

-- Deny Data API access until identity and ownership policies land in issue #6.
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Profile", "Movement", "PersonalRecord" FROM PUBLIC;
