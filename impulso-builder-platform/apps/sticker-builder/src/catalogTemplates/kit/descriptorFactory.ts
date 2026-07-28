import type { TemplateDescriptor } from "@impulso/template-library";
import type { CatalogTemplateSeed } from "./types.js";

export interface BuildCatalogTemplateDescriptorOptions {
  moduleId: string;
  now: string;
  authorId?: string;
}

/**
 * Mapea un `CatalogTemplateSeed` a su `TemplateDescriptor` — el mismo
 * mapeo mecánico que antes vivía inline en el loop de
 * `seedCatalogTemplates` (`catalogTemplates/index.ts`), extraído para que
 * sea reutilizable/testeable de forma aislada, sin necesitar un
 * `TemplateStore` real. Todo template del catálogo se guarda como
 * `builtIn: true` (viene con la app, no lo crea un usuario, no se puede
 * eliminar desde la galería) — misma semántica que los 3 tamaños en
 * blanco.
 */
export function buildCatalogTemplateDescriptor(
  seed: CatalogTemplateSeed,
  options: BuildCatalogTemplateDescriptorOptions,
): TemplateDescriptor {
  return {
    id: seed.id,
    moduleId: options.moduleId,
    name: seed.name,
    description: seed.description,
    tags: seed.tags,
    builtIn: true,
    createdAt: options.now,
    updatedAt: options.now,
    category: seed.category,
    shape: seed.shape,
    difficulty: seed.difficulty,
    targetAudience: seed.targetAudience,
    useCase: seed.useCase,
    suggestedColors: seed.suggestedColors,
    authorId: options.authorId ?? "thoren",
  };
}
