import { describe, expect, it, vi } from "vitest";
import { createMemoryTemplateStore } from "@impulso/template-library";
import { BUILT_IN_STICKER_TEMPLATES, seedBuiltInTemplates, createLazyBuiltInTemplateSeeder } from "./builtInTemplates.js";
import { CATALOG_TEMPLATES } from "./catalogTemplates/index.js";

const TOTAL_SEEDABLE = BUILT_IN_STICKER_TEMPLATES.length + CATALOG_TEMPLATES.length;

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

describe("createLazyBuiltInTemplateSeeder", () => {
  it("siembra los built-in y los templates de catálogo la primera vez que se llama a ensureSeeded()", async () => {
    const store = createMemoryTemplateStore();
    const seeder = createLazyBuiltInTemplateSeeder(store, { now: () => NOW, generateThumbnail: fakeThumbnail });

    await seeder.ensureSeeded();

    // 3 tamaños en blanco + todos los templates del catálogo de contenido
    // (el piloto y el Lote 1 — ver catalogTemplates/index.ts).
    expect(await store.listDescriptors({ moduleId: "sticker-builder" })).toHaveLength(TOTAL_SEEDABLE);
    expect(await store.getDescriptor("catalog_serum-facial-premium")).toBeDefined();
  });

  it("no vuelve a sembrar en llamadas posteriores de la misma instancia", async () => {
    const store = createMemoryTemplateStore();
    const generateThumbnail = vi.fn(fakeThumbnail);
    const seeder = createLazyBuiltInTemplateSeeder(store, { now: () => NOW, generateThumbnail });

    await seeder.ensureSeeded();
    await seeder.ensureSeeded();

    // 3 built-in + N del catálogo, una sola vez (la segunda llamada a
    // ensureSeeded() es un no-op).
    expect(generateThumbnail).toHaveBeenCalledTimes(TOTAL_SEEDABLE);
  });

  it("nunca lanza: un fallo de sembrado se registra y se traga (para ambas fuentes de templates)", async () => {
    const store = createMemoryTemplateStore();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const seeder = createLazyBuiltInTemplateSeeder(store, {
      now: () => NOW,
      generateThumbnail: async () => {
        throw new Error("fallo de rasterización");
      },
    });

    await expect(seeder.ensureSeeded()).resolves.toBeUndefined();
    // Un fallo en seedBuiltInTemplates y otro en seedCatalogTemplates —
    // cada fuente de siembra se registra y se traga independientemente
    // (ver createLazyBuiltInTemplateSeeder).
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
