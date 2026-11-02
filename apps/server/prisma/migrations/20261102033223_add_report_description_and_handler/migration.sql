-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "description" VARCHAR(500),
ADD COLUMN     "handled_at" TIMESTAMPTZ(6),
ADD COLUMN     "handled_by_id" BIGINT;

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
