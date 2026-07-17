import { z } from "zod";
import { LayerIdSchema } from "../primitives/identifiers.js";
import { SceneObjectSchema } from "../object/object.js";
import { MetadataSchema } from "../common/metadata.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";

/**
 * Una Layer es un contenedor ordenado de Objects dentro de una Page — el
 * equivalente a una capa de Photoshop, distinto del tipo de Object "group"
 * (que agrupa objetos entre sí para transformarlos juntos, no organiza el
 * documento en sí).
 */
export const LayerSchema = z.object({
  id: LayerIdSchema,
  objects: z.array(SceneObjectSchema).default([]),
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type Layer = z.infer<typeof LayerSchema>;
