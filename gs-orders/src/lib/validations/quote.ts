import { z } from "zod";

/**
 * Línea de una Quote — espejo de las constraints de `quote_items`
 * (0020_core_quotes.sql: quantity > 0, unit_price >= 0,
 * line_discount_percent entre 0 y 100). line_subtotal NO se valida ni se
 * envía aquí: lo calcula exclusivamente rpc_create_quote/rpc_update_quote.
 */
export const quoteItemSchema = z.object({
  catalog_product_id: z.string().uuid().nullable().optional(),
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
  unit_price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  line_discount_percent: z.coerce
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(100, "El descuento no puede ser mayor a 100%")
    .default(0),
});

/**
 * Payload que arma el Quote Builder para rpc_create_quote/rpc_update_quote.
 * business_unit_id/salesperson_id/quote_date solo los lee rpc_create_quote
 * (rpc_update_quote los ignora — no se pueden cambiar una vez generado el
 * folio, ver trg_prevent_quote_folio_change); se validan siempre igual y es
 * la propia acción de servidor la que decide cuáles enviar según cree o
 * edite.
 */
export const quotePayloadSchema = z.object({
  business_unit_id: z.string().uuid("Selecciona una Business Unit"),
  salesperson_id: z.string().uuid("Selecciona un vendedor"),
  customer_id: z.string().uuid("Selecciona un cliente"),
  quote_date: z.string().optional(),
  currency: z.enum(["MXN", "USD"], { errorMap: () => ({ message: "Selecciona una moneda" }) }),
  tax_rate: z.coerce.number().min(0).max(100).default(16),
  global_discount_percent: z.coerce.number().min(0).max(100).default(0),
  valid_until: z.string().min(1, "La vigencia es obligatoria"),
  notes: z.string().trim().optional(),
  items: z.array(quoteItemSchema).min(1, "Agrega al menos un producto"),
});

export type QuoteItemPayload = z.infer<typeof quoteItemSchema>;
export type QuotePayload = z.infer<typeof quotePayloadSchema>;
