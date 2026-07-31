import type { Recipe } from "../recipe.js";
import { composicionAsimetrica, insigniaEnmarcada, monogramaAnillo } from "../archetypes/index.js";

/**
 * Receta "Elegante" aplicada a la ocasión "Boda" — la única receta de
 * Fase 2 (docs/product/THOREN_CREATIVE_ENGINE.md §5, tabla de afinidad §6:
 * Elegante es la primera recomendada para bodas). El nombre "elegante" es
 * puramente interno — nunca se muestra a la persona (principio 2).
 *
 * Paleta y tipografía tomadas directamente de §5: "champán/marfil con
 * acento metálico discreto (oro viejo, bronce)"; "serifa fina de alto
 * contraste para el elemento principal + sans humanista ligera para texto
 * secundario".
 */
export const RECIPE_ELEGANTE_BODA: Recipe = {
  id: "elegante",
  palette: {
    background: "#f2ede4", // marfil
    ink: "#3a2f28", // tinta oscura de alto contraste sobre el marfil
    accent: "#6b5228", // oro viejo/bronce oscuro — acento metálico discreto, calibrado para pasar contraste AA sobre marfil (§ Filtro de calidad)
  },
  typography: {
    primary: { fontFamily: "Georgia", fontWeight: 600 }, // serifa fina de alto contraste
    secondary: { fontFamily: "Arial", fontWeight: 400 }, // sans humanista ligera
  },
  archetypes: [monogramaAnillo, insigniaEnmarcada, composicionAsimetrica],
};
