import { DocumentSchema } from "@impulso/document-schema";
import { fidelityAnchors } from "./archetypes/content.js";
import type { Composition } from "./composition.js";
import { nextCompositionId } from "./ids.js";
import type { Intent } from "./intent.js";
import { interpretar } from "./intent.js";
import { resolvePalette } from "./recipe.js";
import { validarComposicion } from "./quality/filtroCalidad.js";
import { seleccionarReceta } from "./selector.js";

/**
 * Motor de composición — Fase 2 (docs/product/THOREN_IMPLEMENTATION_PLAN.md,
 * interfaz pública `generarLote(Intent) → Composition[]`).
 *
 * Alcance deliberado de esta fase: sin ciclo de reintento ni sustitución
 * de receta ante un rechazo (eso es el Filtro de calidad ampliado de
 * `THOREN_CREATIVE_ENGINE.md` §11-12, Fase 5). Si una composición no pasa
 * el filtro básico, `generarLote` lanza un error explícito — nunca
 * entrega una pieza no validada, ni a la demo ni a un futuro llamador.
 */
export async function generarLote(intent: Intent): Promise<Composition[]> {
  const recipe = seleccionarReceta(intent);
  const palette = resolvePalette(recipe, intent);
  const now = new Date().toISOString();
  const anchors = fidelityAnchors(intent);

  const compositions: Composition[] = [];
  for (const archetype of recipe.archetypes) {
    const draft = archetype.build(intent, recipe, now);
    const document = DocumentSchema.parse(draft);
    const validacion = await validarComposicion(document, palette, anchors);
    if (!validacion.aprobada) {
      throw new Error(
        `Composición rechazada por el arquetipo "${archetype.id}": ${validacion.fallas.join("; ")}`,
      );
    }
    compositions.push({ id: nextCompositionId(), archetypeId: archetype.id, document });
  }
  return compositions;
}

/**
 * Conveniencia de una sola llamada para demos/pruebas de extremo a
 * extremo — encadena `interpretar` + `generarLote`. No es una interfaz
 * pública nueva del Motor Creativo (esas son `interpretar` y
 * `generarLote`, ya fijadas en `THOREN_IMPLEMENTATION_PLAN.md`); es solo
 * el atajo "frase → propuestas" para quien consume el paquete de un tirón.
 */
export async function crearPropuestas(phrase: string): Promise<Composition[]> {
  return generarLote(interpretar(phrase));
}
