-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "email" TEXT,
ADD COLUMN     "invitedById" UUID;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedProfileId" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_acceptedProfileId_key" ON "Invitation"("acceptedProfileId");

-- CreateIndex
CREATE INDEX "Invitation_invitedById_acceptedAt_revokedAt_idx" ON "Invitation"("invitedById", "acceptedAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedProfileId_fkey" FOREIGN KEY ("acceptedProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- EnableRLS
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
