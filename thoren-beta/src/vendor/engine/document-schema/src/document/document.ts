import { z } from "zod";
import { DocumentIdSchema } from "../primitives/identifiers.js";
import { PageSchema } from "../page/page.js";
import { MetadataSchema } from "../common/metadata.js";
import { DocumentHistorySchema } from "../history/history.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";
import { AssetSchema } from "../asset/asset.js";

/**
 * Document es la unidad que se versiona y migra. `schemaVersion` describe
 * con qué forma de Document Schema fue escrito por última vez (y contra
 * cuál se valida); `documentVersion` es la revisión lógica del contenido en
 * sí (incrementa con cada guardado), independiente del schema.
 *
 * `assets` es el REGISTRO de Assets del documento (descriptores, nunca el
 * binario — ver `asset/base.ts`) — vive en Document, no en Project, porque
 * es contenido versionado/deshacible igual que `pages`, no metadata de
 * sesión. `.default([])` es aditivo: un Document guardado antes de que
 * este campo existiera sigue siendo válido sin ninguna migración de
 * `schemaVersion`.
 */
export const DocumentSchema = z.object({
  id: DocumentIdSchema,
  schemaVersion: z.number().int().positive(),
  documentVersion: z.number().int().positive().default(1),
  pages: z.array(PageSchema).min(1),
  assets: z.array(AssetSchema).default([]),
  metadata: MetadataSchema,
  history: DocumentHistorySchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type Document = z.infer<typeof DocumentSchema>;
