import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || z.string().email().safeParse(v).success, "Email inválido");

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  tax_id: optionalText,
  contact_name: optionalText,
  email: optionalEmail,
  phone: optionalText,
  preferred_currency: optionalText,
  notes: optionalText,
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
