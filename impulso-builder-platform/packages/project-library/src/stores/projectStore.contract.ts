import { expect, it } from "vitest";
import { ProjectIdSchema } from "@impulso/document-schema";
import type { ProjectStore } from "../types.js";
import { buildWorkspaceProject } from "../testUtils/fixtures.js";

const NOW_A = "2026-07-19T00:00:00.000Z";
const pid = (id: string) => ProjectIdSchema.parse(id);

/**
 * Suite de contrato compartida entre `memoryProjectStore` e
 * `indexedDbProjectStore`: ambas implementaciones deben comportarse
 * idénticamente — mismo criterio ya probado en Asset Library/Template
 * Library.
 */
export function testProjectStoreContract(name: string, createStore: () => ProjectStore | Promise<ProjectStore>) {
  it(`${name}: listDescriptors() sin nada guardado devuelve []`, async () => {
    const store = await createStore();
    expect(await store.listDescriptors()).toEqual([]);
  });

  it(`${name}: getDescriptor()/getProject() de un id nunca guardado devuelven undefined`, async () => {
    const store = await createStore();
    expect(await store.getDescriptor(pid("project_no_existe"))).toBeUndefined();
    expect(await store.getProject(pid("project_no_existe"))).toBeUndefined();
  });

  it(`${name}: save() + getProject() devuelve el mismo Project guardado`, async () => {
    const store = await createStore();
    const project = buildWorkspaceProject("project_1");

    await store.save(project);

    expect(await store.getProject(pid("project_1"))).toEqual(project);
  });

  it(`${name}: save() deriva el descriptor del propio Project (id/moduleId/nombre/timestamps)`, async () => {
    const store = await createStore();
    const project = buildWorkspaceProject("project_1");

    await store.save(project);

    const descriptor = await store.getDescriptor(pid("project_1"));
    expect(descriptor).toMatchObject({
      id: "project_1",
      moduleId: "sticker-builder",
      name: "Proyecto de prueba",
      createdAt: project.metadata.createdAt,
      updatedAt: project.metadata.updatedAt,
    });
  });

  it(`${name}: save() sin metadata.name usa "Sin título" como fallback`, async () => {
    const store = await createStore();
    const project = buildWorkspaceProject("project_1", {
      metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "x" },
    });

    await store.save(project);

    expect((await store.getDescriptor(pid("project_1")))?.name).toBe("Sin título");
  });

  it(`${name}: save() con thumbnail lo guarda en el descriptor`, async () => {
    const store = await createStore();
    const thumbnail = new Blob(["png-bytes"], { type: "image/png" });

    await store.save(buildWorkspaceProject("project_1"), thumbnail);

    const descriptor = await store.getDescriptor(pid("project_1"));
    expect(descriptor?.thumbnail).toBeDefined();
    expect(descriptor?.thumbnail?.type).toBe("image/png");
  });

  it(`${name}: save() sin thumbnail conserva el thumbnail ya guardado (renombrar no borra la miniatura)`, async () => {
    const store = await createStore();
    const thumbnail = new Blob(["png-bytes"], { type: "image/png" });
    await store.save(buildWorkspaceProject("project_1"), thumbnail);

    const renamed = buildWorkspaceProject("project_1", {
      metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "y", name: "Nuevo nombre" },
    });
    await store.save(renamed);

    const descriptor = await store.getDescriptor(pid("project_1"));
    expect(descriptor?.name).toBe("Nuevo nombre");
    expect(descriptor?.thumbnail?.type).toBe("image/png");
  });

  it(`${name}: save() sobre un id existente reemplaza el Project anterior`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_1"));
    const updated = buildWorkspaceProject("project_1", {
      metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "y", name: "Actualizado" },
    });
    await store.save(updated);

    expect((await store.getDescriptor(pid("project_1")))?.name).toBe("Actualizado");
    expect((await store.getProject(pid("project_1")))?.metadata.name).toBe("Actualizado");
  });

  it(`${name}: listDescriptors() devuelve todos los guardados`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_1"));
    await store.save(buildWorkspaceProject("project_2"));

    const all = await store.listDescriptors();
    expect(all.map((d) => d.id).sort()).toEqual(["project_1", "project_2"]);
  });

  it(`${name}: listDescriptors({moduleId}) filtra por módulo`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_sticker", { moduleId: "sticker-builder" }));
    await store.save(buildWorkspaceProject("project_planner", { moduleId: "planner-builder" }));

    const stickerOnly = await store.listDescriptors({ moduleId: "sticker-builder" });
    expect(stickerOnly.map((d) => d.id)).toEqual(["project_sticker"]);
  });

  it(`${name}: delete() de un id existente lo remueve (descriptor y contenido)`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_1"));

    await store.delete(pid("project_1"));

    expect(await store.getDescriptor(pid("project_1"))).toBeUndefined();
    expect(await store.getProject(pid("project_1"))).toBeUndefined();
  });

  it(`${name}: delete() de un id inexistente no lanza`, async () => {
    const store = await createStore();
    await expect(store.delete(pid("project_no_existe"))).resolves.not.toThrow();
  });

  it(`${name}: clear() vacía todos los proyectos guardados`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_1"));
    await store.save(buildWorkspaceProject("project_2"));

    await store.clear();

    expect(await store.listDescriptors()).toEqual([]);
  });

  it(`${name}: dos proyectos distintos no se pisan entre sí`, async () => {
    const store = await createStore();
    await store.save(buildWorkspaceProject("project_1", { metadata: { tags: [], visible: true, locked: false, createdAt: NOW_A, updatedAt: NOW_A, name: "Uno" } }));
    await store.save(buildWorkspaceProject("project_2", { metadata: { tags: [], visible: true, locked: false, createdAt: NOW_A, updatedAt: NOW_A, name: "Dos" } }));

    expect((await store.getDescriptor(pid("project_1")))?.name).toBe("Uno");
    expect((await store.getDescriptor(pid("project_2")))?.name).toBe("Dos");
  });
}
