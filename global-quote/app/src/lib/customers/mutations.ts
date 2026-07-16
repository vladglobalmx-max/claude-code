import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { CustomerStatus, DecisionPower } from "@/generated/prisma/enums";

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

export async function updateCustomerCommercialInfo(
  customerId: string,
  data: ProspectInput & Partial<CustomerManagementInput>,
) {
  return prisma.customer.update({
    where: { id: customerId },
    data,
  });
}

export async function addContact(customerId: string, data: ContactInput) {
  return prisma.contact.create({
    data: { ...data, customerId },
  });
}
