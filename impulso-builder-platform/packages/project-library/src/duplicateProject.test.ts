import { describe, expect, it } from "vitest";
import { ProjectIdSchema } from "@impulso/document-schema";
import { createMemoryProjectStore } from "./stores/memoryProjectStore.js";
import { duplicateProject } from "./duplicateProject.js";
import { buildWorkspaceProject } from "./testUtils/fixtures.js";

const NOW = "2026-07-19T01:00:00.000Z";
const pid = (id: string) => ProjectIdSchema.parse(id);

describe("duplicateProject", () => {
  it("devuelve undefined si el id no existe", async () => {
    const store = createMemoryProjectStore();
    const result = await duplicateProject(store, pid("project_no_existe"), { now: NOW, generateId: () => "x" });
    expect(result).toBeUndefined();
  });

  it("clona el Project con ids frescos y lo guarda como una entrada nueva e independiente", async () => {
    const store = createMemoryProjectStore();
    const original = buildWorkspaceProject("project_1");
    await store.save(original);

    let counter = 0;
    const clone = await duplicateProject(store, pid("project_1"), { now: NOW, generateId: () => `fresh_${++counter}` });

    expect(clone).toBeDefined();
    expect(clone!.id).not.toBe(original.id);
    expect(clone!.document.id).not.toBe(original.document.id);

    const stored = await store.listDescriptors();
    expect(stored.map((d) => d.id).sort()).toEqual([clone!.id, "project_1"].sort());
    expect(await store.getProject(pid("project_1"))).toEqual(original);
  });

  it('agrega " (copia)" al nombre del clon', async () => {
    const store = createMemoryProjectStore();
    await store.save(buildWorkspaceProject("project_1"));

    const clone = await duplicateProject(store, pid("project_1"), { now: NOW, generateId: () => "fresh" });

    expect(clone!.metadata.name).toBe("Proyecto de prueba (copia)");
  });

  it("conserva el thumbnail del original en el clon", async () => {
    const store = createMemoryProjectStore();
    const thumbnail = new Blob(["png"], { type: "image/png" });
    await store.save(buildWorkspaceProject("project_1"), thumbnail);

    const clone = await duplicateProject(store, pid("project_1"), { now: NOW, generateId: () => "fresh" });

    const descriptor = await store.getDescriptor(clone!.id);
    expect(descriptor?.thumbnail?.type).toBe("image/png");
  });

  it('usa "Sin título (copia)" si el original no tenía nombre', async () => {
    const store = createMemoryProjectStore();
    await store.save(
      buildWorkspaceProject("project_1", { metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW } }),
    );

    const clone = await duplicateProject(store, pid("project_1"), { now: NOW, generateId: () => "fresh" });

    expect(clone!.metadata.name).toBe("Sin título (copia)");
  });
});
