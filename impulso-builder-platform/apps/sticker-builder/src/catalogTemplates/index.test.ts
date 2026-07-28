import { describe, expect, it, vi } from "vitest";
import { createMemoryTemplateStore } from "@impulso/template-library";
import { validateProject } from "@impulso/document-schema";
import { CATALOG_TEMPLATES, seedCatalogTemplates } from "./index.js";

const NOW = "2026-07-19T00:00:00.000Z";
const fakeThumbnail = async () => new Blob(["png"], { type: "image/png" });

describe("CATALOG_TEMPLATES", () => {
  it("incluye el piloto, el Lote 1 completo, el Lote 2 completo y el Lote 3 completo (15 templates)", () => {
    expect(CATALOG_TEMPLATES).toHaveLength(15);
    expect(CATALOG_TEMPLATES.map((t) => t.id)).toEqual([
      "catalog_serum-facial-premium",
      "catalog_lip-balm-natural",
      "catalog_spa-wellness",
      "catalog_neutral-minimal-label",
      "catalog_closure-seal",
      "catalog_thank-you-preference",
      "catalog_kraft-generic-label",
      "catalog_corporate-simple-label",
      "catalog_handmade-gift-seal",
      "catalog_kraft-handmade-etsy",
      "catalog_etsy-neutral-packaging",
      "catalog_salon-appointment-seal",
      "catalog_corporate-seal",
      "catalog_homemade-stamp",
      "catalog_wedding-envelope-seal",
    ]);
  });
});

describe("seedCatalogTemplates", () => {
  it("siembra el template con moduleId sticker-builder y builtIn: true", async () => {
    const store = createMemoryTemplateStore();
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const descriptor = await store.getDescriptor("catalog_serum-facial-premium");
    expect(descriptor?.moduleId).toBe("sticker-builder");
    expect(descriptor?.builtIn).toBe(true);
  });

  it("guarda toda la metadata extendida del catálogo (categoría, forma, dificultad, público, caso de uso, colores)", async () => {
    const store = createMemoryTemplateStore();
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const descriptor = await store.getDescriptor("catalog_serum-facial-premium");
    expect(descriptor?.category).toBe("Cosmetics");
    expect(descriptor?.shape).toBe("circle");
    expect(descriptor?.difficulty).toBe("Intermedio");
    expect(descriptor?.targetAudience).toContain("skincare");
    expect(descriptor?.useCase).toContain("30ml");
    expect(descriptor?.suggestedColors).toEqual(["#23282B", "#EDEAE2", "#9C4E27"]);
    expect(descriptor?.authorId).toBe("thoren");
  });

  it("el Project sembrado es válido contra document-schema y tiene un thumbnail real", async () => {
    const store = createMemoryTemplateStore();
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const content = await store.getContent("catalog_serum-facial-premium");
    expect(() => validateProject(content!.project)).not.toThrow();
    expect(content?.thumbnail).toBeInstanceOf(Blob);
  });

  it("queda descubrible por categoría vía TemplateStore.listDescriptors({category})", async () => {
    const store = createMemoryTemplateStore();
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    const cosmetics = await store.listDescriptors({ category: "Cosmetics" });
    expect(cosmetics.map((d) => d.id)).toContain("catalog_serum-facial-premium");
  });

  it("es idempotente: llamarla dos veces no duplica ni vuelve a generar el thumbnail", async () => {
    const store = createMemoryTemplateStore();
    const generateThumbnail = vi.fn(fakeThumbnail);

    await seedCatalogTemplates(store, { now: NOW, generateThumbnail });
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail });

    expect(await store.listDescriptors({ moduleId: "sticker-builder" })).toHaveLength(CATALOG_TEMPLATES.length);
    expect(generateThumbnail).toHaveBeenCalledTimes(CATALOG_TEMPLATES.length);
  });

  it("cada template de CATALOG_TEMPLATES (incluido todo el Lote 1) produce un Project válido y queda sembrado como builtIn", async () => {
    const store = createMemoryTemplateStore();
    await seedCatalogTemplates(store, { now: NOW, generateThumbnail: fakeThumbnail });

    for (const seed of CATALOG_TEMPLATES) {
      const descriptor = await store.getDescriptor(seed.id);
      const content = await store.getContent(seed.id);
      expect(descriptor?.builtIn, `${seed.id} debería ser builtIn`).toBe(true);
      expect(() => validateProject(content!.project), `${seed.id} debería producir un Project válido`).not.toThrow();
    }
  });
});
