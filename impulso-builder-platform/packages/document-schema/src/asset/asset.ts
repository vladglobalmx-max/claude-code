import { z } from "zod";
import { AssetIdSchema } from "../primitives/identifiers.js";
import { MetadataSchema } from "../common/metadata.js";

export const AssetTypeSchema = z.enum(["image", "font"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

/**
 * Un Asset es una REFERENCIA a un recurso (imagen o fuente), no el recurso
 * en sí. Los bytes reales (el blob de la imagen, el archivo de la fuente)
 * viven donde el Engine decida almacenarlos (IndexedDB hoy, un bucket
 * remoto mañana) — ese es un detalle de `Persistence`, fuera de este
 * paquete. Guardar el binario aquí rompería "TypeScript puro, sin Browser
 * APIs": un Blob es un tipo del DOM.
 */
export const AssetSchema = z
  .object({
    id: AssetIdSchema,
    type: AssetTypeSchema,
    name: z.string().min(1),
    mimeType: z.string().min(1),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fontFamily: z.string().min(1).optional(),
    metadata: MetadataSchema,
  })
  .superRefine((asset, ctx) => {
    if (asset.type === "image" && (asset.width === undefined || asset.height === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un Asset de type "image" requiere "width" y "height".',
        path: ["width"],
      });
    }
    if (asset.type === "font" && asset.fontFamily === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un Asset de type "font" requiere "fontFamily".',
        path: ["fontFamily"],
      });
    }
  });
export type Asset = z.infer<typeof AssetSchema>;
