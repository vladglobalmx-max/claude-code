import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";
import { computeMarginPctFromSalePrice } from "@/lib/catalog/margin";

export type ProductForProjection = {
  id: string;
  internalSku: string;
  name: string;
  shortDescription: string | null;
  uom: string;
  status: string;
  categoryName: string | null;
  listPrice: number | null;
  landedCost: number | null;
  minMarginPct: number | null;
};

export type ProjectedProduct = {
  id: string;
  internalSku: string;
  name: string;
  shortDescription: string | null;
  uom: string;
  status: string;
  categoryName: string | null;
  listPrice: number | null;
  /** Solo presente si el rol tiene permiso de ver costos (docs/ARCHITECTURE.md §3.1). */
  landedCost: number | null;
  /** Solo presente si el rol tiene permiso de ver costos o margen porcentual. */
  marginPct: number | null;
  belowMinMargin: boolean;
};

/**
 * Unico punto de salida de datos de producto hacia la UI/API. Un vendedor
 * nunca recibe landedCost aunque lo pida el componente que llama esta
 * funcion: el servidor nunca lo incluye en el objeto de respuesta.
 */
export function projectProduct(product: ProductForProjection, role: RoleCode): ProjectedProduct {
  const canViewCosts = hasPermission(role, PERMISSIONS.VIEW_COSTS);
  const canViewMarginPct = canViewCosts || hasPermission(role, PERMISSIONS.VIEW_MARGIN_PCT);

  const marginPct =
    canViewMarginPct && product.listPrice != null && product.landedCost != null
      ? computeMarginPctFromSalePrice({
          landedCost: product.landedCost,
          salePrice: product.listPrice,
        }).toDecimalPlaces(2).toNumber()
      : null;

  const belowMinMargin =
    marginPct != null && product.minMarginPct != null ? marginPct < product.minMarginPct : false;

  return {
    id: product.id,
    internalSku: product.internalSku,
    name: product.name,
    shortDescription: product.shortDescription,
    uom: product.uom,
    status: product.status,
    categoryName: product.categoryName,
    listPrice: product.listPrice,
    landedCost: canViewCosts ? product.landedCost : null,
    marginPct,
    belowMinMargin,
  };
}
