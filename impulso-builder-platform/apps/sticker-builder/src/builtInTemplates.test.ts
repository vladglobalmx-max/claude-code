import { describe, expect, it, vi } from "vitest";
import { createMemoryTemplateStore } from "@impulso/template-library";
import { BUILT_IN_STICKER_TEMPLATES, seedBuiltInTemplates } from "./builtInTemplates.js";

const NOW = "2026-07-19T00:00:00.000Z";
const fakeThumbnail = async () => new Blob(["png"], { type: "image/png" });

describe("BUILT_IN_STICKER_TEMPLATES", () => {
  it("incluye exactamente los 3 tamaños curados (cuadrado, círculo, rectángulo)", () => {
    expect(BUILT_IN_STICKER_TEMPLATES.map((t) => t.shape)).toEqual(["square", "circle", "rectangle"]);
  });
});

describe("seedBuiltInTemplates", () => {
  it("siembra los 3 Templates incorporados con moduleId sticker-builder", async () => {
    const store = createMemoryTemplateStore();
    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const descriptors = await store.listDescriptors({ moduleId: "sticker-builder" });
    expect(descriptors).toHaveLength(3);
    expect(descriptors.every((d) => d.builtIn)).toBe(true);
  });

  it("cada Template sembrado tiene su thumbnail y un Project válido", async () => {
    const store = createMemoryTemplateStore();
    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const content = await store.getContent("builtin_square-5x5");
    expect(content?.thumbnail).toBeInstanceOf(Blob);
    expect(content?.project.document.pages[0]?.size).toEqual({ width: 50, height: 50 });
  });

  it("es idempotente: llamarla dos veces no duplica los Templates ni vuelve a generar el thumbnail", async () => {
    const store = createMemoryTemplateStore();
    const generateThumbnail = vi.fn(fakeThumbnail);

    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail });
    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail });

    expect(await store.listDescriptors({ moduleId: "sticker-builder" })).toHaveLength(3);
    expect(generateThumbnail).toHaveBeenCalledTimes(3);
  });

  it("con un Template ya sembrado manualmente bajo el mismo id, no lo vuelve a crear", async () => {
    const store = createMemoryTemplateStore();
    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });
    const originalProject = (await store.getContent("builtin_square-5x5"))!.project;
    await store.save(
      { id: "builtin_square-5x5", moduleId: "sticker-builder", name: "Renombrado manualmente", tags: [], builtIn: true, createdAt: NOW, updatedAt: NOW },
      { project: originalProject },
    );

    await seedBuiltInTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const descriptor = await store.getDescriptor("builtin_square-5x5");
    expect(descriptor?.name).toBe("Renombrado manualmente");
  });
});
