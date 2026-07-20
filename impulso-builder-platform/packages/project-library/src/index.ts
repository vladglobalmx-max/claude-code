export type { ProjectDescriptor, ProjectStore, ProjectRecoveryEntry } from "./types.js";
export { createMemoryProjectStore } from "./stores/memoryProjectStore.js";
export { createIndexedDbProjectStore } from "./stores/indexedDbProjectStore.js";
export type { IndexedDbProjectStoreOptions } from "./stores/indexedDbProjectStore.js";
export { duplicateProject } from "./duplicateProject.js";
export type { DuplicateProjectOptions } from "./duplicateProject.js";

// Epic 8 — Autosave, Recovery & Project Safety.
export { createProjectSaveCoordinator } from "./saveCoordinator.js";
export type {
  ProjectSaveCoordinator,
  ProjectSaveCoordinatorOptions,
  SaveState,
  SaveStatus,
  SaveOutcome,
} from "./saveCoordinator.js";
