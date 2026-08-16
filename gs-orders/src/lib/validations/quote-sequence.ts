import { z } from "zod";

/**
 * Espejo exacto de las constraints de `salesperson_quote_sequences.quote_prefix`
 * (ver 0020_core_quotes.sql: quote_prefix_format/quote_prefix_charset/
 * quote_prefix_length) — mayúsculas forzadas, charset ^[A-Z0-9-]+$, 1-20
 * caracteres. La DB sigue siendo la autoridad final (esto es solo para dar
 * un mensaje legible antes de llegar al INSERT/UPDATE); no se inventa
 * ninguna regla nueva ni se relaja ninguna existente.
 */
const cleanPrefix = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : value;

const quotePrefixSchema = z.preprocess(
  cleanPrefix,
  z
    .string()
    .min(1, "El prefijo es obligatorio")
    .max(20, "El prefijo debe tener máximo 20 caracteres")
    .regex(/^[A-Z0-9-]+$/, "El prefijo solo puede tener letras, números y guiones, sin espacios")
);

/** Alta de una configuración Salesperson × Business Unit nueva. */
export const createQuoteSequenceSchema = z.object({
  salesperson_id: z.string().uuid("Selecciona un vendedor"),
  business_unit_id: z.string().uuid("Selecciona una Business Unit"),
  quote_prefix: quotePrefixSchema,
});

/**
 * Edición: solo prefijo y activo/inactivo (ver AJUSTE 1 — sequence_current
 * es propiedad exclusiva del motor de folios, nunca editable desde esta
 * pantalla; salesperson_id/business_unit_id identifican la fila y tampoco
 * se reasignan desde aquí).
 */
export const updateQuoteSequenceSchema = z.object({
  quote_prefix: quotePrefixSchema,
  active: z.boolean().default(true),
});

export type CreateQuoteSequenceValues = z.infer<typeof createQuoteSequenceSchema>;
export type UpdateQuoteSequenceValues = z.infer<typeof updateQuoteSequenceSchema>;
