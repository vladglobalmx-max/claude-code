/**
 * El Document Schema declara que NO genera IDs (es responsabilidad de quien
 * lo consume). El Engine es ese consumidor, pero solo necesita generar un
 * ID en un único lugar: `HistoryEntry.id`. Todo lo demás (IDs de página,
 * capa u objeto) lo decide quien llama a `dispatch` — el Engine nunca
 * inventa identidad para contenido del usuario.
 *
 * Se usa un contador incremental por defecto (determinístico, sin
 * dependencias de `crypto`, ideal para tests) en vez de UUIDs. Un consumidor
 * que necesite IDs globalmente únicos puede inyectar su propio generador
 * vía `createEngine(project, { historyEntryIdGenerator })`.
 */
export function createIncrementingIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}_${counter}`;
  };
}
