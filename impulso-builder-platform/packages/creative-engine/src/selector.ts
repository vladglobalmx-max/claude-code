import type { Intent } from "./intent.js";
import type { Recipe } from "./recipe.js";
import { RECIPE_ELEGANTE_BODA } from "./recipes/eleganteBoda.js";

/**
 * Selector de direcciones — Fase 2 (docs/product/THOREN_CREATIVE_ENGINE.md §3.2).
 *
 * Trivial mientras exista una sola receta: siempre devuelve Elegante. El
 * propósito de esta fase no es variedad de recetas (eso es la tabla de
 * afinidad completa de §6, Fase 4) sino validar el contrato real entre
 * Intérprete → Selector → Composición — por eso la firma recibe un
 * `Intent` real, aunque hoy lo ignore, en vez de no recibir nada.
 */
export function seleccionarReceta(_intent: Intent): Recipe {
  return RECIPE_ELEGANTE_BODA;
}
