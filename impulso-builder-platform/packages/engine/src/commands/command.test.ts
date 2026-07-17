import { describe, expect, it } from "vitest";
import { EngineCommandSchema, isSelectionCommand } from "./command.js";
import { buildRectangle } from "../testUtils/fixtures.js";

describe("EngineCommandSchema", () => {
  it("valida un comando de contenido bien formado (updateObjectTransform)", () => {
    const result = EngineCommandSchema.safeParse({
      type: "updateObjectTransform",
      objectId: "rect_1",
      transform: { x: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("valida un comando addObject con un SceneObject completo", () => {
    const result = EngineCommandSchema.safeParse({
      type: "addObject",
      pageId: "page_1",
      layerId: "layer_1",
      object: buildRectangle("rect_1"),
    });
    expect(result.success).toBe(true);
  });

  it("valida los comandos de selección", () => {
    expect(EngineCommandSchema.safeParse({ type: "setSelection", objectIds: ["a", "b"] }).success).toBe(true);
    expect(EngineCommandSchema.safeParse({ type: "clearSelection" }).success).toBe(true);
  });

  it("rechaza un type desconocido", () => {
    expect(EngineCommandSchema.safeParse({ type: "flyToTheMoon" }).success).toBe(false);
  });

  it("rechaza un comando sin los campos requeridos", () => {
    expect(EngineCommandSchema.safeParse({ type: "removeObject" }).success).toBe(false);
  });
});

describe("isSelectionCommand", () => {
  it("identifica correctamente comandos de selección vs de contenido", () => {
    expect(isSelectionCommand({ type: "setSelection", objectIds: [] })).toBe(true);
    expect(isSelectionCommand({ type: "clearSelection" })).toBe(true);
    expect(isSelectionCommand({ type: "removePage", pageId: "p" } as never)).toBe(false);
  });
});
