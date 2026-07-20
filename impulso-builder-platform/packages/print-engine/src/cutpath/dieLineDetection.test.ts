import { describe, expect, it } from "vitest";
import { NOW, buildEllipse, buildGroup, buildLayer, buildPage, buildRectangle, buildText } from "../testUtils/fixtures.js";
import { resolveDieLineSource } from "./dieLineDetection.js";

const DIE_LINE_METADATA = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line" };

describe("resolveDieLineSource — source auto", () => {
  it("encuentra un único candidato top-level", () => {
    const rect = buildRectangle("rect_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const result = resolveDieLineSource(page, { type: "auto" });
    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.candidate.object.id).toBe("rect_1");
  });

  it("encuentra un candidato anidado dentro de un group, a cualquier profundidad", () => {
    const ellipse = buildEllipse("ellipse_1", { metadata: DIE_LINE_METADATA });
    const innerGroup = buildGroup("group_inner", [ellipse]);
    const outerGroup = buildGroup("group_outer", [innerGroup]);
    const page = buildPage("page_1", [buildLayer("layer_1", [outerGroup])]);
    const result = resolveDieLineSource(page, { type: "auto" });
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.candidate.object.id).toBe("ellipse_1");
      expect(result.candidate.ancestorChain).toHaveLength(2);
    }
  });

  it("cero candidatos: not-found", () => {
    const rect = buildRectangle("rect_1");
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const result = resolveDieLineSource(page, { type: "auto" });
    expect(result.status).toBe("not-found");
  });

  it("dos o más candidatos: multiple — nunca elige el primero en silencio", () => {
    const rect = buildRectangle("rect_1", { metadata: DIE_LINE_METADATA });
    const ellipse = buildEllipse("ellipse_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect, ellipse])]);
    const result = resolveDieLineSource(page, { type: "auto" });
    expect(result.status).toBe("multiple");
    if (result.status === "multiple") expect(result.candidates).toHaveLength(2);
  });

  it("un die-line taggeado sobre un tipo no soportado (Text) SÍ se encuentra — la validación de tipo es responsabilidad de normalizeCutGeometry", () => {
    const text = buildText("text_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [text])]);
    const result = resolveDieLineSource(page, { type: "auto" });
    expect(result.status).toBe("found");
  });
});

describe("resolveDieLineSource — source object (selección manual)", () => {
  it("encuentra el object por id, sin importar metadata.role", () => {
    const rect = buildRectangle("rect_1");
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const result = resolveDieLineSource(page, { type: "object", objectId: "rect_1" });
    expect(result.status).toBe("found");
  });

  it("id inexistente: not-found", () => {
    const page = buildPage("page_1", [buildLayer("layer_1", [])]);
    const result = resolveDieLineSource(page, { type: "object", objectId: "no_existe" });
    expect(result.status).toBe("not-found");
  });
});
