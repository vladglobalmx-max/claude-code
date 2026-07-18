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
    expect(EngineCommandSchema.safeParse({ type: "toggleObjectSelection", objectId: "a" }).success).toBe(true);
  });

  it("rechaza un type desconocido", () => {
    expect(EngineCommandSchema.safeParse({ type: "flyToTheMoon" }).success).toBe(false);
  });

  it("rechaza un comando sin los campos requeridos", () => {
    expect(EngineCommandSchema.safeParse({ type: "removeObject" }).success).toBe(false);
  });

  it("valida un comando resizeObject bien formado", () => {
    const result = EngineCommandSchema.safeParse({
      type: "resizeObject",
      objectId: "rect_1",
      handle: "bottom-right",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("resizeObject acepta maintainAspectRatio opcional", () => {
    const result = EngineCommandSchema.safeParse({
      type: "resizeObject",
      objectId: "rect_1",
      handle: "right",
      pointerDelta: { x: 5, y: 0 },
      intrinsicSize: { width: 10, height: 10 },
      maintainAspectRatio: true,
    });
    expect(result.success).toBe(true);
  });

  it("resizeObject rechaza un handle inválido", () => {
    const result = EngineCommandSchema.safeParse({
      type: "resizeObject",
      objectId: "rect_1",
      handle: "diagonal",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("resizeObject rechaza un intrinsicSize no positivo", () => {
    const result = EngineCommandSchema.safeParse({
      type: "resizeObject",
      objectId: "rect_1",
      handle: "bottom-right",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 0, height: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("valida un comando rotateObject bien formado", () => {
    const result = EngineCommandSchema.safeParse({
      type: "rotateObject",
      objectId: "rect_1",
      pointerAngleDegrees: 45,
    });
    expect(result.success).toBe(true);
  });

  it("rotateObject acepta snapToIncrement opcional", () => {
    const result = EngineCommandSchema.safeParse({
      type: "rotateObject",
      objectId: "rect_1",
      pointerAngleDegrees: 45,
      snapToIncrement: true,
    });
    expect(result.success).toBe(true);
  });

  it("rotateObject rechaza un comando sin los campos requeridos", () => {
    expect(EngineCommandSchema.safeParse({ type: "rotateObject", objectId: "rect_1" }).success).toBe(false);
  });

  it("valida un comando addAsset con un Asset completo", () => {
    const result = EngineCommandSchema.safeParse({
      type: "addAsset",
      asset: {
        id: "asset_1",
        type: "image",
        name: "logo.png",
        mimeType: "image/png",
        width: 10,
        height: 10,
        metadata: { createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("addAsset rechaza un asset inválido (sin width/height para type image)", () => {
    const result = EngineCommandSchema.safeParse({
      type: "addAsset",
      asset: {
        id: "asset_1",
        type: "image",
        name: "logo.png",
        mimeType: "image/png",
        metadata: { createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("valida removeAsset/renameAsset bien formados", () => {
    expect(EngineCommandSchema.safeParse({ type: "removeAsset", assetId: "asset_1" }).success).toBe(true);
    expect(
      EngineCommandSchema.safeParse({ type: "renameAsset", assetId: "asset_1", name: "nuevo.png" }).success,
    ).toBe(true);
  });

  it("renameAsset rechaza un name vacío", () => {
    expect(EngineCommandSchema.safeParse({ type: "renameAsset", assetId: "asset_1", name: "" }).success).toBe(false);
  });
});

describe("isSelectionCommand", () => {
  it("identifica correctamente comandos de selección vs de contenido", () => {
    expect(isSelectionCommand({ type: "setSelection", objectIds: [] })).toBe(true);
    expect(isSelectionCommand({ type: "clearSelection" })).toBe(true);
    expect(isSelectionCommand({ type: "toggleObjectSelection", objectId: "a" as never })).toBe(true);
    expect(isSelectionCommand({ type: "removePage", pageId: "p" } as never)).toBe(false);
  });
});
