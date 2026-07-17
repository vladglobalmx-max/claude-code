import { describe, expect, it } from "vitest";
import { PageIdSchema, LayerIdSchema } from "@impulso/document-schema";
import { addLayer, removeLayer, reorderLayers } from "./layerCommands.js";
import { buildProject, buildDocument, buildPage, buildLayer } from "../testUtils/fixtures.js";

function projectWithTwoLayers() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1"), buildLayer("layer_2")])]),
  });
}

describe("addLayer", () => {
  it("agrega una layer al final de la página", () => {
    const project = buildProject();
    const result = addLayer(project, {
      type: "addLayer",
      pageId: PageIdSchema.parse("page_1"),
      layer: buildLayer("layer_new"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_new"]);
    }
  });

  it("rechaza una página inexistente", () => {
    const project = buildProject();
    const result = addLayer(project, {
      type: "addLayer",
      pageId: PageIdSchema.parse("no_existe"),
      layer: buildLayer("layer_new"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("rechaza un layerId duplicado en la misma página", () => {
    const project = projectWithTwoLayers();
    const result = addLayer(project, {
      type: "addLayer",
      pageId: PageIdSchema.parse("page_1"),
      layer: buildLayer("layer_1"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("removeLayer", () => {
  it("elimina una layer existente", () => {
    const result = removeLayer(projectWithTwoLayers(), {
      type: "removeLayer",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_2"]);
    }
  });

  it("rechaza un layerId inexistente", () => {
    const result = removeLayer(projectWithTwoLayers(), {
      type: "removeLayer",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("no_existe"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("layer_not_found");
  });

  it("rechaza una página inexistente", () => {
    const result = removeLayer(projectWithTwoLayers(), {
      type: "removeLayer",
      pageId: PageIdSchema.parse("no_existe"),
      layerId: LayerIdSchema.parse("layer_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });
});

describe("reorderLayers", () => {
  it("reordena las layers de una página", () => {
    const result = reorderLayers(projectWithTwoLayers(), {
      type: "reorderLayers",
      pageId: PageIdSchema.parse("page_1"),
      layerIds: [LayerIdSchema.parse("layer_2"), LayerIdSchema.parse("layer_1")],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_2", "layer_1"]);
    }
  });

  it("rechaza un conjunto que no coincide", () => {
    const result = reorderLayers(projectWithTwoLayers(), {
      type: "reorderLayers",
      pageId: PageIdSchema.parse("page_1"),
      layerIds: [LayerIdSchema.parse("layer_1")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_reorder");
  });

  it("rechaza una página inexistente", () => {
    const result = reorderLayers(projectWithTwoLayers(), {
      type: "reorderLayers",
      pageId: PageIdSchema.parse("no_existe"),
      layerIds: [LayerIdSchema.parse("layer_1"), LayerIdSchema.parse("layer_2")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });
});
