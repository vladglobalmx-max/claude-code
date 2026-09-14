import { z } from "zod";

/**
 * Línea de una Sales Order — espejo de las constraints de
 * `sales_order_items` (0067_sales_orders_mvp.sql: quantity > 0,
 * unit_price >= 0, discount/tax entre 0 y 100). line_subtotal/line_total NO
 * se validan ni se envían aquí: los calcula exclusivamente
 * rpc_create_sales_order/rpc_update_sales_order. Una línea libre (sin
 * catalog_product_id) debe traer sku_snapshot — el RPC repite esta misma
 * validación como capa 3 real, esto es solo capa 2 (mensaje sin viaje
 * redondo).
 */
export const salesOrderItemSchema = z
  .object({
    catalog_product_id: z.string().uuid().nullable().optional(),
    sku_snapshot: z.string().trim().optional(),
    description_snapshot: z.string().trim().optional(),
    uom_snapshot: z.string().trim().optional(),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
    unit_price: z.coerce.number().min(0, "El precio no puede ser negativo"),
    discount: z.coerce.number().min(0, "El descuento no puede ser negativo").max(100, "El descuento no puede ser mayor a 100%").default(0),
    tax: z.coerce.number().min(0, "El impuesto no puede ser negativo").max(100, "El impuesto no puede ser mayor a 100%").default(0),
    estimated_unit_cost: z.coerce.number().min(0).optional(),
    estimated_margin: z.coerce.number().optional(),
  })
  .refine((item) => !!item.catalog_product_id || !!(item.sku_snapshot && item.sku_snapshot.length > 0), {
    message: "Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia",
    path: ["sku_snapshot"],
  });

/**
 * Payload que arma el Sales Order Builder para rpc_create_sales_order/
 * rpc_update_sales_order. salesperson_id solo lo lee rpc_create_sales_order
 * (rpc_update_sales_order lo ignora — inmutable una vez creada la SO, ver
 * trg_prevent_sales_order_identity_change); se valida siempre igual, es
 * cada acción de servidor la que decide qué enviar.
 */
export const salesOrderPayloadSchema = z.object({
  customer_id: z.string().uuid("Selecciona un cliente"),
  salesperson_id: z.string().uuid("Selecciona un vendedor"),
  currency: z.enum(["MXN", "USD"], { errorMap: () => ({ message: "Selecciona una moneda" }) }),
  exchange_rate: z.coerce.number().positive().optional(),
  payment_terms: z.string().trim().optional(),
  // THÖREN Financial Release (0068) — clasificación estructurada de la
  // condición de pago, obligatoria (gatea qué camino de liberación
  // financiera aplica). payment_required_amount solo tiene efecto real
  // para 'advance'/'custom': el servidor lo fuerza al total para 'cash' y
  // a NULL para 'credit' (ver rpc_create_sales_order/rpc_update_sales_order).
  payment_terms_type: z.enum(["cash", "credit", "advance", "custom"], {
    errorMap: () => ({ message: "Selecciona un tipo de condición de pago" }),
  }),
  payment_required_amount: z.coerce.number().min(0, "El monto requerido no puede ser negativo").optional(),
  requested_delivery_date: z.string().trim().optional(),
  billing_address_snapshot: z.string().trim().optional(),
  shipping_address_snapshot: z.string().trim().optional(),
  commercial_notes: z.string().trim().optional(),
  internal_notes: z.string().trim().optional(),
  items: z.array(salesOrderItemSchema).default([]),
});

/**
 * Payload de rpc_register_sales_order_payment (0068). El monto debe ser
 * mayor a cero — el RPC repite esta validación como capa 3 real.
 */
export const salesOrderPaymentSchema = z.object({
  amount: z.coerce.number().positive("El monto del pago debe ser mayor a cero"),
  note: z.string().trim().optional(),
});

/**
 * Payload de rpc_set_sales_order_financial_hold (0068). El motivo es
 * obligatorio — el RPC repite esta validación como capa 3 real.
 */
export const salesOrderFinancialHoldSchema = z.object({
  reason: z.string().trim().min(1, "Debes indicar un motivo para bloquear financieramente esta Sales Order"),
});

export type SalesOrderItemPayload = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderPayload = z.infer<typeof salesOrderPayloadSchema>;
export type SalesOrderPaymentPayload = z.infer<typeof salesOrderPaymentSchema>;
export type SalesOrderFinancialHoldPayload = z.infer<typeof salesOrderFinancialHoldSchema>;
