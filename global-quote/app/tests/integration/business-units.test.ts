import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import {
  BusinessUnitMutationError,
  createBankAccount,
  createBusinessUnit,
  replaceTermsAndConditions,
  setBankAccountActive,
  updateBusinessUnit,
} from "@/lib/business-units/mutations";
import { createTax, setTaxActive, TaxMutationError } from "@/lib/taxes/mutations";

const E2E_CODE = "ZZT";
const createdBusinessUnitIds: string[] = [];
const createdTaxIds: string[] = [];

afterEach(async () => {
  while (createdBusinessUnitIds.length > 0) {
    const id = createdBusinessUnitIds.pop()!;
    await prisma.termsAndConditions.deleteMany({ where: { businessUnitId: id } });
    await prisma.bankAccount.deleteMany({ where: { businessUnitId: id } });
    await prisma.businessUnit.deleteMany({ where: { id } });
  }
  while (createdTaxIds.length > 0) {
    const id = createdTaxIds.pop()!;
    await prisma.tax.deleteMany({ where: { id } });
  }
});

async function seller() {
  return prisma.user.findUniqueOrThrow({ where: { email: "diego.ramirez@globalsuppliermty.com" } });
}

describe("createBusinessUnit (docs/ARCHITECTURE.md §5.2, Módulo 2)", () => {
  it("creates a new business unit with a unique code", async () => {
    const bu = await createBusinessUnit({ code: E2E_CODE, name: "Línea de prueba" });
    createdBusinessUnitIds.push(bu.id);

    expect(bu.code).toBe(E2E_CODE);
    expect(bu.active).toBe(true);
    expect(bu.folioNumberingMode).toBe("ANNUAL");
  });

  it("rejects a duplicate code", async () => {
    const bu = await createBusinessUnit({ code: E2E_CODE, name: "Línea de prueba" });
    createdBusinessUnitIds.push(bu.id);

    await expect(createBusinessUnit({ code: E2E_CODE, name: "Otra línea" })).rejects.toThrow(
      BusinessUnitMutationError,
    );
  });

  it("rejects the real seeded GFB code too", async () => {
    await expect(createBusinessUnit({ code: "GFB", name: "Duplicado" })).rejects.toThrow(
      BusinessUnitMutationError,
    );
  });
});

describe("updateBusinessUnit", () => {
  it("updates fiscal/brand fields without ever touching the immutable code", async () => {
    const bu = await createBusinessUnit({ code: E2E_CODE, name: "Línea de prueba" });
    createdBusinessUnitIds.push(bu.id);

    const updated = await updateBusinessUnit(bu.id, {
      name: "Línea de prueba renombrada",
      legalName: "Línea de Prueba S.A. de C.V.",
      taxId: "LPT010101AB1",
      address: "Calle Falsa 123",
      colorPrimary: "#123456",
      colorSecondary: "#654321",
      minMarginDefault: 25,
      folioNumberingMode: "CONTINUOUS",
      active: false,
    });

    expect(updated.code).toBe(E2E_CODE);
    expect(updated.name).toBe("Línea de prueba renombrada");
    expect(updated.folioNumberingMode).toBe("CONTINUOUS");
    expect(updated.active).toBe(false);
    expect(updated.minMarginDefault?.toString()).toBe("25");
  });
});

describe("bank accounts", () => {
  it("creates a bank account for a line and can toggle it inactive", async () => {
    const bu = await createBusinessUnit({ code: E2E_CODE, name: "Línea de prueba" });
    createdBusinessUnitIds.push(bu.id);

    const account = await createBankAccount({
      businessUnitId: bu.id,
      bankName: "Banorte",
      accountHolder: "Global Supplier MTY S.A. de C.V.",
      accountNumber: "0123456789",
      clabe: "072580001234567890",
      currency: "MXN",
    });
    expect(account.active).toBe(true);

    const deactivated = await setBankAccountActive(account.id, false);
    expect(deactivated.active).toBe(false);
  });
});

describe("replaceTermsAndConditions (docs/ARCHITECTURE.md §5.2)", () => {
  it("versions terms and conditions the same way replaceProductCost versions costs", async () => {
    const bu = await createBusinessUnit({ code: E2E_CODE, name: "Línea de prueba" });
    createdBusinessUnitIds.push(bu.id);
    const actor = await seller();

    const v1 = await replaceTermsAndConditions({
      businessUnitId: bu.id,
      content: "Versión 1 de los términos y condiciones.",
      actorId: actor.id,
    });
    expect(v1.effectiveTo).toBeNull();

    const v2 = await replaceTermsAndConditions({
      businessUnitId: bu.id,
      content: "Versión 2 de los términos y condiciones.",
      actorId: actor.id,
    });
    expect(v2.effectiveTo).toBeNull();

    const closedV1 = await prisma.termsAndConditions.findUniqueOrThrow({ where: { id: v1.id } });
    expect(closedV1.effectiveTo).not.toBeNull();

    const openRows = await prisma.termsAndConditions.findMany({
      where: { businessUnitId: bu.id, effectiveTo: null },
    });
    expect(openRows).toHaveLength(1);
    expect(openRows[0].id).toBe(v2.id);
  });
});

describe("taxes (docs/ARCHITECTURE.md §5.2)", () => {
  it("creates a tax and rejects a duplicate code", async () => {
    const tax = await createTax({ code: "TESTTAX", name: "Impuesto de prueba", ratePct: 16 });
    createdTaxIds.push(tax.id);

    expect(tax.active).toBe(true);
    expect(tax.ratePct.toString()).toBe("16");

    await expect(
      createTax({ code: "TESTTAX", name: "Otro impuesto", ratePct: 8 }),
    ).rejects.toThrow(TaxMutationError);
  });

  it("toggles a tax inactive", async () => {
    const tax = await createTax({ code: "TESTTAX2", name: "Impuesto de prueba 2", ratePct: 0 });
    createdTaxIds.push(tax.id);

    const deactivated = await setTaxActive(tax.id, false);
    expect(deactivated.active).toBe(false);
  });
});
