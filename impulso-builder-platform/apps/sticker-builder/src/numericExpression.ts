/**
 * Alcance deliberadamente acotado (Epic 7 / Fase 7.1): un campo numérico
 * del Inspector acepta un valor absoluto o una expresión relativa de un
 * solo paso (`+n`/`-n`/`*n`/`/n`) — nunca `eval` ni un lenguaje de
 * expresiones completo. Función pura, sin dependencia del Engine ni del
 * DOM, para poder testearla en aislamiento.
 */
const ABSOLUTE_PATTERN = /^-?\d*\.?\d+$/;
const RELATIVE_PATTERN = /^([+\-*/])\s*(-?\d*\.?\d+)$/;

/**
 * Evalúa `input` contra `currentValue`. Devuelve `undefined` si `input` no
 * coincide con ninguna de las formas soportadas, o si el resultado no es
 * un número finito (ej. división por cero) — quien llama decide qué hacer
 * ante `undefined` (típicamente: mostrar un error inline, no aplicar nada).
 */
export function evaluateNumericExpression(currentValue: number, input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;

  // Un valor absoluto negativo pegado ("-5") es ambiguo con la forma relativa
  // "-n", y aquí gana el absoluto a propósito: en un campo numérico de
  // Inspector (X, Y, tamaño de fuente...), escribir "-5" como contenido
  // completo del campo casi siempre significa "fijar este valor en -5", no
  // "restar 5 al valor actual". Las formas "+n"/"*n"/"/n" no tienen esta
  // ambigüedad porque un número absoluto nunca empieza con esos símbolos.
  // Quien quiera la resta relativa con un operando que arranca en "-" puede
  // separarlo con un espacio ("- 5"), que no coincide con ABSOLUTE_PATTERN.
  if (ABSOLUTE_PATTERN.test(trimmed)) {
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : undefined;
  }

  const match = trimmed.match(RELATIVE_PATTERN);
  if (!match) return undefined;
  const [, operator, operandText] = match;
  const operand = Number(operandText);
  if (!Number.isFinite(operand)) return undefined;

  switch (operator) {
    case "+":
      return currentValue + operand;
    case "-":
      return currentValue - operand;
    case "*":
      return currentValue * operand;
    case "/":
      return operand === 0 ? undefined : currentValue / operand;
    default:
      return undefined;
  }
}
