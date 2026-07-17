import { z } from "zod";

/**
 * Bolsa de datos por plugin, indexada por el id del plugin dueño del dato
 * (ej. "sticker-builder"). El Document Schema no conoce ni valida la forma
 * interna de cada entrada — cada plugin es responsable de validar su propio
 * payload con su propio esquema Zod antes de escribir aquí. `unknown` (no
 * `any`) fuerza a quien lea el valor a comprobar su forma antes de usarlo.
 */
export const PluginDataSchema = z.record(z.string(), z.unknown()).default({});
export type PluginData = z.infer<typeof PluginDataSchema>;
