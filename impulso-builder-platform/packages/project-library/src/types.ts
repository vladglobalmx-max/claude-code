import type { Project, ProjectId } from "@impulso/document-schema";

/**
 * A diferencia de `TemplateDescriptor` (que necesita metadatos de catálogo
 * ajenos al propio `Project`, como `builtIn`), un `ProjectDescriptor` es
 * enteramente derivable del `Project` que describe — `id`/`moduleId` y el
 * nombre/timestamps de `Project.metadata` ya alcanzan. La única pieza que
 * NO vive en el `Project` es el thumbnail (un `Blob` opaco, generado por
 * la app — este paquete no sabe cómo).
 */
export interface ProjectDescriptor {
  id: ProjectId;
  moduleId: string;
  name: string;
  thumbnail?: Blob;
  createdAt: string;
  updatedAt: string;
}

/**
 * Puerto de almacenamiento de proyectos (Workspace) — descriptor liviano
 * (para listar la grilla sin cargar cada `Project` completo) y contenido
 * pesado (el `Project` en sí), mismo patrón ya usado por Asset Library y
 * Template Library. `save` recibe el `Project` completo — el store deriva
 * el descriptor de él; si se omite `thumbnail`, se conserva el thumbnail
 * ya guardado para ese id (renombrar no debe borrar la miniatura).
 */
export interface ProjectStore {
  listDescriptors(filter?: { moduleId?: string }): Promise<ProjectDescriptor[]>;
  getDescriptor(id: ProjectId): Promise<ProjectDescriptor | undefined>;
  getProject(id: ProjectId): Promise<Project | undefined>;
  save(project: Project, thumbnail?: Blob): Promise<void>;
  delete(id: ProjectId): Promise<void>;
  clear(): Promise<void>;
}
