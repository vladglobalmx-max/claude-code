import { z } from "zod";

export const quotationHeaderSchema = z.object({
  businessUnitId: z.string().uuid(),
  customerId: z.string().uuid("Selecciona un cliente"),
  taxId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().uuid().nullable()),
  validUntil: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === "" ? null : value)),
});

export const quotationItemSchema = z.object({
  productId: z.string().uuid("Selecciona un producto"),
  qty: z
    .string()
    .trim()
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1, {
      message: "La cantidad debe ser un entero de al menos 1",
    })
    .transform((value) => Number(value)),
  discountPct: z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value))
    .refine((value) => !Number.isNaN(Number(value)), "Debe ser un número")
    .transform((value) => Number(value))
    .refine((value) => value >= 0 && value <= 100, "El descuento debe estar entre 0 y 100"),
});

export type QuotationHeaderFormValues = z.infer<typeof quotationHeaderSchema>;
export type QuotationItemFormValues = z.infer<typeof quotationItemSchema>;
