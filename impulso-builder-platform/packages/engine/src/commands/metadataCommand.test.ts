import { describe, expect, it } from "vitest";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema } from "@impulso/document-schema";
import { updateMetadata } from "./metadataCommand.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

function fullProject() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
  });
}

describe("updateMetadata — project", () => {
  it("actualiza el nombre del proyecto", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "project" },
      metadata: { name: "Nuevo nombre" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.metadata.name).toBe("Nuevo nombre");
  });

  it("rechaza un patch de metadata inválido", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "project" },
      metadata: { tags: "no-es-un-array" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_metadata");
  });
});

describe("updateMetadata — document", () => {
  it("actualiza el nombre del documento", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "document" },
      metadata: { name: "Documento renombrado" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.document.metadata.name).toBe("Documento renombrado");
  });

  it("rechaza un patch de metadata inválido", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "document" },
      metadata: { tags: "no-es-un-array" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_metadata");
  });
});

describe("updateMetadata — page", () => {
  it("actualiza metadata de una página existente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "page", pageId: PageIdSchema.parse("page_1") },
      metadata: { name: "Página 1" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.document.pages[0]?.metadata.name).toBe("Página 1");
  });

  it("rechaza una página inexistente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "page", pageId: PageIdSchema.parse("no_existe") },
      metadata: { name: "x" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("rechaza un patch de metadata inválido", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "page", pageId: PageIdSchema.parse("page_1") },
      metadata: { tags: "no-es-un-array" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_metadata");
  });
});

describe("updateMetadata — layer", () => {
  it("actualiza metadata de una layer existente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "layer", pageId: PageIdSchema.parse("page_1"), layerId: LayerIdSchema.parse("layer_1") },
      metadata: { name: "Capa 1" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.document.pages[0]?.layers[0]?.metadata.name).toBe("Capa 1");
  });

  it("rechaza una página inexistente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "layer", pageId: PageIdSchema.parse("no_existe"), layerId: LayerIdSchema.parse("layer_1") },
      metadata: { name: "x" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("rechaza una layer inexistente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "layer", pageId: PageIdSchema.parse("page_1"), layerId: LayerIdSchema.parse("no_existe") },
      metadata: { name: "x" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("layer_not_found");
  });

  it("rechaza un patch de metadata inválido", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "layer", pageId: PageIdSchema.parse("page_1"), layerId: LayerIdSchema.parse("layer_1") },
      metadata: { tags: "no-es-un-array" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_metadata");
  });
});

describe("updateMetadata — object", () => {
  it("actualiza metadata de un object existente (incluyendo anidado)", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "object", objectId: ObjectIdSchema.parse("rect_1") },
      metadata: { role: "die-line" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects[0]?.metadata.role).toBe("die-line");
    }
  });

  it("rechaza un objectId inexistente", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "object", objectId: ObjectIdSchema.parse("no_existe") },
      metadata: { role: "die-line" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });

  it("rechaza un patch de metadata inválido", () => {
    const result = updateMetadata(fullProject(), {
      type: "updateMetadata",
      target: { level: "object", objectId: ObjectIdSchema.parse("rect_1") },
      metadata: { tags: "no-es-un-array" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_metadata");
  });
});
