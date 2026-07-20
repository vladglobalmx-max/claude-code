import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createEngine } from "@impulso/engine";
import { ObjectIdSchema, PageIdSchema, LayerIdSchema } from "@impulso/document-schema";
import { renderManipulationHandles } from "./handles.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

// Índice de cada handle dentro de `resizeHandles(...)` — coincide con el
// orden de `RESIZE_HANDLES` (@impulso/engine), que es el orden en el que
// `handles.ts` los agrega a `selectionLayer`.
const TOP_LEFT = 0;
const TOP = 1;
const TOP_RIGHT = 2;
const LEFT = 3;
const RIGHT = 4;
const BOTTOM_LEFT = 5;
const BOTTOM = 6;
const BOTTOM_RIGHT = 7;

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

/** Monta un Stage real de 2 layers (mainLayer + selectionLayer) con UN
 * rectangle ya creado como node Konva, y un Engine real detrás — igual de
 * fiel al pipeline real que `renderer.test.ts`, pero ejercitando
 * `renderManipulationHandles` directamente (sin pasar por `createKonvaRenderer`). */
function setup(
  overrides: {
    transform?: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>;
  } = {},
) {
  const transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...overrides.transform };
  const engine = createEngine(
    buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildRectangle("rect_1", { size: { width: 10, height: 20 }, transform })]),
        ]),
      ]),
    }),
  );

  const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
  const mainLayer = new Konva.Layer();
  const selectionLayer = new Konva.Layer();
  stage.add(mainLayer);
  stage.add(selectionLayer);

  const node = new Konva.Rect({ id: "rect_1", width: 10, height: 20, ...transform });
  mainLayer.add(node);

  const onRejected = vi.fn();
  return { engine, stage, mainLayer, selectionLayer, node, onRejected };
}

function renderHandles(
  env: ReturnType<typeof setup>,
  objectId = "rect_1",
  snapping?: Parameters<typeof renderManipulationHandles>[0]["snapping"],
) {
  return renderManipulationHandles({
    objectId: ObjectIdSchema.parse(objectId),
    node: env.node,
    selectionLayer: env.selectionLayer,
    stage: env.stage,
    engine: env.engine,
    onRejected: env.onRejected,
    snapping,
  });
}

/** Variante de `setup()` con un segundo rectangle (candidato de snap) ya
 * medible en `mainLayer`, y un `SnapEnvironment` real (Epic 7 / Fase 7.3)
 * listo para pasarle a `renderHandles`. */
function setupWithSnapping(
  overrides: Parameters<typeof setup>[0] = {},
  second: { x: number; y: number; width: number; height: number } = { x: 100, y: 0, width: 10, height: 20 },
) {
  const env = setup(overrides);
  env.engine.dispatch({
    type: "addObject",
    pageId: PageIdSchema.parse("page_1"),
    layerId: LayerIdSchema.parse("layer_1"),
    object: buildRectangle("rect_2", {
      size: { width: second.width, height: second.height },
      transform: { x: second.x, y: second.y, rotation: 0, scaleX: 1, scaleY: 1 },
    }),
  });
  const secondNode = new Konva.Rect({
    id: "rect_2",
    width: second.width,
    height: second.height,
    x: second.x,
    y: second.y,
  });
  env.mainLayer.add(secondNode);

  const guidesLayer = new Konva.Layer();
  env.stage.add(guidesLayer);
  const snapping = { stage: env.stage, mainLayer: env.mainLayer, guidesLayer, getZoom: () => 1 };
  return { ...env, guidesLayer, snapping };
}

function resizeHandles(selectionLayer: Konva.Layer): Konva.Rect[] {
  return selectionLayer.getChildren().filter((n): n is Konva.Rect => n instanceof Konva.Rect);
}

function rotateHandle(selectionLayer: Konva.Layer): Konva.Circle {
  return selectionLayer.getChildren().find((n): n is Konva.Circle => n instanceof Konva.Circle)!;
}

describe("renderManipulationHandles — estructura", () => {
  it("devuelve false y no dibuja nada si el objectId no existe en el Project", () => {
    const env = setup();
    const result = renderHandles(env, "no_existe");

    expect(result).toBe(false);
    expect(env.selectionLayer.getChildren()).toHaveLength(0);
  });

  it("dibuja 2 Line (contorno + vara), 8 Rect (resize) y 1 Circle (rotación)", () => {
    const env = setup();
    const result = renderHandles(env);

    expect(result).toBe(true);
    const children = env.selectionLayer.getChildren();
    expect(children).toHaveLength(11);
    expect(children.filter((n) => n instanceof Konva.Line)).toHaveLength(2);
    expect(resizeHandles(env.selectionLayer)).toHaveLength(8);
    expect(rotateHandle(env.selectionLayer)).toBeDefined();
  });

  it("los 8 handles quedan posicionados en las esquinas/bordes correctos (sin rotación, caja 10x20 en el origen)", () => {
    const env = setup();
    renderHandles(env);
    const h = resizeHandles(env.selectionLayer);

    expect({ x: h[TOP_LEFT]!.x(), y: h[TOP_LEFT]!.y() }).toEqual({ x: 0, y: 0 });
    expect({ x: h[TOP]!.x(), y: h[TOP]!.y() }).toEqual({ x: 5, y: 0 });
    expect({ x: h[TOP_RIGHT]!.x(), y: h[TOP_RIGHT]!.y() }).toEqual({ x: 10, y: 0 });
    expect({ x: h[LEFT]!.x(), y: h[LEFT]!.y() }).toEqual({ x: 0, y: 10 });
    expect({ x: h[RIGHT]!.x(), y: h[RIGHT]!.y() }).toEqual({ x: 10, y: 10 });
    expect({ x: h[BOTTOM_LEFT]!.x(), y: h[BOTTOM_LEFT]!.y() }).toEqual({ x: 0, y: 20 });
    expect({ x: h[BOTTOM]!.x(), y: h[BOTTOM]!.y() }).toEqual({ x: 5, y: 20 });
    expect({ x: h[BOTTOM_RIGHT]!.x(), y: h[BOTTOM_RIGHT]!.y() }).toEqual({ x: 10, y: 20 });
  });

  it("todos los handles son draggable", () => {
    const env = setup();
    renderHandles(env);

    for (const rect of resizeHandles(env.selectionLayer)) expect(rect.draggable()).toBe(true);
    expect(rotateHandle(env.selectionLayer).draggable()).toBe(true);
  });

  it("ADR-0018: el handle de rotación se recorta contra los límites del Stage cuando el object está pegado al borde superior, en vez de quedar en Y negativa (invisible/inalcanzable)", () => {
    // El fixture por defecto ya coloca el object en y=0 (pegado al borde
    // superior) — antes de ADR-0018 esto producía un handle en Y=-24
    // (fuera del Stage de 200x200, el bug de severidad alta de Fase 7.3.5).
    const env = setup();
    renderHandles(env);
    const handle = rotateHandle(env.selectionLayer);

    expect(handle.y()).toBeGreaterThanOrEqual(0);
    // Sin espacio hacia arriba (topCenter ya está en Y=0), el recorte lo deja
    // sobre el propio borde superior del object, nunca oculto/fuera de rango.
    expect(handle.y()).toBe(0);
  });

  it("ADR-0018: con espacio suficiente debajo del borde superior, el offset completo de 24px no se recorta", () => {
    const env = setup({ transform: { y: 50 } });
    renderHandles(env);
    const handle = rotateHandle(env.selectionLayer);

    expect(handle.y()).toBe(50 - 24);
  });

  it("un object bloqueado conserva su contorno de selección pero no expone handles de resize/rotación (Fase 7.4 — política de objects bloqueados)", () => {
    const engine = createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [
            buildLayer("layer_1", [
              buildRectangle("rect_1", {
                size: { width: 10, height: 20 },
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                metadata: { tags: [], visible: true, locked: true, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
              }),
            ]),
          ]),
        ]),
      }),
    );
    const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
    const mainLayer = new Konva.Layer();
    const selectionLayer = new Konva.Layer();
    stage.add(mainLayer);
    stage.add(selectionLayer);
    const node = new Konva.Rect({ id: "rect_1", width: 10, height: 20, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    mainLayer.add(node);

    const result = renderManipulationHandles({
      objectId: ObjectIdSchema.parse("rect_1"),
      node,
      selectionLayer,
      stage,
      engine,
      onRejected: vi.fn(),
    });

    expect(result).toBe(true);
    // Solo el contorno (1 Line) — sin la "vara" del handle de rotación, sin
    // los 8 Rect de resize, sin el Circle de rotación.
    expect(selectionLayer.getChildren()).toHaveLength(1);
    expect(selectionLayer.getChildren()[0]).toBeInstanceOf(Konva.Line);
    expect(resizeHandles(selectionLayer)).toHaveLength(0);
  });
});

describe("renderManipulationHandles — resize (dragmove/dragend)", () => {
  it("dragmove previsualiza en vivo el node SIN despachar al Engine", () => {
    const env = setup();
    renderHandles(env);
    const before = env.engine.getProject();

    const bottomRight = resizeHandles(env.selectionLayer)[BOTTOM_RIGHT]!;
    bottomRight.x(15);
    bottomRight.y(25);
    bottomRight.fire("dragmove", { evt: {} });

    // Previsualización aplicada directamente al node de contenido...
    expect(env.node.scaleX()).toBeCloseTo(1.5, 10);
    expect(env.node.scaleY()).toBeCloseTo(1.25, 10);
    // ...pero el Project del Engine no cambió todavía (no hubo dispatch).
    expect(env.engine.getProject()).toBe(before);
  });

  it("dragend despacha resizeObject con el pointerDelta acumulado desde el inicio del gesto", () => {
    const env = setup();
    renderHandles(env);

    const bottomRight = resizeHandles(env.selectionLayer)[BOTTOM_RIGHT]!;
    bottomRight.x(15);
    bottomRight.y(25);
    bottomRight.fire("dragmove", { evt: {} });
    bottomRight.fire("dragend", { evt: {} });

    const object = env.engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1.5, scaleY: 1.25 });
    expect(env.onRejected).not.toHaveBeenCalled();
  });

  it("maintainAspectRatio se activa con Shift durante el resize", () => {
    const env = setup();
    renderHandles(env);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.x(20); // +10 de ancho
    right.fire("dragend", { evt: { shiftKey: true } });

    const object = env.engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    // width 10->20 (scaleX 2); aspectRatio = 10/20 = 0.5 -> newHeight = 20/0.5 = 40 -> scaleY 40/20 = 2.
    expect(object?.transform.scaleX).toBeCloseTo(2, 10);
    expect(object?.transform.scaleY).toBeCloseTo(2, 10);
  });

  it("un dragend rechazado por el Engine llama a onRejected", () => {
    const env = setup();
    renderHandles(env);
    env.engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });

    const bottomRight = resizeHandles(env.selectionLayer)[BOTTOM_RIGHT]!;
    bottomRight.x(15);
    bottomRight.fire("dragend", { evt: {} });

    expect(env.onRejected).toHaveBeenCalledTimes(1);
  });

  it("handles de esquina (top-left) no restringen el eje de arrastre (dragBoundFunc los deja libres)", () => {
    const env = setup();
    renderHandles(env);

    const topLeft = resizeHandles(env.selectionLayer)[TOP_LEFT]!;
    const dragBoundFunc = topLeft.dragBoundFunc();
    const proposed = { x: 3, y: 7 };
    expect(dragBoundFunc.call(topLeft, proposed, {} as never)).toEqual(proposed);
  });

  it("handles de borde (right) restringen el arrastre al eje horizontal local", () => {
    const env = setup();
    renderHandles(env);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    const dragBoundFunc = right.dragBoundFunc();
    // Sin rotación, el eje horizontal local es el eje X absoluto: la
    // componente Y de cualquier propuesta debe descartarse.
    const constrained = dragBoundFunc.call(right, { x: 20, y: 999 }, {} as never);
    expect(constrained.x).toBeCloseTo(20, 10);
    expect(constrained.y).toBeCloseTo(10, 10); // vuelve al y original del handle
  });

  it("handles de borde (top) restringen el arrastre al eje vertical local", () => {
    const env = setup();
    renderHandles(env);

    const top = resizeHandles(env.selectionLayer)[TOP]!;
    const dragBoundFunc = top.dragBoundFunc();
    const constrained = dragBoundFunc.call(top, { x: 999, y: -5 }, {} as never);
    expect(constrained.x).toBeCloseTo(5, 10);
    expect(constrained.y).toBeCloseTo(-5, 10);
  });

  it("con el object rotado 90°, el eje local del handle 'right' pasa a ser el eje vertical absoluto", () => {
    const env = setup({ transform: { rotation: 90 } });
    renderHandles(env);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    const startPos = { x: right.x(), y: right.y() };
    const dragBoundFunc = right.dragBoundFunc();
    // Una propuesta con delta en X debe colapsarse de vuelta al X original
    // del handle (el eje libre ahora es Y, no X).
    const constrained = dragBoundFunc.call(right, { x: startPos.x + 999, y: startPos.y + 5 }, {} as never);
    expect(constrained.x).toBeCloseTo(startPos.x, 5);
    expect(constrained.y).toBeCloseTo(startPos.y + 5, 5);
  });
});

describe("renderManipulationHandles — snapping durante resize (Epic 7 / Fase 7.3)", () => {
  it("un handle de borde ('right') snapea al borde izquierdo de otro object dentro de tolerancia", () => {
    // rect_1: 10x20 en (0,0). rect_2: 10x20 en (205,0) -> su borde
    // izquierdo (minX=205) no coincide con ningún candidato de página
    // (0/50/100 para una página de 100x100) — el match solo puede venir del object.
    const env = setupWithSnapping({}, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    right.x(200); // ancho crudo propuesto: 200 (distancia 5 del candidato en 205)
    right.fire("dragmove", { evt: {} });

    expect(env.node.scaleX()).toBeCloseTo(20.5, 10); // width 205 / intrinsicSize 10
  });

  it("el snap dibuja una guía en guidesLayer y la limpia al terminar el gesto (dragend)", () => {
    const env = setupWithSnapping({}, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    right.x(200);
    right.fire("dragmove", { evt: {} });
    expect(env.guidesLayer.getChildren().length).toBeGreaterThan(0);

    right.fire("dragend", { evt: {} });
    expect(env.guidesLayer.getChildren()).toHaveLength(0);
  });

  it("el commit final (dragend) reproduce EXACTAMENTE el tamaño snapeado en preview — sin divergencia", () => {
    const env = setupWithSnapping({}, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    right.x(200);
    right.fire("dragmove", { evt: {} });
    const previewScaleX = env.node.scaleX();
    right.fire("dragend", { evt: {} });

    const object = env.engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.scaleX).toBeCloseTo(previewScaleX, 10);
    expect(object?.transform.scaleX).toBeCloseTo(20.5, 10);
  });

  it("Ctrl/Cmd desactiva el snap temporalmente — el preview usa el tamaño crudo", () => {
    const env = setupWithSnapping({}, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    right.x(200);
    right.fire("dragmove", { evt: { ctrlKey: true } });

    expect(env.node.scaleX()).toBeCloseTo(20, 10); // sin snap: 200/10
    expect(env.guidesLayer.getChildren()).toHaveLength(0);
  });

  it("Shift (maintainAspectRatio) desactiva el snap para no romper la proporción bloqueada", () => {
    const env = setupWithSnapping({}, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    right.x(200);
    right.fire("dragmove", { evt: { shiftKey: true } });

    // Sin snap: width 200/10=20 -> aspectRatio original 10/20=0.5 -> newHeight=20/0.5=400 -> scaleY=20.
    expect(env.node.scaleX()).toBeCloseTo(20, 10);
    expect(env.node.scaleY()).toBeCloseTo(20, 10);
  });

  it("un object rotado no snapea durante resize (fuera de alcance — ver canSnapDuringResize)", () => {
    const env = setupWithSnapping({ transform: { rotation: 45 } }, { x: 205, y: 0, width: 10, height: 20 });
    renderHandles(env, "rect_1", env.snapping);

    const right = resizeHandles(env.selectionLayer)[RIGHT]!;
    right.fire("dragstart");
    const startPos = { x: right.x(), y: right.y() };
    // Sin rotación el eje libre sería X puro; con 45° el dragBoundFunc ya
    // no restringe a X — se fuerza igualmente un delta grande a lo largo
    // del eje libre real para verificar que el ancho resultante NO se
    // ajustó a ningún candidato (queda en el valor crudo).
    const axis = right.dragBoundFunc().call(right, { x: startPos.x + 200, y: startPos.y + 200 }, {} as never);
    right.x(axis.x);
    right.y(axis.y);
    right.fire("dragmove", { evt: {} });

    // No debe haber dibujado ninguna guía (canSnapDuringResize === false).
    expect(env.guidesLayer.getChildren()).toHaveLength(0);
  });

  it("sin `snapping` provisto, el resize funciona exactamente igual que antes (sin guías)", () => {
    const env = setup();
    renderHandles(env); // sin snapping

    const bottomRight = resizeHandles(env.selectionLayer)[BOTTOM_RIGHT]!;
    bottomRight.x(15);
    bottomRight.y(25);
    expect(() => bottomRight.fire("dragmove", { evt: {} })).not.toThrow();
    expect(env.node.scaleX()).toBeCloseTo(1.5, 10);
  });
});

describe("renderManipulationHandles — rotación (dragmove/dragend)", () => {
  it("dragmove previsualiza la rotación del node sin despachar", () => {
    const env = setup();
    renderHandles(env);
    const before = env.engine.getProject();

    const handle = rotateHandle(env.selectionLayer);
    // Pivote en (0,0): mover el handle directamente a la derecha produce ~90°.
    handle.x(100);
    handle.y(0);
    handle.fire("dragmove", { evt: {} });

    expect(env.node.rotation()).toBeCloseTo(90, 5);
    expect(env.engine.getProject()).toBe(before);
  });

  it("dragend despacha rotateObject con el ángulo calculado desde el pivote", () => {
    const env = setup();
    renderHandles(env);

    const handle = rotateHandle(env.selectionLayer);
    handle.x(0);
    handle.y(100); // directamente abajo del pivote -> 180°
    handle.fire("dragend", { evt: {} });

    const object = env.engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.rotation).toBeCloseTo(180, 5);
  });

  it("snapToIncrement se activa con Shift durante la rotación", () => {
    const env = setup();
    renderHandles(env);

    const handle = rotateHandle(env.selectionLayer);
    // ángulo ~41° (cerca de 45): dx positivo pequeño, dy negativo grande.
    handle.x(Math.sin(41 * (Math.PI / 180)) * 100);
    handle.y(-Math.cos(41 * (Math.PI / 180)) * 100);
    handle.fire("dragend", { evt: { shiftKey: true } });

    const object = env.engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.rotation).toBe(45);
  });

  it("un dragend de rotación rechazado por el Engine llama a onRejected", () => {
    const env = setup();
    renderHandles(env);
    env.engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });

    const handle = rotateHandle(env.selectionLayer);
    handle.x(0);
    handle.y(100);
    handle.fire("dragend", { evt: {} });

    expect(env.onRejected).toHaveBeenCalledTimes(1);
  });
});

describe("renderManipulationHandles — cursor feedback", () => {
  it("mouseenter en un handle de resize aplica el cursor CSS correspondiente al container del Stage", () => {
    const env = setup();
    renderHandles(env);

    const topLeft = resizeHandles(env.selectionLayer)[TOP_LEFT]!;
    topLeft.fire("mouseenter");
    expect(env.stage.container().style.cursor).toBe("nwse-resize");

    topLeft.fire("mouseleave");
    expect(env.stage.container().style.cursor).toBe("default");
  });

  it("mouseenter en el handle de rotación aplica el cursor 'grab'", () => {
    const env = setup();
    renderHandles(env);

    const handle = rotateHandle(env.selectionLayer);
    handle.fire("mouseenter");
    expect(env.stage.container().style.cursor).toBe("grab");

    handle.fire("mouseleave");
    expect(env.stage.container().style.cursor).toBe("default");
  });
});
