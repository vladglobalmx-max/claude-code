/**
 * Intérprete de intención — Fase 2 (docs/product/THOREN_CREATIVE_ENGINE.md §3.1/§4).
 *
 * Deliberadamente determinista: sin LLM, sin prompts, sin modelos. Extrae
 * únicamente lo que esta fase necesita — nombres, fecha, ocasión y color
 * explícito — por diseño explícito del usuario, no un recorte accidental
 * del alcance más amplio de §4 (marca, producto, cantidad, restricciones
 * llegan cuando se amplíe la tabla de afinidad más allá de "Boda").
 *
 * Alcance de esta fase: una sola ocasión ("boda"). No hay todavía tabla de
 * afinidad que mapear — por eso `occasion` es un literal fijo, nunca "no
 * reconocida"; ausencia de la palabra clave nunca bloquea el flujo (regla
 * general de §4: "THÖREN debe inferir todo lo razonable antes de hacer una
 * pregunta adicional").
 */

export interface Intent {
  readonly occasion: "boda";
  /** 0, 1 o 2 nombres, en el orden en que aparecen en la frase. */
  readonly names: readonly string[];
  /** Tal como aparece en la frase — nunca normalizada a un formato de fecha,
   * para no arriesgar una mala interpretación del orden día/mes/año. */
  readonly date?: string;
  /** Hex ya resuelto desde una señal explícita de color ("en dorado"). */
  readonly color?: string;
}

const COUPLE_WITH_CONNECTOR = /\bde\s+([A-ZÁÉÍÓÚÑÜ][\p{L}'-]*)\s+(?:y|&)\s+([A-ZÁÉÍÓÚÑÜ][\p{L}'-]*)/u;
const COUPLE_ANYWHERE = /\b([A-ZÁÉÍÓÚÑÜ][\p{L}'-]*)\s+(?:y|&)\s+([A-ZÁÉÍÓÚÑÜ][\p{L}'-]*)\b/u;
const CAPITALIZED_WORD = /\b[A-ZÁÉÍÓÚÑÜ][\p{L}'-]*\b/gu;

/** Palabras capitalizadas que jamás son un nombre de persona en este contexto. */
const NAME_STOPWORDS = new Set(["Boda", "Casamiento", "Matrimonio", "Enlace", "Nupcias"]);

function extractNames(phrase: string): string[] {
  const withConnector = COUPLE_WITH_CONNECTOR.exec(phrase) ?? COUPLE_ANYWHERE.exec(phrase);
  if (withConnector) {
    return [withConnector[1]!, withConnector[2]!];
  }

  // Frase corta, informal o fragmentada ("Boda. Marcela. Andrés."): se
  // toma cada palabra capitalizada como una señal independiente, excepto
  // la primera del texto completo (capitalizada solo por ser el inicio de
  // la oración, no por ser un nombre — p. ej. "Etiquetas para...").
  const words = [...phrase.matchAll(CAPITALIZED_WORD)].map((m) => m[0]);
  const candidates = words
    .slice(1)
    .filter((word) => !NAME_STOPWORDS.has(word));
  const unique = [...new Set(candidates)];
  return unique.slice(0, 2);
}

const MONTH_NAMES =
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
const DATE_WITH_MONTH_NAME = new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES})(?:\\s+de\\s+\\d{4})?\\b`, "iu");
const DATE_NUMERIC = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/;

function extractDate(phrase: string): string | undefined {
  const withMonthName = DATE_WITH_MONTH_NAME.exec(phrase);
  if (withMonthName) return withMonthName[0];
  const numeric = DATE_NUMERIC.exec(phrase);
  return numeric?.[0];
}

/**
 * Diccionario cerrado de señales de color explícitas — deliberadamente
 * pequeño y curado, coherente con la paleta de la receta Elegante (§5):
 * nunca acepta un color que rompa "champán/marfil con acento metálico
 * discreto". Resolver el color a hex aquí, una sola vez, evita que la capa
 * de Composición tenga que conocer nombres de colores en español.
 */
const COLOR_SIGNALS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(dorado|oro)\b/iu, "#b08d57"],
  [/\b(plata|plateado)\b/iu, "#9aa0a6"],
  [/\bverde\b/iu, "#5b6b4d"],
  [/\bterracota\b/iu, "#c1613f"],
  [/\b(burdeos|vino)\b/iu, "#6f2732"],
  [/\bazul\b/iu, "#33475b"],
  [/\brosa\b/iu, "#c98da0"],
  [/\bnegro\b/iu, "#1c1917"],
  [/\bblanco\b/iu, "#f7f5f2"],
  [/\bmarfil\b/iu, "#f2ede4"],
  [/\b(champán|champagne)\b/iu, "#e8d9b5"],
];

function extractColor(phrase: string): string | undefined {
  for (const [pattern, hex] of COLOR_SIGNALS) {
    if (pattern.test(phrase)) return hex;
  }
  return undefined;
}

export function interpretar(phrase: string): Intent {
  const names = extractNames(phrase);
  const date = extractDate(phrase);
  const color = extractColor(phrase);

  return {
    occasion: "boda",
    names,
    ...(date ? { date } : {}),
    ...(color ? { color } : {}),
  };
}
