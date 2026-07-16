-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tax_id" UUID,
ADD COLUMN     "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "tax_id" UUID,
ADD COLUMN     "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
