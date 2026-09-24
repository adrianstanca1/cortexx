ALTER TABLE "ExpenseReceipt" ADD COLUMN IF NOT EXISTS "costCodeId" TEXT;
ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ExpenseReceipt_costCodeId_idx" ON "ExpenseReceipt"("costCodeId");

ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "costCodeId" TEXT;
ALTER TABLE "SubInvoice" ADD CONSTRAINT "SubInvoice_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "SubInvoice_costCodeId_idx" ON "SubInvoice"("costCodeId");
