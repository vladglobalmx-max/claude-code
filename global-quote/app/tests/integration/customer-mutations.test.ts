import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  addContact,
  createCustomerFull,
  createProspect,
  updateCustomerCommercialInfo,
} from "@/lib/customers/mutations";

const createdCustomerIds: string[] = [];

afterEach(async () => {
  while (createdCustomerIds.length > 0) {
    const customerId = createdCustomerIds.pop()!;
    await prisma.contact.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
  }
});

async function gfbFixtures() {
  const businessUnit = await prisma.businessUnit.findUniqueOrThrow({ where: { code: "GFB" } });
  const seller = await prisma.user.findUniqueOrThrow({
    where: { email: "diego.ramirez@globalsuppliermty.com" },
  });
  return { businessUnit, seller };
}

describe("createProspect", () => {
  it("always assigns the creating seller and forces PROSPECT status", async () => {
    const { businessUnit, seller } = await gfbFixtures();

    const customer = await createProspect({
      prospect: {
        businessUnitId: businessUnit.id,
        legalName: "Cliente de prueba prospecto",
        tradeName: null,
        taxId: null,
        industry: null,
        segment: null,
        notes: null,
      },
      sellerId: seller.id,
    });
    createdCustomerIds.push(customer.id);

    expect(customer.status).toBe("PROSPECT");
    expect(customer.assignedSellerId).toBe(seller.id);
  });
});

describe("createCustomerFull", () => {
  it("stores every commercial field an Administración user can set", async () => {
    const { businessUnit, seller } = await gfbFixtures();
    const paymentTerms = await prisma.paymentTerms.findUniqueOrThrow({
      where: { code: "CREDITO30" },
    });

    const customer = await createCustomerFull({
      prospect: {
        businessUnitId: businessUnit.id,
        legalName: "Cliente de prueba completo",
        tradeName: "Prueba",
        taxId: "ABC123",
        industry: "Pruebas",
        segment: "QA",
        notes: "Nota de prueba",
      },
      management: {
        assignedSellerId: seller.id,
        paymentTermsId: paymentTerms.id,
        priceListId: null,
        creditLimit: 50000,
        authorizedDiscountPct: 10,
        status: "ACTIVE",
      },
    });
    createdCustomerIds.push(customer.id);

    expect(customer.status).toBe("ACTIVE");
    expect(customer.creditLimit.toNumber()).toBe(50000);
    expect(customer.authorizedDiscountPct.toNumber()).toBe(10);
    expect(customer.paymentTermsId).toBe(paymentTerms.id);
  });
});

describe("updateCustomerCommercialInfo + addContact", () => {
  it("updates fields and adds a contact without touching unrelated data", async () => {
    const { businessUnit, seller } = await gfbFixtures();

    const customer = await createProspect({
      prospect: {
        businessUnitId: businessUnit.id,
        legalName: "Cliente a actualizar",
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
        legalName: "Cliente actualizado",
        tradeName: "Nombre comercial nuevo",
        taxId: null,
        industry: null,
        segment: null,
        notes: null,
        status: "ACTIVE",
      },
      seller.id,
    );

    const contact = await addContact(customer.id, {
      name: "Contacto de prueba",
      position: "Puesto de prueba",
      area: null,
      email: "contacto@example.mx",
      phone: null,
      whatsapp: null,
      decisionPower: "MEDIUM",
    });

    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { contacts: true },
    });

    expect(updated.legalName).toBe("Cliente actualizado");
    expect(updated.status).toBe("ACTIVE");
    expect(updated.assignedSellerId).toBe(seller.id);
    expect(updated.contacts).toHaveLength(1);
    expect(updated.contacts[0].id).toBe(contact.id);
  });
});
