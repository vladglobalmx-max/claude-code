import { z } from "zod";

export const salespersonSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  prefix: z
    .string()
    .trim()
    .min(2, "El prefijo debe tener al menos 2 caracteres")
    .max(8, "El prefijo debe tener máximo 8 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "El prefijo solo puede tener letras y números")
    .transform((v) => v.toUpperCase()),
  sequence_current: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export type SalespersonFormValues = z.infer<typeof salespersonSchema>;
