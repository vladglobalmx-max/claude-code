import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { ObjectIdSchema, type ObjectId } from "@impulso/document-schema";
import { attachTransformInteractions } from "./transformInteractions.js";
import { buildRectangle, buildEllipse } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

function contextWithDispatch(
  dispatchResult: { ok: true; value: unknown } | { ok: false; error: unknown },
  getSelection?: () => readonly ObjectId[],
) {
  const dispatch = vi.fn().mockReturnValue(dispatchResult);
  const onRejectedTransform = vi.fn();
  const context: NodeContext = { dispatch: dispatch as never, onRejectedTransform, getSelection };
  return { context, dispatch, onRejectedTransform };
}

describe("attachTransformInteractions — dragstart selecciona el object arrastrado", () => {
  it("si el object NO está seleccionado, dragstart lo selecciona (reemplaza la selección)", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} }, () => []);
    attachTransformInteractions(node, object, context);

    node.fire("dragstart");

    expect(dispatch).toHaveBeenCalledWith({ type: "setSelection", objectIds: ["rect_1"] });
  });

  it("si el object YA está seleccionado (solo o en un grupo), dragstart no vuelve a despachar setSelection", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} }, () => [
      ObjectIdSchema.parse("rect_1"),
      ObjectIdSchema.parse("other"),
    ]);
    attachTransformInteractions(node, object, context);

    node.fire("dragstart");

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("sin getSelection provisto, dragstart asume que no está seleccionado y lo selecciona (fallback seguro)", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTransformInteractions(node, object, context);

    node.fire("dragstart");

    expect(dispatch).toHaveBeenCalledWith({ type: "setSelection", objectIds: ["rect_1"] });
  });
});

describe("attachTransformInteractions — dragend confirma la transformación", () => {
  it("dragend exitoso despacha updateObjectTransform con la nueva posición y NO llama onRejectedTransform", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch, onRejectedTransform } = contextWithDispatch({ ok: true, value: {} }, () => []);

    attachTransformInteractions(node, object, context);
    node.x(42);
    node.y(99);
    node.fire("dragend");

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateObjectTransform",
      objectId: "rect_1",
      transform: { x: 42, y: 99 },
    });
    expect(onRejectedTransform).not.toHaveBeenCalled();
  });

  it("dragend convierte de vuelta la posición de Konva para ellipse (fromKonvaXY)", () => {
    const object = buildEllipse("e", { size: { width: 20, height: 20 } });
    const node = new Konva.Ellipse();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} }, () => []);

    attachTransformInteractions(node, object, context);
    node.x(50); // centro Konva
    node.y(60);
    node.fire("dragend");

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateObjectTransform",
      objectId: "e",
      transform: { x: 40, y: 50 }, // 50-10, 60-10
    });
  });

  it("dragend rechazado por el Engine llama a onRejectedTransform (para revertir la vista)", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, onRejectedTransform } = contextWithDispatch({
      ok: false,
      error: { code: "object_not_found", message: "x" },
    });

    attachTransformInteractions(node, object, context);
    node.fire("dragend");

    expect(onRejectedTransform).toHaveBeenCalledTimes(1);
  });

  it("no lanza si no se provee onRejectedTransform y el dispatch es rechazado", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const dispatch = vi.fn().mockReturnValue({ ok: false, error: { code: "object_not_found", message: "x" } });
    const context: NodeContext = { dispatch: dispatch as never };

    attachTransformInteractions(node, object, context);
    expect(() => node.fire("dragend")).not.toThrow();
  });
});
