import { describe, expect, it } from "vitest";
import Konva from "konva";
import { createEngine } from "@impulso/engine";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema } from "@impulso/document-schema";
import { createKonvaRenderer } from "./renderer.js";
import {
  buildProject,
  buildDocument,
  buildPage,
  buildLayer,
  buildRectangle,
} from "./testUtils/fixtures.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function testEngine() {
  return createEngine(
    buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])], {
          size: { width: 50, height: 50 },
          unit: "mm",
        }),
      ]),
    }),
    { clock: () => "2026-07-17T00:00:00.000Z" },
  );
}

describe("createKonvaRenderer — mount", () => {
  it("crea un Stage dimensionado en píxeles a partir del tamaño físico de la página (mm)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage();
    expect(stage).toBeInstanceOf(Konva.Stage);
    // 50mm -> px vía 96px/25.4mm
    expect(stage?.width()).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(stage?.height()).toBeCloseTo(50 * (96 / 25.4), 5);
  });

  it("construye un Konva.Group por cada Layer del Document, conteniendo sus objects", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage();
    const mainLayer = stage?.getChildren()[0] as Konva.Layer;
    const layerGroups = mainLayer.getChildren();
    expect(layerGroups).toHaveLength(1);
    expect(layerGroups[0]?.id()).toBe("layer_1");

    const objectsInLayer = (layerGroups[0] as Konva.Group).getChildren();
    expect(objectsInLayer).toHaveLength(1);
    expect(objectsInLayer[0]?.id()).toBe("rect_1");
    expect(objectsInLayer[0]).toBeInstanceOf(Konva.Rect);
  });

  it("getStage() devuelve null antes de mount()", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    expect(renderer.getStage()).toBeNull();
  });
});

describe("createKonvaRenderer — reconciliación reactiva vía Engine", () => {
  it("re-renderiza automáticamente cuando el Engine emite projectChanged", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    engine.dispatch({
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRectangle("rect_2"),
    });

    const stage = renderer.getStage();
    const mainLayer = stage?.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    expect(layerGroup.getChildren().map((n) => n.id())).toEqual(["rect_1", "rect_2"]);
  });

  it("refleja un cambio de transform tras un dispatch exitoso", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("rect_1"),
      transform: { x: 33 },
    });

    const stage = renderer.getStage();
    const mainLayer = stage?.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const rectNode = layerGroup.getChildren()[0];
    expect(rectNode?.x()).toBe(33);
  });
});

describe("createKonvaRenderer — eventos de Konva -> Engine (drag)", () => {
  it("arrastrar un nodo y disparar dragend actualiza el Project vía el Engine", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage()!;
    const mainLayer = stage.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const rectNode = layerGroup.getChildren()[0]!;

    rectNode.x(77);
    rectNode.y(88);
    rectNode.fire("dragend");

    const updatedObject = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(updatedObject?.transform).toMatchObject({ x: 77, y: 88 });
  });

  it("si el Engine rechaza el cambio, el render revierte la posición visual", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    // Se elimina el object DESPUÉS de montar (así el nodo Konva sigue vivo
    // en pantalla) para forzar que el próximo dragend sea rechazado
    // (object_not_found) sin pasar por una remoción visual todavía.
    const stage = renderer.getStage()!;
    const mainLayer = stage.getChildren()[0] as Konva.Layer;
    let layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const rectNode = layerGroup.getChildren()[0]!;

    // Se captura el nodo antes de que removeObject dispare un re-render que
    // reconstruye el árbol (rebuild completo) y elimina este rectángulo.
    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });

    rectNode.x(500);
    rectNode.y(500);
    const before = engine.getProject();
    rectNode.fire("dragend");

    // El dispatch fue rechazado (el object ya no existe) — el Project del
    // Engine no cambia por este intento de drag.
    expect(engine.getProject()).toBe(before);

    // Tras el rebuild disparado por onRejectedTransform, la layer ya no
    // contiene ningún object (coherente con el estado real del Engine).
    layerGroup = (renderer.getStage()!.getChildren()[0] as Konva.Layer).getChildren()[0] as Konva.Group;
    expect(layerGroup.getChildren()).toHaveLength(0);
  });

  it("arrastrar un object no seleccionado lo selecciona (el resaltado aparece desde dragstart)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage()!;
    const mainLayer = stage.getChildren()[0] as Konva.Layer;
    const selectionLayer = stage.getChildren()[1] as Konva.Layer;
    const rectNode = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0]!;

    expect(engine.getSelection()).toEqual([]);

    rectNode.fire("dragstart");

    expect(engine.getSelection()).toEqual(["rect_1"]);
    // Un único object seleccionado dibuja la caja de manipulación completa
    // (ver ADR-0008): 2 Line (contorno + "vara" del handle de rotación) + 8
    // Rect (handles de resize) + 1 Circle (handle de rotación).
    expect(selectionLayer.getChildren()).toHaveLength(11);
  });

  it("arrastrar un object que ya es parte de una selección múltiple no la colapsa", () => {
    const engine = createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
        ]),
      }),
    );
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")] });

    const mainLayer = renderer.getStage()!.getChildren()[0] as Konva.Layer;
    const nodeA = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0]!;
    nodeA.fire("dragstart");

    expect(engine.getSelection()).toEqual(["a", "b"]);
  });
});

describe("createKonvaRenderer — selección de página", () => {
  it("usa la primera página por defecto", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());
    expect(renderer.getStage()?.width()).toBeGreaterThan(0);
  });

  it("respeta options.pageId cuando se provee", () => {
    const engine = createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [], { size: { width: 10, height: 10 }, unit: "px" }),
          buildPage("page_2", [buildLayer("layer_2", [buildRectangle("rect_2")])], {
            size: { width: 200, height: 200 },
            unit: "px",
          }),
        ]),
      }),
    );
    const renderer = createKonvaRenderer(engine, { pageId: PageIdSchema.parse("page_2") });
    renderer.mount(container());

    expect(renderer.getStage()?.width()).toBe(200);
  });

  it("si el pageId configurado no existe, el Stage queda vacío sin lanzar", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine, { pageId: PageIdSchema.parse("no_existe") });
    expect(() => renderer.mount(container())).not.toThrow();

    const stage = renderer.getStage();
    const mainLayer = stage?.getChildren()[0] as Konva.Layer;
    expect(mainLayer.getChildren()).toHaveLength(0);
  });
});

describe("createKonvaRenderer — selección (Editor 2)", () => {
  it("click en un object lo selecciona: aparece un rectángulo de highlight en selectionLayer", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage()!;
    const mainLayer = stage.getChildren()[0] as Konva.Layer;
    const selectionLayer = stage.getChildren()[1] as Konva.Layer;
    const rectNode = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0]!;

    expect(selectionLayer.getChildren()).toHaveLength(0);

    rectNode.fire("click", { evt: { shiftKey: false }, cancelBubble: false }, true);

    expect(engine.getSelection()).toEqual(["rect_1"]);
    // Un único object seleccionado dibuja la caja de manipulación completa
    // (ver ADR-0008), no el simple rectángulo punteado de Editor 2.
    const children = selectionLayer.getChildren();
    expect(children).toHaveLength(11);
    expect(children.filter((n) => n instanceof Konva.Rect)).toHaveLength(8);
    expect(children.filter((n) => n instanceof Konva.Circle)).toHaveLength(1);
    expect(children.filter((n) => n instanceof Konva.Line)).toHaveLength(2);
  });

  it("click en el Stage fuera de cualquier object limpia la selección", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });

    const stage = renderer.getStage()!;
    stage.fire("click", { target: stage });

    expect(engine.getSelection()).toEqual([]);
    const selectionLayer = stage.getChildren()[1] as Konva.Layer;
    expect(selectionLayer.getChildren()).toHaveLength(0);
  });

  it("un click sobre un object NO limpia la selección (la propagación al Stage se detiene)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const stage = renderer.getStage()!;
    const mainLayer = stage.getChildren()[0] as Konva.Layer;
    const rectNode = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0]!;

    // bubble=true: simula que el evento se propaga hacia arriba (Group ->
    // Layer -> Stage) tal como ocurriría con un click real del usuario.
    rectNode.fire("click", { evt: { shiftKey: false }, cancelBubble: false }, true);

    expect(engine.getSelection()).toEqual(["rect_1"]);
  });

  it("selectionChanged NO reconstruye mainLayer (los nodos de contenido conservan su referencia)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const mainLayer = renderer.getStage()!.getChildren()[0] as Konva.Layer;
    const rectNodeBefore = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0];

    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });

    const rectNodeAfter = (mainLayer.getChildren()[0] as Konva.Group).getChildren()[0];
    expect(rectNodeAfter).toBe(rectNodeBefore); // misma instancia: no hubo rebuild de contenido
  });

  it("toggleObjectSelection (Shift-click) agrega un segundo object sin quitar el primero", () => {
    const engine = createEngine(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
        ]),
      }),
    );
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const mainLayer = renderer.getStage()!.getChildren()[0] as Konva.Layer;
    const [nodeA, nodeB] = (mainLayer.getChildren()[0] as Konva.Group).getChildren();

    nodeA!.fire("click", { evt: { shiftKey: false }, cancelBubble: false }, true);
    expect(engine.getSelection()).toEqual(["a"]);

    nodeB!.fire("click", { evt: { shiftKey: true }, cancelBubble: false }, true);
    expect(engine.getSelection()).toEqual(["a", "b"]);

    const selectionLayer = renderer.getStage()!.getChildren()[1] as Konva.Layer;
    expect(selectionLayer.getChildren()).toHaveLength(2);
  });

  it("un id seleccionado que no corresponde a ningún nodo actual se ignora sin lanzar", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    // setSelection no valida existencia (ver Foundation 2) — un id colgante
    // es posible en teoría; el overlay debe simplemente omitirlo.
    expect(() =>
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("no_existe")] }),
    ).not.toThrow();

    const selectionLayer = renderer.getStage()!.getChildren()[1] as Konva.Layer;
    expect(selectionLayer.getChildren()).toHaveLength(0);
  });

  it("la selección inicial (antes de cualquier click) no dibuja ningún highlight", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const selectionLayer = renderer.getStage()!.getChildren()[1] as Konva.Layer;
    expect(selectionLayer.getChildren()).toHaveLength(0);
  });
});

describe("createKonvaRenderer — destroy", () => {
  it("limpia el contenedor del DOM y libera la referencia al Stage", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    const div = container();
    renderer.mount(div);

    expect(div.children.length).toBeGreaterThan(0); // Konva insertó su wrapper

    renderer.destroy();

    expect(renderer.getStage()).toBeNull();
    expect(div.children.length).toBe(0); // Stage.destroy() limpia el DOM que insertó
  });

  it("un dispatch posterior a destroy() no re-renderiza ni lanza (ya no hay suscripción activa)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());
    renderer.destroy();

    expect(() =>
      engine.dispatch({
        type: "updateObjectTransform",
        objectId: ObjectIdSchema.parse("rect_1"),
        transform: { x: 1 },
      }),
    ).not.toThrow();
  });

  it("destroy() antes de mount() no lanza", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    expect(() => renderer.destroy()).not.toThrow();
  });

  it("un dragend rechazado que llega DESPUÉS de destroy() no falla (render() ya no tiene Stage)", () => {
    const engine = testEngine();
    const renderer = createKonvaRenderer(engine);
    renderer.mount(container());

    const staleNode = (
      (renderer.getStage()!.getChildren()[0] as Konva.Layer).getChildren()[0] as Konva.Group
    ).getChildren()[0]!;

    // El object deja de existir (dispara un re-render normal primero).
    engine.dispatch({ type: "removeObject", objectId: ObjectIdSchema.parse("rect_1") });
    // Ahora se destruye el renderer — stage/mainLayer quedan en null.
    renderer.destroy();

    // Un dragend tardío sobre el nodo ya obsoleto sigue intentando
    // despachar (será rechazado: el object ya no existe) y dispara
    // onRejectedTransform -> render(), que debe no-opear sin Stage.
    staleNode.x(1);
    staleNode.y(1);
    expect(() => staleNode.fire("dragend")).not.toThrow();
  });
});
