import { expect, it } from "vitest";
import type { TemplateStore } from "../types.js";
import { buildTemplateDescriptor, buildTemplateProject } from "../testUtils/fixtures.js";

/**
 * Suite de contrato compartida entre `memoryTemplateStore` e
 * `indexedDbTemplateStore`: ambas implementaciones deben comportarse
 * idénticamente desde la perspectiva de quien las usa — mismo criterio ya
 * probado en `@impulso/asset-library` para `AssetBinaryStore`.
 */
export function testTemplateStoreContract(name: string, createStore: () => TemplateStore | Promise<TemplateStore>) {
  it(`${name}: listDescriptors() sin nada guardado devuelve []`, async () => {
    const store = await createStore();
    expect(await store.listDescriptors()).toEqual([]);
  });

  it(`${name}: getDescriptor()/getContent() de un id nunca guardado devuelven undefined`, async () => {
    const store = await createStore();
    expect(await store.getDescriptor("no_existe")).toBeUndefined();
    expect(await store.getContent("no_existe")).toBeUndefined();
  });

  it(`${name}: save() + getDescriptor()/getContent() devuelve lo mismo guardado`, async () => {
    const store = await createStore();
    const descriptor = buildTemplateDescriptor("tpl_1");
    const project = buildTemplateProject();

    await store.save(descriptor, { project });

    expect(await store.getDescriptor("tpl_1")).toEqual(descriptor);
    const content = await store.getContent("tpl_1");
    expect(content?.project).toEqual(project);
  });

  it(`${name}: save() guarda el thumbnail junto al contenido`, async () => {
    const store = await createStore();
    const thumbnail = new Blob(["png-bytes"], { type: "image/png" });
    await store.save(buildTemplateDescriptor("tpl_1"), { project: buildTemplateProject(), thumbnail });

    const content = await store.getContent("tpl_1");
    expect(content?.thumbnail).toBeDefined();
    expect(content?.thumbnail?.type).toBe("image/png");
  });

  it(`${name}: save() sobre un id existente reemplaza el descriptor y el contenido anteriores`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_1", { name: "Viejo" }), { project: buildTemplateProject() });
    await store.save(buildTemplateDescriptor("tpl_1", { name: "Nuevo" }), {
      project: buildTemplateProject({ metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "x", name: "Nuevo Project" } }),
    });

    const descriptor = await store.getDescriptor("tpl_1");
    expect(descriptor?.name).toBe("Nuevo");
  });

  it(`${name}: listDescriptors() devuelve todos los guardados`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_1"), { project: buildTemplateProject() });
    await store.save(buildTemplateDescriptor("tpl_2"), { project: buildTemplateProject() });

    const all = await store.listDescriptors();
    expect(all.map((d) => d.id).sort()).toEqual(["tpl_1", "tpl_2"]);
  });

  it(`${name}: listDescriptors({moduleId}) filtra por módulo`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_sticker", { moduleId: "sticker-builder" }), {
      project: buildTemplateProject(),
    });
    await store.save(buildTemplateDescriptor("tpl_planner", { moduleId: "planner-builder" }), {
      project: buildTemplateProject({ moduleId: "planner-builder" }),
    });

    const stickerOnly = await store.listDescriptors({ moduleId: "sticker-builder" });
    expect(stickerOnly.map((d) => d.id)).toEqual(["tpl_sticker"]);
  });

  it(`${name}: listDescriptors({category}) filtra por categoría de catálogo`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_cosmetics", { category: "Cosmetics" }), {
      project: buildTemplateProject(),
    });
    await store.save(buildTemplateDescriptor("tpl_wedding", { category: "Wedding" }), {
      project: buildTemplateProject(),
    });

    const cosmeticsOnly = await store.listDescriptors({ category: "Cosmetics" });
    expect(cosmeticsOnly.map((d) => d.id)).toEqual(["tpl_cosmetics"]);
  });

  it(`${name}: listDescriptors({shape}) filtra por forma de troquel`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_circle", { shape: "circle" }), {
      project: buildTemplateProject(),
    });
    await store.save(buildTemplateDescriptor("tpl_square", { shape: "square" }), {
      project: buildTemplateProject(),
    });

    const circleOnly = await store.listDescriptors({ shape: "circle" });
    expect(circleOnly.map((d) => d.id)).toEqual(["tpl_circle"]);
  });

  it(`${name}: listDescriptors({moduleId, category}) combina filtros (AND)`, async () => {
    const store = await createStore();
    await store.save(
      buildTemplateDescriptor("tpl_match", { moduleId: "sticker-builder", category: "Cosmetics" }),
      { project: buildTemplateProject() },
    );
    await store.save(
      buildTemplateDescriptor("tpl_wrong_module", { moduleId: "planner-builder", category: "Cosmetics" }),
      { project: buildTemplateProject({ moduleId: "planner-builder" }) },
    );
    await store.save(
      buildTemplateDescriptor("tpl_wrong_category", { moduleId: "sticker-builder", category: "Wedding" }),
      { project: buildTemplateProject() },
    );

    const matched = await store.listDescriptors({ moduleId: "sticker-builder", category: "Cosmetics" });
    expect(matched.map((d) => d.id)).toEqual(["tpl_match"]);
  });

  it(`${name}: un descriptor guardado sin campos extendidos (registro legado) se lee sin error`, async () => {
    const store = await createStore();
    // Simula un TemplateDescriptor guardado ANTES de la extensión de
    // metadata (los 3 built-in originales, cualquier plantilla de usuario
    // ya guardada) — ningún campo nuevo presente en absoluto.
    const legacyDescriptor = buildTemplateDescriptor("tpl_legacy");
    await store.save(legacyDescriptor, { project: buildTemplateProject() });

    const read = await store.getDescriptor("tpl_legacy");
    expect(read).toEqual(legacyDescriptor);
    expect(read?.category).toBeUndefined();

    // Filtrar por un campo extendido sobre un registro legado no lanza —
    // simplemente no lo incluye (undefined !== "Cosmetics").
    const filtered = await store.listDescriptors({ category: "Cosmetics" });
    expect(filtered.map((d) => d.id)).not.toContain("tpl_legacy");
  });

  it(`${name}: delete() de un id existente lo remueve (descriptor y contenido)`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_1"), { project: buildTemplateProject() });

    await store.delete("tpl_1");

    expect(await store.getDescriptor("tpl_1")).toBeUndefined();
    expect(await store.getContent("tpl_1")).toBeUndefined();
  });

  it(`${name}: delete() de un id inexistente no lanza`, async () => {
    const store = await createStore();
    await expect(store.delete("no_existe")).resolves.not.toThrow();
  });

  it(`${name}: clear() vacía todos los Templates guardados`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_1"), { project: buildTemplateProject() });
    await store.save(buildTemplateDescriptor("tpl_2"), { project: buildTemplateProject() });

    await store.clear();

    expect(await store.listDescriptors()).toEqual([]);
  });

  it(`${name}: dos Templates distintos no se pisan entre sí`, async () => {
    const store = await createStore();
    await store.save(buildTemplateDescriptor("tpl_1", { name: "Uno" }), { project: buildTemplateProject() });
    await store.save(buildTemplateDescriptor("tpl_2", { name: "Dos" }), { project: buildTemplateProject() });

    expect((await store.getDescriptor("tpl_1"))?.name).toBe("Uno");
    expect((await store.getDescriptor("tpl_2"))?.name).toBe("Dos");
  });
}
