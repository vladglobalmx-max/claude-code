import { describe, expect, it } from "vitest";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
  type Unit,
} from "@impulso/document-schema";
import { mountCanvasRuntime } from "./bootstrap.js";
import { createAlignmentController, mountAlignmentPanel } from "./alignment.js";

const NOW = "2026-07-19T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function rect(id: string, x: number, y: number, width: number, height: number, rotation = 0): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x, y, rotation, scaleX: 1, scaleY: 1 },
    size: { width, height },
    cornerRadius: 0,
    style: { fill: "#ff0000", strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

function buildProject(objects: SceneObject[], pageSize = { width: 300, height: 300 }, unit: Unit = "px"): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_1"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: pageSize,
          unit,
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" as const },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects, metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "test" },
    pluginData: {},
    customProperties: {},
  };
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function setup(objects: SceneObject[], pageSize?: { width: number; height: number }, unit?: Unit) {
  const runtime = mountCanvasRuntime(container(), buildProject(objects, pageSize, unit));
  const controller = createAlignmentController(runtime.engine, runtime.renderer);
  return { ...runtime, controller };
}

function select(engine: ReturnType<typeof setup>["engine"], ids: string[]): void {
  engine.dispatch({ type: "setSelection", objectIds: ids.map((id) => ObjectIdSchema.parse(id)) });
}

describe("createAlignmentController", () => {
  it("sin selección, rechaza con un mensaje accesible", () => {
    const { controller } = setup([rect("a", 0, 0, 10, 10)]);
    const result = controller.run("align-left");
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("alignLeft mueve los objects y produce una sola entrada de historial", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    select(engine, ["a", "b"]);

    const result = controller.run("align-left");

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(1);
    expect(engine.getProject().document.history.entries[0]?.description).toBe("Alinear a la izquierda");
    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.transform.x)).toEqual([0, 0]);
  });

  it("si ya está alineado, no genera ningún cambio ni entrada de historial", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 0, 30, 10, 10)]);
    select(engine, ["a", "b"]);

    const result = controller.run("align-left");

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(0);
  });

  it("distribuye correctamente con 3 objects seleccionados", () => {
    const { engine, controller } = setup([
      rect("a", 0, 0, 10, 10),
      rect("b", 40, 0, 10, 10),
      rect("c", 100, 0, 10, 10),
    ]);
    select(engine, ["a", "b", "c"]);

    const result = controller.run("distribute-h");

    expect(result.ok).toBe(true);
    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.find((o) => o.id === "b")?.transform.x).toBe(50);
    expect(engine.getProject().document.history.entries[0]?.description).toBe("Distribuir horizontalmente");
  });

  it("distribuir con menos de 3 seleccionados es un no-op silencioso (la función pura ya lo maneja)", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    select(engine, ["a", "b"]);

    const result = controller.run("distribute-h");

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(0);
  });

  it("las 6 alineaciones y las 2 distribuciones aplican su operación correspondiente", () => {
    const objects = [rect("a", 0, 0, 10, 10), rect("b", 40, 0, 10, 10), rect("c", 100, 0, 10, 10)];
    for (const operation of [
      "align-center-h",
      "align-right",
      "align-top",
      "align-center-v",
      "align-bottom",
      "distribute-v",
    ] as const) {
      const { engine, controller } = setup(objects.map((o) => ({ ...o })));
      select(engine, ["a", "b", "c"]);
      const result = controller.run(operation);
      expect(result.ok).toBe(true);
    }
  });

  it("centrar en página funciona con exactamente un object seleccionado", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 20, 10)], { width: 100, height: 100 });
    select(engine, ["a"]);

    const result = controller.run("center-page-h");

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(40);
  });

  it("centrar vertical en página funciona con exactamente un object seleccionado", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 20, 10)], { width: 100, height: 100 });
    select(engine, ["a"]);

    const result = controller.run("center-page-v");

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.y).toBe(45);
  });

  it("centrar en página se rechaza con 2+ seleccionados (con mensaje accesible)", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 20, 10), rect("b", 50, 0, 20, 10)], {
      width: 100,
      height: 100,
    });
    select(engine, ["a", "b"]);

    const result = controller.run("center-page-h");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("un solo object");
  });

  it("centrar en página convierte page.unit a la unidad canónica (px) antes de calcular", () => {
    // page 100mm de ancho -> en px: 100 * (96/25.4) ≈ 377.95px. Object 20px de ancho.
    const { engine, controller } = setup([rect("a", 0, 0, 20, 10)], { width: 100, height: 100 }, "mm");
    select(engine, ["a"]);

    const result = controller.run("center-page-h");

    expect(result.ok).toBe(true);
    const x = engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x;
    expect(x).toBeCloseTo((100 * (96 / 25.4) - 20) / 2, 2);
  });

  it("un rectángulo rotado se alinea por su caja real (AABB), no por su transform.x crudo", () => {
    // "a" 40x10 en (0,0) rotado 90°: su AABB real tiene minX negativo.
    // "b" 10x10 en (100,0), sin rotar.
    const { engine, controller } = setup([rect("a", 0, 0, 40, 10, 90), rect("b", 100, 0, 10, 10)]);
    select(engine, ["a", "b"]);

    const result = controller.run("align-left");

    expect(result.ok).toBe(true);
    // "a" rotado 90° alrededor de (0,0): su AABB va de x=-10 a x=0 (ver
    // computeRotatedBoundingBox). "b" debe moverse para compartir ese borde:
    // su nuevo transform.x = -10 (su ancho es 10, minX pasa a ser -10).
    const bX = engine.getProject().document.pages[0]?.layers[0]?.objects.find((o) => o.id === "b")?.transform.x;
    expect(bX).toBeCloseTo(-10, 5);
  });

  it("selectedTopLevelCount refleja la selección actual", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    expect(controller.selectedTopLevelCount()).toBe(0);
    select(engine, ["a", "b"]);
    expect(controller.selectedTopLevelCount()).toBe(2);
  });

  it("si el renderer no tiene un Stage montado (ej. tras destroy()), rechaza con un mensaje accesible", () => {
    const { engine, renderer, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    select(engine, ["a", "b"]);
    renderer.destroy();

    const result = controller.run("align-left");

    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("centrar en página también rechaza si no hay Stage montado", () => {
    const { engine, renderer, controller } = setup([rect("a", 0, 0, 10, 10)]);
    select(engine, ["a"]);
    renderer.destroy();

    const result = controller.run("center-page-h");

    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });
});

describe("mountAlignmentPanel", () => {
  it("sin selección, no renderiza ninguna sección", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);

    expect(div.querySelector(".alignment-section")).toBeNull();
  });

  it("con 1 seleccionado, muestra solo los 2 botones de centrar en página", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a"]);

    const buttons = div.querySelectorAll(".alignment-button");
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Centrar horizontal en página",
      "Centrar vertical en página",
    ]);
  });

  it("con 2 seleccionados, muestra los 6 botones de alineación (sin distribuir)", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b"]);

    expect(div.querySelectorAll(".alignment-button")).toHaveLength(6);
  });

  it("con 3+ seleccionados, agrega los 2 botones de distribuir (8 en total)", () => {
    const { engine, controller } = setup([
      rect("a", 0, 0, 10, 10),
      rect("b", 50, 0, 10, 10),
      rect("c", 100, 0, 10, 10),
    ]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b", "c"]);

    expect(div.querySelectorAll(".alignment-button")).toHaveLength(8);
  });

  it("cada botón tiene title, aria-label y aria-describedby (no depende solo de color/ícono)", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b"]);

    const button = div.querySelector(".alignment-button") as HTMLButtonElement;
    expect(button.title.length).toBeGreaterThan(0);
    expect(button.getAttribute("aria-label")).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("al hacer clic en un botón, aplica la operación", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b"]);

    const leftButton = div.querySelector(".alignment-button") as HTMLButtonElement; // primer botón: alinear izquierda
    leftButton.click();

    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.transform.x)).toEqual([0, 0]);
  });

  it("un rechazo real (sin Stage montado) muestra un mensaje de error accesible (role=alert), no solo color", () => {
    const { engine, renderer, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    const div = container();
    mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b"]);

    const errorEl = div.querySelector("[role='alert']");
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe(""); // sin error todavía

    renderer.destroy(); // simula una falla real: ya no hay Stage para medir bounding boxes
    const button = div.querySelector(".alignment-button") as HTMLButtonElement;
    button.click();

    expect(errorEl?.textContent).toBeTruthy();
  });

  it("destroy() detiene la suscripción — un cambio posterior no re-renderiza", () => {
    const { engine, controller } = setup([rect("a", 0, 0, 10, 10), rect("b", 50, 0, 10, 10)]);
    const div = container();
    const panel = mountAlignmentPanel(div, engine, controller);
    select(engine, ["a", "b"]);
    expect(div.querySelectorAll(".alignment-button").length).toBeGreaterThan(0);

    panel.destroy();
    select(engine, []);
    // Sin destroy() habría vuelto a estar vacío; con destroy(), el DOM
    // congelado en su último estado no cambia (no hay suscripción activa).
    expect(div.querySelectorAll(".alignment-button").length).toBeGreaterThan(0);
  });
});
