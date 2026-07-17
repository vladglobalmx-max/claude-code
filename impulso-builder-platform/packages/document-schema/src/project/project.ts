import { z } from "zod";
import { ProjectIdSchema } from "../primitives/identifiers.js";
import { DocumentSchema } from "../document/document.js";
import { MetadataSchema } from "../common/metadata.js";
import { PluginDataSchema } from "../common/pluginData.js";
import { CustomPropertiesSchema } from "../common/customProperties.js";

/**
 * Project es la raíz persistida: "un proyecto de Sticker Builder", "un
 * proyecto de Planner Builder". `moduleId` identifica qué módulo es dueño
 * del proyecto (ej. "sticker-builder") — el Document Schema no sabe nada
 * más sobre ese módulo; es solo una etiqueta que el Engine y la UI usan
 * para enrutar a los plugins correctos.
 */
export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  moduleId: z.string().min(1),
  document: DocumentSchema,
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type Project = z.infer<typeof ProjectSchema>;
