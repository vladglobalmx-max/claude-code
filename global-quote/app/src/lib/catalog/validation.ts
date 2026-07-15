import { z } from "zod";

const decimalString = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Requerido")
    .refine((value) => !Number.isNaN(Number(value)), "Debe ser un número")
    .transform((value) => Number(value))
    .refine((value) => value >= 0, "No puede ser negativo")
    .refine((value) => value <= max, `No puede ser mayor a ${max}`);

export const productCommercialSchema = z.object({
  businessUnitId: z.string().uuid(),
  categoryId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  internalSku: z
    .string()
    .trim()
    .min(3, "El SKU debe tener al menos 3 caracteres")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Solo letras, números, guiones y puntos"),
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(200),
  shortDescription: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value === "" ? null : value)),
  uom: z.string().trim().min(1).max(20),
  status: z.enum(["DRAFT", "ACTIVE", "DISCONTINUED"]),
});

export const productCostSchema = z
  .object({
    purchaseCost: decimalString(1_000_000),
    logisticsCost: decimalString(1_000_000),
    importExpenses: decimalString(1_000_000),
    targetMarginPct: decimalString(99.99),
    minMarginPct: decimalString(99.99),
  })
  .refine((data) => data.minMarginPct <= data.targetMarginPct, {
    message: "El margen mínimo no puede ser mayor al margen objetivo",
    path: ["minMarginPct"],
  });

export const priceListItemSchema = z.object({
  priceListId: z.string().uuid(),
  listPrice: decimalString(10_000_000),
});

export type ProductCommercialFormValues = z.infer<typeof productCommercialSchema>;
export type ProductCostFormValues = z.infer<typeof productCostSchema>;
export type PriceListItemFormValues = z.infer<typeof priceListItemSchema>;
