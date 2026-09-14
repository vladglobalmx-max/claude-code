import { z } from "zod";

/**
 * Payload que arma el formulario de Nueva Comisión para
 * rpc_create_commission_record (0073_commissions_mvp.sql).
 * sales_order_id lo resuelve la página desde ?sales_order_id= — no lo
 * captura el usuario. commission_base es opcional: si se deja vacío, el
 * RPC usa el subtotal de la Sales Order por defecto.
 */
export const commissionPayloadSchema = z.object({
  sales_order_id: z.string().uuid("Selecciona la Sales Order de origen"),
  salesperson_id: z.string().uuid("Selecciona el vendedor"),
  commission_rate: z.coerce.number().min(0, "El porcentaje no puede ser negativo").max(100, "El porcentaje no puede superar 100"),
  commission_base: z.coerce.number().min(0, "La base no puede ser negativa").optional(),
  notes: z.string().trim().optional(),
});

/** Payload de registro de pago para rpc_register_commission_payment. */
export const commissionPaymentPayloadSchema = z.object({
  amount: z.coerce.number().positive("El monto del pago debe ser mayor a cero"),
  notes: z.string().trim().optional(),
});

/** Payload de cancelación para rpc_cancel_commission_record — motivo obligatorio (no blanco). */
export const commissionCancelPayloadSchema = z.object({
  reason: z.string().trim().min(1, "Indica el motivo de la cancelación"),
});

export type CommissionPayload = z.infer<typeof commissionPayloadSchema>;
export type CommissionPaymentPayload = z.infer<typeof commissionPaymentPayloadSchema>;
export type CommissionCancelPayload = z.infer<typeof commissionCancelPayloadSchema>;
