import { describe, expect, it } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import { mountInspector } from "./inspector.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildRect(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 30, height: 40 },
    cornerRadius: 0,
    style: { fill: "#ff0000", strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  } as SceneObject;
}

function buildText(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "text",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    content: "Hola",
    fontFamily: "sans-serif",
    fontSize: 16,
    fontWeight: 400,
    textAlign: "left",
    lineHeight: 1.2,
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
  } as SceneObject;
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

describe("mountInspector", () => {
  it("sin selección, muestra el mensaje vacío", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();

    mountInspector(div, engine);

    expect(div.querySelector(".inspector-empty")?.textContent).toBe("Nada seleccionado.");
  });

  it("con selección múltiple, solo muestra el campo Opacidad", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")] });

    mountInspector(div, engine);

    const sections = div.querySelectorAll(".inspector-section");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.querySelector("legend")?.textContent).toBe("Apariencia");
    expect(sections[0]?.querySelectorAll(".inspector-field")).toHaveLength(1);
  });

  it("cambiar la opacidad en selección múltiple la aplica a todos los objects seleccionados", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")] });
    mountInspector(div, engine);

    const opacityInput = div.querySelector('input[type="number"]') as HTMLInputElement;
    opacityInput.value = "0.5";
    opacityInput.dispatchEvent(new Event("change"));

    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.style.opacity)).toEqual([0.5, 0.5]);
  });

  it("con un rectangle seleccionado, muestra Transformar (con Ancho/Alto) y Apariencia (con Relleno)", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    mountInspector(div, engine);

    const sections = Array.from(div.querySelectorAll(".inspector-section")).map(
      (s) => s.querySelector("legend")?.textContent,
    );
    expect(sections).toEqual(["Transformar", "Apariencia", "Metadata"]);

    const transformSection = div.querySelectorAll(".inspector-section")[0]!;
    const fieldLabels = Array.from(transformSection.querySelectorAll(".inspector-field span")).map(
      (s) => s.textContent,
    );
    expect(fieldLabels).toEqual(["X", "Y", "Ancho", "Alto", "Rotación"]);

    const appearanceSection = div.querySelectorAll(".inspector-section")[1]!;
    const appearanceLabels = Array.from(appearanceSection.querySelectorAll(".inspector-field span")).map(
      (s) => s.textContent,
    );
    expect(appearanceLabels).toEqual(["Opacidad", "Relleno"]);
  });

  it("editar Opacidad en selección única dispara updateObjectStyle", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const appearanceSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Apariencia",
    )!;
    const opacityInput = appearanceSection.querySelector("input[type='number']") as HTMLInputElement;
    opacityInput.value = "0.4";
    opacityInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.style.opacity).toBe(0.4);
  });

  it("un text con `size` explícito muestra Ancho/Alto derivados de ese tamaño", () => {
    const engine = createEngine(buildProject([buildText("t1", { size: { width: 80, height: 20 } } as never)]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });

    mountInspector(div, engine);

    const transformSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Transformar",
    )!;
    const labels = Array.from(transformSection.querySelectorAll(".inspector-field span")).map((s) => s.textContent);
    expect(labels).toEqual(["X", "Y", "Ancho", "Alto", "Rotación"]);
  });

  it("editar X dispara updateObjectTransform", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const xInput = div.querySelector(".inspector-section input[type='number']") as HTMLInputElement;
    xInput.value = "99";
    xInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(99);
  });

  it("editar el Relleno dispara updateObjectStyle", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const fillInput = div.querySelector('input[type="color"]') as HTMLInputElement;
    fillInput.value = "#00ff00";
    fillInput.dispatchEvent(new Event("input"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.style.fill).toBe("#00ff00");
  });

  it("con un group seleccionado, Apariencia NO incluye Relleno, y no hay Ancho/Alto", () => {
    const engine = createEngine(buildProject([buildGroup("g1", [buildRect("child_a")])]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("g1")] });

    mountInspector(div, engine);

    const appearanceSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Apariencia",
    )!;
    const appearanceLabels = Array.from(appearanceSection.querySelectorAll(".inspector-field span")).map(
      (s) => s.textContent,
    );
    expect(appearanceLabels).toEqual(["Opacidad"]);

    const transformSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Transformar",
    )!;
    const transformLabels = Array.from(transformSection.querySelectorAll(".inspector-field span")).map(
      (s) => s.textContent,
    );
    expect(transformLabels).toEqual(["X", "Y", "Rotación"]);
  });

  it("con un text seleccionado, agrega la sección Texto con Contenido/Tipografía/Tamaño/Alineación", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });

    mountInspector(div, engine);

    const sections = Array.from(div.querySelectorAll(".inspector-section")).map(
      (s) => s.querySelector("legend")?.textContent,
    );
    expect(sections).toEqual(["Transformar", "Apariencia", "Texto", "Metadata"]);

    const textSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Texto",
    )!;
    const textLabels = Array.from(textSection.querySelectorAll(".inspector-field span")).map((s) => s.textContent);
    expect(textLabels).toEqual(["Contenido", "Tipografía", "Tamaño", "Alineación"]);
  });

  it("editar el Contenido de un text dispara updateObjectContent", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const textarea = div.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Nuevo contenido";
    textarea.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.content).toBe("Nuevo contenido");
  });

  it("editar Tipografía/Tamaño/Alineación no lanza (son de solo lectura, ver deuda técnica)", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const fontFamilyInput = div.querySelector(".inspector-field input[type='text']") as HTMLInputElement;
    expect(() => {
      fontFamilyInput.value = "serif";
      fontFamilyInput.dispatchEvent(new Event("change"));
    }).not.toThrow();

    const textSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Texto",
    )!;
    const sizeInput = textSection.querySelector("input[type='number']") as HTMLInputElement;
    expect(() => {
      sizeInput.value = "40";
      sizeInput.dispatchEvent(new Event("change"));
    }).not.toThrow();

    const select = div.querySelector("select") as HTMLSelectElement;
    expect(() => {
      select.value = "center";
      select.dispatchEvent(new Event("change"));
    }).not.toThrow();

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    // No cambia: dispatchFontFamily/dispatchFontSize/dispatchTextAlign son no-op deliberados.
    expect(object?.type === "text" && object.fontFamily).toBe("sans-serif");
    expect(object?.type === "text" && object.fontSize).toBe(16);
    expect(object?.type === "text" && object.textAlign).toBe("left");
  });

  it("editar el Nombre dispara updateMetadata a nivel object", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const metadataSection = Array.from(div.querySelectorAll(".inspector-section")).find(
      (s) => s.querySelector("legend")?.textContent === "Metadata",
    )!;
    const nameInput = metadataSection.querySelector("input[type='text']") as HTMLInputElement;
    nameInput.value = "Mi rectángulo";
    nameInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.metadata.name).toBe("Mi rectángulo");
  });

  it("se actualiza automáticamente cuando cambia la selección", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    mountInspector(div, engine);
    expect(div.querySelector(".inspector-empty")).not.toBeNull();

    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    expect(div.querySelector(".inspector-empty")).toBeNull();
    expect(div.querySelectorAll(".inspector-section").length).toBeGreaterThan(0);
  });

  it("se actualiza automáticamente cuando el Engine emite projectChanged", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    engine.dispatch({ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 55 } });

    const xInput = div.querySelector(".inspector-section input[type='number']") as HTMLInputElement;
    expect(xInput.value).toBe("55");
  });

  it("destroy() detiene la suscripción — un cambio posterior no re-renderiza", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    const inspector = mountInspector(div, engine);

    inspector.destroy();
    engine.dispatch({ type: "setSelection", objectIds: [] });

    expect(div.querySelector(".inspector-empty")).toBeNull();
  });

  it("si el object seleccionado ya no existe en el documento, muestra el mensaje vacío", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    engine.dispatch({
      type: "removeObject",
      objectId: ObjectIdSchema.parse("a"),
    });
    // removeObject probablemente limpia la selección también, pero si no lo
    // hiciera, el Inspector debe tolerar una selección "colgante" sin lanzar.
    expect(div.querySelector(".inspector-empty")).not.toBeNull();
  });
});
