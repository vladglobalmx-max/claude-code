import { z } from "zod";

export const clientFormSchema = z.object({
  legal_name: z.string().min(2, "Requerido"),
  trade_name: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  employees_count: z.coerce.number().int().nonnegative().optional(),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  business_unit_id: z.string().uuid("Selecciona una unidad de negocio"),
  status: z.enum(["active", "inactive", "prospect"]).default("prospect"),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
