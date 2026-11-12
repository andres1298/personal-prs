-- CreateEnum
CREATE TYPE "Division" AS ENUM ('MEN', 'WOMEN');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "division" "Division";
