import type { Project, ProjectId } from "@impulso/document-schema";
import { deriveDescriptor } from "../deriveDescriptor.js";
import type { ProjectDescriptor, ProjectStore } from "../types.js";

/** Implementación en memoria de `ProjectStore` — para tests o entornos sin IndexedDB. */
export function createMemoryProjectStore(): ProjectStore {
  const descriptors = new Map<ProjectId, ProjectDescriptor>();
  const projects = new Map<ProjectId, Project>();

  return {
    async listDescriptors(filter) {
      const all = Array.from(descriptors.values());
      if (!filter?.moduleId) return all;
      return all.filter((descriptor) => descriptor.moduleId === filter.moduleId);
    },
    async getDescriptor(id) {
      return descriptors.get(id);
    },
    async getProject(id) {
      return projects.get(id);
    },
    async save(project, thumbnail) {
      const descriptor = deriveDescriptor(project, descriptors.get(project.id)?.thumbnail, thumbnail);
      descriptors.set(project.id, descriptor);
      projects.set(project.id, project);
    },
    async delete(id) {
      descriptors.delete(id);
      projects.delete(id);
    },
    async clear() {
      descriptors.clear();
      projects.clear();
    },
  };
}
