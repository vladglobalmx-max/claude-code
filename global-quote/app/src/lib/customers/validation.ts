import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalDecimal = (max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value))
    .refine((value) => !Number.isNaN(Number(value)), "Debe ser un número")
    .transform((value) => Number(value))
    .refine((value) => value >= 0 && value <= max, `Debe estar entre 0 y ${max}`);

/** Campos que puede capturar un Vendedor al crear un prospecto. */
export const prospectSchema = z.object({
  businessUnitId: z.string().uuid(),
  legalName: z.string().trim().min(3, "La razón social debe tener al menos 3 caracteres").max(200),
  tradeName: optionalText(200),
  taxId: optionalText(20),
  industry: optionalText(100),
  segment: optionalText(100),
  notes: optionalText(1000),
});

/** Campos adicionales que solo Administración/Super Admin pueden capturar. */
export const customerManagementSchema = z.object({
  assignedSellerId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  paymentTermsId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  priceListId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  creditLimit: optionalDecimal(100_000_000),
  authorizedDiscountPct: optionalDecimal(100),
  status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(200),
  position: optionalText(100),
  area: optionalText(100),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || z.string().email().safeParse(value).success, {
      message: "Correo inválido",
    }),
  phone: optionalText(30),
  whatsapp: optionalText(30),
  decisionPower: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.enum(["LOW", "MEDIUM", "HIGH"]).nullable()),
});

export type ProspectFormValues = z.infer<typeof prospectSchema>;
export type CustomerManagementFormValues = z.infer<typeof customerManagementSchema>;
export type ContactFormValues = z.infer<typeof contactSchema>;
