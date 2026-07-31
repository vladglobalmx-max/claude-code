import type { z } from "zod";

/**
 * Cuatro funciones genéricas — no doce funciones bespoke, una por entidad.
 * Cualquier entidad del Document Schema (Style, Asset, Layer, Page...)
 * puede validar/serializar/deserializar/clonar con estas mismas cuatro
 * funciones más su propio esquema Zod exportado. Document y Project tienen
 * además sus propias envolturas (ver documentSerialization.ts /
 * projectSerialization.ts) porque son las únicas dos entidades que
 * requieren migración de versión antes de validar.
 *
 * Se usa `S extends z.ZodTypeAny` + `z.infer<S>` (en vez de anotar
 * `schema: z.ZodType<T>`) porque, en presencia de campos con `.default()`,
 * el tipo de "entrada" de un esquema Zod es más permisivo que su tipo de
 * "salida" — anotar `z.ZodType<T>` (que asume entrada === salida) rechaza
 * en tiempo de compilación esquemas perfectamente válidos como
 * `DocumentSchema`. Inferir `S` directamente evita ese desajuste.
 */

export function validateWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): z.infer<S> {
  return schema.parse(value) as z.infer<S>;
}

export function serializeWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  value: z.infer<S>,
): string {
  return JSON.stringify(schema.parse(value));
}

export function deserializeWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  raw: string,
): z.infer<S> {
  return schema.parse(JSON.parse(raw)) as z.infer<S>;
}

export function cloneWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  value: z.infer<S>,
): z.infer<S> {
  const validated = schema.parse(value);
  return schema.parse(JSON.parse(JSON.stringify(validated))) as z.infer<S>;
}
