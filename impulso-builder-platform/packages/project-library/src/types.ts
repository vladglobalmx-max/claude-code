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
 * Snapshot ligero de recuperación (Epic 8 — Autosave, Recovery & Project
 * Safety): una sola entrada por `projectId`, nunca una lista creciente de
 * versiones históricas. Existe para sobrevivir la ventana entre el último
 * guardado principal confirmado y un cierre inesperado (crash, refresh,
 * pestaña cerrada antes de que el autosave con debounce llegara a correr).
 * Se escribe en el MISMO ciclo que intenta el guardado principal (antes de
 * intentarlo, ver `ProjectSaveCoordinator`) y se limpia inmediatamente
 * después de un guardado principal exitoso — por diseño, si esta entrada
 * existe, siempre representa contenido AL MENOS tan reciente como (y
 * normalmente más reciente que) el `Project` persistido en el store
 * principal para ese mismo id.
 */
export interface ProjectRecoveryEntry {
  projectId: ProjectId;
  project: Project;
  /** ISO timestamp de cuándo se escribió esta entrada — permite decidir si
   * es más reciente que `ProjectDescriptor.updatedAt` sin tener que cargar
   * el `Project` guardado completo primero. */
  savedAt: string;
}

/**
 * Puerto de almacenamiento de proyectos (Workspace) — descriptor liviano
 * (para listar la grilla sin cargar cada `Project` completo) y contenido
 * pesado (el `Project` en sí), mismo patrón ya usado por Asset Library y
 * Template Library. `save` recibe el `Project` completo — el store deriva
 * el descriptor de él; si se omite `thumbnail`, se conserva el thumbnail
 * ya guardado para ese id (renombrar no debe borrar la miniatura).
 *
 * Los 4 métodos `*Recovery` (Epic 8) son un mecanismo DISTINTO de `save`:
 * nunca participan del listado/descriptor de la Workspace por sí solos —
 * ver `ProjectRecoveryEntry`.
 */
export interface ProjectStore {
  listDescriptors(filter?: { moduleId?: string }): Promise<ProjectDescriptor[]>;
  getDescriptor(id: ProjectId): Promise<ProjectDescriptor | undefined>;
  getProject(id: ProjectId): Promise<Project | undefined>;
  save(project: Project, thumbnail?: Blob): Promise<void>;
  delete(id: ProjectId): Promise<void>;
  clear(): Promise<void>;
  saveRecovery(project: Project, savedAt: string): Promise<void>;
  getRecovery(id: ProjectId): Promise<ProjectRecoveryEntry | undefined>;
  clearRecovery(id: ProjectId): Promise<void>;
  listRecoveries(): Promise<ProjectRecoveryEntry[]>;
}
