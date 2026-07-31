// Shim de integración: @impulso/creative-engine#ids.ts usa
// `import { randomUUID } from "node:crypto"` porque ese paquete corre en
// Node/Vitest (ver su propio comentario). Para el bundle de navegador,
// "node:crypto" no existe — este shim resuelve el mismo nombre de función
// usando el Web Crypto API nativo del navegador (`crypto.randomUUID()`,
// disponible en todo navegador evergreen sobre un contexto seguro),
// sin modificar el archivo congelado del monorepo.
export function randomUUID() {
  return crypto.randomUUID();
}
