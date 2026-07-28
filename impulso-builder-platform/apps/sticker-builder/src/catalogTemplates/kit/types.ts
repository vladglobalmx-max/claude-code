import type { Project } from "@impulso/document-schema";
import type { TemplateDifficulty, TemplateShape } from "@impulso/template-library";

/**
 * Un template del catálogo de contenido de THÖREN (`TEMPLATE_CATALOG_v1.md`,
 * 63 templates especificados en `docs/product/TEMPLATE_BATCH_01.md` a
 * `TEMPLATE_BATCH_13.md`) — distinto de `BuiltInTemplateSeed`
 * (`builtInTemplates.ts`), que solo describe un tamaño/forma en blanco.
 * Aquí `buildProject` construye el `Project` completo con su contenido de
 * diseño real (tipografía, layout, paleta), no solo la línea de corte.
 *
 * Vive en `kit/` (no en `catalogTemplates/index.ts`, donde se definía
 * originalmente durante el piloto) para que `descriptorFactory.ts` pueda
 * importarlo sin crear un ciclo con `index.ts` — `index.ts` re-exporta
 * este tipo para que ningún import externo existente se rompa.
 */
export interface CatalogTemplateSeed {
  /** Id fijo y estable del catálogo — mismo criterio de idempotencia que
   * `BuiltInTemplateSeed.id` (ver `seedBuiltInTemplates`). */
  id: string;
  name: string;
  description?: string;
  tags: string[];
  category: string;
  shape: TemplateShape;
  difficulty: TemplateDifficulty;
  targetAudience?: string;
  useCase?: string;
  suggestedColors?: string[];
  buildProject: (options: { now: string; generateId: () => string }) => Project;
}
