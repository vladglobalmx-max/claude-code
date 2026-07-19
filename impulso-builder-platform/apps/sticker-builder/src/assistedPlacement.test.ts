import { describe, expect, it } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type GridConfig,
  type Unit,
} from "@impulso/document-schema";
import {
  mountGridOverlay,
  mountRulers,
  mountPointerIndicator,
  mountGridSnapControls,
  toggleGridVisible,
} from "./assistedPlacement.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildProject(overrides: { unit?: Unit; grid?: Partial<GridConfig>; size?: { width: number; height: number } } = {}): Project {
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
          size: overrides.size ?? { width: 100, height: 100 },
          unit: overrides.unit ?? "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" as const, ...overrides.grid },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
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

function div(): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("mountGridOverlay", () => {
  it("inserta un .grid-overlay como PRIMER hijo del container", () => {
    const container = div();
    const preexisting = document.createElement("span");
    container.appendChild(preexisting);
    const engine = createEngine(buildProject());

    mountGridOverlay(container, engine, () => 1);

    expect(container.firstElementChild?.className).toBe("grid-overlay");
    expect(container.children).toHaveLength(2);
  });

  it("oculta el overlay cuando grid.visible es false", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: false } }));

    mountGridOverlay(container, engine, () => 1);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("muestra el overlay con background-size = grid.size cuando visible y zoom no exige adaptar el intervalo", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: true, size: 20 } }));

    mountGridOverlay(container, engine, () => 1);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.display).toBe("block");
    expect(overlay.style.backgroundSize).toBe("20px 20px");
  });

  it("duplica el intervalo visual cuando el zoom haría el patrón demasiado denso, sin cambiar grid.size real", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: true, size: 1 } }));

    // size(1) * zoom(1) = 1px en pantalla, muy por debajo del mínimo (4px) -> debe duplicar hasta >= 4 (1,2,4 -> step final 4).
    mountGridOverlay(container, engine, () => 1);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.backgroundSize).toBe("4px 4px");
  });

  it("onZoomChange recalcula el intervalo visual", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: true, size: 10 } }));
    let zoom = 1;
    const overlay2 = mountGridOverlay(container, engine, () => zoom);

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.backgroundSize).toBe("10px 10px");

    zoom = 0.05; // 10 * 0.05 = 0.5px -> debe duplicar varias veces
    overlay2.onZoomChange(zoom);
    expect(overlay.style.backgroundSize).not.toBe("10px 10px");
  });

  it("reacciona a projectChanged (ej. toggle de grid.visible vía comando)", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: false } }));
    mountGridOverlay(container, engine, () => 1);
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.display).toBe("none");

    toggleGridVisible(engine);

    expect(overlay.style.display).toBe("block");
  });

  it("destroy() remueve el overlay del DOM", () => {
    const container = div();
    const engine = createEngine(buildProject());
    const overlay = mountGridOverlay(container, engine, () => 1);

    overlay.destroy();

    expect(container.children).toHaveLength(0);
  });
});

describe("mountRulers", () => {
  function setupViewport() {
    const viewport = div();
    const canvasContainer = div();
    viewport.appendChild(canvasContainer);
    const horizontal = document.createElement("canvas");
    const vertical = document.createElement("canvas");
    return { viewport, canvasContainer, horizontal, vertical };
  }

  it("no lanza al montar/actualizar aunque jsdom no implemente un contexto 2D real", () => {
    const { viewport, canvasContainer, horizontal, vertical } = setupViewport();
    const engine = createEngine(buildProject());

    expect(() => mountRulers(horizontal, vertical, viewport, canvasContainer, engine, () => 1)).not.toThrow();
  });

  it("refresh() no lanza tras un cambio de página/unidad", () => {
    const { viewport, canvasContainer, horizontal, vertical } = setupViewport();
    const engine = createEngine(buildProject({ unit: "mm" }));
    const rulers = mountRulers(horizontal, vertical, viewport, canvasContainer, engine, () => 1);

    expect(() => rulers.refresh()).not.toThrow();
  });

  it("se re-dibuja automáticamente en projectChanged sin lanzar (suscripción interna)", () => {
    const { viewport, canvasContainer, horizontal, vertical } = setupViewport();
    const engine = createEngine(buildProject());
    mountRulers(horizontal, vertical, viewport, canvasContainer, engine, () => 1);

    expect(() =>
      engine.dispatch({ type: "updatePageGrid", pageId: PageIdSchema.parse("page_1"), grid: { visible: true } }),
    ).not.toThrow();
  });

  it("destroy() desuscribe del Engine sin lanzar", () => {
    const { viewport, canvasContainer, horizontal, vertical } = setupViewport();
    const engine = createEngine(buildProject());
    const rulers = mountRulers(horizontal, vertical, viewport, canvasContainer, engine, () => 1);

    expect(() => rulers.destroy()).not.toThrow();
  });
});

describe("mountPointerIndicator", () => {
  function setupViewport(pageWidthPx = 100, pageHeightPx = 100) {
    const viewport = div();
    const canvasContainer = div();
    viewport.appendChild(canvasContainer);
    canvasContainer.getBoundingClientRect = () =>
      ({ left: 50, top: 50, right: 50 + pageWidthPx, bottom: 50 + pageHeightPx, width: pageWidthPx, height: pageHeightPx, x: 50, y: 50, toJSON: () => ({}) }) as DOMRect;
    return { viewport, canvasContainer };
  }

  it("está oculto por defecto (antes de cualquier pointermove)", () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    const engine = createEngine(buildProject());

    mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);

    expect(indicator.style.display).toBe("none");
  });

  it("muestra X/Y en page.unit cuando el puntero está dentro de la página (rAF)", async () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    const engine = createEngine(buildProject({ unit: "px" }));

    mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);
    viewport.dispatchEvent(new MouseEvent("pointermove", { clientX: 50 + 25, clientY: 50 + 30 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(indicator.style.display).toBe("");
    expect(indicator.textContent).toBe("X: 25px  Y: 30px");
  });

  it("oculta el indicador cuando el puntero sale del área de la página", async () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    const engine = createEngine(buildProject());

    mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);
    viewport.dispatchEvent(new MouseEvent("pointermove", { clientX: 999, clientY: 999 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(indicator.style.display).toBe("none");
  });

  it("oculta el indicador en pointerleave", async () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    const engine = createEngine(buildProject());

    mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);
    viewport.dispatchEvent(new MouseEvent("pointermove", { clientX: 60, clientY: 60 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(indicator.style.display).toBe("");

    viewport.dispatchEvent(new MouseEvent("pointerleave"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(indicator.style.display).toBe("none");
  });

  it("es aria-hidden por convención del caller (no gestionado por este módulo) y no usa aria-live", () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    indicator.setAttribute("aria-hidden", "true");
    const engine = createEngine(buildProject());

    mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);

    expect(indicator.getAttribute("aria-live")).toBeNull();
  });

  it("destroy() remueve los listeners (pointermove posterior no hace nada)", async () => {
    const { viewport, canvasContainer } = setupViewport();
    const indicator = div();
    const engine = createEngine(buildProject());

    const pointerIndicator = mountPointerIndicator(indicator, viewport, canvasContainer, engine, () => 1);
    pointerIndicator.destroy();
    viewport.dispatchEvent(new MouseEvent("pointermove", { clientX: 60, clientY: 60 }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(indicator.style.display).toBe("none");
  });
});

describe("mountGridSnapControls", () => {
  it("refleja el estado inicial de grid.visible/snapEnabled/size", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: true, snapEnabled: false, size: 15 } }));

    mountGridSnapControls(container, engine);

    const [gridButton, snapButton] = Array.from(container.querySelectorAll("button"));
    const sizeInput = container.querySelector("input") as HTMLInputElement;
    expect(gridButton!.classList.contains("active")).toBe(true);
    expect(snapButton!.classList.contains("active")).toBe(false);
    expect(sizeInput.value).toBe("15");
  });

  it("clic en el botón de Grid despacha updatePageGrid({visible: !actual})", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { visible: false } }));
    mountGridSnapControls(container, engine);

    const [gridButton] = Array.from(container.querySelectorAll("button"));
    gridButton!.click();

    expect(engine.getProject().document.pages[0]?.grid.visible).toBe(true);
  });

  it("clic en el botón de Snap despacha updatePageGrid({snapEnabled: !actual})", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { snapEnabled: false } }));
    mountGridSnapControls(container, engine);

    const [, snapButton] = Array.from(container.querySelectorAll("button"));
    snapButton!.click();

    expect(engine.getProject().document.pages[0]?.grid.snapEnabled).toBe(true);
  });

  it("cambiar el tamaño (evento 'change', no cada tecla) despacha updatePageGrid({size})", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { size: 10 } }));
    mountGridSnapControls(container, engine);

    const sizeInput = container.querySelector("input") as HTMLInputElement;
    sizeInput.value = "25";
    sizeInput.dispatchEvent(new Event("change"));

    expect(engine.getProject().document.pages[0]?.grid.size).toBe(25);
  });

  it("ignora un tamaño inválido (0, negativo, no numérico) sin despachar", () => {
    const container = div();
    const engine = createEngine(buildProject({ grid: { size: 10 } }));
    mountGridSnapControls(container, engine);

    const sizeInput = container.querySelector("input") as HTMLInputElement;
    sizeInput.value = "0";
    sizeInput.dispatchEvent(new Event("change"));

    expect(engine.getProject().document.pages[0]?.grid.size).toBe(10);
  });

  it("destroy() remueve los controles del DOM", () => {
    const container = div();
    const engine = createEngine(buildProject());
    const controls = mountGridSnapControls(container, engine);

    controls.destroy();

    expect(container.children).toHaveLength(0);
  });
});

describe("toggleGridVisible", () => {
  it("alterna grid.visible", () => {
    const engine = createEngine(buildProject({ grid: { visible: false } }));
    toggleGridVisible(engine);
    expect(engine.getProject().document.pages[0]?.grid.visible).toBe(true);
    toggleGridVisible(engine);
    expect(engine.getProject().document.pages[0]?.grid.visible).toBe(false);
  });
});
