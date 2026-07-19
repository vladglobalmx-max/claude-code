import { describe, expect, it } from "vitest";
import Konva from "konva";
import { ObjectIdSchema } from "@impulso/document-schema";
import { beginSnapGesture, updateSnapGesture, endSnapGesture, type SnapEnvironment } from "./smartGuides.js";
import { buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function setupEnv(): { env: SnapEnvironment; mainLayer: Konva.Layer; guidesLayer: Konva.Layer } {
  const stage = new Konva.Stage({ container: container(), width: 400, height: 400 });
  const mainLayer = new Konva.Layer();
  const guidesLayer = new Konva.Layer();
  stage.add(mainLayer);
  stage.add(guidesLayer);
  return { env: { stage, mainLayer, guidesLayer, getZoom: () => 1 }, mainLayer, guidesLayer };
}

describe("beginSnapGesture", () => {
  it("arma candidatos de página (6) + de cada object visible top-level (6 c/u), excluyendo los ids dados", () => {
    const { env, mainLayer } = setupEnv();
    const page = buildPage(
      "page_1",
      [
        buildLayer("layer_1", [
          buildRectangle("a", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }),
          buildRectangle("b", { transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } }),
        ]),
      ],
      { size: { width: 200, height: 100 }, unit: "px" },
    );
    mainLayer.add(new Konva.Rect({ id: "a", x: 0, y: 0, width: 10, height: 10 }));
    mainLayer.add(new Konva.Rect({ id: "b", x: 50, y: 0, width: 10, height: 10 }));

    const gesture = beginSnapGesture(env, page, [ObjectIdSchema.parse("a")]);

    // 6 de página + 6 de "b" (excluyendo "a", que es el object en manipulación).
    expect(gesture.candidates).toHaveLength(12);
    expect(gesture.candidates.some((c) => c.objectId === "a")).toBe(false);
    expect(gesture.candidates.filter((c) => c.objectId === "b")).toHaveLength(6);
    expect(gesture.objectBoxes.has(ObjectIdSchema.parse("b"))).toBe(true);
    expect(gesture.objectBoxes.has(ObjectIdSchema.parse("a"))).toBe(false);
  });

  it("no incluye objects de layers ocultas (invisibles)", () => {
    const { env, mainLayer } = setupEnv();
    const hiddenLayer = buildLayer("layer_hidden", [buildRectangle("c")], {
      metadata: { tags: [], visible: false, locked: false, createdAt: "x", updatedAt: "x" },
    });
    const page = buildPage("page_1", [hiddenLayer], { size: { width: 200, height: 100 }, unit: "px" });
    mainLayer.add(new Konva.Rect({ id: "c", x: 0, y: 0, width: 10, height: 10 }));

    const gesture = beginSnapGesture(env, page, []);

    expect(gesture.candidates.some((c) => c.objectId === "c")).toBe(false);
  });

  it("convierte el tamaño de página a espacio canónico (px) según page.unit", () => {
    const { env } = setupEnv();
    // 50mm -> px vía 96px/25.4mm (misma conversión que el resto del paquete).
    const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });

    const gesture = beginSnapGesture(env, page, []);

    const pageEndX = gesture.candidates.find((c) => c.source === "page" && c.axis === "x" && c.refPoint === "end");
    expect(pageEndX?.value).toBeCloseTo(50 * (96 / 25.4), 5);
  });

  it("el candidato de grid refleja `page.grid.size`/`snapEnabled`", () => {
    const { env } = setupEnv();
    const page = buildPage("page_1", [], { grid: { visible: true, snapEnabled: true, size: 25, type: "lines" } });

    const gesture = beginSnapGesture(env, page, []);

    expect(gesture.grid).toEqual({ size: 25, snapEnabled: true });
  });
});

describe("updateSnapGesture", () => {
  function simpleGesture(env: SnapEnvironment, mainLayer: Konva.Layer) {
    const page = buildPage(
      "page_1",
      [buildLayer("layer_1", [buildRectangle("b", { transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })])],
      { size: { width: 1000, height: 1000 }, unit: "px" },
    );
    mainLayer.add(new Konva.Rect({ id: "b", x: 100, y: 0, width: 10, height: 10 }));
    return beginSnapGesture(env, page, []);
  }

  it("devuelve un snap cuando la caja objetivo cae dentro de tolerancia de un candidato", () => {
    const { env, mainLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);

    const result = updateSnapGesture(env, gesture, { minX: 101, minY: 700, maxX: 111, maxY: 720 }, { disabled: false });

    expect(result.x?.value).toBe(100);
  });

  it("no devuelve snap fuera de tolerancia", () => {
    const { env, mainLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);

    const result = updateSnapGesture(env, gesture, { minX: 600, minY: 700, maxX: 610, maxY: 720 }, { disabled: false });

    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
  });

  it("`disabled: true` no calcula snap, limpia guías y olvida la hysteresis previa", () => {
    const { env, mainLayer, guidesLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);
    gesture.previousSnap = { x: { value: 100, refPoint: "start", delta: 0, source: "object", objectId: ObjectIdSchema.parse("b") } };

    const result = updateSnapGesture(env, gesture, { minX: 101, minY: 700, maxX: 111, maxY: 720 }, { disabled: true });

    expect(result).toEqual({});
    expect(gesture.previousSnap).toBeUndefined();
    expect(guidesLayer.getChildren()).toHaveLength(0);
  });

  it("dibuja al menos una guía en `guidesLayer` cuando hay snap", () => {
    const { env, mainLayer, guidesLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);

    updateSnapGesture(env, gesture, { minX: 101, minY: 700, maxX: 111, maxY: 720 }, { disabled: false });

    expect(guidesLayer.getChildren().length).toBeGreaterThan(0);
  });

  it("no dibuja ninguna guía cuando no hay snap", () => {
    const { env, mainLayer, guidesLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);

    updateSnapGesture(env, gesture, { minX: 600, minY: 700, maxX: 610, maxY: 720 }, { disabled: false });

    expect(guidesLayer.getChildren()).toHaveLength(0);
  });

  it("respeta `eligibleRefPoints` (ej. resize: solo el borde que mueve ese handle)", () => {
    const { env, mainLayer } = setupEnv();
    const gesture = simpleGesture(env, mainLayer);

    // La caja objetivo tiene su borde IZQUIERDO (start=101) cerca del
    // candidato "b" (100), pero su borde DERECHO (end=300) está lejos de
    // cualquier candidato. Restringir a solo "end" debe impedir el snap.
    const result = updateSnapGesture(
      env,
      gesture,
      { minX: 101, minY: 700, maxX: 300, maxY: 720 },
      { disabled: false, eligibleRefPoints: { x: ["end"], y: [] } },
    );

    expect(result.x).toBeUndefined();
  });
});

describe("endSnapGesture", () => {
  it("limpia cualquier guía dibujada previamente", () => {
    const { env, guidesLayer } = setupEnv();
    guidesLayer.add(new Konva.Line({ points: [0, 0, 10, 10] }));
    expect(guidesLayer.getChildren().length).toBeGreaterThan(0);

    endSnapGesture(env);

    expect(guidesLayer.getChildren()).toHaveLength(0);
  });
});
