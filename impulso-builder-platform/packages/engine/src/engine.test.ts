import { describe, expect, it, vi } from "vitest";
import { ObjectIdSchema, PageIdSchema, LayerIdSchema } from "@impulso/document-schema";
import { createEngine } from "./engine.js";
import type { EngineEvent } from "./events/engineEvent.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, NOW } from "./testUtils/fixtures.js";

function projectWithRect() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
  });
}

function testEngine() {
  let counter = 0;
  return createEngine(projectWithRect(), {
    clock: () => NOW,
    historyEntryIdGenerator: () => `h_${++counter}`,
  });
}

describe("createEngine — construcción", () => {
  it("lanza si el Project inicial es inválido", () => {
    expect(() => createEngine({ bogus: true } as never)).toThrow();
  });

  it("usa Date.toISOString() como clock por defecto si no se inyecta uno", () => {
    const engine = createEngine(projectWithRect());
    const result = engine.dispatch({ type: "updateMetadata", target: { level: "document" }, metadata: { name: "x" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(() => new Date(result.value.document.metadata.updatedAt)).not.toThrow();
      expect(Number.isNaN(new Date(result.value.document.metadata.updatedAt).getTime())).toBe(false);
    }
  });

  it("getProject/getSelection devuelven el estado inicial", () => {
    const engine = testEngine();
    expect(engine.getProject().document.pages).toHaveLength(1);
    expect(engine.getSelection()).toEqual([]);
    expect(engine.canUndo()).toBe(false);
    expect(engine.canRedo()).toBe(false);
  });
});

describe("createEngine — dispatch de comandos de contenido", () => {
  it("aplica un comando válido y actualiza getProject()", () => {
    const engine = testEngine();
    const result = engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: 20 },
    });
    expect(result.ok).toBe(true);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(20);
  });

  it("rechaza un comando inválido (shape incorrecta) sin lanzar", () => {
    const engine = testEngine();
    const result = engine.dispatch({ type: "removeObject" } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_command");
  });

  it("rechaza un comando bien formado pero semánticamente inválido (objeto inexistente)", () => {
    const engine = testEngine();
    const result = engine.dispatch({
      type: "removeObject",
      objectId: ObjectIdSchema.parse("no_existe"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });

  it("un comando rechazado no cambia el Project ni habilita undo", () => {
    const engine = testEngine();
    const before = engine.getProject();
    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("no_existe") });
    expect(engine.getProject()).toBe(before);
    expect(engine.canUndo()).toBe(false);
  });
});

describe("createEngine — selección", () => {
  it("setSelection y clearSelection no pasan por el pipeline de historial de contenido", () => {
    const engine = testEngine();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });
    expect(engine.getSelection()).toEqual(["rect_1"]);
    expect(engine.canUndo()).toBe(false); // seleccionar no es deshacible

    engine.dispatch({ type: "clearSelection" });
    expect(engine.getSelection()).toEqual([]);
  });

  it("poda automáticamente la selección cuando el objeto seleccionado se elimina", () => {
    const engine = testEngine();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });
    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });
    expect(engine.getSelection()).toEqual([]);
  });

  it("toggleObjectSelection permite selección múltiple sin pasar por historial", () => {
    const engine = testEngine();
    engine.dispatch({ type: "toggleObjectSelection", objectId: ObjectIdSchema.parse("rect_1") });
    expect(engine.getSelection()).toEqual(["rect_1"]);
    expect(engine.canUndo()).toBe(false);

    engine.dispatch({ type: "toggleObjectSelection", objectId: ObjectIdSchema.parse("rect_1") });
    expect(engine.getSelection()).toEqual([]);
  });
});

describe("createEngine — undo/redo", () => {
  it("undo revierte el último comando de contenido y redo lo reaplica", () => {
    const engine = testEngine();
    engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: 20 },
    });
    expect(engine.canUndo()).toBe(true);

    const undoResult = engine.undo();
    expect(undoResult.ok).toBe(true);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(0);
    expect(engine.canRedo()).toBe(true);

    const redoResult = engine.redo();
    expect(redoResult.ok).toBe(true);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(20);
  });

  it("undo sin historial devuelve nothing_to_undo", () => {
    const engine = testEngine();
    const result = engine.undo();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("nothing_to_undo");
  });

  it("redo sin historial devuelve nothing_to_redo", () => {
    const engine = testEngine();
    const result = engine.redo();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("nothing_to_redo");
  });

  it("un nuevo comando después de undo limpia la pila de redo", () => {
    const engine = testEngine();
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 1 } });
    engine.undo();
    expect(engine.canRedo()).toBe(true);

    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 2 } });
    expect(engine.canRedo()).toBe(false);
  });

  it("respeta historyLimit: no acumula más estados de los permitidos", () => {
    const engine = createEngine(projectWithRect(), { clock: () => NOW, historyLimit: 2 });
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 1 } });
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 2 } });
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 3 } });

    // Con límite 2 solo se puede deshacer dos veces, no tres.
    expect(engine.undo().ok).toBe(true);
    expect(engine.undo().ok).toBe(true);
    expect(engine.undo().ok).toBe(false);
  });
});

describe("createEngine — eventos", () => {
  it("emite projectChanged y historyChanged tras un comando exitoso", () => {
    const engine = testEngine();
    const events: EngineEvent[] = [];
    engine.subscribe((event) => events.push(event));

    engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: 5 },
    });

    expect(events.map((e) => e.type)).toEqual(["projectChanged", "historyChanged"]);
  });

  it("emite commandRejected para un comando fallido", () => {
    const engine = testEngine();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("no_existe") });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "commandRejected", error: expect.objectContaining({ code: "object_not_found" }) }),
    );
  });

  it("emite selectionChanged al seleccionar y al podar automáticamente", () => {
    const engine = testEngine();
    const events: EngineEvent[] = [];
    engine.subscribe((event) => events.push(event));

    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });
    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });

    const selectionEvents = events.filter((e) => e.type === "selectionChanged");
    expect(selectionEvents).toHaveLength(2);
  });

  it("unsubscribe detiene la entrega de eventos", () => {
    const engine = testEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    unsubscribe();

    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 1 } });

    expect(listener).not.toHaveBeenCalled();
  });

  it("emite projectChanged con cause 'undo'/'redo' en vez de 'command'", () => {
    const engine = testEngine();
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("rect_1"), transform: { x: 1 } });

    const events: EngineEvent[] = [];
    engine.subscribe((event) => events.push(event));

    engine.undo();
    const undoEvent = events.find((e) => e.type === "projectChanged");
    expect(undoEvent && "cause" in undoEvent ? undoEvent.cause.type : undefined).toBe("undo");
  });
});

describe("createEngine — dispatchBatch (Epic 7 / Fase 7.2)", () => {
  function twoRectEngine() {
    let counter = 0;
    return createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
        ]),
      }),
      { clock: () => NOW, historyEntryIdGenerator: () => `h_${++counter}` },
    );
  }

  it("aplica varios comandos como una sola entrada de historial", () => {
    const engine = twoRectEngine();
    const result = engine.dispatchBatch([
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
    ]);
    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(1);
    expect(
      engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.transform.x),
    ).toEqual([10, 20]);
  });

  it("un solo Undo revierte TODO el batch (atómico)", () => {
    const engine = twoRectEngine();
    engine.dispatchBatch([
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
    ]);

    const undoResult = engine.undo();
    expect(undoResult.ok).toBe(true);
    expect(
      engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.transform.x),
    ).toEqual([0, 0]);
    expect(engine.canRedo()).toBe(true);
  });

  it("un solo Redo restaura TODO el batch (atómico)", () => {
    const engine = twoRectEngine();
    engine.dispatchBatch([
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
    ]);
    engine.undo();

    const redoResult = engine.redo();
    expect(redoResult.ok).toBe(true);
    expect(
      engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.transform.x),
    ).toEqual([10, 20]);
  });

  it("interopera con dispatch()/undo/redo normales: un batch es una entrada más de la misma pila", () => {
    const engine = twoRectEngine();
    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 1 } });
    engine.dispatchBatch([
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 100 } },
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 200 } },
    ]);
    expect(engine.getProject().document.history.entries).toHaveLength(2);

    engine.undo(); // revierte el batch completo
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.transform.x)).toEqual([1, 0]);

    engine.undo(); // revierte el dispatch() individual anterior
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.transform.x)).toEqual([0, 0]);
  });

  it("batch vacío: no-op — no agrega historial, no emite projectChanged", () => {
    const engine = twoRectEngine();
    const events: EngineEvent[] = [];
    engine.subscribe((event) => events.push(event));

    const result = engine.dispatchBatch([]);
    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(0);
    expect(engine.canUndo()).toBe(false);
    expect(events).toHaveLength(0);
  });

  it("un batch fallido no deja estado parcial ni habilita undo", () => {
    const engine = twoRectEngine();
    const before = engine.getProject();
    const result = engine.dispatchBatch([
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 999 } },
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 1 } },
    ]);
    expect(result.ok).toBe(false);
    expect(engine.getProject()).toBe(before);
    expect(engine.canUndo()).toBe(false);
  });

  it("rechaza un comando mal formado dentro de un batch (shape incorrecta) sin lanzar", () => {
    const engine = twoRectEngine();
    const result = engine.dispatchBatch([{ type: "updateObjectTransform" } as never]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_command");
    expect(engine.canUndo()).toBe(false);
  });

  it("rechaza comandos de selección dentro de un batch (no participan de historial/undo)", () => {
    const engine = twoRectEngine();
    const result = engine.dispatchBatch([
      { type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] } as never,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_command");
    expect(engine.getSelection()).toEqual([]);
  });

  it("emite batchRejected (no commandRejected) cuando el batch falla", () => {
    const engine = twoRectEngine();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.dispatchBatch([{ type: "removeObject", objectId: ObjectIdSchema.parse("no-existe") }]);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "batchRejected", error: expect.objectContaining({ code: "object_not_found" }) }),
    );
  });

  it("emite projectChanged con cause 'batch' (incluye los comandos y la label) en éxito", () => {
    const engine = twoRectEngine();
    const events: EngineEvent[] = [];
    engine.subscribe((event) => events.push(event));

    engine.dispatchBatch(
      [{ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } }],
      { label: "Alinear a la izquierda" },
    );

    const changed = events.find((e) => e.type === "projectChanged");
    expect(changed && "cause" in changed ? changed.cause : undefined).toEqual(
      expect.objectContaining({ type: "batch", label: "Alinear a la izquierda" }),
    );
  });

  it("usa la etiqueta dada como descripción de la entrada de historial", () => {
    const engine = twoRectEngine();
    engine.dispatchBatch(
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
      ],
      { label: "Distribuir horizontalmente" },
    );
    expect(engine.getProject().document.history.entries[0]?.description).toBe("Distribuir horizontalmente");
  });

  it("poda la selección tras un batch igual que tras un dispatch() normal", () => {
    const engine = twoRectEngine();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")] });
    engine.dispatchBatch([{ type: "removeObject", objectId: ObjectIdSchema.parse("a") }]);
    expect(engine.getSelection()).toEqual(["b"]);
  });

  it("respeta historyLimit igual que dispatch() individual", () => {
    let counter = 0;
    const engine = createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
        ]),
      }),
      { clock: () => NOW, historyEntryIdGenerator: () => `h_${++counter}`, historyLimit: 1 },
    );
    engine.dispatchBatch([{ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 1 } }]);
    engine.dispatchBatch([{ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 2 } }]);

    expect(engine.undo().ok).toBe(true);
    expect(engine.undo().ok).toBe(false);
  });

  /**
   * Benchmark ligero (Epic 7 / Fase 7.2, sección "Performance"): confirma
   * que mover 150 objects en un solo batch sigue produciendo una única
   * entrada de historial (no 150) y termina en un tiempo acotado — no es
   * infraestructura de benchmarking real, solo una red de seguridad para
   * detectar una regresión evidente (ej. si alguien reintrodujera un
   * `ProjectSchema.safeParse` por comando dentro del batch en vez de uno
   * solo al final).
   */
  it("mover 150 objects en un solo batch produce una entrada y termina en un tiempo acotado", () => {
    const objects = Array.from({ length: 150 }, (_, i) => buildRectangle(`rect_${i}`));
    let counter = 0;
    const engine = createEngine(
      buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", objects)])]) }),
      { clock: () => NOW, historyEntryIdGenerator: () => `h_${++counter}` },
    );
    const commands = objects.map((object) => ({
      type: "updateObjectTransform" as const,
      objectId: object.id,
      transform: { x: 10 },
    }));

    const start = Date.now();
    const result = engine.dispatchBatch(commands, { label: "Alinear a la izquierda" });
    const elapsedMs = Date.now() - start;

    expect(result.ok).toBe(true);
    expect(engine.getProject().document.history.entries).toHaveLength(1);
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects.every((o) => o.transform.x === 10)).toBe(true);
    // Presupuesto generoso a propósito (evitar flakiness en CI) — el
    // objetivo es atrapar una regresión de orden de magnitud, no medir con precisión.
    expect(elapsedMs).toBeLessThan(500);
  });
});

describe("createEngine — comandos de estructura no relacionados con Sticker Builder", () => {
  it("addPage / addLayer / addObject componen un documento multi-página genérico", () => {
    const engine = testEngine();

    engine.dispatch({ type: "addPage", page: buildPage("page_2") });
    engine.dispatch({ type: "addLayer", pageId: PageIdSchema.parse("page_2"), layer: buildLayer("layer_2") });
    engine.dispatch({
      type: "addObject",
      pageId: PageIdSchema.parse("page_2"),
      layerId: LayerIdSchema.parse("layer_2"),
      object: buildRectangle("rect_2"),
    });

    const project = engine.getProject();
    expect(project.document.pages.map((p) => p.id)).toEqual(["page_1", "page_2"]);
    expect(project.document.pages[1]?.layers[0]?.objects[0]?.id).toBe("rect_2");
    expect(project.document.documentVersion).toBe(4); // 1 inicial + 3 comandos exitosos
  });
});
