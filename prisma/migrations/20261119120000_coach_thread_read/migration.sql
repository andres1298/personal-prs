-- CreateTable
CREATE TABLE "CoachThreadRead" (
    "sessionId" UUID NOT NULL,
    "athleteId" UUID NOT NULL,
    "seenAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CoachThreadRead_pkey" PRIMARY KEY ("sessionId","athleteId")
);

-- AddForeignKey
ALTER TABLE "CoachThreadRead" ADD CONSTRAINT "CoachThreadRead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny Data API access, as for every other application table.
ALTER TABLE "CoachThreadRead" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CoachThreadRead" FROM PUBLIC;
