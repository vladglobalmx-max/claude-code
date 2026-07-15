-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('MXN', 'USD');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'CONFIGURABLE', 'PROJECT', 'KIT', 'COMBO', 'SERVICE', 'INSTALLATION', 'FREIGHT', 'PROMOTIONAL', 'CUSTOM', 'BACKORDER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "category_id" UUID,
    "internal_sku" TEXT NOT NULL,
    "supplier_sku" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "short_description" TEXT,
    "technical_description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'STANDARD',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "uom" TEXT NOT NULL DEFAULT 'PZA',
    "min_order_qty" INTEGER NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER,
    "warranty" TEXT,
    "country_of_origin" TEXT,
    "purchase_currency" "Currency" NOT NULL DEFAULT 'MXN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_costs" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "purchase_cost" DECIMAL(12,4) NOT NULL,
    "logistics_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "import_expenses" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "landed_cost" DECIMAL(12,4) NOT NULL,
    "target_margin_pct" DECIMAL(5,2) NOT NULL,
    "min_margin_pct" DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'MXN',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "list_price" DECIMAL(12,2) NOT NULL,
    "special_price" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_internal_sku_key" ON "products"("internal_sku");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_code_key" ON "price_lists"("code");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_price_list_id_product_id_key" ON "price_list_items"("price_list_id", "product_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express PostgreSQL EXCLUDE constraints, so this is added by
-- hand (docs/ARCHITECTURE.md §5.3): two cost vigencias for the same product
-- can never overlap. effective_to = NULL means "open-ended / vigente".
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "product_costs"
  ADD CONSTRAINT "product_costs_no_overlap"
  EXCLUDE USING gist (
    product_id WITH =,
    tsrange(effective_from, COALESCE(effective_to, 'infinity'::timestamp), '[)') WITH &&
  );
