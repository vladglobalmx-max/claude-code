import { z } from "zod";
import {
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  AssetIdSchema,
  PageSchema,
  LayerSchema,
  SceneObjectSchema,
  SceneObjectBaseSchema,
  AssetSchema,
  TransformSchema,
  StyleSchema,
  MetadataSchema,
  PointSchema,
  TextAlignSchema,
  GridConfigSchema,
} from "@impulso/document-schema";
import { EntityRefSchema } from "./entityRef.js";
import { RESIZE_HANDLES } from "../geometry/resizeMath.js";

export { EntityRefSchema, type EntityRef } from "./entityRef.js";

/** Los 8 handles de resize válidos como comando — mismo set que `RESIZE_HANDLES`. */
export const ResizeHandleSchema = z.enum(RESIZE_HANDLES);

/**
 * Comandos que cambian contenido persistido (pages/layers/objects/
 * metadata). Cada uno corresponde 1:1 a una operación estructural del
 * Document Schema — no hay nada aquí específico de Sticker Builder.
 */
export const ContentCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addPage"), page: PageSchema, index: z.number().int().nonnegative().optional() }),
  z.object({ type: z.literal("removePage"), pageId: PageIdSchema }),
  z.object({ type: z.literal("reorderPages"), pageIds: z.array(PageIdSchema) }),
  /**
   * Configuración de Grid por Page (Epic 7 / Fase 7.3 — Assisted
   * Placement). Separado de `updateMetadata` porque `grid` no es parte de
   * `Metadata` — es un campo propio de `Page`, mismo criterio que
   * `updateTextStyle` está separado de `updateObjectStyle`.
   */
  z.object({
    type: z.literal("updatePageGrid"),
    pageId: PageIdSchema,
    grid: GridConfigSchema.partial(),
  }),

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

  z.object({
    type: z.literal("resizeObject"),
    objectId: ObjectIdSchema,
    handle: ResizeHandleSchema,
    pointerDelta: PointSchema,
    intrinsicSize: z.object({ width: z.number().positive(), height: z.number().positive() }),
    maintainAspectRatio: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("rotateObject"),
    objectId: ObjectIdSchema,
    pointerAngleDegrees: z.number(),
    snapToIncrement: z.boolean().optional(),
  }),

  z.object({
    type: z.literal("updateObjectContent"),
    objectId: ObjectIdSchema,
    content: z.string(),
  }),

  /**
   * Solo aplica a `TextObject` (fontFamily/fontSize/textAlign) — separado
   * de `updateObjectStyle` (fill/stroke/opacity, genérico a cualquier
   * tipo) porque son campos propios de `TextObjectSchema`, no de
   * `StyleSchema`. Ver Epic 7 / Fase 7.1 (Professional Design Experience):
   * antes de este comando, estos tres campos existían en el Inspector sin
   * ningún efecto real.
   */
  z.object({
    type: z.literal("updateTextStyle"),
    objectId: ObjectIdSchema,
    textStyle: z.object({
      fontFamily: z.string().min(1).optional(),
      fontSize: z.number().positive().optional(),
      textAlign: TextAlignSchema.optional(),
    }),
  }),

  z.object({
    type: z.literal("groupObjects"),
    objectIds: z.array(ObjectIdSchema).min(2),
    /**
     * El Engine nunca inventa identidad ni timestamps para contenido nuevo
     * (mismo principio que `addObject`): quien despacha el comando ya trae
     * el id, transform, style, metadata, etc. del Group a crear. `children`
     * no se incluye aquí — el reducer lo completa con los objects que
     * `objectIds` referencia, en su orden real dentro de la layer.
     */
    group: SceneObjectBaseSchema,
  }),
  z.object({
    type: z.literal("ungroupObject"),
    objectId: ObjectIdSchema,
  }),

  /**
   * Asset Library: `document.assets` es el registro de descriptores de
   * Asset del documento (nunca el binario — ver `@impulso/document-schema`
   * `asset/base.ts`). Estos tres comandos son genéricos sobre `AssetSchema`
   * (la unión completa) — agregar un tipo de Asset nuevo (plantilla, ícono,
   * patrón...) no requiere ningún comando nuevo, solo una variante nueva de
   * la unión del Document Schema.
   */
  z.object({ type: z.literal("addAsset"), asset: AssetSchema }),
  z.object({ type: z.literal("removeAsset"), assetId: AssetIdSchema }),
  z.object({ type: z.literal("renameAsset"), assetId: AssetIdSchema, name: z.string().min(1) }),
]);
export type ContentCommand = z.infer<typeof ContentCommandSchema>;

/**
 * Comandos que solo cambian la selección — estado efímero de sesión, no
 * contenido persistido. No pasan por el pipeline de versionado/historial
 * de Document (ver applyCommand.ts) y no son deshacibles con undo/redo:
 * deshacer no debería "reseleccionar" algo por el usuario.
 *
 * `toggleObjectSelection` es lo que habilita selección múltiple (ej. vía
 * Shift-click): agrega el id a la selección si no estaba, lo quita si ya
 * estaba. Vive aquí (Engine) y no en el Renderer a propósito — el
 * Renderer solo sabe "hubo un click, y la tecla Shift estaba o no
 * presionada"; decidir qué le pasa a la selección como resultado es
 * lógica de dominio, no traducción de eventos (ver ADR-0006).
 */
export const SelectionCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setSelection"), objectIds: z.array(ObjectIdSchema) }),
  z.object({ type: z.literal("clearSelection") }),
  z.object({ type: z.literal("toggleObjectSelection"), objectId: ObjectIdSchema }),
]);
export type SelectionCommand = z.infer<typeof SelectionCommandSchema>;

export const EngineCommandSchema = z.union([ContentCommandSchema, SelectionCommandSchema]);
export type EngineCommand = ContentCommand | SelectionCommand;

export function isSelectionCommand(command: EngineCommand): command is SelectionCommand {
  return (
    command.type === "setSelection" ||
    command.type === "clearSelection" ||
    command.type === "toggleObjectSelection"
  );
}
