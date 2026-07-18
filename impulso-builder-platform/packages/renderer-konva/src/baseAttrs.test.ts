import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { applyBaseAttrs } from "./baseAttrs.js";
import { buildRectangle, buildEllipse } from "./testUtils/fixtures.js";
import type { NodeContext } from "./types.js";

function contextWithDispatch(dispatchResult: { ok: true; value: unknown } | { ok: false; error: unknown }) {
  const dispatch = vi.fn().mockReturnValue(dispatchResult);
  const context: NodeContext = { dispatch: dispatch as never };
  return { context, dispatch };
}

describe("applyBaseAttrs — atributos estáticos", () => {
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

  it("delega la interacción de selección (click) — ver interactions/selectionInteractions.test.ts para el detalle", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);
    node.fire("click", { evt: { shiftKey: false }, cancelBubble: false });

    expect(dispatch).toHaveBeenCalledWith({ type: "setSelection", objectIds: ["rect_1"] });
  });

  it("delega la interacción de transformación (dragend) — ver interactions/transformInteractions.test.ts para el detalle", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });

    applyBaseAttrs(node, object, context);
    node.x(42);
    node.y(99);
    node.fire("dragend");

    expect(dispatch).toHaveBeenCalledWith({
      type: "updateObjectTransform",
      objectId: "rect_1",
      transform: { x: 42, y: 99 },
    });
  });

  describe("interactive: false (hijo anidado en un group, ver ADR-0010)", () => {
    it("nunca es draggable, incluso si el object NO está bloqueado", () => {
      const object = buildRectangle("rect_1", {
        metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "x" },
      });
      const node = new Konva.Rect();
      const { context } = contextWithDispatch({ ok: true, value: {} });

      applyBaseAttrs(node, object, { ...context, interactive: false });

      expect(node.draggable()).toBe(false);
    });

    it("sigue siendo listening (para que el click/drag burbujee hasta el Group)", () => {
      const object = buildRectangle("rect_1");
      const node = new Konva.Rect();
      const { context } = contextWithDispatch({ ok: true, value: {} });

      applyBaseAttrs(node, object, { ...context, interactive: false });

      expect(node.listening()).toBe(true);
    });

    it("NO dispatcha al hacer click (no tiene su propia interacción de selección)", () => {
      const object = buildRectangle("rect_1");
      const node = new Konva.Rect();
      const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });

      applyBaseAttrs(node, object, { ...context, interactive: false });
      node.fire("click", { evt: { shiftKey: false }, cancelBubble: false });

      expect(dispatch).not.toHaveBeenCalled();
    });

    it("NO dispatcha al soltar un drag (no tiene su propia interacción de transform)", () => {
      const object = buildRectangle("rect_1");
      const node = new Konva.Rect();
      const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });

      applyBaseAttrs(node, object, { ...context, interactive: false });
      node.x(42);
      node.fire("dragend");

      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
