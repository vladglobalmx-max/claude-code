import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { applyBaseAttrs } from "./baseAttrs.js";
import { buildRectangle, buildEllipse } from "./testUtils/fixtures.js";
import type { NodeContext } from "./types.js";

function contextWithDispatch(dispatchResult: { ok: true; value: unknown } | { ok: false; error: unknown }) {
  const dispatch = vi.fn().mockReturnValue(dispatchResult);
  const onRejectedTransform = vi.fn();
  const context: NodeContext = { dispatch: dispatch as never, onRejectedTransform };
  return { context, dispatch, onRejectedTransform };
}

describe("applyBaseAttrs", () => {
  it("aplica id, posición, transform y opacity", () => {
    const object = buildRectangle("rect_1", {
      transform: { x: 5, y: 10, rotation: 45, scaleX: 2, scaleY: 0.5 },
      style: { strokeWidth: 0, opacity: 0.5, blendMode: "normal" },
    });
    const node = new Konva.Rect();
    const { context } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);

    expect(node.id()).toBe("rect_1");
    expect(node.x()).toBe(5);
    expect(node.y()).toBe(10);
    expect(node.rotation()).toBe(45);
    expect(node.scaleX()).toBe(2);
    expect(node.scaleY()).toBe(0.5);
    expect(node.opacity()).toBe(0.5);
  });

  it("usa toKonvaXY para posicionar (ellipse se centra)", () => {
    const object = buildEllipse("e", {
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 20, height: 20 },
    });
    const node = new Konva.Ellipse();
    const { context } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);

    expect(node.x()).toBe(20);
    expect(node.y()).toBe(20);
  });

  it("un object bloqueado (metadata.locked) no es draggable, pero SÍ sigue siendo seleccionable (listening=true)", () => {
    const object = buildRectangle("rect_1", {
      metadata: { tags: [], visible: true, locked: true, createdAt: "x", updatedAt: "x" },
    });
    const node = new Konva.Rect();
    const { context } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);

    expect(node.draggable()).toBe(false);
    expect(node.listening()).toBe(true);
  });

  it("un object oculto (metadata.visible=false) se crea con visible=false y deja de escuchar eventos", () => {
    const object = buildRectangle("rect_1", {
      metadata: { tags: [], visible: false, locked: false, createdAt: "x", updatedAt: "x" },
    });
    const node = new Konva.Rect();
    const { context } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);

    expect(node.visible()).toBe(false);
    expect(node.listening()).toBe(false);
  });

  it("click sin Shift reemplaza la selección (setSelection) y detiene la propagación", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    applyBaseAttrs(node, object, context);

    const evt = { evt: { shiftKey: false }, cancelBubble: false };
    node.fire("click", evt);

    expect(dispatch).toHaveBeenCalledWith({ type: "setSelection", objectIds: ["rect_1"] });
    expect(evt.cancelBubble).toBe(true);
  });

  it("click con Shift alterna la selección (toggleObjectSelection) en vez de reemplazarla", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    applyBaseAttrs(node, object, context);

    node.fire("click", { evt: { shiftKey: true }, cancelBubble: false });

    expect(dispatch).toHaveBeenCalledWith({ type: "toggleObjectSelection", objectId: "rect_1" });
  });

  it("dragend exitoso despacha updateObjectTransform con la nueva posición y NO llama onRejectedTransform", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch, onRejectedTransform } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);
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
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);
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

    applyBaseAttrs(node, object, context);
    node.fire("dragend");

    expect(onRejectedTransform).toHaveBeenCalledTimes(1);
  });

  it("no lanza si no se provee onRejectedTransform y el dispatch es rechazado", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const dispatch = vi.fn().mockReturnValue({ ok: false, error: { code: "object_not_found", message: "x" } });
    const context: NodeContext = { dispatch: dispatch as never };

    applyBaseAttrs(node, object, context);
    expect(() => node.fire("dragend")).not.toThrow();
  });
});
