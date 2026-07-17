/**
 * Un "reorder" es una permutación: mismo conjunto de IDs, otro orden. No es
 * una forma de agregar/quitar elementos — eso ya tienen sus propios
 * comandos (add/remove). Verificar esto explícitamente evita que un
 * `reorderLayers` con una lista incompleta borre capas silenciosamente.
 */
export function isPermutationOf(candidate: readonly string[], reference: readonly string[]): boolean {
  if (candidate.length !== reference.length) return false;
  const candidateSet = new Set(candidate);
  if (candidateSet.size !== candidate.length) return false; // sin duplicados
  const referenceSet = new Set(reference);
  if (candidateSet.size !== referenceSet.size) return false;
  for (const id of candidateSet) {
    if (!referenceSet.has(id)) return false;
  }
  return true;
}
