import type { TemplateContent, TemplateDescriptor, TemplateId, TemplateStore } from "../types.js";

/** Implementación en memoria de `TemplateStore` — para tests o entornos sin IndexedDB. */
export function createMemoryTemplateStore(): TemplateStore {
  const descriptors = new Map<TemplateId, TemplateDescriptor>();
  const contents = new Map<TemplateId, TemplateContent>();

  return {
    async listDescriptors(filter) {
      const all = Array.from(descriptors.values());
      if (!filter?.moduleId) return all;
      return all.filter((descriptor) => descriptor.moduleId === filter.moduleId);
    },
    async getDescriptor(id) {
      return descriptors.get(id);
    },
    async getContent(id) {
      return contents.get(id);
    },
    async save(descriptor, content) {
      descriptors.set(descriptor.id, descriptor);
      contents.set(descriptor.id, content);
    },
    async delete(id) {
      descriptors.delete(id);
      contents.delete(id);
    },
    async clear() {
      descriptors.clear();
      contents.clear();
    },
  };
}
