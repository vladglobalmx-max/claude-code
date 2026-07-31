import type { Intent } from "./intent.js";
import { CONTRAST_THRESHOLD_NORMAL_TEXT, ensureContrast } from "./quality/contrast.js";

/**
 * Modelo de dominio de la receta — Fase 2 (docs/product/THOREN_TECHNICAL_ARCHITECTURE.md §5).
 *
 * Solo incluye los campos que esta fase realmente usa (paleta, tipografía,
 * arquetipos). El modelo completo de `Recipe` en la documentación también
 * habla de motivos ornamentales, densidad y reglas de jerarquía — esos
 * llegan cuando el Filtro de calidad ampliado (Fase 5) necesite calibrarlos
 * contra más de una receta; añadirlos ahora sería diseñar para una
 * necesidad que todavía no existe.
 */

export interface RecipePalette {
  /** Color de fondo de la pieza — el "papel"/vinilo sobre el que se imprime. */
  readonly background: string;
  /** Color de alto contraste para el elemento dominante (nombres, monograma). */
  readonly ink: string;
  /** Acento discreto para elementos secundarios/ornamentales (marcos, anillos, filetes). */
  readonly accent: string;
}

export interface RecipeTypographyRole {
  readonly fontFamily: string;
  readonly fontWeight: number;
}

export interface RecipeTypography {
  readonly primary: RecipeTypographyRole;
  readonly secondary: RecipeTypographyRole;
}

/** Documento crudo (previo a `DocumentSchema.parse`) que produce un arquetipo. */
export type DocumentDraft = Record<string, unknown>;

/**
 * Nombrado `ArchetypeDefinition` (no `Archetype` a secas) para no chocar
 * con el `Archetype` de Fase 1 (`componer.ts`, el tipo de forma geométrica
 * mínima "circle" | "rectangle") en la superficie pública del paquete —
 * son dos conceptos distintos que ambas fases necesitaban nombrar.
 */
export interface ArchetypeDefinition {
  /** Identificador interno — nunca se muestra a la persona (principio 2 de THOREN_CREATIVE_ENGINE.md). */
  readonly id: string;
  readonly build: (intent: Intent, recipe: Recipe, now: string) => DocumentDraft;
}

export interface Recipe {
  /** Identificador interno — nunca se muestra a la persona (principio 2). */
  readonly id: string;
  readonly palette: RecipePalette;
  readonly typography: RecipeTypography;
  readonly archetypes: readonly ArchetypeDefinition[];
}

/**
 * Una señal explícita de color (Intent.color) sustituye únicamente el
 * acento — el fondo y el color de alto contraste (ink) permanecen intactos,
 * porque son los que garantizan la legibilidad ya validada de la receta.
 * Nunca se le permite a una señal de color romper la paleta base: si el
 * tono pedido no alcanza el contraste mínimo contra el fondo, se ajusta en
 * silencio (`ensureContrast`) en vez de rechazar la composición o
 * preguntar — igual que cualquier otro ajuste automático de la receta.
 */
export function resolvePalette(recipe: Recipe, intent: Intent): RecipePalette {
  if (!intent.color) return recipe.palette;
  const accent = ensureContrast(intent.color, recipe.palette.background, CONTRAST_THRESHOLD_NORMAL_TEXT);
  return { ...recipe.palette, accent };
}
