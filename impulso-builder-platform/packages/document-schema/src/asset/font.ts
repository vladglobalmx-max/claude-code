import { z } from "zod";
import { AssetBaseSchema } from "./base.js";

/**
 * Declarado desde antes de esta épica, no implementado todavía (ningún
 * flujo de Impulso sube/gestiona fuentes hoy) — se conserva como el primer
 * ejemplo real de "agregar un tipo de Asset nuevo es una variante más de
 * la unión, no un rediseño" (ver `asset.ts` y el ADR de esta épica).
 */
export const FontAssetSchema = AssetBaseSchema.extend({
  type: z.literal("font"),
  fontFamily: z.string().min(1),
});
export type FontAsset = z.infer<typeof FontAssetSchema>;
