import { z } from "zod";

const cleanPrefix = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : value;

export const salespersonSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  prefix: z.preprocess(
    cleanPrefix,
    z
      .string()
      .min(2, "El prefijo debe tener al menos 2 caracteres")
      .max(5, "El prefijo debe tener máximo 5 caracteres")
      .regex(/^[A-Z0-9]+$/, "El prefijo solo puede tener letras y números, sin espacios")
  ),
  sequence_current: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export type SalespersonFormValues = z.infer<typeof salespersonSchema>;
