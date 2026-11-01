-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- Deny Data API access, as for every other application table. Only the server limiter uses it.
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RateLimitBucket" FROM PUBLIC;
