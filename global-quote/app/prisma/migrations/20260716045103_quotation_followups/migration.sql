-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP', 'IN_PERSON', 'OTHER');

-- CreateTable
CREATE TABLE "quotation_followups" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "contact_method" "ContactMethod" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_followup_at" TIMESTAMP(3),
    "close_probability_pct" DECIMAL(5,2),
    "competitor" TEXT,
    "objection" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_followups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotation_followups" ADD CONSTRAINT "quotation_followups_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_followups" ADD CONSTRAINT "quotation_followups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
