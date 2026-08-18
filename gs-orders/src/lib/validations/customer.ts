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

export const customerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  legal_name: optionalText,
  tax_id: optionalText,
  email: optionalEmail,
  phone: optionalText,
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

/**
 * Alta de Customer con un contacto opcional (alta inline desde Cotizaciones
 * — ver customer-inline-create-dialog.tsx — e importación Excel). Semántica
 * aprobada (ver 0021_core_customer_contacts.sql): si `contact_name` viene
 * con valor, email/phone pertenecen al contacto (customer_contacts), NO al
 * Customer; si `contact_name` está vacío, email/phone pertenecen al
 * Customer directamente y no se crea ningún contacto.
 */
export const customerWithContactSchema = customerSchema.extend({
  contact_name: optionalText,
});

export type CustomerWithContactFormValues = z.infer<typeof customerWithContactSchema>;

/** Alta/edición directa de un contacto ya existente (gestión en /clientes/[id]/editar). */
export const customerContactSchema = z.object({
  name: z.string().trim().min(1, "El nombre del contacto es obligatorio"),
  email: optionalEmail,
  phone: optionalText,
});

export type CustomerContactFormValues = z.infer<typeof customerContactSchema>;
