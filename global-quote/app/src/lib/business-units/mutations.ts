import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Currency, FolioNumberingMode } from "@/generated/prisma/enums";

export class BusinessUnitMutationError extends Error {}

/**
 * Alta de línea de negocio (docs/ARCHITECTURE.md §5.2, Módulo 2). `code` es
 * único e inmutable desde su creación — todo el resto del sistema (folios,
 * catálogo, clientes) lo usa como identificador estable, así que nunca se
 * expone en el formulario de edición.
 */
export async function createBusinessUnit(input: { code: string; name: string }) {
  const existing = await prisma.businessUnit.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new BusinessUnitMutationError(`Ya existe una línea de negocio con el código ${input.code}.`);
  }
  return prisma.businessUnit.create({ data: { code: input.code, name: input.name } });
}

export async function updateBusinessUnit(
  businessUnitId: string,
  data: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    colorPrimary: string | null;
    colorSecondary: string | null;
    minMarginDefault: number | null;
    folioNumberingMode: FolioNumberingMode;
    active: boolean;
  },
) {
  return prisma.businessUnit.update({ where: { id: businessUnitId }, data });
}

export async function createBankAccount(input: {
  businessUnitId: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  clabe: string | null;
  currency: Currency;
}) {
  return prisma.bankAccount.create({ data: input });
}

export async function setBankAccountActive(bankAccountId: string, active: boolean) {
  return prisma.bankAccount.update({ where: { id: bankAccountId }, data: { active } });
}

/**
 * Cierra la versión vigente de términos y condiciones (si existe) y crea
 * una nueva — mismo patrón que `replaceProductCost` (Módulo 3): el texto
 * anterior nunca se edita ni se borra, queda como historial consultable.
 */
export async function replaceTermsAndConditions(input: {
  businessUnitId: string;
  content: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.termsAndConditions.updateMany({
      where: { businessUnitId: input.businessUnitId, effectiveTo: null },
      data: { effectiveTo: now },
    });

    return tx.termsAndConditions.create({
      data: {
        businessUnitId: input.businessUnitId,
        content: input.content,
        effectiveFrom: now,
        createdById: input.actorId,
      },
    });
  });
}
