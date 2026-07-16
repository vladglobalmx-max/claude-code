-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'CONVERTED_TO_ORDER');

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "short_folio" TEXT NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'MXN',
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "margin_pct" DECIMAL(5,2),
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_reason" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(14,2) NOT NULL,
    "landed_cost_snapshot" DECIMAL(12,4),
    "min_margin_pct_snapshot" DECIMAL(5,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_status_history" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "from_status" "QuotationStatus",
    "to_status" "QuotationStatus" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_folio_key" ON "quotations"("folio");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
