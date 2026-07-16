import { z } from "zod";

export const taxSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, "2 a 20 caracteres: letras, números, guiones"),
  name: z.string().trim().min(2, "Requerido").max(80),
  ratePct: z
    .string()
    .trim()
    .min(1, "Requerido")
    .refine((value) => !Number.isNaN(Number(value)), "Debe ser un número")
    .transform((value) => Number(value))
    .refine((value) => value >= 0 && value <= 100, "Debe estar entre 0 y 100"),
});

export type TaxFormValues = z.infer<typeof taxSchema>;
