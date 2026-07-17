import { z } from "zod";

/**
 * Un color se guarda como string (hex `#rrggbb`, `rgba(...)`, o cualquier
 * notación que el módulo consumidor elija). El Document Schema no impone un
 * formato concreto de color: eso acoplaría el esquema a supuestos de
 * renderizado. Solo exige que no esté vacío.
 */
const ColorSchema = z.string().min(1);

export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
]);
export type BlendMode = z.infer<typeof BlendModeSchema>;

export const ShadowSchema = z.object({
  color: ColorSchema,
  blur: z.number().nonnegative(),
  offsetX: z.number(),
  offsetY: z.number(),
});
export type Shadow = z.infer<typeof ShadowSchema>;

/** Estilo visual genérico, compartido por todos los tipos de Object. */
export const StyleSchema = z.object({
  fill: ColorSchema.optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().nonnegative().default(0),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: BlendModeSchema.default("normal"),
  shadow: ShadowSchema.optional(),
});
export type Style = z.infer<typeof StyleSchema>;
