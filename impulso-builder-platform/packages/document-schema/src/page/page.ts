import { z } from "zod";
import { PageIdSchema } from "../primitives/identifiers.js";
import { SizeSchema } from "../primitives/geometry.js";
import { LayerSchema } from "../layer/layer.js";
import { MetadataSchema } from "../common/metadata.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";

/**
 * Unidad de "lienzo" del documento (tamaño físico/lógico propio). Sticker
 * Builder usará documentos de una sola Page; un futuro Planner Builder
 * tendrá muchas — el esquema no distingue entre esos casos de uso.
 */
export const UnitSchema = z.enum(["px", "mm", "in"]);
export type Unit = z.infer<typeof UnitSchema>;

export const PageSchema = z.object({
  id: PageIdSchema,
  size: SizeSchema,
  unit: UnitSchema.default("px"),
  layers: z.array(LayerSchema).default([]),
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type Page = z.infer<typeof PageSchema>;
