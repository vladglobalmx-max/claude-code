"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  createProductWithCostAndPrice,
  replaceProductCost,
  updateProductCommercialInfo,
  upsertPriceListItem,
} from "@/lib/catalog/mutations";
import {
  priceListItemSchema,
  productCommercialSchema,
  productCostSchema,
} from "@/lib/catalog/validation";

async function requireProductManager() {
  const session = await auth();
  if (
    !session ||
    !hasPermission(session.user.role, PERMISSIONS.MANAGE_PRODUCTS) ||
    !hasPermission(session.user.role, PERMISSIONS.VIEW_COSTS)
  ) {
    // Un intento de invocar la accion directamente (sin pasar por la pagina,
    // que ya bloquea el acceso) se corta aqui tambien — nunca confiar solo en
    // el gate de la pagina (docs/ARCHITECTURE.md §3.1).
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

function formatZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues.map((issue) => issue.message).join(" · ");
  }
  return error instanceof Error ? error.message : "Error de validación.";
}

export async function createProductAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireProductManager();

  const commercialResult = productCommercialSchema.safeParse({
    businessUnitId: formData.get("businessUnitId"),
    categoryId: formData.get("categoryId"),
    internalSku: formData.get("internalSku"),
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    uom: formData.get("uom"),
    status: formData.get("status"),
  });
  const costResult = productCostSchema.safeParse({
    purchaseCost: formData.get("purchaseCost"),
    logisticsCost: formData.get("logisticsCost"),
    importExpenses: formData.get("importExpenses"),
    targetMarginPct: formData.get("targetMarginPct"),
    minMarginPct: formData.get("minMarginPct"),
  });
  const priceResult = priceListItemSchema.safeParse({
    priceListId: formData.get("priceListId"),
    listPrice: formData.get("listPrice"),
  });

  if (!commercialResult.success) return formatZodError(commercialResult.error);
  if (!costResult.success) return formatZodError(costResult.error);
  if (!priceResult.success) return formatZodError(priceResult.error);

  let productId: string;
  try {
    const product = await createProductWithCostAndPrice({
      product: commercialResult.data,
      cost: costResult.data,
      price: priceResult.data,
      actorId: session.user.id,
    });
    productId = product.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return `El SKU "${commercialResult.data.internalSku}" ya existe.`;
    }
    throw error;
  }

  redirect(`/products/${productId}`);
}

export async function updateProductAction(
  productId: string,
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireProductManager();

  const commercialResult = productCommercialSchema
    .omit({ businessUnitId: true, internalSku: true })
    .safeParse({
      categoryId: formData.get("categoryId"),
      name: formData.get("name"),
      shortDescription: formData.get("shortDescription"),
      uom: formData.get("uom"),
      status: formData.get("status"),
    });
  const costResult = productCostSchema.safeParse({
    purchaseCost: formData.get("purchaseCost"),
    logisticsCost: formData.get("logisticsCost"),
    importExpenses: formData.get("importExpenses"),
    targetMarginPct: formData.get("targetMarginPct"),
    minMarginPct: formData.get("minMarginPct"),
  });
  const priceResult = priceListItemSchema.safeParse({
    priceListId: formData.get("priceListId"),
    listPrice: formData.get("listPrice"),
  });

  if (!commercialResult.success) return formatZodError(commercialResult.error);
  if (!costResult.success) return formatZodError(costResult.error);
  if (!priceResult.success) return formatZodError(priceResult.error);

  await updateProductCommercialInfo(productId, commercialResult.data);
  await replaceProductCost({ productId, cost: costResult.data, actorId: session.user.id });
  await upsertPriceListItem({ productId, ...priceResult.data });

  redirect(`/products/${productId}`);
}
