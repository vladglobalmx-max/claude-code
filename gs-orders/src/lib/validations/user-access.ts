import { z } from "zod";

const baseUserAccessFields = {
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  role: z.enum(["admin", "vendedor"]),
  salesperson_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
};

/** VENDEDOR requiere salesperson_id obligatorio; ADMIN lo deja vacío (opcional). */
function requireSalespersonForVendedor<T extends { role: string; salesperson_id?: string | null }>(data: T) {
  return data.role !== "vendedor" || !!data.salesperson_id;
}

export const createUserAccessSchema = z
  .object({
    ...baseUserAccessFields,
    email: z.string().trim().email("Correo inválido"),
  })
  .refine(requireSalespersonForVendedor, {
    message: "Selecciona un vendedor asociado",
    path: ["salesperson_id"],
  });

export const updateUserAccessSchema = z
  .object(baseUserAccessFields)
  .refine(requireSalespersonForVendedor, {
    message: "Selecciona un vendedor asociado",
    path: ["salesperson_id"],
  });

export type CreateUserAccessPayload = z.infer<typeof createUserAccessSchema>;
export type UpdateUserAccessPayload = z.infer<typeof updateUserAccessSchema>;
