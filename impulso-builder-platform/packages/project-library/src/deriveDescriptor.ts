import type { Project } from "@impulso/document-schema";
import type { ProjectDescriptor } from "./types.js";

const UNTITLED_NAME = "Sin título";

/** Deriva un `ProjectDescriptor` a partir de un `Project` — compartido
 * entre las dos implementaciones de `ProjectStore` para que ambas deriven
 * el descriptor exactamente igual. `existingThumbnail` es el thumbnail ya
 * guardado para este id (si lo hay) — se conserva cuando `save()` no
 * provee uno nuevo explícitamente. */
export function deriveDescriptor(project: Project, existingThumbnail: Blob | undefined, thumbnail: Blob | undefined): ProjectDescriptor {
  return {
    id: project.id,
    moduleId: project.moduleId,
    name: project.metadata.name ?? UNTITLED_NAME,
    thumbnail: thumbnail ?? existingThumbnail,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
  };
}
