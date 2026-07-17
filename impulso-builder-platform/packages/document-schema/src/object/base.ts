import { z } from "zod";
import { ObjectIdSchema } from "../primitives/identifiers.js";
import { TransformSchema } from "../primitives/geometry.js";
import { StyleSchema } from "../style/style.js";
import { MetadataSchema } from "../common/metadata.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";

/**
 * Campos comunes a todo tipo de Object. Se define una sola vez y cada tipo
 * concreto (`RectangleObjectSchema`, `TextObjectSchema`...) lo extiende con
 * `.extend({...})` — evita repetir estos seis campos seis veces.
 */
export const SceneObjectBaseSchema = z.object({
  id: ObjectIdSchema,
  transform: TransformSchema,
  style: StyleSchema,
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type SceneObjectBase = z.infer<typeof SceneObjectBaseSchema>;
