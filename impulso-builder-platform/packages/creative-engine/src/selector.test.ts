import { describe, expect, it } from "vitest";
import { interpretar } from "./intent.js";
import { RECIPE_ELEGANTE_BODA } from "./recipes/eleganteBoda.js";
import { seleccionarReceta } from "./selector.js";

describe("seleccionarReceta", () => {
  it("siempre devuelve Elegante mientras exista una sola receta, sin importar el Intent", () => {
    const intents = [
      interpretar("Etiquetas para la boda de Marcela y Andrés"),
      interpretar("etiquetas para mi negocio"),
      interpretar("Boda de Marcela y Andrés en dorado"),
    ];
    for (const intent of intents) {
      expect(seleccionarReceta(intent)).toBe(RECIPE_ELEGANTE_BODA);
    }
  });

  it("la receta declara exactamente tres arquetipos, con ids distintos", () => {
    const recipe = seleccionarReceta(interpretar("Boda de Marcela y Andrés"));
    expect(recipe.archetypes).toHaveLength(3);
    expect(new Set(recipe.archetypes.map((a) => a.id)).size).toBe(3);
  });
});
