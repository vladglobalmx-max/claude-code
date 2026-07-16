-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTATION', 'ORDER', 'CREDIT_NOTE', 'DELIVERY_NOTE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "folio_code" TEXT;

-- CreateTable
CREATE TABLE "sequence_settings" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "last_consecutive" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sequence_settings_business_unit_id_document_type_year_key" ON "sequence_settings"("business_unit_id", "document_type", "year");

-- AddForeignKey
ALTER TABLE "sequence_settings" ADD CONSTRAINT "sequence_settings_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
