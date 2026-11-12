-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "coachSince" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "CoachAthlete" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "endedById" UUID,

    CONSTRAINT "CoachAthlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","athleteId")
);

-- CreateTable
CREATE TABLE "CoachInvite" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" UUID NOT NULL,
    "coachId" UUID NOT NULL,
    "groupId" UUID,
    "athleteId" UUID,
    "date" DATE NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "sessionId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "results" JSONB NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "seenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("sessionId","athleteId")
);

-- CreateTable
CREATE TABLE "SessionComment" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachAthlete_coachId_endedAt_idx" ON "CoachAthlete"("coachId", "endedAt");

-- CreateIndex
CREATE INDEX "CoachAthlete_athleteId_endedAt_idx" ON "CoachAthlete"("athleteId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroup_joinCode_key" ON "TrainingGroup"("joinCode");

-- CreateIndex
CREATE INDEX "TrainingGroup_coachId_archivedAt_idx" ON "TrainingGroup"("coachId", "archivedAt");

-- CreateIndex
CREATE INDEX "GroupMember_athleteId_idx" ON "GroupMember"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachInvite_tokenHash_key" ON "CoachInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CoachInvite_coachId_acceptedAt_revokedAt_idx" ON "CoachInvite"("coachId", "acceptedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "TrainingSession_athleteId_date_idx" ON "TrainingSession"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_groupId_date_key" ON "TrainingSession"("groupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_coachId_athleteId_date_key" ON "TrainingSession"("coachId", "athleteId", "date");

-- CreateIndex
CREATE INDEX "SessionLog_athleteId_idx" ON "SessionLog"("athleteId");

-- CreateIndex
CREATE INDEX "SessionComment_sessionId_athleteId_createdAt_idx" ON "SessionComment"("sessionId", "athleteId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachAthlete" ADD CONSTRAINT "CoachAthlete_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAthlete" ADD CONSTRAINT "CoachAthlete_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionComment" ADD CONSTRAINT "SessionComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionComment" ADD CONSTRAINT "SessionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Prisma does not express partial indexes: a coach and an athlete share at most one active link.
CREATE UNIQUE INDEX "CoachAthlete_active_key" ON "CoachAthlete"("coachId", "athleteId") WHERE "endedAt" IS NULL;

-- Nobody coaches themselves, and a session targets a group or an athlete, never both or neither.
ALTER TABLE "CoachAthlete" ADD CONSTRAINT "CoachAthlete_distinct_check" CHECK ("coachId" <> "athleteId");
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_target_check" CHECK (("groupId" IS NULL) <> ("athleteId" IS NULL));

-- Deny Data API access, as for every other application table.
ALTER TABLE "CoachAthlete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionComment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CoachAthlete", "TrainingGroup", "GroupMember", "CoachInvite", "TrainingSession", "SessionLog", "SessionComment" FROM PUBLIC;
