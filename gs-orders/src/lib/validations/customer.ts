import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const customerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  legal_name: optionalText,
  tax_id: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Email inválido"),
  phone: optionalText,
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
