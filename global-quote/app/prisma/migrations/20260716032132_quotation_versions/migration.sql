-- CreateTable
CREATE TABLE "quotation_versions" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_versions_quotation_id_version_number_key" ON "quotation_versions"("quotation_id", "version_number");

-- AddForeignKey
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
