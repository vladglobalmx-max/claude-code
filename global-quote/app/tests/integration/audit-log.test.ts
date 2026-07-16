import { afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { prisma } from "@/lib/prisma/client";
import { createProspect, updateCustomerCommercialInfo } from "@/lib/customers/mutations";
import { replaceProductCost } from "@/lib/catalog/mutations";

const createdCustomerIds: string[] = [];

/**
 * `audit_logs` es append-only reforzado con triggers (ver la migración) —
 * ni siquiera Prisma, con el mismo rol dueño de la tabla, puede borrar de
 * ella normalmente. Deshabilitar el trigger por el tiempo de la limpieza es
 * una acción deliberada de mantenimiento de pruebas, no algo que la
 * aplicación pueda hacer por accidente en producción.
 */
async function deleteAuditLogsForTesting(entityType: string, entityId: string) {
  await prisma.$executeRawUnsafe(`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_delete`);
  await prisma.auditLog.deleteMany({ where: { entityType, entityId } });
  await prisma.$executeRawUnsafe(`ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_delete`);
}

afterEach(async () => {
  while (createdCustomerIds.length > 0) {
    const customerId = createdCustomerIds.pop()!;
    await deleteAuditLogsForTesting("Customer", customerId);
    await prisma.contact.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
  }
});

async function fixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const seller = await prisma.user.findUniqueOrThrow({
    where: { email: "diego.ramirez@globalsuppliermty.com" },
  });
  const healthyProduct = await prisma.product.findUniqueOrThrow({
    where: { internalSku: "GFB-ENJ-001" },
  });
  return { businessUnit, seller, healthyProduct };
}

describe("audit logging on sensitive-field mutations (docs/ARCHITECTURE.md §5.2/§10)", () => {
  it("logs changes to credit limit, authorized discount, and assigned seller — but not unrelated fields", async () => {
    const { businessUnit, seller } = await fixtures();
    const customer = await createProspect({
      prospect: {
        businessUnitId: businessUnit.id,
        legalName: "Cliente auditoría",
        tradeName: null,
        taxId: null,
        industry: null,
        segment: null,
        notes: null,
      },
      sellerId: seller.id,
    });
    createdCustomerIds.push(customer.id);

    await updateCustomerCommercialInfo(
      customer.id,
      {
        businessUnitId: businessUnit.id,
        legalName: "Cliente auditoría renombrado", // no sensible, no debe auditarse
        tradeName: null,
        taxId: null,
        industry: null,
        segment: null,
        notes: "nota nueva", // tampoco sensible
        creditLimit: 50000,
        authorizedDiscountPct: 8,
        status: "ACTIVE",
      },
      seller.id,
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Customer", entityId: customer.id },
      orderBy: { fieldChanged: "asc" },
    });

    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.fieldChanged)).toEqual(["authorizedDiscountPct", "creditLimit"]);
    const creditLog = logs.find((l) => l.fieldChanged === "creditLimit")!;
    expect(creditLog.oldValue).toBe("0");
    expect(creditLog.newValue).toBe("50000");
    expect(creditLog.userId).toBe(seller.id);
    expect(creditLog.action).toBe("UPDATE");
  });

  it("does not log anything when no sensitive field actually changes", async () => {
    const { businessUnit, seller } = await fixtures();
    const customer = await createProspect({
      prospect: {
        businessUnitId: businessUnit.id,
        legalName: "Cliente sin cambios sensibles",
        tradeName: null,
        taxId: null,
        industry: null,
        segment: null,
        notes: null,
      },
      sellerId: seller.id,
    });
    createdCustomerIds.push(customer.id);

    await updateCustomerCommercialInfo(
      customer.id,
      {
        businessUnitId: businessUnit.id,
        legalName: "Cliente renombrado otra vez",
        tradeName: null,
        taxId: null,
        industry: null,
        segment: null,
        notes: null,
        status: "PROSPECT",
      },
      seller.id,
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Customer", entityId: customer.id },
    });
    expect(logs).toEqual([]);
  });

  it("logs a product cost/margin change, but not the very first cost (no previous vigencia to compare)", async () => {
    const { seller, healthyProduct } = await fixtures();

    const original = await prisma.productCost.findFirstOrThrow({
      where: { productId: healthyProduct.id, effectiveTo: null },
    });

    await replaceProductCost({
      productId: healthyProduct.id,
      cost: {
        purchaseCost: 30,
        logisticsCost: 3,
        importExpenses: 1,
        targetMarginPct: 40,
        minMarginPct: 20,
      },
      actorId: seller.id,
    });

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Product", entityId: healthyProduct.id },
      orderBy: { fieldChanged: "asc" },
    });
    expect(logs.map((l) => l.fieldChanged)).toEqual(["landedCost", "minMarginPct"]);
    const landedCostLog = logs.find((l) => l.fieldChanged === "landedCost")!;
    expect(landedCostLog.oldValue).toBe(original.landedCost.toString());
    expect(landedCostLog.userId).toBe(seller.id);

    // Restaura la vigencia de costo original: GFB-ENJ-001 es un fixture
    // compartido con las pruebas de cotizaciones (esperan su margen/precio
    // exactos), así que esta prueba no puede dejarlo mutado. Primero se
    // borra la vigencia nueva y luego se reabre la original — en ese orden,
    // para no violar el EXCLUDE de vigencias traslapadas con dos filas
    // abiertas a la vez.
    const newCost = await prisma.productCost.findFirstOrThrow({
      where: { productId: healthyProduct.id, effectiveTo: null },
    });
    await prisma.productCost.delete({ where: { id: newCost.id } });
    await prisma.productCost.update({ where: { id: original.id }, data: { effectiveTo: null } });
    await deleteAuditLogsForTesting("Product", healthyProduct.id);
  });
});

describe("audit_logs is append-only at the database level (docs/ARCHITECTURE.md §5.2/§10)", () => {
  it("rejects UPDATE and DELETE via raw SQL, even though the app's role owns the table", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const seller = await prisma.user.findUniqueOrThrow({
        where: { email: "diego.ramirez@globalsuppliermty.com" },
      });
      const { rows } = await pool.query(
        `insert into audit_logs (id, entity_type, entity_id, user_id, action, occurred_at)
         values (gen_random_uuid(), 'Test', gen_random_uuid(), $1, 'CREATE', now())
         returning id`,
        [seller.id],
      );
      const id = rows[0].id as string;

      await expect(pool.query(`update audit_logs set reason = 'tampered' where id = $1`, [id])).rejects.toThrow(
        /append-only/,
      );
      await expect(pool.query(`delete from audit_logs where id = $1`, [id])).rejects.toThrow(/append-only/);

      // Limpieza de este registro de prueba: los triggers son de fila
      // (FOR EACH ROW), así que deshabilitarlos por sesión sí permite borrar
      // — a diferencia de un REVOKE, esto es una acción deliberada de
      // mantenimiento, no algo que la aplicación pueda hacer por accidente.
      await pool.query(`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_delete`);
      await pool.query(`delete from audit_logs where id = $1`, [id]);
      await pool.query(`ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_delete`);
    } finally {
      await pool.end();
    }
  });
});
