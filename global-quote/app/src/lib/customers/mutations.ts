import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { CustomerStatus, DecisionPower } from "@/generated/prisma/enums";
import { diffSensitiveFields, recordAuditLog } from "@/lib/audit/log";

const CUSTOMER_SENSITIVE_FIELDS = ["creditLimit", "authorizedDiscountPct", "assignedSellerId"] as const;

export type ProspectInput = {
  businessUnitId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  industry: string | null;
  segment: string | null;
  notes: string | null;
};

export type CustomerManagementInput = {
  assignedSellerId: string | null;
  paymentTermsId: string | null;
  priceListId: string | null;
  creditLimit: number;
  authorizedDiscountPct: number;
  status: CustomerStatus;
};

export type ContactInput = {
  name: string;
  position: string | null;
  area: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  decisionPower: DecisionPower | null;
};

/** Alta de prospecto por un Vendedor: siempre queda asignado a quien lo crea. */
export async function createProspect(input: { prospect: ProspectInput; sellerId: string }) {
  return prisma.customer.create({
    data: {
      ...input.prospect,
      assignedSellerId: input.sellerId,
      status: "PROSPECT",
    },
  });
}

/** Alta completa por Administración/Super Admin, con todos los campos comerciales. */
export async function createCustomerFull(input: {
  prospect: ProspectInput;
  management: CustomerManagementInput;
}) {
  return prisma.customer.create({
    data: {
      ...input.prospect,
      ...input.management,
    },
  });
}

/**
 * Cambios a crédito, descuento autorizado o vendedor asignado son "campos
 * sensibles" (docs/ARCHITECTURE.md §5.2/§10) y quedan en `audit_logs`, con
 * el antes/después de cada uno que de verdad cambió.
 */
export async function updateCustomerCommercialInfo(
  customerId: string,
  data: ProspectInput & Partial<CustomerManagementInput>,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    const updated = await tx.customer.update({ where: { id: customerId }, data });

    const changes = diffSensitiveFields(before, updated, CUSTOMER_SENSITIVE_FIELDS);
    for (const change of changes) {
      await recordAuditLog(tx, {
        entityType: "Customer",
        entityId: customerId,
        userId: actorId,
        action: "UPDATE",
        fieldChanged: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      });
    }

    return updated;
  });
}

export async function addContact(customerId: string, data: ContactInput) {
  return prisma.contact.create({
    data: { ...data, customerId },
  });
}
