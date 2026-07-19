import type { Project, ProjectId } from "@impulso/document-schema";
import { cloneProjectWithNewIds } from "@impulso/engine";
import type { ProjectStore } from "./types.js";

export interface DuplicateProjectOptions {
  now: string;
  /** El Engine (y por lo tanto este paquete) nunca inventa identidad —
   * quien llama SIEMPRE provee el generador. */
  generateId: () => string;
}

const COPY_SUFFIX = " (copia)";

/**
 * Duplica un proyecto ya guardado: clona su contenido con ids frescos
 * (`cloneProjectWithNewIds`, `@impulso/engine` — el mismo mecanismo que ya
 * usa `instantiateTemplate` en Template Library), agrega " (copia)" al
 * nombre, conserva el thumbnail del original, y lo guarda como una entrada
 * NUEVA e independiente en el mismo `ProjectStore`. Función independiente
 * (no un método de `ProjectStore`) — funciona igual sobre cualquier
 * implementación (memoria o IndexedDB) componiendo solo `getProject`/
 * `getDescriptor`/`save`, sin duplicar lógica de clonado en cada adaptador.
 */
export async function duplicateProject(
  store: ProjectStore,
  id: ProjectId,
  options: DuplicateProjectOptions,
): Promise<Project | undefined> {
  const original = await store.getProject(id);
  if (!original) return undefined;

  const descriptor = await store.getDescriptor(id);
  const cloned = cloneProjectWithNewIds(original, options);
  const renamed: Project = {
    ...cloned,
    metadata: { ...cloned.metadata, name: `${original.metadata.name ?? "Sin título"}${COPY_SUFFIX}` },
  };

  await store.save(renamed, descriptor?.thumbnail);
  return renamed;
}
