import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

/** `code` es inmutable una vez creada la línea — nunca aparece en el schema de edición. */
export const businessUnitCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, "2 a 5 letras mayúsculas (ej. TSS, GFB)"),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
});

export const businessUnitEditSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  legalName: optionalTrimmed(200),
  taxId: optionalTrimmed(20),
  address: optionalTrimmed(300),
  colorPrimary: optionalTrimmed(20),
  colorSecondary: optionalTrimmed(20),
  minMarginDefault: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (!Number.isNaN(value) && value >= 0 && value <= 99.99), {
      message: "Debe ser un porcentaje entre 0 y 99.99",
    }),
  folioNumberingMode: z.enum(["ANNUAL", "CONTINUOUS"]),
  active: z.boolean(),
});

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2, "Requerido").max(120),
  accountHolder: z.string().trim().min(2, "Requerido").max(200),
  accountNumber: z.string().trim().min(4, "Requerido").max(40),
  clabe: optionalTrimmed(18),
  currency: z.enum(["MXN", "USD"]),
});

export const termsAndConditionsSchema = z.object({
  content: z.string().trim().min(20, "El texto debe tener al menos 20 caracteres"),
});

export type BusinessUnitCreateFormValues = z.infer<typeof businessUnitCreateSchema>;
export type BusinessUnitEditFormValues = z.infer<typeof businessUnitEditSchema>;
export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;
export type TermsAndConditionsFormValues = z.infer<typeof termsAndConditionsSchema>;
