import type { Project } from "@impulso/document-schema";
import { cloneProjectWithNewIds } from "@impulso/engine";

export interface InstantiateTemplateOptions {
  now: string;
  /** El Engine (y por lo tanto este paquete) nunca inventa identidad —
   * quien llama SIEMPRE provee el generador. */
  generateId: () => string;
}

/**
 * Instancia un Template como un `Project` nuevo, listo para editar: envoltorio
 * semántico sobre `cloneProjectWithNewIds` (`@impulso/engine`) — el mismo
 * mecanismo genérico de "clonar un Project completo con ids frescos" que
 * cualquier "duplicar este proyecto" futuro también reutilizaría. Un
 * consumidor de Templates no necesita saber que por debajo es un clon; ve
 * una operación con nombre propio del dominio ("instanciar una plantilla").
 */
export function instantiateTemplate(templateProject: Project, options: InstantiateTemplateOptions): Project {
  return cloneProjectWithNewIds(templateProject, options);
}
