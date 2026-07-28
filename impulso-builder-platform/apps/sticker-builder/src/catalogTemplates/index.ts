import type { Project } from "@impulso/document-schema";
import type { TemplateStore } from "@impulso/template-library";
import { createSerumFacialPremiumProject } from "./serumFacialPremium.js";
import { buildCatalogTemplateDescriptor } from "./kit/descriptorFactory.js";
import type { CatalogTemplateSeed } from "./kit/types.js";

/** Re-exportado desde `kit/types.ts` (donde vive ahora, ver
 * `THOREN_PRODUCTION_INFRASTRUCTURE.md`) para que ningún import existente
 * de `CatalogTemplateSeed` desde este módulo se rompa. */
export type { CatalogTemplateSeed };

/**
 * Metadata real tomada de `TEMPLATE_BATCH_02.md` (Template 7, catálogo
 * 2.1) y de `TEMPLATE_CATALOG_v1.md` — no inventada para el piloto. Es el
 * único template del catálogo de 63 integrado como código real hasta este
 * punto (Etapa 2 del proyecto — ver `THOREN_PILOT_TEMPLATE_STANDARD.md`
 * y, para la infraestructura de producción usada a partir de aquí,
 * `THOREN_PRODUCTION_INFRASTRUCTURE.md`).
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
 * El mapeo seed -> `TemplateDescriptor` vive en
 * `kit/descriptorFactory.ts` (`buildCatalogTemplateDescriptor`) — este
 * loop es, deliberadamente, el único código que los 62 templates
 * restantes necesitarán tocar (agregar una entrada a `CATALOG_TEMPLATES`),
 * nunca este mecanismo de siembra en sí.
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
    const descriptor = buildCatalogTemplateDescriptor(seed, { moduleId: "sticker-builder", now });

    await store.save(descriptor, { project, thumbnail });
  }
}
