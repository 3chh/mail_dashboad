ALTER TABLE "ScanJob"
ADD COLUMN "batchId" TEXT;

CREATE INDEX "ScanJob_batchId_createdAt_idx" ON "ScanJob"("batchId", "createdAt" DESC);
