import { describe, expect, it } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import { mountLayersPanel, computeReorderedIds } from "./layersPanel.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildRect(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  } as SceneObject;
}

function buildGroup(id: string, children: SceneObject[]): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "group",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
    children,
  };
}

function buildProject(objects: SceneObject[]): Project {
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
          size: { width: 100, height: 100 },
          unit: "px",
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

function buildObjectOfType(id: string, type: "text" | "image" | "ellipse" | "path"): SceneObject {
  const base = {
    id: ObjectIdSchema.parse(id),
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
  };
  switch (type) {
    case "text":
      return {
        ...base,
        type: "text",
        content: "",
        fontFamily: "sans-serif",
        fontSize: 16,
        fontWeight: 400,
        textAlign: "left",
        lineHeight: 1.2,
      } as SceneObject;
    case "image":
      return {
        ...base,
        type: "image",
        assetId: AssetIdSchema.parse("asset_1"),
        size: { width: 10, height: 10 },
      } as SceneObject;
    case "ellipse":
      return { ...base, type: "ellipse", size: { width: 10, height: 10 } } as SceneObject;
    case "path":
      return {
        ...base,
        type: "path",
        segments: [{ type: "moveTo", point: { x: 0, y: 0 } }],
        closed: false,
      } as SceneObject;
  }
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("computeReorderedIds", () => {
  it("mueve el dragged a la posición visual del drop target (frente->fondo)", () => {
    // underlying (fondo->frente): a, b, c, d. Visual (frente->fondo): d, c, b, a.
    const ids = [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b"), ObjectIdSchema.parse("c"), ObjectIdSchema.parse("d")];
    // Arrastrar "a" (visualmente al fondo) y soltar sobre "c": "a" debe terminar donde estaba "c" visualmente.
    const result = computeReorderedIds(ids, ObjectIdSchema.parse("a"), ObjectIdSchema.parse("c"));
    // visual sin "a": d, c, b -> insertar "a" en el índice de "c" (1): d, a, c, b -> reverse: b, c, a, d
    expect(result).toEqual(["b", "c", "a", "d"]);
  });

  it("si el dropTargetId no existe, devuelve el orden sin cambios", () => {
    const ids = [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")];
    const result = computeReorderedIds(ids, ObjectIdSchema.parse("a"), ObjectIdSchema.parse("no_existe"));
    expect(result).toEqual(["a", "b"]);
  });
});

describe("mountLayersPanel", () => {
  it("renderiza una fila por object, de frente a fondo (orden visual invertido)", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();

    mountLayersPanel(div, engine);

    const rows = div.querySelectorAll(".layer-row");
    expect(Array.from(rows).map((r) => (r as HTMLElement).dataset.objectId)).toEqual(["b", "a"]);
  });

  it("click en una fila selecciona ese object", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    mountLayersPanel(div, engine);

    const row = div.querySelector('[data-object-id="a"]') as HTMLElement;
    row.click();

    expect(engine.getSelection()).toEqual(["a"]);
  });

  it("Shift-click alterna la selección múltiple", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    mountLayersPanel(div, engine);
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    const row = div.querySelector('[data-object-id="b"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent("click", { shiftKey: true, bubbles: true }));

    expect(engine.getSelection()).toEqual(["a", "b"]);
  });

  it("un cambio de selección NO reconstruye las filas (preserva la identidad del nodo DOM, necesario para el doble-click nativo del navegador)", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    mountLayersPanel(div, engine);
    const rowBefore = div.querySelector('[data-object-id="a"]');

    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    const rowAfter = div.querySelector('[data-object-id="a"]');
    expect(rowAfter).toBe(rowBefore);
    expect(rowAfter?.classList.contains("selected")).toBe(true);
  });

  it("dos clicks consecutivos sobre la MISMA fila (que cambian la selección en cada click) permiten que el navegador detecte un doble-click, porque la fila no se reconstruye entre uno y otro", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    mountLayersPanel(div, engine);

    const row = div.querySelector('[data-object-id="a"]') as HTMLElement;
    row.click();
    // Si `render()` completo se ejecutara aquí (en vez de solo actualizar la
    // clase), esta seria una fila NUEVA — y el navegador no la reconocería
    // como el mismo elemento del primer click al construir el doble-click.
    const rowStillSame = div.querySelector('[data-object-id="a"]');
    expect(rowStillSame).toBe(row);
  });

  it("la fila del object seleccionado tiene la clase 'selected'", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    mountLayersPanel(div, engine);

    const row = div.querySelector('[data-object-id="a"]') as HTMLElement;
    expect(row.classList.contains("selected")).toBe(true);
  });

  it("el ícono de visibilidad alterna metadata.visible sin seleccionar el object", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountLayersPanel(div, engine);

    const button = div.querySelector(".layer-visibility") as HTMLButtonElement;
    button.click();

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.metadata.visible).toBe(false);
    expect(engine.getSelection()).toEqual([]); // no disparó selección
  });

  it("el ícono de candado alterna metadata.locked sin seleccionar el object", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountLayersPanel(div, engine);

    const button = div.querySelector(".layer-lock") as HTMLButtonElement;
    button.click();

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.metadata.locked).toBe(true);
    expect(engine.getSelection()).toEqual([]);
  });

  it("doble-click en el nombre permite renombrar; Enter confirma", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountLayersPanel(div, engine);

    const label = div.querySelector(".layer-label") as HTMLElement;
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const input = div.querySelector(".layer-rename-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "Mi rectángulo";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.metadata.name).toBe("Mi rectángulo");
  });

  it("cada tipo de object sin nombre propio usa su etiqueta por defecto", () => {
    const engine = createEngine(
      buildProject([
        buildObjectOfType("txt", "text"),
        buildObjectOfType("img", "image"),
        buildObjectOfType("ell", "ellipse"),
        buildObjectOfType("pth", "path"),
      ]),
    );
    const div = container();

    mountLayersPanel(div, engine);

    const labels = new Map(
      Array.from(div.querySelectorAll(".layer-row")).map((row) => [
        (row as HTMLElement).dataset.objectId,
        row.querySelector(".layer-label")?.textContent,
      ]),
    );
    expect(labels.get("txt")).toBe("Texto");
    expect(labels.get("img")).toBe("Imagen");
    expect(labels.get("ell")).toBe("Elipse");
    expect(labels.get("pth")).toBe("Trazo");
  });

  it("Escape durante el renombrado cancela sin aplicar el cambio", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountLayersPanel(div, engine);

    const label = div.querySelector(".layer-label") as HTMLElement;
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = div.querySelector(".layer-rename-input") as HTMLInputElement;
    input.value = "Nombre descartado";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.metadata.name).toBeUndefined();
  });

  it("los hijos de un group (depth > 0) no se pueden seleccionar ni renombrar: son solo informativos", () => {
    const engine = createEngine(buildProject([buildGroup("g1", [buildRect("child_a")])]));
    const div = container();
    mountLayersPanel(div, engine);
    (div.querySelector(".layer-expand") as HTMLButtonElement).click();

    const childRow = div.querySelector('[data-object-id="child_a"]') as HTMLElement;
    childRow.click();
    expect(engine.getSelection()).toEqual([]);

    const childLabel = childRow.querySelector(".layer-label") as HTMLElement;
    childLabel.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(div.querySelector(".layer-rename-input")).toBeNull();
  });

  it("un group aparece con un botón de expandir, colapsado por defecto (sin filas de hijos)", () => {
    const engine = createEngine(buildProject([buildGroup("g1", [buildRect("child_a")])]));
    const div = container();

    mountLayersPanel(div, engine);

    expect(div.querySelector(".layer-expand")).not.toBeNull();
    expect(div.querySelector('[data-object-id="child_a"]')).toBeNull();
  });

  it("click en expandir muestra los hijos indentados; click de nuevo los oculta", () => {
    const engine = createEngine(buildProject([buildGroup("g1", [buildRect("child_a")])]));
    const div = container();
    mountLayersPanel(div, engine);

    const expandButton = div.querySelector(".layer-expand") as HTMLButtonElement;
    expandButton.click();
    expect(div.querySelector('[data-object-id="child_a"]')).not.toBeNull();

    // Al re-renderizar tras expandir, hay que volver a tomar el botón (el DOM se reconstruyó).
    (div.querySelector(".layer-expand") as HTMLButtonElement).click();
    expect(div.querySelector('[data-object-id="child_a"]')).toBeNull();
  });

  it("arrastrar y soltar una fila reordena vía reorderObjects", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b"), buildRect("c")]));
    const div = container();
    mountLayersPanel(div, engine);

    const rowA = div.querySelector('[data-object-id="a"]') as HTMLElement;
    const rowC = div.querySelector('[data-object-id="c"]') as HTMLElement;
    rowA.dispatchEvent(new Event("dragstart", { bubbles: true }));
    rowC.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    rowC.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));

    const ids = engine.getProject().document.pages[0]?.layers[0]?.objects.map((o) => o.id);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("se actualiza automáticamente cuando el Engine emite projectChanged/selectionChanged", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountLayersPanel(div, engine);

    engine.dispatch({
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRect("b"),
    });

    expect(div.querySelectorAll(".layer-row")).toHaveLength(2);
  });

  it("destroy() detiene la suscripción — un cambio posterior no re-renderiza", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    const panel = mountLayersPanel(div, engine);

    panel.destroy();
    engine.dispatch({
      type: "addObject",
      pageId: PageIdSchema.parse("page_1"),
      layerId: LayerIdSchema.parse("layer_1"),
      object: buildRect("b"),
    });

    expect(div.querySelectorAll(".layer-row")).toHaveLength(1);
  });
});
