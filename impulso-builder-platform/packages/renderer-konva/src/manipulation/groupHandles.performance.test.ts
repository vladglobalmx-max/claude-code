import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createEngine } from "@impulso/engine";
import { ObjectIdSchema } from "@impulso/document-schema";
import { renderSharedManipulationHandles, type GroupGestureHooks } from "./groupHandles.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

/**
 * Epic 7 / Fase 7.4, sección 11 (Performance) — verifica el invariante
 * arquitectónico central del preview grupal: el snapshot inicial
 * (`initialMembers`, calculado UNA vez vía `getSelfRect()`/`getClientRect()`
 * de Konva) nunca se vuelve a medir en cada frame de `dragmove` — solo se
 * itera sobre el snapshot ya calculado y se escriben unos pocos atributos
 * por member. No son benchmarks de tiempo estrictos (estos entornos de CI
 * varían), sino smoke tests que fallarían de inmediato si alguien
 * reintrodujera una medición por frame (ej. llamar a
 * `computeObjectBoundingBox` dentro de un handler de `dragmove`).
 */

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function buildGridProject(count: number) {
  const objects = Array.from({ length: count }, (_, i) =>
    buildRectangle(`obj_${i}`, {
      size: { width: 10, height: 10 },
      transform: { x: (i % 20) * 15, y: Math.floor(i / 20) * 15, rotation: 0, scaleX: 1, scaleY: 1 },
    }),
  );
  const engine = createEngine(
    buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", objects)], { size: { width: 2000, height: 2000 } })]) }),
  );

  const stage = new Konva.Stage({ container: container(), width: 2000, height: 2000 });
  const mainLayer = new Konva.Layer();
  const selectionLayer = new Konva.Layer();
  stage.add(mainLayer);
  stage.add(selectionLayer);

  for (const object of objects) {
    mainLayer.add(
      new Konva.Rect({
        id: object.id,
        width: object.size.width,
        height: object.size.height,
        x: object.transform.x,
        y: object.transform.y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        draggable: true,
      }),
    );
  }

  const onNeedsRefresh = vi.fn();
  const hooks: GroupGestureHooks = { notifyGestureStart: vi.fn(), notifyGestureEnd: vi.fn() };
  const transformableIds = objects.map((o) => ObjectIdSchema.parse(o.id));
  return { engine, stage, mainLayer, selectionLayer, onNeedsRefresh, hooks, transformableIds };
}

describe("renderSharedManipulationHandles — performance (Fase 7.4, sección 11)", () => {
  it("mover 100 objects: getSelfRect se llama UNA vez por member al iniciar, nunca de nuevo durante los frames de dragmove", () => {
    const env = buildGridProject(100);
    const getSelfRectSpy = vi.spyOn(Konva.Rect.prototype, "getSelfRect");

    const result = renderSharedManipulationHandles({
      transformableIds: env.transformableIds,
      mainLayer: env.mainLayer,
      selectionLayer: env.selectionLayer,
      stage: env.stage,
      engine: env.engine,
      onNeedsRefresh: env.onNeedsRefresh,
      hooks: env.hooks,
    });
    expect(result).toBe(true);
    const callsAfterSetup = getSelfRectSpy.mock.calls.length;
    expect(callsAfterSetup).toBeGreaterThanOrEqual(100); // al menos una medición por member

    const box = env.selectionLayer.getChildren()[0] as Konva.Rect;
    const start = performance.now();
    box.fire("dragstart");
    for (let frame = 0; frame < 30; frame++) {
      box.x(box.x() + 1);
      box.fire("dragmove", { evt: {} });
    }
    box.fire("dragend", { evt: {} });
    const elapsedMs = performance.now() - start;

    // Ninguna medición Konva adicional durante los 30 frames + commit —
    // el preview y el commit parten siempre del snapshot inicial.
    expect(getSelfRectSpy.mock.calls.length).toBe(callsAfterSetup);
    // Smoke test de tiempo, generoso a propósito (no es un benchmark de
    // precisión): 100 objects x 30 frames sin remedir Konva debe ser casi
    // instantáneo; un regresión que reintroduzca medición por frame
    // (O(N) getSelfRect x 30 frames) sería un orden de magnitud más lento.
    expect(elapsedMs).toBeLessThan(2000);

    getSelfRectSpy.mockRestore();
  });

  it("redimensionar 50 objects: computeGroupResize + escritura de atributos por frame, sin medir Konva de nuevo", () => {
    const env = buildGridProject(50);
    const getSelfRectSpy = vi.spyOn(Konva.Rect.prototype, "getSelfRect");

    renderSharedManipulationHandles({
      transformableIds: env.transformableIds,
      mainLayer: env.mainLayer,
      selectionLayer: env.selectionLayer,
      stage: env.stage,
      engine: env.engine,
      onNeedsRefresh: env.onNeedsRefresh,
      hooks: env.hooks,
    });
    const callsAfterSetup = getSelfRectSpy.mock.calls.length;

    // Índice 8 = handle "bottom-right" (0=caja, 1-8=resize, ver constantes de groupHandles.test.ts).
    const bottomRight = env.selectionLayer.getChildren()[8] as Konva.Rect;
    const start = performance.now();
    bottomRight.fire("dragstart");
    for (let frame = 0; frame < 30; frame++) {
      bottomRight.x(bottomRight.x() + 2);
      bottomRight.y(bottomRight.y() + 2);
      bottomRight.fire("dragmove", { evt: {} });
    }
    bottomRight.fire("dragend", { evt: {} });
    const elapsedMs = performance.now() - start;

    expect(getSelfRectSpy.mock.calls.length).toBe(callsAfterSetup);
    expect(elapsedMs).toBeLessThan(2000);

    getSelfRectSpy.mockRestore();
  });

  it("rotar 50 objects: computeGroupRotation por frame, sin medir Konva de nuevo", () => {
    const env = buildGridProject(50);
    const getSelfRectSpy = vi.spyOn(Konva.Rect.prototype, "getSelfRect");

    renderSharedManipulationHandles({
      transformableIds: env.transformableIds,
      mainLayer: env.mainLayer,
      selectionLayer: env.selectionLayer,
      stage: env.stage,
      engine: env.engine,
      onNeedsRefresh: env.onNeedsRefresh,
      hooks: env.hooks,
    });
    const callsAfterSetup = getSelfRectSpy.mock.calls.length;

    const rotateHandle = env.selectionLayer.getChildren()[10] as Konva.Circle;
    const start = performance.now();
    rotateHandle.fire("dragstart");
    for (let frame = 0; frame < 30; frame++) {
      const angle = frame * 3 * (Math.PI / 180);
      rotateHandle.x(Math.sin(angle) * 200);
      rotateHandle.y(-Math.cos(angle) * 200);
      rotateHandle.fire("dragmove", { evt: {} });
    }
    rotateHandle.fire("dragend", { evt: {} });
    const elapsedMs = performance.now() - start;

    expect(getSelfRectSpy.mock.calls.length).toBe(callsAfterSetup);
    expect(elapsedMs).toBeLessThan(2000);

    getSelfRectSpy.mockRestore();
  });
});
