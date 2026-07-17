import { z } from "zod";
import {
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  PageSchema,
  LayerSchema,
  SceneObjectSchema,
  TransformSchema,
  StyleSchema,
  MetadataSchema,
} from "@impulso/document-schema";
import { EntityRefSchema } from "./entityRef.js";

export { EntityRefSchema, type EntityRef } from "./entityRef.js";

/**
 * Comandos que cambian contenido persistido (pages/layers/objects/
 * metadata). Cada uno corresponde 1:1 a una operación estructural del
 * Document Schema — no hay nada aquí específico de Sticker Builder.
 */
export const ContentCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addPage"), page: PageSchema, index: z.number().int().nonnegative().optional() }),
  z.object({ type: z.literal("removePage"), pageId: PageIdSchema }),
  z.object({ type: z.literal("reorderPages"), pageIds: z.array(PageIdSchema) }),

  z.object({
    type: z.literal("addLayer"),
    pageId: PageIdSchema,
    layer: LayerSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("removeLayer"), pageId: PageIdSchema, layerId: LayerIdSchema }),
  z.object({
    type: z.literal("reorderLayers"),
    pageId: PageIdSchema,
    layerIds: z.array(LayerIdSchema),
  }),

  z.object({
    type: z.literal("addObject"),
    pageId: PageIdSchema,
    layerId: LayerIdSchema,
    object: SceneObjectSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("removeObject"), objectId: ObjectIdSchema }),
  z.object({
    type: z.literal("updateObjectTransform"),
    objectId: ObjectIdSchema,
    transform: TransformSchema.partial(),
  }),
  z.object({
    type: z.literal("updateObjectStyle"),
    objectId: ObjectIdSchema,
    style: StyleSchema.partial(),
  }),
  z.object({
    type: z.literal("reorderObjects"),
    pageId: PageIdSchema,
    layerId: LayerIdSchema,
    objectIds: z.array(ObjectIdSchema),
  }),

  z.object({
    type: z.literal("updateMetadata"),
    target: EntityRefSchema,
    metadata: MetadataSchema.partial(),
  }),
]);
export type ContentCommand = z.infer<typeof ContentCommandSchema>;

/**
 * Comandos que solo cambian la selección — estado efímero de sesión, no
 * contenido persistido. No pasan por el pipeline de versionado/historial
 * de Document (ver applyCommand.ts) y no son deshacibles con undo/redo:
 * deshacer no debería "reseleccionar" algo por el usuario.
 */
export const SelectionCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setSelection"), objectIds: z.array(ObjectIdSchema) }),
  z.object({ type: z.literal("clearSelection") }),
]);
export type SelectionCommand = z.infer<typeof SelectionCommandSchema>;

export const EngineCommandSchema = z.union([ContentCommandSchema, SelectionCommandSchema]);
export type EngineCommand = ContentCommand | SelectionCommand;

export function isSelectionCommand(command: EngineCommand): command is SelectionCommand {
  return command.type === "setSelection" || command.type === "clearSelection";
}
