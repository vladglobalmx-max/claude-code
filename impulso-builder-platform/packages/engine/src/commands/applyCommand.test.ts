import { describe, expect, it } from "vitest";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema } from "@impulso/document-schema";
import { applyContentCommand } from "./applyCommand.js";
import {
  buildProject,
  buildDocument,
  buildPage,
  buildLayer,
  buildRectangle,
  NOW,
} from "../testUtils/fixtures.js";

function options(now = NOW) {
  let counter = 0;
  return { now, generateHistoryEntryId: () => `history_${++counter}` };
}

/** Documento con 2 páginas y una página con 2 layers/2 objects, para poder
 * ejercitar los comandos de "reorder" de forma significativa. */
function richProject() {
  return buildProject({
    document: buildDocument([
      buildPage("page_1", [
        buildLayer("layer_1", [buildRectangle("rect_1"), buildRectangle("rect_2")]),
        buildLayer("layer_2"),
      ]),
      buildPage("page_2"),
    ]),
  });
}

describe("applyContentCommand — versionado e historial", () => {
  it("camino feliz: updateMetadata a nivel documento incrementa documentVersion y agrega history", () => {
    const project = buildProject();
    const before = project.document.documentVersion;

    const result = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Renombrado" } },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.documentVersion).toBe(before + 1);
      expect(result.value.document.history.entries).toHaveLength(1);
      expect(result.value.document.history.entries[0]).toMatchObject({
        documentVersionBefore: before,
        documentVersionAfter: before + 1,
        description: "Actualizar metadata (document)",
      });
      expect(result.value.document.metadata.updatedAt).toBe(NOW);
      expect(result.value.metadata.updatedAt).toBe(NOW);
    }
  });

  it("updateMetadata a nivel project NO incrementa documentVersion ni agrega history", () => {
    const project = buildProject();
    const before = project.document.documentVersion;

    const result = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "project" }, metadata: { name: "Solo el proyecto" } },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.documentVersion).toBe(before);
      expect(result.value.document.history.entries).toHaveLength(0);
      expect(result.value.metadata.name).toBe("Solo el proyecto");
      expect(result.value.metadata.updatedAt).toBe(NOW);
    }
  });

  it("acumula múltiples entradas de historial en orden", () => {
    let project = buildProject();
    const opts = options();

    const first = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Uno" } },
      opts,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    project = first.value;

    const second = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Dos" } },
      opts,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.value.document.history.entries.map((e) => e.id)).toEqual(["history_1", "history_2"]);
    expect(second.value.document.documentVersion).toBe(project.document.documentVersion + 1);
  });

  it("propaga el error del reducer sin tocar version/historial", () => {
    const project = buildProject();
    const result = applyContentCommand(
      project,
      { type: "removePage", pageId: "no_existe" as never },
      options(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("la red de seguridad rechaza un Project que quedaría inválido, aunque el reducer específico no lo detecte", () => {
    // Se corrompe el documento a propósito (pages: []) SIN pasar por
    // removePage (que sí lo impediría) para probar que applyContentCommand
    // no confía ciegamente en cada reducer individual.
    const project = buildProject();
    const corrupted = { ...project, document: { ...project.document, pages: [] } };

    const result = applyContentCommand(
      corrupted,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "x" } },
      options(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invariant_violation");
  });
});

describe("applyContentCommand — cada tipo de ContentCommand a través del pipeline completo", () => {
  it("removePage", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "removePage", pageId: PageIdSchema.parse("page_2") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Eliminar página "page_2"');
    }
  });

  it("reorderPages", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "reorderPages", pageIds: [PageIdSchema.parse("page_2"), PageIdSchema.parse("page_1")] },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_2", "page_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar páginas");
    }
  });

  it("removeLayer", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "removeLayer", pageId: PageIdSchema.parse("page_1"), layerId: LayerIdSchema.parse("layer_2") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Eliminar layer "layer_2"');
    }
  });

  it("reorderLayers", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "reorderLayers",
        pageId: PageIdSchema.parse("page_1"),
        layerIds: [LayerIdSchema.parse("layer_2"), LayerIdSchema.parse("layer_1")],
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_2", "layer_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar layers");
    }
  });

  it("updateObjectStyle", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "updateObjectStyle", objectId: ObjectIdSchema.parse("rect_1"), style: { fill: "#ff00ff" } },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.style.fill).toBe("#ff00ff");
      expect(result.value.document.history.entries[0]?.description).toBe('Cambiar estilo de object "rect_1"');
    }
  });

  it("reorderObjects", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "reorderObjects",
        pageId: PageIdSchema.parse("page_1"),
        layerId: LayerIdSchema.parse("layer_1"),
        objectIds: [ObjectIdSchema.parse("rect_2"), ObjectIdSchema.parse("rect_1")],
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["rect_2", "rect_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar objects");
    }
  });

  it("resizeObject", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "resizeObject",
        objectId: ObjectIdSchema.parse("rect_1"),
        handle: "bottom-right",
        pointerDelta: { x: 5, y: 5 },
        intrinsicSize: { width: 10, height: 10 },
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1.5, scaleY: 1.5 });
      expect(result.value.document.history.entries[0]?.description).toBe(
        'Redimensionar object "rect_1" (handle: bottom-right)',
      );
    }
  });

  it("rotateObject", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "rotateObject",
        objectId: ObjectIdSchema.parse("rect_1"),
        pointerAngleDegrees: 45,
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.rotation).toBe(45);
      expect(result.value.document.history.entries[0]?.description).toBe('Rotar object "rect_1"');
    }
  });
});
