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

/**
 * Configuración de Grid por Page (Epic 7 / Fase 7.3 — Assisted Placement).
 * `visible` (mostrar la grilla) y `snapEnabled` (ajustar a ella al mover/
 * redimensionar) son deliberadamente independientes: ver una grilla y que
 * el snap la use son dos capacidades distintas, cada combinación es válida
 * (grilla oculta con snap activo, grilla visible sin snap, etc.).
 *
 * `size` vive siempre en la unidad canónica interna (px — el mismo espacio
 * numérico que `Transform.x/y`, independiente de `Page.unit`); la UI la
 * muestra/edita en `page.unit` vía `toPixels`/`fromPixels`, igual que
 * cualquier otro campo de longitud del Inspector (ver Fase 7.1). Rechaza
 * 0/negativo/NaN/Infinity por el propio schema (`positive().finite()`).
 *
 * `type` reserva una estructura extensible para futuros estilos de grid
 * (ej. isométrica, puntos) sin necesitar otro cambio de schema — hoy solo
 * existe `"lines"`; agregar un tipo nuevo requerirá lógica de render nueva,
 * no solo declarar el literal.
 */
export const GridTypeSchema = z.enum(["lines"]);
export type GridType = z.infer<typeof GridTypeSchema>;

export const GridConfigSchema = z.object({
  visible: z.boolean().default(false),
  snapEnabled: z.boolean().default(false),
  size: z.number().positive().finite().default(10),
  type: GridTypeSchema.default("lines"),
});
export type GridConfig = z.infer<typeof GridConfigSchema>;

export const PageSchema = z.object({
  id: PageIdSchema,
  size: SizeSchema,
  unit: UnitSchema.default("px"),
  layers: z.array(LayerSchema).default([]),
  /** Aditivo vía `.default({})` — mismo mecanismo que `unit`/`layers`: un
   * documento guardado antes de esta fase sigue siendo válido sin ninguna
   * migración de `schemaVersion` (ver ADR de Assisted Placement). */
  grid: GridConfigSchema.default({}),
  metadata: MetadataSchema,
  pluginData: PluginDataSchema,
  customProperties: CustomPropertiesSchema,
});
export type Page = z.infer<typeof PageSchema>;
