import { z } from "zod";
import { JsonValueSchema } from "../primitives/json.js";

/**
 * Propiedades libres definidas por el usuario final (no por un plugin de
 * módulo) — por ejemplo, anotaciones o datos de integración que Impulso no
 * modela todavía. A diferencia de `PluginData`, no está namespaced por
 * plugin: es una única bolsa plana de clave/valor JSON.
 */
export const CustomPropertiesSchema = z
  .record(z.string(), JsonValueSchema)
  .default({});
export type CustomProperties = z.infer<typeof CustomPropertiesSchema>;
