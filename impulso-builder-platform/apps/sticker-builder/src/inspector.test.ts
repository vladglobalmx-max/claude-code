import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  type Unit,
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

function buildProject(objects: SceneObject[], unit: Unit = "px"): Project {
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

/** Los campos numéricos ahora son `input[type="text"]` (para aceptar
 * expresiones como "+5"/"*2"), distinguibles por esta clase — ver
 * Epic 7 / Fase 7.1. */
function numberInputs(scope: ParentNode): HTMLInputElement[] {
  return Array.from(scope.querySelectorAll("input.inspector-number-input"));
}

function sectionByLegend(scope: ParentNode, legend: string): Element {
  const found = Array.from(scope.querySelectorAll(".inspector-section")).find(
    (s) => s.querySelector("legend")?.textContent === legend,
  );
  if (!found) throw new Error(`No se encontró la sección "${legend}"`);
  return found;
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

    const opacityInput = numberInputs(div)[0]!;
    opacityInput.value = "0.5";
    opacityInput.dispatchEvent(new Event("change"));

    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.style.opacity)).toEqual([0.5, 0.5]);
  });

  it("con un rectangle seleccionado, muestra Transformar (con Ancho/Alto y unidad) y Apariencia (con Relleno)", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });

    mountInspector(div, engine);

    const sections = Array.from(div.querySelectorAll(".inspector-section")).map(
      (s) => s.querySelector("legend")?.textContent,
    );
    expect(sections).toEqual(["Transformar", "Apariencia", "Metadatos"]);

    const transformSection = sectionByLegend(div, "Transformar");
    const fieldLabels = Array.from(transformSection.querySelectorAll(".inspector-field > span")).map(
      (s) => s.textContent,
    );
    expect(fieldLabels).toEqual(["X", "Y", "Ancho", "Alto", "Rotación"]);

    const unitLabels = Array.from(transformSection.querySelectorAll(".inspector-unit")).map((s) => s.textContent);
    expect(unitLabels).toEqual(["px", "px", "px", "px", "°"]);

    const appearanceSection = sectionByLegend(div, "Apariencia");
    const appearanceLabels = Array.from(appearanceSection.querySelectorAll(".inspector-field > span")).map(
      (s) => s.textContent,
    );
    expect(appearanceLabels).toEqual(["Opacidad", "Relleno"]);
  });

  it("editar Opacidad en selección única dispara updateObjectStyle", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const opacityInput = numberInputs(sectionByLegend(div, "Apariencia"))[0]!;
    opacityInput.value = "0.4";
    opacityInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.style.opacity).toBe(0.4);
  });

  it("editar Y, Rotación, Ancho y Alto dispara updateObjectTransform con el patch correcto", () => {
    const engine = createEngine(buildProject([buildRect("a")])); // x:10 y:20 size:30x40 scale:1,1
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const [xInput, yInput, widthInput, heightInput, rotationInput] = numberInputs(
      sectionByLegend(div, "Transformar"),
    );

    yInput!.value = "99";
    yInput!.dispatchEvent(new Event("change"));
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.y).toBe(99);

    rotationInput!.value = "45";
    rotationInput!.dispatchEvent(new Event("change"));
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.rotation).toBe(45);

    widthInput!.value = "60";
    widthInput!.dispatchEvent(new Event("change"));
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.scaleX).toBe(2);

    heightInput!.value = "20";
    heightInput!.dispatchEvent(new Event("change"));
    expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.scaleY).toBe(0.5);

    expect(xInput).toBeDefined();
  });

  it("confirmar el mismo valor que ya está aplicado no dispara un dispatch redundante", () => {
    const engine = createEngine(buildProject([buildRect("a")])); // x inicial: 10
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const historyBefore = engine.getProject().document.history.entries.length;
    const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
    xInput.value = "10"; // idéntico al valor actual
    xInput.dispatchEvent(new Event("change"));

    expect(engine.getProject().document.history.entries.length).toBe(historyBefore);
  });

  it("en selección múltiple, si algún object rechaza el cambio, el campo se marca inválido", () => {
    const engine = createEngine(buildProject([buildRect("a"), buildRect("b")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")] });
    mountInspector(div, engine);

    const opacityInput = numberInputs(div)[0]!;
    // Fuera de [0,1]: StyleSchema lo rechaza para ambos objects.
    opacityInput.value = "5";
    opacityInput.dispatchEvent(new Event("change"));

    expect(opacityInput.classList.contains("inspector-field-invalid")).toBe(true);
    const objects = engine.getProject().document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.style.opacity)).toEqual([1, 1]);
  });

  it("un text con `size` explícito muestra Ancho/Alto derivados de ese tamaño", () => {
    const engine = createEngine(buildProject([buildText("t1", { size: { width: 80, height: 20 } } as never)]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });

    mountInspector(div, engine);

    const transformSection = sectionByLegend(div, "Transformar");
    const labels = Array.from(transformSection.querySelectorAll(".inspector-field > span")).map((s) => s.textContent);
    expect(labels).toEqual(["X", "Y", "Ancho", "Alto", "Rotación"]);
  });

  it("editar X con un valor absoluto dispara updateObjectTransform", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
    xInput.value = "99";
    xInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(99);
  });

  it("editar X con una expresión relativa (+5) suma sobre el valor actual", () => {
    const engine = createEngine(buildProject([buildRect("a")])); // x inicial: 10
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
    xInput.value = "+5";
    xInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(15);
    expect(xInput.value).toBe("15");
  });

  it("una expresión no soportada no dispara ningún cambio y marca el campo inválido", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
    xInput.value = "abc";
    xInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(10);
    expect(xInput.classList.contains("inspector-field-invalid")).toBe(true);
    expect(xInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("un valor rechazado por el Engine (fontSize <= 0) no cambia el documento y marca el campo inválido", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const sizeInput = numberInputs(sectionByLegend(div, "Texto"))[0]!;
    sizeInput.value = "*0";
    sizeInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.fontSize).toBe(16);
    expect(sizeInput.classList.contains("inspector-field-invalid")).toBe(true);
  });

  it("con unidad activa 'mm', X/Y/Ancho/Alto se muestran convertidos y se confirman de vuelta a la unidad canónica", () => {
    // page.size/unit no importa para el transform del object: el transform
    // vive en unidad canónica (px) independientemente de page.unit.
    const engine = createEngine(buildProject([buildRect("a")], "mm")); // x=10px, width derivado=30px
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const transformSection = sectionByLegend(div, "Transformar");
    const unitLabels = Array.from(transformSection.querySelectorAll(".inspector-unit")).map((s) => s.textContent);
    expect(unitLabels).toEqual(["mm", "mm", "mm", "mm", "°"]);

    const xInput = numberInputs(transformSection)[0]!;
    // 10px -> mm: 10 / (96/25.4) ≈ 2.65mm
    expect(Number(xInput.value)).toBeCloseTo(2.65, 2);

    xInput.value = "10"; // fijar en 10mm
    xInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    // 10mm -> px: 10 * (96/25.4) ≈ 37.795px
    expect(object?.transform.x).toBeCloseTo(37.795, 2);
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

    const appearanceSection = sectionByLegend(div, "Apariencia");
    const appearanceLabels = Array.from(appearanceSection.querySelectorAll(".inspector-field > span")).map(
      (s) => s.textContent,
    );
    expect(appearanceLabels).toEqual(["Opacidad"]);

    const transformSection = sectionByLegend(div, "Transformar");
    const transformLabels = Array.from(transformSection.querySelectorAll(".inspector-field > span")).map(
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
    expect(sections).toEqual(["Transformar", "Apariencia", "Texto", "Metadatos"]);

    const textSection = sectionByLegend(div, "Texto");
    const textLabels = Array.from(textSection.querySelectorAll(".inspector-field > span")).map((s) => s.textContent);
    expect(textLabels).toEqual(["Contenido", "Tipografía", "Tamaño", "Alineación"]);

    const sizeUnit = textSection.querySelector(".inspector-unit")?.textContent;
    expect(sizeUnit).toBe("px");
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

  it("editar Tipografía dispara updateTextStyle de verdad", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const textSection = sectionByLegend(div, "Texto");
    const fontFamilyInput = textSection.querySelector("input[type='text']") as HTMLInputElement;
    fontFamilyInput.value = "serif";
    fontFamilyInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.fontFamily).toBe("serif");
  });

  it("dejar Tipografía vacía no dispara el cambio y marca el campo inválido", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const textSection = sectionByLegend(div, "Texto");
    const fontFamilyInput = textSection.querySelector("input[type='text']") as HTMLInputElement;
    fontFamilyInput.value = "   ";
    fontFamilyInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.fontFamily).toBe("sans-serif");
    expect(fontFamilyInput.classList.contains("inspector-field-invalid")).toBe(true);
  });

  it("editar Tamaño dispara updateTextStyle de verdad", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const sizeInput = numberInputs(sectionByLegend(div, "Texto"))[0]!;
    sizeInput.value = "40";
    sizeInput.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.fontSize).toBe(40);
  });

  it("editar Alineación dispara updateTextStyle de verdad", () => {
    const engine = createEngine(buildProject([buildText("t1")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("t1")] });
    mountInspector(div, engine);

    const select = div.querySelector("select") as HTMLSelectElement;
    select.value = "center";
    select.dispatchEvent(new Event("change"));

    const object = engine.getProject().document.pages[0]?.layers[0]?.objects[0];
    expect(object?.type === "text" && object.textAlign).toBe("center");
  });

  it("editar el Nombre dispara updateMetadata a nivel object", () => {
    const engine = createEngine(buildProject([buildRect("a")]));
    const div = container();
    engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
    mountInspector(div, engine);

    const metadataSection = sectionByLegend(div, "Metadatos");
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

    const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
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

  describe("vista previa en vivo (debounce) y confirmación con Enter", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("escribir sin confirmar dispara el cambio tras el debounce, sin esperar a 'change'", () => {
      const engine = createEngine(buildProject([buildRect("a")]));
      const div = container();
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      mountInspector(div, engine);

      const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
      xInput.value = "42";
      xInput.dispatchEvent(new Event("input"));

      // Antes de que venza el debounce, el documento no cambió todavía.
      expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(10);

      vi.advanceTimersByTime(300);

      expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(42);
    });

    it("Enter confirma inmediatamente sin esperar el debounce", () => {
      const engine = createEngine(buildProject([buildRect("a")]));
      const div = container();
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      mountInspector(div, engine);

      const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
      xInput.value = "77";
      xInput.dispatchEvent(new Event("input"));
      xInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      xInput.dispatchEvent(new Event("blur"));

      expect(engine.getProject().document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(77);
    });

    it("perder el foco con una expresión inválida revierte el campo al último valor confirmado", () => {
      const engine = createEngine(buildProject([buildRect("a")]));
      const div = container();
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      mountInspector(div, engine);

      const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
      xInput.value = "no-numero";
      xInput.dispatchEvent(new Event("input"));
      xInput.dispatchEvent(new Event("blur"));

      expect(xInput.value).toBe("10");
      expect(xInput.classList.contains("inspector-field-invalid")).toBe(false);
    });
  });

  describe("accesibilidad mínima", () => {
    it("los campos numéricos exponen un title explicando la sintaxis de expresión", () => {
      const engine = createEngine(buildProject([buildRect("a")]));
      const div = container();
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      mountInspector(div, engine);

      const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
      expect(xInput.title.length).toBeGreaterThan(0);
      expect(xInput.title).toContain("+n");
    });

    it("cada campo numérico está envuelto en un <label> asociado a su texto", () => {
      const engine = createEngine(buildProject([buildRect("a")]));
      const div = container();
      engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("a")] });
      mountInspector(div, engine);

      const xInput = numberInputs(sectionByLegend(div, "Transformar"))[0]!;
      expect(xInput.closest("label.inspector-field")).not.toBeNull();
    });
  });
});
