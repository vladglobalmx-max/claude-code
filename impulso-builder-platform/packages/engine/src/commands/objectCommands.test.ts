import { describe, expect, it } from "vitest";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema } from "@impulso/document-schema";
import {
  addObject,
  removeObject,
  updateObjectTransform,
  updateObjectStyle,
  reorderObjects,
} from "./objectCommands.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, buildGroup } from "../testUtils/fixtures.js";

function projectWithRect() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
  });
}

describe("addObject", () => {
  it("agrega un object a una layer existente", () => {
    const project = buildProject();
    const result = addObject(project, {
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRectangle("rect_1"),
    });
    expect(result.ok).toBe(false); // layer_1 no existe todavía en el fixture base
  });

  it("agrega un object a una layer que sí existe", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1")])]),
    });
    const result = addObject(project, {
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRectangle("rect_1"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["rect_1"]);
    }
  });

  it("rechaza un objectId que ya existe en cualquier parte del documento", () => {
    const project = projectWithRect();
    const result = addObject(project, {
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRectangle("rect_1"),
    });
    expect(result.ok).toBe(false);
  });

  it("rechaza layerId inexistente", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1")]) });
    const result = addObject(project, {
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("no_existe"),
      object: buildRectangle("rect_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("layer_not_found");
  });

  it("rechaza pageId inexistente", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1")]) });
    const result = addObject(project, {
      type: "addObject",
      pageId: PageIdSchema.parse("no_existe"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRectangle("rect_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });
});

describe("removeObject", () => {
  it("elimina un object de nivel superior", () => {
    const result = removeObject(projectWithRect(), {
      type: "removeObject",
      objectId: ObjectIdSchema.parse("rect_1"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects).toHaveLength(0);
    }
  });

  it("elimina un object anidado dentro de un group", () => {
    const leaf = buildRectangle("leaf");
    const group = buildGroup("group_1", [leaf]);
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]),
    });
    const result = removeObject(project, { type: "removeObject", objectId: ObjectIdSchema.parse("leaf") });
    expect(result.ok).toBe(true);
  });

  it("rechaza un objectId inexistente", () => {
    const result = removeObject(projectWithRect(), {
      type: "removeObject",
      objectId: ObjectIdSchema.parse("no_existe"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });
});

describe("updateObjectTransform", () => {
  it("mezcla el transform parcial sobre el existente", () => {
    const result = updateObjectTransform(projectWithRect(), {
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: 50 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    }
  });

  it("rechaza un objectId inexistente", () => {
    const result = updateObjectTransform(projectWithRect(), {
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("no_existe"),
      transform: { x: 50 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });

  it("rechaza un transform inválido tras el merge", () => {
    const result = updateObjectTransform(projectWithRect(), {
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: "no-es-un-numero" as never },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_transform");
  });
});

describe("updateObjectStyle", () => {
  it("rechaza un objectId inexistente", () => {
    const result = updateObjectStyle(projectWithRect(), {
      type: "updateObjectStyle",
      objectId: ObjectIdSchema.parse("no_existe"),
      style: { fill: "#000000" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });

  it("mezcla el style parcial sobre el existente", () => {
    const result = updateObjectStyle(projectWithRect(), {
      type: "updateObjectStyle",
      objectId: ObjectIdSchema.parse("rect_1"),
      style: { fill: "#123456" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.style.fill).toBe("#123456");
    }
  });

  it("rechaza un style inválido (opacity fuera de rango)", () => {
    const result = updateObjectStyle(projectWithRect(), {
      type: "updateObjectStyle",
      objectId: ObjectIdSchema.parse("rect_1"),
      style: { opacity: 5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_style");
  });
});

describe("reorderObjects", () => {
  it("reordena los objects de nivel superior de una layer", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
      ]),
    });
    const result = reorderObjects(project, {
      type: "reorderObjects",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      objectIds: [ObjectIdSchema.parse("b"), ObjectIdSchema.parse("a")],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["b", "a"]);
    }
  });

  it("rechaza un conjunto que no coincide", () => {
    const result = reorderObjects(projectWithRect(), {
      type: "reorderObjects",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      objectIds: [ObjectIdSchema.parse("otro")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_reorder");
  });

  it("rechaza una página inexistente", () => {
    const result = reorderObjects(projectWithRect(), {
      type: "reorderObjects",
      pageId: PageIdSchema.parse("no_existe"),
      layerId: LayerIdSchema.parse("layer_1"),
      objectIds: [ObjectIdSchema.parse("rect_1")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("rechaza una layer inexistente", () => {
    const result = reorderObjects(projectWithRect(), {
      type: "reorderObjects",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("no_existe"),
      objectIds: [ObjectIdSchema.parse("rect_1")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("layer_not_found");
  });
});
