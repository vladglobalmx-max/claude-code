import type { Project } from "@impulso/document-schema";
import type { TemplateDescriptor, TemplateDifficulty, TemplateShape, TemplateStore } from "@impulso/template-library";
import { createSerumFacialPremiumProject } from "./serumFacialPremium.js";

/**
 * Un template del catálogo de contenido de THÖREN (`TEMPLATE_CATALOG_v1.md`,
 * 63 templates especificados en `docs/product/TEMPLATE_BATCH_01.md` a
 * `TEMPLATE_BATCH_13.md`) — distinto de `BuiltInTemplateSeed`
 * (`builtInTemplates.ts`), que solo describe un tamaño/forma en blanco.
 * Aquí `buildProject` construye el `Project` completo con su contenido de
 * diseño real (tipografía, layout, paleta), no solo la línea de corte.
 *
 * Este es el estándar de producción establecido por el piloto (Serum
 * Facial Premium, ver `THOREN_PILOT_TEMPLATE_STANDARD.md`) — cada uno de
 * los 62 templates restantes del catálogo se integra agregando una entrada
 * más a `CATALOG_TEMPLATES`, nunca modificando el mecanismo de siembra en
 * sí (`seedCatalogTemplates`, ya genérico).
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

/**
 * Metadata real tomada de `TEMPLATE_BATCH_02.md` (Template 7, catálogo
 * 2.1) y de `TEMPLATE_CATALOG_v1.md` — no inventada para el piloto. Es el
 * único template del catálogo de 63 integrado como código real hasta este
 * punto (Etapa 2 del proyecto, piloto en curso — ver
 * `THOREN_PILOT_TEMPLATE_STANDARD.md`).
 */
export const CATALOG_TEMPLATES: readonly CatalogTemplateSeed[] = [
  {
    id: "catalog_serum-facial-premium",
    name: "Serum Facial Premium",
    description: "Etiqueta minimalista de alta gama para frasco gotero, con espacio para % de activos.",
    tags: ["skincare", "serum", "premium", "minimal", "beauty"],
    category: "Cosmetics",
    shape: "circle",
    difficulty: "Intermedio",
    targetAudience: "Marcas de skincare independientes, cosmética natural premium",
    useCase: "Frasco gotero de serum de 30ml",
    suggestedColors: ["#23282B", "#EDEAE2", "#9C4E27"],
    buildProject: createSerumFacialPremiumProject,
  },
];

export interface SeedCatalogTemplatesOptions {
  now: string;
  generateId?: () => string;
  generateThumbnail: (project: Project) => Promise<Blob>;
}

/**
 * Siembra los templates del catálogo de contenido en `store` si todavía no
 * existen — mismo patrón idempotente-por-id-de-catálogo que
 * `seedBuiltInTemplates`. Se guardan como `builtIn: true` (vienen con la
 * app, no los crea un usuario, no se pueden borrar desde la galería) —
 * misma semántica que los 3 tamaños en blanco, con metadata real además.
 */
export async function seedCatalogTemplates(store: TemplateStore, options: SeedCatalogTemplatesOptions): Promise<void> {
  const { now, generateThumbnail } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const existing = await store.listDescriptors({ moduleId: "sticker-builder" });
  const existingIds = new Set(existing.map((descriptor) => descriptor.id));

  for (const seed of CATALOG_TEMPLATES) {
    if (existingIds.has(seed.id)) continue;

    const project = seed.buildProject({ now, generateId });
    const thumbnail = await generateThumbnail(project);

    const descriptor: TemplateDescriptor = {
      id: seed.id,
      moduleId: "sticker-builder",
      name: seed.name,
      description: seed.description,
      tags: seed.tags,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
      category: seed.category,
      shape: seed.shape,
      difficulty: seed.difficulty,
      targetAudience: seed.targetAudience,
      useCase: seed.useCase,
      suggestedColors: seed.suggestedColors,
      authorId: "thoren",
    };

    await store.save(descriptor, { project, thumbnail });
  }
}
