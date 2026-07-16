import "server-only";

import { prisma } from "@/lib/prisma/client";

/**
 * Resuelve el precio aplicable para un producto en una cotizacion
 * (docs/ARCHITECTURE.md §6 paso 8, §11): primero la lista de precios del
 * cliente si tiene una asignada, si no la lista activa de la linea de
 * negocio. Dentro de una lista, `specialPrice` gana sobre `listPrice`
 * (docs/ARCHITECTURE.md §7 "precio de lista" vs "precio especial"). Si no
 * hay precio vigente en ninguna, devuelve `null` — el vendedor no debe
 * poder cotizar ese producto (docs/ARCHITECTURE.md §8.2, "producto sin
 * costo/precio actualizado: bloqueo").
 */
export async function resolveUnitPrice(input: {
  customerId: string;
  productId: string;
}): Promise<number | null> {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { priceListId: true, businessUnitId: true },
  });

  if (customer.priceListId) {
    const item = await prisma.priceListItem.findUnique({
      where: {
        priceListId_productId: { priceListId: customer.priceListId, productId: input.productId },
      },
    });
    if (item) {
      return (item.specialPrice ?? item.listPrice).toNumber();
    }
  }

  const defaultPriceList = await prisma.priceList.findFirst({
    where: { businessUnitId: customer.businessUnitId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!defaultPriceList) return null;

  const item = await prisma.priceListItem.findUnique({
    where: {
      priceListId_productId: { priceListId: defaultPriceList.id, productId: input.productId },
    },
  });
  return item ? (item.specialPrice ?? item.listPrice).toNumber() : null;
}
