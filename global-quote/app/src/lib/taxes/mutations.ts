import "server-only";

import { prisma } from "@/lib/prisma/client";

export class TaxMutationError extends Error {}

export async function createTax(input: { code: string; name: string; ratePct: number }) {
  const existing = await prisma.tax.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new TaxMutationError(`Ya existe un impuesto con el código ${input.code}.`);
  }
  return prisma.tax.create({ data: input });
}

export async function setTaxActive(taxId: string, active: boolean) {
  return prisma.tax.update({ where: { id: taxId }, data: { active } });
}
