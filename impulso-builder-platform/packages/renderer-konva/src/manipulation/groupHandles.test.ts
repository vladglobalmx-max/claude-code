import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createEngine } from "@impulso/engine";
import { ObjectIdSchema } from "@impulso/document-schema";
import { renderSharedManipulationHandles, type GroupGestureHooks } from "./groupHandles.js";
import { toKonvaXY } from "../coordinates.js";
import {
  buildProject,
  buildDocument,
  buildPage,
  buildLayer,
  buildRectangle,
  buildEllipse,
  buildGroup,
} from "../testUtils/fixtures.js";

// Mismo orden que RESIZE_HANDLES (@impulso/engine) — índice 0 es la caja
// compartida, 1-8 son los handles de resize, 9 la "vara", 10 el círculo.
const SHARED_BOX = 0;
const TOP_LEFT = 1;
const BOTTOM_RIGHT = 8;
const ROTATE_LINE = 9;
const ROTATE_CIRCLE = 10;

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

interface MemberSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
}

function setup(members: MemberSpec[]) {
  const engine = createEngine(
    buildProject({
      document: buildDocument([
        buildPage(
          "page_1",
          [
            buildLayer(
              "layer_1",
              members.map((m) =>
                buildRectangle(m.id, {
                  size: { width: m.width, height: m.height },
                  transform: { x: m.x, y: m.y, rotation: m.rotation ?? 0, scaleX: 1, scaleY: 1 },
                  ...(m.locked !== undefined
                    ? {
                        metadata: {
                          tags: [],
                          visible: true,
                          locked: m.locked,
                          createdAt: "2024-01-01T00:00:00.000Z",
                          updatedAt: "2024-01-01T00:00:00.000Z",
                        },
                      }
                    : {}),
                }),
              ),
            ),
          ],
        ),
      ]),
    }),
  );

  const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
  const mainLayer = new Konva.Layer();
  const selectionLayer = new Konva.Layer();
  stage.add(mainLayer);
  stage.add(selectionLayer);

  const nodes: Record<string, Konva.Rect> = {};
  for (const m of members) {
    const node = new Konva.Rect({
      id: m.id,
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
      rotation: m.rotation ?? 0,
      scaleX: 1,
      scaleY: 1,
      draggable: true,
    });
    mainLayer.add(node);
    nodes[m.id] = node;
  }

  const onNeedsRefresh = vi.fn();
  const hooks: GroupGestureHooks = { notifyGestureStart: vi.fn(), notifyGestureEnd: vi.fn() };
  return { engine, stage, mainLayer, selectionLayer, nodes, onNeedsRefresh, hooks };
}

function render(env: ReturnType<typeof setup>, ids: string[]) {
  return renderSharedManipulationHandles({
    transformableIds: ids.map((id) => ObjectIdSchema.parse(id)),
    mainLayer: env.mainLayer,
    selectionLayer: env.selectionLayer,
    stage: env.stage,
    engine: env.engine,
    onNeedsRefresh: env.onNeedsRefresh,
    hooks: env.hooks,
  });
}

function objectById(env: ReturnType<typeof setup>, id: string) {
  return env.engine.getProject().document.pages[0]!.layers[0]!.objects.find((o) => o.id === id)!;
}

describe("renderSharedManipulationHandles — estructura", () => {
  it("devuelve false con menos de 2 ids, sin dibujar nada", () => {
    const env = setup([{ id: "a", x: 0, y: 0, width: 10, height: 10 }]);
    expect(render(env, ["a"])).toBe(false);
    expect(env.selectionLayer.getChildren()).toHaveLength(0);
  });

  it("devuelve false si algún id no corresponde a un object/node existente", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    expect(render(env, ["a", "no_existe"])).toBe(false);
    expect(env.selectionLayer.getChildren()).toHaveLength(0);
  });

  it("dibuja la caja compartida (1 Rect) + 8 handles de resize + 1 Line + 1 Circle para 2+ ids", () => {
    const env = setup([
      { id: "a", x: 0, y: 50, width: 10, height: 20 },
      { id: "b", x: 30, y: 50, width: 10, height: 20 },
    ]);
    expect(render(env, ["a", "b"])).toBe(true);
    const children = env.selectionLayer.getChildren();
    expect(children).toHaveLength(11);
    expect(children[SHARED_BOX]).toBeInstanceOf(Konva.Rect);
    expect(children[ROTATE_LINE]).toBeInstanceOf(Konva.Line);
    expect(children[ROTATE_CIRCLE]).toBeInstanceOf(Konva.Circle);
  });

  it("la caja compartida envuelve la unión de las cajas de los members (0,50)-(40,70)", () => {
    const env = setup([
      { id: "a", x: 0, y: 50, width: 10, height: 20 },
      { id: "b", x: 30, y: 50, width: 10, height: 20 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    expect(box.x()).toBe(0);
    expect(box.y()).toBe(50);
    expect(box.width()).toBe(40);
    expect(box.height()).toBe(20);
  });

  it("cada member deja de ser individualmente draggable, y reenvía mousedown a la caja compartida", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);

    expect(env.nodes.a!.draggable()).toBe(false);
    expect(env.nodes.b!.draggable()).toBe(false);

    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    let boxDragStarted = false;
    box.on("dragstart", () => {
      boxDragStarted = true;
    });
    env.nodes.a!.fire("mousedown", { cancelBubble: false }, true);
    expect(boxDragStarted).toBe(true);
  });
});

describe("renderSharedManipulationHandles — mover (dragmove/dragend)", () => {
  it("dragmove traslada TODOS los members transformables por el mismo delta, sin dispatch", () => {
    const env = setup([
      { id: "a", x: 0, y: 50, width: 10, height: 20 },
      { id: "b", x: 30, y: 50, width: 10, height: 20 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    const before = env.engine.getProject();

    box.x(box.x() + 20);
    box.y(box.y() + 10);
    box.fire("dragmove", { evt: {} });

    expect(env.nodes.a!.x()).toBeCloseTo(20, 10);
    expect(env.nodes.a!.y()).toBeCloseTo(60, 10);
    expect(env.nodes.b!.x()).toBeCloseTo(50, 10);
    expect(env.nodes.b!.y()).toBeCloseTo(60, 10);
    expect(env.engine.getProject()).toBe(before);
  });

  it("dragend dispatcha UN solo dispatchBatch — una sola entrada de historial mueve ambos members", () => {
    const env = setup([
      { id: "a", x: 0, y: 50, width: 10, height: 20 },
      { id: "b", x: 30, y: 50, width: 10, height: 20 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    const historyBefore = env.engine.getProject().document.history.entries.length;

    box.x(box.x() + 20);
    box.y(box.y() + 10);
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });

    expect(objectById(env, "a").transform.x).toBeCloseTo(20, 10);
    expect(objectById(env, "a").transform.y).toBeCloseTo(60, 10);
    expect(objectById(env, "b").transform.x).toBeCloseTo(50, 10);
    expect(env.engine.getProject().document.history.entries.length).toBe(historyBefore + 1);
    expect(env.engine.canUndo()).toBe(true);
    expect(env.onNeedsRefresh).not.toHaveBeenCalled();
  });

  it("un dragend sin movimiento real (delta ~0) no genera ninguna entrada de historial", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    const historyBefore = env.engine.getProject().document.history.entries.length;

    box.fire("dragend", { evt: {} }); // sin mover box.x()/y() del todo

    expect(env.engine.getProject().document.history.entries.length).toBe(historyBefore);
    expect(env.engine.canUndo()).toBe(false);
    expect(env.onNeedsRefresh).toHaveBeenCalledTimes(1);
  });

  it("un solo Undo revierte el movimiento de AMBOS members a la vez", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;

    box.x(15);
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });
    expect(objectById(env, "a").transform.x).toBeCloseTo(15, 10);
    expect(objectById(env, "b").transform.x).toBeCloseTo(35, 10);

    env.engine.undo();
    expect(objectById(env, "a").transform.x).toBeCloseTo(0, 10);
    expect(objectById(env, "b").transform.x).toBeCloseTo(20, 10);
  });
});

describe("renderSharedManipulationHandles — redimensionar (dragmove/dragend)", () => {
  it("arrastrar bottom-right escala el grupo desde el ancla top-left y preserva la relación espacial", () => {
    const env = setup([
      { id: "a", x: 0, y: 50, width: 10, height: 20 },
      { id: "b", x: 30, y: 50, width: 10, height: 20 },
    ]);
    render(env, ["a", "b"]);
    // unionBox inicial: {0,50,40,70} (ancho 40, alto 20).
    const bottomRight = env.selectionLayer.getChildren()[BOTTOM_RIGHT] as Konva.Rect;
    const startX = bottomRight.x();
    const startY = bottomRight.y();

    bottomRight.x(startX + 40); // ancho 40->80 (factor 2)
    bottomRight.y(startY + 20); // alto 20->40 (factor 2)
    bottomRight.fire("dragmove", { evt: {} });

    expect(env.nodes.a!.scaleX()).toBeCloseTo(2, 10);
    expect(env.nodes.a!.scaleY()).toBeCloseTo(2, 10);
    expect(env.nodes.a!.x()).toBeCloseTo(0, 10); // "a" está en el ancla, no se mueve
    expect(env.nodes.a!.y()).toBeCloseTo(50, 10);
    expect(env.nodes.b!.x()).toBeCloseTo(60, 10); // 0 + (30-0)*2
    expect(env.nodes.b!.scaleX()).toBeCloseTo(2, 10);

    bottomRight.fire("dragend", { evt: {} });
    expect(objectById(env, "a").transform.scaleX).toBeCloseTo(2, 10);
    expect(objectById(env, "b").transform.x).toBeCloseTo(60, 10);
    expect(env.engine.canUndo()).toBe(true);
  });

  it("preserva la rotación individual de cada member durante el resize de grupo", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10, rotation: 33 },
      { id: "b", x: 20, y: 0, width: 10, height: 10, rotation: 0 },
    ]);
    render(env, ["a", "b"]);
    const bottomRight = env.selectionLayer.getChildren()[BOTTOM_RIGHT] as Konva.Rect;
    bottomRight.x(bottomRight.x() + 10);
    bottomRight.fire("dragend", { evt: {} });

    expect(objectById(env, "a").transform.rotation).toBe(33);
    expect(objectById(env, "b").transform.rotation).toBe(0);
  });

  it("respeta el tamaño mínimo del conjunto — nunca colapsa a scale 0/negativo", () => {
    const env = setup([{ id: "a", x: 0, y: 0, width: 10, height: 10 }, { id: "b", x: 20, y: 0, width: 10, height: 10 }]);
    render(env, ["a", "b"]);
    const topLeft = env.selectionLayer.getChildren()[TOP_LEFT] as Konva.Rect;
    topLeft.x(topLeft.x() + 10000);
    topLeft.y(topLeft.y() + 10000);
    topLeft.fire("dragend", { evt: {} });

    expect(objectById(env, "a").transform.scaleX).toBeGreaterThan(0);
    expect(Number.isFinite(objectById(env, "a").transform.scaleX)).toBe(true);
  });
});

describe("renderSharedManipulationHandles — rotar (dragmove/dragend)", () => {
  // y=50 (no y=0): evita que ADR-0018 recorte el offset del handle de
  // rotación por cercanía al borde superior del Stage — ese comportamiento
  // ya está cubierto por sus propios tests en `handles.test.ts` y no debe
  // interferir con el ángulo inicial que estos tests asumen.
  it("rota ambos members alrededor del centro de la caja envolvente conjunta", () => {
    const env = setup([
      { id: "a", x: -10, y: 50, width: 0, height: 0 },
      { id: "b", x: 10, y: 50, width: 0, height: 0 },
    ]);
    render(env, ["a", "b"]);
    // Centro de la unión: (0,50). "a" está a la izquierda, "b" a la derecha.
    const rotateHandle = env.selectionLayer.getChildren()[ROTATE_CIRCLE] as Konva.Circle;

    rotateHandle.x(100);
    rotateHandle.y(50);
    rotateHandle.fire("dragmove", { evt: {} });
    rotateHandle.fire("dragend", { evt: {} });

    // Un giro de ~90° debería llevar a "a" (izquierda) hacia arriba y "b" (derecha) hacia abajo (o viceversa según convención) — lo importante es que AMBOS rotaron el mismo delta y sus posiciones ya no son las originales.
    expect(objectById(env, "a").transform.rotation).toBeCloseTo(objectById(env, "b").transform.rotation, 5);
    expect(objectById(env, "a").transform.x).not.toBeCloseTo(-10, 1);
    expect(objectById(env, "b").transform.x).not.toBeCloseTo(10, 1);
  });

  it("Shift redondea el DELTA de rotación del grupo a incrementos de 15°", () => {
    const env = setup([
      { id: "a", x: -10, y: 50, width: 0, height: 0, rotation: 5 },
      { id: "b", x: 10, y: 50, width: 0, height: 0, rotation: 10 },
    ]);
    render(env, ["a", "b"]);
    const rotateHandle = env.selectionLayer.getChildren()[ROTATE_CIRCLE] as Konva.Circle;
    // Ángulo inicial del handle: arriba del centro (0, 50-offset) -> 0°.
    // ~41° (cerca de 45, debería redondear a 45).
    rotateHandle.x(Math.sin(41 * (Math.PI / 180)) * 100);
    rotateHandle.y(50 - Math.cos(41 * (Math.PI / 180)) * 100);
    rotateHandle.fire("dragend", { evt: { shiftKey: true } });

    // delta ~45 -> a: 5+45=50, b: 10+45=55
    expect(objectById(env, "a").transform.rotation).toBeCloseTo(50, 5);
    expect(objectById(env, "b").transform.rotation).toBeCloseTo(55, 5);
  });
});

describe("renderSharedManipulationHandles — cancelación (blur/pointercancel)", () => {
  it("un blur de window mientras se arrastra la caja compartida cancela el gesto sin dispatchar y llama a onNeedsRefresh", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    const before = env.engine.getProject();

    box.startDrag();
    expect(box.isDragging()).toBe(true);
    window.dispatchEvent(new Event("blur"));

    expect(box.isDragging()).toBe(false);
    expect(env.engine.getProject()).toBe(before);
    expect(env.onNeedsRefresh).toHaveBeenCalledTimes(1);
  });

  it("un pointercancel cancela igual que blur", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    const before = env.engine.getProject();

    box.startDrag();
    window.dispatchEvent(new Event("pointercancel"));

    expect(env.engine.getProject()).toBe(before);
    expect(env.onNeedsRefresh).toHaveBeenCalledTimes(1);
  });

  it("un gesto completado (no cancelado) remueve sus listeners de blur/pointercancel — sin memory leak", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;

    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    box.fire("dragstart");
    expect(addSpy).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
    box.x(box.x() + 5);
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });

    expect(removeSpy).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
    expect(removeSpy.mock.calls.filter((call) => call[0] === "blur")).toHaveLength(
      addSpy.mock.calls.filter((call) => call[0] === "blur").length,
    );

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("hooks.notifyGestureStart/End se llaman en cada gesto, exponiendo una función de cancelación externa (Escape vía RendererAdapter)", () => {
    const env = setup([
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "b", x: 20, y: 0, width: 10, height: 10 },
    ]);
    render(env, ["a", "b"]);
    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;

    box.fire("dragstart");
    expect(env.hooks.notifyGestureStart).toHaveBeenCalledTimes(1);
    const cancelFn = (env.hooks.notifyGestureStart as ReturnType<typeof vi.fn>).mock.calls[0]![0] as () => void;

    box.startDrag(); // asegura que Konva reconozca un drag real para que stopDrag() complete
    cancelFn();
    expect(box.isDragging()).toBe(false);
    expect(env.hooks.notifyGestureEnd).toHaveBeenCalled();
  });
});

describe("renderSharedManipulationHandles — snapping excluye la propia selección", () => {
  it("mover el grupo NO se snapea de vuelta a las posiciones originales de sus propios members (bug clásico que previene excludeIds)", () => {
    // Página 100x100 (default del fixture): posiciones y delta elegidos
    // deliberadamente lejos de CUALQUIER candidato de Página (0/50/100 en
    // ambos ejes, en start/center/end de la caja) para que el único
    // candidato de snap posible sea "a"/"b" mismos — si `excludeIds` no los
    // excluyera, la propia posición INICIAL de "a" (x=15, dentro de
    // tolerancia de 8px del nuevo x=18) capturaría el movimiento de vuelta,
    // dejando la selección congelada.
    const env = setup([
      { id: "a", x: 15, y: 15, width: 5, height: 5 },
      { id: "b", x: 30, y: 15, width: 5, height: 5 },
    ]);
    const getZoom = () => 1;
    const guidesLayer = new Konva.Layer();
    env.stage.add(guidesLayer);

    const result = renderSharedManipulationHandles({
      transformableIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      mainLayer: env.mainLayer,
      selectionLayer: env.selectionLayer,
      stage: env.stage,
      engine: env.engine,
      onNeedsRefresh: env.onNeedsRefresh,
      hooks: env.hooks,
      snapping: { stage: env.stage, mainLayer: env.mainLayer, guidesLayer, getZoom },
    });
    expect(result).toBe(true);

    const box = env.selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    box.fire("dragstart");
    box.x(box.x() + 3);
    box.fire("dragmove", { evt: {} });

    expect(env.nodes.a!.x()).toBeCloseTo(18, 5);
    expect(env.nodes.b!.x()).toBeCloseTo(33, 5);
    box.fire("dragend", { evt: {} });
  });
});

describe("renderSharedManipulationHandles — casos límite adicionales (Fase 7.4, sección 12)", () => {
  it("mueve correctamente un grupo que incluye una Ellipse (pivote-centro en Konva) junto a un Rectangle (pivote-esquina)", () => {
    // Ellipse "e": schema top-left (5,5), size 20x10 -> Konva (centro) = (15,10).
    const ellipse = buildEllipse("e", { size: { width: 20, height: 10 }, transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 } });
    const rect = buildRectangle("r", { size: { width: 10, height: 10 }, transform: { x: 30, y: 5, rotation: 0, scaleX: 1, scaleY: 1 } });
    const engine = createEngine(buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [ellipse, rect])])]) }));

    const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
    const mainLayer = new Konva.Layer();
    const selectionLayer = new Konva.Layer();
    stage.add(mainLayer);
    stage.add(selectionLayer);

    const ellipseKonvaXY = toKonvaXY(ellipse);
    const ellipseNode = new Konva.Rect({ id: "e", width: 20, height: 10, x: ellipseKonvaXY.x, y: ellipseKonvaXY.y, rotation: 0, scaleX: 1, scaleY: 1 });
    const rectNode = new Konva.Rect({ id: "r", width: 10, height: 10, x: 30, y: 5, rotation: 0, scaleX: 1, scaleY: 1 });
    mainLayer.add(ellipseNode);
    mainLayer.add(rectNode);

    const onNeedsRefresh = vi.fn();
    const hooks: GroupGestureHooks = { notifyGestureStart: vi.fn(), notifyGestureEnd: vi.fn() };
    const result = renderSharedManipulationHandles({
      transformableIds: [ObjectIdSchema.parse("e"), ObjectIdSchema.parse("r")],
      mainLayer,
      selectionLayer,
      stage,
      engine,
      onNeedsRefresh,
      hooks,
    });
    expect(result).toBe(true);

    const box = selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    box.fire("dragstart");
    box.x(box.x() + 10);
    box.y(box.y());
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });

    // El Rectangle (pivote esquina) se mueve 1:1 en Konva y en schema.
    const rObj = engine.getProject().document.pages[0]!.layers[0]!.objects.find((o) => o.id === "r")!;
    expect(rObj.transform.x).toBeCloseTo(40, 5);

    // La Ellipse (pivote centro en Konva, esquina en schema) también se
    // mueve +10 en su Transform.x SCHEMA — la conversión de pivote no debe
    // introducir ningún offset adicional ni perderse durante el gesto.
    const eObj = engine.getProject().document.pages[0]!.layers[0]!.objects.find((o) => o.id === "e")!;
    expect(eObj.transform.x).toBeCloseTo(15, 5);
    // Y su node Konva (centro) refleja el mismo delta de +10.
    expect(ellipseNode.x()).toBeCloseTo(ellipseKonvaXY.x + 10, 5);
  });

  it("trata un GroupObject anidado como un member opaco — solo cambia su propio Transform, nunca toca `children`", () => {
    const child = buildRectangle("child", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const group = buildGroup("g", [child], { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const rect = buildRectangle("r", { transform: { x: 30, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const engine = createEngine(buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group, rect])])]) }));

    const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
    const mainLayer = new Konva.Layer();
    const selectionLayer = new Konva.Layer();
    stage.add(mainLayer);
    stage.add(selectionLayer);
    const groupNode = new Konva.Rect({ id: "g", width: 10, height: 10, x: 0, y: 0 });
    const rectNode = new Konva.Rect({ id: "r", width: 10, height: 10, x: 30, y: 0 });
    mainLayer.add(groupNode);
    mainLayer.add(rectNode);

    const onNeedsRefresh = vi.fn();
    const hooks: GroupGestureHooks = { notifyGestureStart: vi.fn(), notifyGestureEnd: vi.fn() };
    renderSharedManipulationHandles({
      transformableIds: [ObjectIdSchema.parse("g"), ObjectIdSchema.parse("r")],
      mainLayer,
      selectionLayer,
      stage,
      engine,
      onNeedsRefresh,
      hooks,
    });

    const box = selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    box.fire("dragstart");
    box.x(box.x() + 5);
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });

    const groupObj = engine.getProject().document.pages[0]!.layers[0]!.objects.find((o) => o.id === "g")!;
    expect(groupObj.type).toBe("group");
    expect(groupObj.transform.x).toBeCloseTo(5, 5);
    // `children` nunca se toca — sigue siendo exactamente el mismo array de origen.
    expect((groupObj as typeof group).children).toEqual(group.children);
  });

  it("un object oculto (visible:false) SÍ es transformable como parte del grupo (a diferencia de uno bloqueado)", () => {
    const hidden = buildRectangle("h", {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      metadata: { tags: [], visible: false, locked: false, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
    });
    const rect = buildRectangle("r", { transform: { x: 30, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const engine = createEngine(buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [hidden, rect])])]) }));

    const stage = new Konva.Stage({ container: container(), width: 200, height: 200 });
    const mainLayer = new Konva.Layer();
    const selectionLayer = new Konva.Layer();
    stage.add(mainLayer);
    stage.add(selectionLayer);
    const hiddenNode = new Konva.Rect({ id: "h", width: 10, height: 10, x: 0, y: 0, visible: false });
    const rectNode = new Konva.Rect({ id: "r", width: 10, height: 10, x: 30, y: 0 });
    mainLayer.add(hiddenNode);
    mainLayer.add(rectNode);

    const onNeedsRefresh = vi.fn();
    const hooks: GroupGestureHooks = { notifyGestureStart: vi.fn(), notifyGestureEnd: vi.fn() };
    const result = renderSharedManipulationHandles({
      transformableIds: [ObjectIdSchema.parse("h"), ObjectIdSchema.parse("r")],
      mainLayer,
      selectionLayer,
      stage,
      engine,
      onNeedsRefresh,
      hooks,
    });
    expect(result).toBe(true);

    const box = selectionLayer.getChildren()[SHARED_BOX] as Konva.Rect;
    box.fire("dragstart");
    box.x(box.x() + 7);
    box.fire("dragmove", { evt: {} });
    box.fire("dragend", { evt: {} });

    const hiddenObj = engine.getProject().document.pages[0]!.layers[0]!.objects.find((o) => o.id === "h")!;
    expect(hiddenObj.transform.x).toBeCloseTo(7, 5);
  });

  it("ADR-0018: el handle de rotación de la caja COMPARTIDA también se recorta contra el borde superior del Stage", () => {
    const env = setup([
      { id: "a", x: -10, y: 0, width: 0, height: 0 },
      { id: "b", x: 10, y: 0, width: 0, height: 0 },
    ]);
    render(env, ["a", "b"]);
    const rotateHandle = env.selectionLayer.getChildren()[ROTATE_CIRCLE] as Konva.Circle;

    expect(rotateHandle.y()).toBeGreaterThanOrEqual(0);
    expect(rotateHandle.y()).toBe(0);
  });
});
