import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createEngine } from "@impulso/engine";
import { ObjectIdSchema, type ObjectId } from "@impulso/document-schema";
import { attachTransformInteractions } from "./transformInteractions.js";
import { buildRectangle, buildEllipse, buildProject, buildDocument, buildLayer, buildPage } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

function domContainer(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

/** Monta un mainLayer real con `rect_1` (el object a mover) y `rect_2` (un
 * candidato de snap fijo) — necesario para probar Smart Guides/Snapping
 * durante `dragmove` (Epic 7 / Fase 7.3), que mide vía `mainLayer.findOne`. */
function setupSnappingMove() {
  const rect1 = buildRectangle("rect_1", { size: { width: 10, height: 20 } });
  const rect2 = buildRectangle("rect_2", {
    size: { width: 42, height: 7 },
    transform: { x: 250, y: 13, rotation: 0, scaleX: 1, scaleY: 1 },
  });
  const engine = createEngine(
    buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [rect1, rect2])])]) }),
  );

  const stage = new Konva.Stage({ container: domContainer(), width: 400, height: 400 });
  const mainLayer = new Konva.Layer();
  const guidesLayer = new Konva.Layer();
  stage.add(mainLayer);
  stage.add(guidesLayer);

  const node1 = new Konva.Rect({ id: "rect_1", width: 10, height: 20, x: 0, y: 0 });
  const node2 = new Konva.Rect({ id: "rect_2", width: 42, height: 7, x: 250, y: 13 });
  mainLayer.add(node1);
  mainLayer.add(node2);

  const dispatch = vi.fn(engine.dispatch);
  const context: NodeContext = {
    dispatch,
    getSelection: engine.getSelection,
    snapping: { engine, env: { stage, mainLayer, guidesLayer, getZoom: () => 1 } },
  };

  return { engine, stage, mainLayer, guidesLayer, node1, rect1, context, dispatch };
}

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

describe("attachTransformInteractions — Smart Guides/Snapping durante move (Epic 7 / Fase 7.3)", () => {
  it("dragmove ajusta la posición del node cuando hay un candidato dentro de tolerancia", () => {
    const env = setupSnappingMove();
    attachTransformInteractions(env.node1, env.rect1, env.context);

    env.node1.fire("dragstart");
    // Caja cruda propuesta: minX=244,maxX=254 (centro=249, distancia 1 al
    // candidato x=250 de rect_2 — el más cercano de los 3 refpoints).
    env.node1.x(244);
    env.node1.y(0);
    env.node1.fire("dragmove", { evt: {} });

    expect(env.node1.x()).toBeCloseTo(245, 10); // 244 + delta(+1)
    expect(env.node1.y()).toBeCloseTo(0, 10); // ya alineado con el borde superior de la página
  });

  it("dibuja una guía visible durante el gesto y la limpia en dragend", () => {
    const env = setupSnappingMove();
    attachTransformInteractions(env.node1, env.rect1, env.context);

    env.node1.fire("dragstart");
    env.node1.x(244);
    env.node1.y(0);
    env.node1.fire("dragmove", { evt: {} });
    expect(env.guidesLayer.getChildren().length).toBeGreaterThan(0);

    env.node1.fire("dragend");
    expect(env.guidesLayer.getChildren()).toHaveLength(0);
  });

  it("Ctrl/Cmd desactiva el snap temporalmente — el node conserva la posición cruda", () => {
    const env = setupSnappingMove();
    attachTransformInteractions(env.node1, env.rect1, env.context);

    env.node1.fire("dragstart");
    env.node1.x(244);
    env.node1.y(0);
    env.node1.fire("dragmove", { evt: { ctrlKey: true } });

    expect(env.node1.x()).toBe(244);
    expect(env.guidesLayer.getChildren()).toHaveLength(0);
  });

  it("sin candidatos dentro de tolerancia, el node conserva la posición cruda", () => {
    const env = setupSnappingMove();
    attachTransformInteractions(env.node1, env.rect1, env.context);

    env.node1.fire("dragstart");
    env.node1.x(999);
    env.node1.y(999);
    env.node1.fire("dragmove", { evt: {} });

    expect(env.node1.x()).toBe(999);
    expect(env.node1.y()).toBe(999);
  });

  it("dragend despacha updateObjectTransform con la posición YA snapeada (sin divergencia con el preview)", () => {
    const env = setupSnappingMove();
    attachTransformInteractions(env.node1, env.rect1, env.context);

    env.node1.fire("dragstart");
    env.node1.x(244);
    env.node1.y(0);
    env.node1.fire("dragmove", { evt: {} });
    const previewX = env.node1.x();
    const previewY = env.node1.y();
    env.node1.fire("dragend");

    expect(env.dispatch).toHaveBeenCalledWith({
      type: "updateObjectTransform",
      objectId: "rect_1",
      transform: { x: previewX, y: previewY },
    });
  });

  it("sin `context.snapping`, dragmove no hace nada (comportamiento previo intacto)", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context } = contextWithDispatch({ ok: true, value: {} }, () => []);

    attachTransformInteractions(node, object, context);
    node.fire("dragstart");
    node.x(50);
    node.y(60);
    expect(() => node.fire("dragmove", { evt: {} })).not.toThrow();
    expect(node.x()).toBe(50);
    expect(node.y()).toBe(60);
  });
});
