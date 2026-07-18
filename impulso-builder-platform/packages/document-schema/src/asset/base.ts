import { z } from "zod";
import { AssetIdSchema } from "../primitives/identifiers.js";
import { MetadataSchema } from "../common/metadata.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";

/**
 * Campos comunes a todo tipo de Asset — mismo patrón que
 * `SceneObjectBaseSchema` (object/base.ts): se define una vez y cada tipo
 * concreto (`ImageAssetSchema`, `FontAssetSchema`, y los que se agreguen
 * más adelante — plantillas, íconos, patrones, fondos, texturas, marcos,
 * mockups, assets generados por IA...) lo extiende con `.extend({...})`.
 * `pluginData`/`customProperties` existen desde el día uno (aunque ningún
 * tipo de Asset los use todavía) por la misma razón que ya existen en
 * Project/Document/Page/Layer/Object: un lugar ya reservado para lo que un
 * tipo futuro necesite, sin otro cambio de esquema — ver ADR de esta
 * épica, "Asset Library como pilar de la plataforma".
 */
export const AssetBaseSchema = z.object({
  id: AssetIdSchema,
  name: z.string().min(1),
  mimeType: z.string().min(1),
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type AssetBase = z.infer<typeof AssetBaseSchema>;
