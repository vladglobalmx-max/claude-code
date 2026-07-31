import type { Intent } from "../intent.js";

/**
 * Derivación de contenido compartida por los tres arquetipos — todos
 * muestran los mismos nombres/fecha reales del usuario, solo cambia cómo
 * los distribuyen. Los valores por defecto aquí son los documentados para
 * cuando el Intérprete no encuentra nombres (§4: "el contenido personal
 * siempre pesa más que la etiqueta de la ocasión" — pero si ni siquiera
 * hay contenido personal, la pieza igual debe nacer terminada, nunca con
 * un placeholder tipo "Tu Nombre Aquí").
 */

/** Sin nombres detectados: frase genérica de celebración, nunca un placeholder de edición. */
const DEFAULT_CONTENT = "Siempre Juntos";
const DEFAULT_RING_FRAGMENTS: readonly string[] = ["SIEMPRE", "•", "JUNTOS", "•"];
/** Símbolo ornamental neutro — nunca se inventan iniciales de nombres inexistentes. */
const DEFAULT_MONOGRAM = "❦";

export function primaryContent(intent: Intent): string {
  if (intent.names.length >= 2) return `${intent.names[0]} & ${intent.names[1]}`;
  if (intent.names.length === 1) return intent.names[0]!;
  return DEFAULT_CONTENT;
}

export function deriveInitials(intent: Intent): string {
  if (intent.names.length >= 2) {
    return `${intent.names[0]!.charAt(0).toUpperCase()} · ${intent.names[1]!.charAt(0).toUpperCase()}`;
  }
  if (intent.names.length === 1) return intent.names[0]!.charAt(0).toUpperCase();
  return DEFAULT_MONOGRAM;
}

export function ringFragments(intent: Intent): readonly string[] {
  if (intent.names.length >= 2) {
    return [intent.names[0]!.toUpperCase(), "•", intent.names[1]!.toUpperCase(), "•"];
  }
  if (intent.names.length === 1) {
    const name = intent.names[0]!.toUpperCase();
    return [name, "•", name, "•"];
  }
  return DEFAULT_RING_FRAGMENTS;
}

/**
 * Anclas de fidelidad de contenido (§11: "que el nombre/marca real
 * aparezca correctamente") — lo que el Filtro de calidad exige encontrar,
 * en algún formato (mayúsculas/minúsculas), en el SVG final de cualquier
 * arquetipo. Sin nombres reales, las anclas son las palabras del contenido
 * por defecto — ese texto genérico también debe sobrevivir intacto.
 */
export function fidelityAnchors(intent: Intent): readonly string[] {
  return intent.names.length > 0 ? intent.names : ["Siempre", "Juntos"];
}
