-- AlterEnum
ALTER TYPE "MatchStatus" ADD VALUE 'ADJOURNED';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "adjourned_at" TIMESTAMPTZ(6);
