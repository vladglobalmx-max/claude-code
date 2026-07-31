// API pública de la Fase 1 ("Núcleo del Documento") del Motor Creativo.
// Ver docs/product/THOREN_IMPLEMENTATION_PLAN.md.
export { componer } from "./componer.js";
export type { Archetype, ComponerParams } from "./componer.js";
export { exportarSVG } from "./exportar.js";

// API pública de la Fase 2 ("Motor Creativo v1"): Intérprete de intención,
// Selector trivial, Composición conectada a la Fase 1, Filtro de calidad
// básico. Sin recetas múltiples, variantes, aprendizaje ni interfaz — eso
// llega en fases posteriores (THOREN_IMPLEMENTATION_PLAN.md).
export { interpretar } from "./intent.js";
export type { Intent } from "./intent.js";
export { seleccionarReceta } from "./selector.js";
export type { ArchetypeDefinition, Recipe, RecipePalette, RecipeTypography } from "./recipe.js";
export { generarLote, crearPropuestas } from "./generarLote.js";
export type { Composition } from "./composition.js";
export { validarComposicion } from "./quality/filtroCalidad.js";
export type { Validacion } from "./quality/filtroCalidad.js";
