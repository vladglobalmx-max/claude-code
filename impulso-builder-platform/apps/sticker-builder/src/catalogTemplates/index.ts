import type { Project } from "@impulso/document-schema";
import type { TemplateStore } from "@impulso/template-library";
import { createSerumFacialPremiumProject } from "./serumFacialPremium.js";
import { createLipBalmNaturalProject } from "./lipBalmNatural.js";
import { createSpaWellnessProject } from "./spaWellness.js";
import { createNeutralMinimalLabelProject } from "./neutralMinimalLabel.js";
import { createClosureSealProject } from "./closureSeal.js";
import { createThankYouPreferenceProject } from "./thankYouPreference.js";
import { buildCatalogTemplateDescriptor } from "./kit/descriptorFactory.js";
import type { CatalogTemplateSeed } from "./kit/types.js";

/** Re-exportado desde `kit/types.ts` (donde vive ahora, ver
 * `THOREN_PRODUCTION_INFRASTRUCTURE.md`) para que ningún import existente
 * de `CatalogTemplateSeed` desde este módulo se rompa. */
export type { CatalogTemplateSeed };

/**
 * Metadata real tomada de `TEMPLATE_CATALOG_v1.md` y de cada
 * `TEMPLATE_BATCH_XX.md` correspondiente — nunca inventada. El Serum
 * Facial Premium es el Template Piloto Oficial (Etapa 2); los 5 restantes
 * son el Lote 1 del `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (todos "cero
 * ilustración, layout puro" — construidos enteramente sobre
 * `catalogTemplates/kit/` sin ningún componente nuevo, ver el reporte de
 * producción del Lote 1).
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
  {
    id: "catalog_lip-balm-natural",
    name: "Bálsamo Labial Natural",
    description: "Etiqueta circular diminuta para la tapa o base de un bálsamo labial.",
    tags: ["lip-balm", "balsamo", "natural", "tiny-label"],
    category: "Cosmetics",
    shape: "circle",
    difficulty: "Básico",
    targetAudience: "Marcas de cuidado personal natural",
    useCase: "Tapa de lata o tubo de bálsamo labial",
    suggestedColors: ["#C97A4F", "#FFF8F0", "#2B2B2B"],
    buildProject: createLipBalmNaturalProject,
  },
  {
    id: "catalog_spa-wellness",
    name: "Spa & Bienestar",
    description: "Etiqueta serena para productos o packaging de spa.",
    tags: ["spa", "wellness", "relax", "beauty"],
    category: "Beauty",
    shape: "rectangle",
    difficulty: "Básico",
    targetAudience: "Spas, centros de bienestar",
    useCase: "Bolsa o caja de amenidades de spa/tratamiento",
    suggestedColors: ["#A9BBB4", "#F5F3EF", "#3A423E"],
    buildProject: createSpaWellnessProject,
  },
  {
    id: "catalog_neutral-minimal-label",
    name: "Etiqueta Neutral Minimalista",
    description: "Plantilla en blanco pero no vacía — jerarquía clara sin ilustración, para cualquier producto sin categoría propia todavía.",
    tags: ["generic", "minimal", "neutral", "product-label"],
    category: "Product Labels",
    shape: "rectangle",
    difficulty: "Básico",
    targetAudience: "Emprendedores en etapa temprana, cualquier industria no cubierta por el catálogo",
    useCase: "Etiqueta genérica para cualquier producto físico nuevo en catálogo",
    suggestedColors: ["#23282B", "#EDEAE2", "#9C4E27"],
    buildProject: createNeutralMinimalLabelProject,
  },
  {
    id: "catalog_closure-seal",
    name: "Sello de Cierre",
    description: "Sello circular pequeño para cerrar bolsas o cajas de empaque.",
    tags: ["seal", "packaging", "closure", "tiny-label"],
    category: "Packaging",
    shape: "circle",
    difficulty: "Básico",
    targetAudience: "Cualquier negocio que empaque productos para venta/envío",
    useCase: "Cierre decorativo de bolsa de regalo o caja de envío",
    suggestedColors: ["#9C4E27", "#EDEAE2", "#23282B"],
    buildProject: createClosureSealProject,
  },
  {
    id: "catalog_thank-you-preference",
    name: "Gracias por tu Preferencia",
    description: "Sticker de agradecimiento formal para clientes de negocio (no e-commerce).",
    tags: ["thank-you", "business", "customer", "seal"],
    category: "Business",
    shape: "circle",
    difficulty: "Básico",
    targetAudience: "Comercios y negocios de atención directa al cliente",
    useCase: "Sello en factura, bolsa o material de atención al cliente",
    suggestedColors: ["#2B2224", "#F7F5EF", "#B76E79"],
    buildProject: createThankYouPreferenceProject,
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
