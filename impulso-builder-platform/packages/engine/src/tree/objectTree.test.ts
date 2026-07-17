import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { findObjectInDocument, updateObjectInDocument, removeObjectFromDocument } from "./objectTree.js";
import { buildDocument, buildLayer, buildPage, buildRectangle, buildGroup } from "../testUtils/fixtures.js";

function buildNestedDocument() {
  const leaf = buildRectangle("leaf");
  const innerGroup = buildGroup("inner_group", [leaf]);
  const outerGroup = buildGroup("outer_group", [innerGroup, buildRectangle("sibling")]);
  const layer = buildLayer("layer_1", [outerGroup]);
  const page = buildPage("page_1", [layer]);
  return buildDocument([page]);
}

describe("findObjectInDocument", () => {
  it("encuentra un objeto en el nivel superior de una layer", () => {
    const document = buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]);
    const found = findObjectInDocument(document, ObjectIdSchema.parse("rect_1"));
    expect(found?.id).toBe("rect_1");
  });

  it("encuentra un objeto anidado varios niveles dentro de groups", () => {
    const document = buildNestedDocument();
    const found = findObjectInDocument(document, ObjectIdSchema.parse("leaf"));
    expect(found?.type).toBe("rectangle");
  });

  it("devuelve undefined si el objeto no existe", () => {
    const document = buildNestedDocument();
    expect(findObjectInDocument(document, ObjectIdSchema.parse("no_existe"))).toBeUndefined();
  });
});

describe("updateObjectInDocument", () => {
  it("actualiza un objeto anidado sin afectar a sus hermanos", () => {
    const document = buildNestedDocument();
    const updated = updateObjectInDocument(document, ObjectIdSchema.parse("leaf"), (object) => ({
      ...object,
      transform: { ...object.transform, x: 99 },
    }));

    const updatedLeaf = findObjectInDocument(updated, ObjectIdSchema.parse("leaf"));
    expect(updatedLeaf?.transform.x).toBe(99);

    // El original no se muta.
    const originalLeaf = findObjectInDocument(document, ObjectIdSchema.parse("leaf"));
    expect(originalLeaf?.transform.x).toBe(0);

    // El hermano del group externo no se ve afectado.
    const sibling = findObjectInDocument(updated, ObjectIdSchema.parse("sibling"));
    expect(sibling?.transform.x).toBe(0);
  });

  it("no cambia nada si el objectId no existe", () => {
    const document = buildNestedDocument();
    const updated = updateObjectInDocument(document, ObjectIdSchema.parse("no_existe"), (object) => ({
      ...object,
      transform: { ...object.transform, x: 500 },
    }));
    expect(updated).toEqual(document);
  });
});

describe("removeObjectFromDocument", () => {
  it("elimina un objeto anidado dentro de un group", () => {
    const document = buildNestedDocument();
    const updated = removeObjectFromDocument(document, ObjectIdSchema.parse("leaf"));
    expect(findObjectInDocument(updated, ObjectIdSchema.parse("leaf"))).toBeUndefined();
    // El group que lo contenía sigue existiendo, ahora vacío.
    const innerGroup = findObjectInDocument(updated, ObjectIdSchema.parse("inner_group"));
    expect(innerGroup?.type).toBe("group");
    if (innerGroup?.type === "group") {
      expect(innerGroup.children).toHaveLength(0);
    }
  });

  it("elimina un objeto de nivel superior sin afectar al resto de la layer", () => {
    const document = buildDocument([
      buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
    ]);
    const updated = removeObjectFromDocument(document, ObjectIdSchema.parse("a"));
    expect(findObjectInDocument(updated, ObjectIdSchema.parse("a"))).toBeUndefined();
    expect(findObjectInDocument(updated, ObjectIdSchema.parse("b"))).toBeDefined();
  });
});
