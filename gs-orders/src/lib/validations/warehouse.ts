import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  code: z.string().trim().min(1, "El código es obligatorio"),
  location: optionalText,
  notes: optionalText,
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;
