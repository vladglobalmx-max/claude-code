import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { attachTextEditingInteraction, computeTextareaRect } from "./textEditingInteractions.js";
import { buildText } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function mountedTextNode(overrides: Parameters<typeof buildText>[1] = {}) {
  const stage = new Konva.Stage({ container: container(), width: 400, height: 400 });
  const layer = new Konva.Layer();
  stage.add(layer);
  const object = buildText("text_1", overrides);
  const node = new Konva.Text({
    id: object.id,
    x: object.transform.x,
    y: object.transform.y,
    rotation: object.transform.rotation,
    scaleX: object.transform.scaleX,
    scaleY: object.transform.scaleY,
    text: object.content,
    fontFamily: object.fontFamily,
    fontSize: object.fontSize,
  });
  layer.add(node);
  layer.draw();
  return { stage, layer, node, object };
}

function contextWithDispatch(dispatchResult: { ok: true; value: unknown } | { ok: false; error: unknown }) {
  const dispatch = vi.fn().mockReturnValue(dispatchResult);
  const onRejectedTransform = vi.fn();
  const context: NodeContext = { dispatch: dispatch as never, onRejectedTransform };
  return { context, dispatch, onRejectedTransform };
}

function getTextarea(stage: Konva.Stage): HTMLTextAreaElement {
  const el = stage.container().querySelector("textarea");
  if (!el) throw new Error("no se encontró el textarea de edición");
  return el;
}

describe("computeTextareaRect", () => {
  it("sin rotación ni escala, coincide con la posición/tamaño absolutos del node", () => {
    const { node } = mountedTextNode({ transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } });
    node.width(100);
    node.height(30);

    const rect = computeTextareaRect(node);

    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(30);
    expect(rect.rotationDegrees).toBeCloseTo(0, 10);
  });

  it("aplica la escala absoluta al ancho/alto", () => {
    const { node } = mountedTextNode({ transform: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 3 } });
    node.width(10);
    node.height(5);

    const rect = computeTextareaRect(node);

    expect(rect.width).toBeCloseTo(20, 10);
    expect(rect.height).toBeCloseTo(15, 10);
  });

  it("refleja la rotación absoluta del node", () => {
    const { node } = mountedTextNode({ transform: { x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 } });

    const rect = computeTextareaRect(node);

    expect(rect.rotationDegrees).toBeCloseTo(45, 10);
  });
});

describe("attachTextEditingInteraction — doble click activa la edición", () => {
  it("oculta el node de Konva y crea un textarea con el contenido actual", () => {
    const { stage, node, object } = mountedTextNode({ content: "hola mundo" });
    const { context } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);

    node.fire("dblclick");

    expect(node.visible()).toBe(false);
    const textarea = getTextarea(stage);
    expect(textarea.value).toBe("hola mundo");
  });

  it("posiciona el textarea sobre el node (position absolute, coordenadas del node)", () => {
    const { stage, node, object } = mountedTextNode({ transform: { x: 15, y: 25, rotation: 0, scaleX: 1, scaleY: 1 } });
    const { context } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);

    node.fire("dblclick");

    const textarea = getTextarea(stage);
    expect(textarea.style.position).toBe("absolute");
    expect(textarea.style.left).toBe("15px");
    expect(textarea.style.top).toBe("25px");
  });
});

describe("attachTextEditingInteraction — confirmar (blur/Enter)", () => {
  it("blur con contenido modificado despacha updateObjectContent y remueve el textarea", () => {
    const { stage, node, object } = mountedTextNode({ content: "original" });
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    const textarea = getTextarea(stage);
    textarea.value = "modificado";
    textarea.dispatchEvent(new Event("blur"));

    expect(dispatch).toHaveBeenCalledWith({ type: "updateObjectContent", objectId: "text_1", content: "modificado" });
    expect(stage.container().querySelector("textarea")).toBeNull();
  });

  it("blur SIN modificar el contenido no despacha nada, y restaura la visibilidad del node", () => {
    const { stage, node, object } = mountedTextNode({ content: "sin cambios" });
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    getTextarea(stage).dispatchEvent(new Event("blur"));

    expect(dispatch).not.toHaveBeenCalled();
    expect(node.visible()).toBe(true);
  });

  it("Enter (sin Shift) confirma igual que blur", () => {
    const { stage, node, object } = mountedTextNode({ content: "original" });
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    const textarea = getTextarea(stage);
    textarea.value = "nuevo";
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: false }));

    expect(dispatch).toHaveBeenCalledWith({ type: "updateObjectContent", objectId: "text_1", content: "nuevo" });
  });

  it("Shift+Enter NO confirma (permite salto de línea)", () => {
    const { stage, node, object } = mountedTextNode({ content: "original" });
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    const textarea = getTextarea(stage);
    textarea.value = "nuevo";
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(stage.container().querySelector("textarea")).not.toBeNull();
  });

  it("si el Engine rechaza el cambio, restaura la visibilidad y llama a onRejectedTransform", () => {
    const { stage, node, object } = mountedTextNode({ content: "original" });
    const { context, onRejectedTransform } = contextWithDispatch({
      ok: false,
      error: { code: "object_not_found", message: "x" },
    });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    const textarea = getTextarea(stage);
    textarea.value = "nuevo";
    textarea.dispatchEvent(new Event("blur"));

    expect(node.visible()).toBe(true);
    expect(onRejectedTransform).toHaveBeenCalledTimes(1);
  });
});

describe("attachTextEditingInteraction — cancelar (Escape)", () => {
  it("Escape descarta los cambios, no despacha, y restaura la visibilidad", () => {
    const { stage, node, object } = mountedTextNode({ content: "original" });
    const { context, dispatch } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);
    node.fire("dblclick");

    const textarea = getTextarea(stage);
    textarea.value = "esto se descarta";
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(node.visible()).toBe(true);
    expect(stage.container().querySelector("textarea")).toBeNull();
  });
});

describe("attachTextEditingInteraction — sin Stage montado", () => {
  it("no lanza si el node todavía no está en un Stage", () => {
    const object = buildText("text_1");
    const node = new Konva.Text({ id: object.id, text: object.content });
    const { context } = contextWithDispatch({ ok: true, value: {} });
    attachTextEditingInteraction(node, object, context);

    expect(() => node.fire("dblclick")).not.toThrow();
  });
});
