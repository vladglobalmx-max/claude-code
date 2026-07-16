-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "field_changed" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" TEXT,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express "append-only" as a constraint, so this is added by
-- hand (docs/ARCHITECTURE.md §5.2: "append-only, sin UPDATE/DELETE
-- permitido a nivel de rol de base de datos"). A plain REVOKE would NOT
-- work here: the connecting role owns this table (it ran the migration),
-- and PostgreSQL always grants table owners full DML regardless of
-- GRANT/REVOKE. A trigger that unconditionally rejects UPDATE/DELETE is
-- the only mechanism that holds regardless of ownership — it fires for
-- every role, including the owner, so the guarantee is real rather than
-- bypassable by whoever happens to own the table.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es append-only: % no esta permitido (docs/ARCHITECTURE.md §5.2)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
