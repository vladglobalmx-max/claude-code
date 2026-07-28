import { describe, expect, it } from "vitest";
import { buildCatalogTemplateDescriptor } from "./descriptorFactory.js";
import type { CatalogTemplateSeed } from "./types.js";

const NOW = "2026-07-28T00:00:00.000Z";
const seed: CatalogTemplateSeed = {
  id: "catalog_test",
  name: "Test Template",
  description: "desc",
  tags: ["a", "b"],
  category: "Cosmetics",
  shape: "circle",
  difficulty: "Intermedio",
  targetAudience: "audience",
  useCase: "use case",
  suggestedColors: ["#111111"],
  buildProject: () => {
    throw new Error("no debería invocarse en este test");
  },
};

describe("buildCatalogTemplateDescriptor", () => {
  it("mapea todos los campos del seed al TemplateDescriptor", () => {
    const descriptor = buildCatalogTemplateDescriptor(seed, { moduleId: "sticker-builder", now: NOW });
    expect(descriptor).toMatchObject({
      id: "catalog_test",
      moduleId: "sticker-builder",
      name: "Test Template",
      description: "desc",
      tags: ["a", "b"],
      category: "Cosmetics",
      shape: "circle",
      difficulty: "Intermedio",
      targetAudience: "audience",
      useCase: "use case",
      suggestedColors: ["#111111"],
    });
  });

  it("siempre marca builtIn: true", () => {
    const descriptor = buildCatalogTemplateDescriptor(seed, { moduleId: "sticker-builder", now: NOW });
    expect(descriptor.builtIn).toBe(true);
  });

  it("usa createdAt/updatedAt = now, y authorId por defecto 'thoren'", () => {
    const descriptor = buildCatalogTemplateDescriptor(seed, { moduleId: "sticker-builder", now: NOW });
    expect(descriptor.createdAt).toBe(NOW);
    expect(descriptor.updatedAt).toBe(NOW);
    expect(descriptor.authorId).toBe("thoren");
  });

  it("respeta un authorId explícito", () => {
    const descriptor = buildCatalogTemplateDescriptor(seed, { moduleId: "sticker-builder", now: NOW, authorId: "otro" });
    expect(descriptor.authorId).toBe("otro");
  });
});
