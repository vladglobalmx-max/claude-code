import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ObjectIdSchema,
  PageIdSchema,
  LayerIdSchema,
  DocumentIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { mountProductionExportDialog } from "./productionExportDialog.js";

const NOW = "2026-07-20T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const style = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

function buildRect(id: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: { ...style, fill: "#3366cc" },
    metadata,
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

function buildDieLine(id: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style,
    metadata: { ...metadata, role: "die-line" },
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

/** El perfil por defecto "Sticker Sheet" tiene `cutPath.mode: "die-cut"`.
 * Si la página NO tiene ningún object `die-line`, `productionExportDialog`
 * degrada automáticamente `cutPath.mode` a `"none"` al construir el
 * `PrintJob` — templates cuadrados/rectangulares se arman deliberadamente
 * sin ese object porque su troquel coincide con el borde de la página
 * (`catalogTemplates/kit/dieLine.ts`), así que exigir uno ahí sería un
 * falso positivo de Preflight, no un caso real de error. `withDieLine:
 * true` (default) incluye uno para poder ejercer el camino feliz completo
 * del flujo con `cutPath.mode` sin modificar. */
function buildProject(withDieLine = true): Project {
  const objects = withDieLine ? [buildRect("obj_1"), buildDieLine("die_1")] : [buildRect("obj_1")];
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
          size: { width: 20, height: 20 },
          unit: "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
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
    metadata,
    pluginData: {},
    customProperties: {},
  };
}

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function onePixelPngBytes(): Uint8Array {
  const binaryString = atob(ONE_BY_ONE_PNG_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function fakePngBlob(): Blob {
  const bytes = onePixelPngBytes();
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  if (typeof blob.arrayBuffer !== "function") {
    (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
  }
  return blob;
}

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

let container: HTMLElement;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(fakePngBlob()));
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  vi.restoreAllMocks();
  container.remove();
});

function mount() {
  return mountProductionExportDialog(container, { resolver: noopResolver, now: () => NOW });
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** Espera hasta que el `<h2>` del diálogo muestre el título de paso
 * pedido — la exportación real encadena varias promesas (render,
 * codificación) que un par de `await Promise.resolve()` no alcanza a
 * drenar de forma confiable. */
async function waitForStepTitle(expectedTitle: string): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelector("h2")!.textContent).toBe(expectedTitle);
  });
}

describe("mountProductionExportDialog", () => {
  it("open() muestra el paso 'profile' con el perfil Sticker Sheet preseleccionado", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    expect(container.querySelector(".production-export-dialog-overlay") as HTMLElement).toHaveProperty("style");
    expect(container.querySelector("h2")!.textContent).toBe("Perfil de impresión");
    const selectedCard = container.querySelector(".production-export-profile-card-selected") as HTMLElement;
    expect(selectedCard.querySelector("h3")!.textContent).toBe("Sticker Sheet");
    expect((container.querySelector(".production-export-back") as HTMLButtonElement).disabled).toBe(true);
  });

  it("el paso 'profile' muestra los 3 perfiles reales del motor (Fase 9.5 — antes solo uno estaba conectado)", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    const titles = Array.from(container.querySelectorAll(".production-export-profile-card h3")).map((el) => el.textContent);
    expect(titles).toEqual(["Digital PNG", "Print PDF", "Sticker Sheet"]);
    // "Web Preview" existe en @impulso/print-engine pero deliberadamente no
    // se expone aquí — ver el comentario junto a WIZARD_PROFILE_IDS.
    expect(titles).not.toContain("Web Preview");
  });

  it("elegir un perfil sin imposición (Digital PNG) y avanzar produce un PrintJob en modo 'single', sin campos de imposición en 'config'", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    const digitalPngRadio = Array.from(container.querySelectorAll<HTMLInputElement>('.production-export-profile-card input[type="radio"]')).find(
      (input) => input.value === "digital-png",
    )!;
    digitalPngRadio.checked = true;
    digitalPngRadio.dispatchEvent(new Event("change"));
    expect(container.querySelector(".production-export-profile-card-selected h3")!.textContent).toBe("Digital PNG");

    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // profile -> config
    expect(container.querySelector(".production-export-simple-summary")).not.toBeNull();
    expect(container.querySelector(".production-export-simple-summary")!.textContent).toContain("PNG");
    // Ningún control de imposición (cantidad/hoja/gap/alineación) en este
    // perfil — sección 16: "activar o desactivar imposición según
    // corresponda".
    expect(container.querySelector("fieldset")).toBeNull();
  });

  it("un proyecto SIN advertencias (perfil Digital PNG, sin die-line/imposición/bleed que objetar) completa la exportación real hasta 'Resultado' — regresión Fase 9.5: antes de este fix, el paso 'warnings' se saltaba automáticamente a 'progress' sin llamar nunca a startExport(), dejando el wizard colgado indefinidamente en 'Preparando…' sin ningún botón visible para continuar (el de 'Siguiente' se oculta en el paso 'progress')", async () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    const digitalPngRadio = Array.from(container.querySelectorAll<HTMLInputElement>('.production-export-profile-card input[type="radio"]')).find(
      (input) => input.value === "digital-png",
    )!;
    digitalPngRadio.checked = true;
    digitalPngRadio.dispatchEvent(new Event("change"));

    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // profile -> config
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // config -> preview
    await flush();
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preview -> preflight
    (container.querySelector(".production-export-body button") as HTMLButtonElement).click(); // "Correr Preflight"
    await flush();
    // Confirma que este escenario realmente ejercita el camino "sin
    // advertencias" — si el entorno alguna vez produjera una advertencia
    // real aquí, este test dejaría de probar lo que dice probar.
    expect(container.querySelector(".production-export-issues-error")).toBeNull();
    expect(container.querySelector(".production-export-issues-warning")).toBeNull();

    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preflight -> (warnings, auto-skip) -> progress -> (al completar) results
    await waitForStepTitle("Resultado");
    const downloadButton = container.querySelector(".production-export-body button") as HTMLButtonElement;
    expect(downloadButton.textContent).toContain("Descargar");
  });

  it("Escape cierra el diálogo y restaura el foco previo", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    expect(document.activeElement).not.toBe(trigger);

    const overlay = container.querySelector(".production-export-dialog-overlay") as HTMLElement;
    const dialogEl = container.querySelector(".production-export-dialog") as HTMLElement;
    dialogEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.style.display).toBe("none");
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("'Cancelar' cierra el diálogo", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    (container.querySelector(".production-export-cancel") as HTMLButtonElement).click();
    expect((container.querySelector(".production-export-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  /** Recorre profile -> config -> preview -> preflight -> warnings ->
   * progress -> results — el die-line de `buildProject()` cruza el safe
   * area (a propósito: 20x20mm sobre un trim de 20x20mm con margen de
   * safe area de 3mm) y la `quantity` por defecto (1) deja la única hoja
   * parcialmente ocupada, así que SIEMPRE hay advertencias/información
   * reales que pasar por el paso "warnings" (nunca un caso "sin
   * observaciones" armado a mano). */
  async function driveToResults(): Promise<void> {
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // profile -> config
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // config -> preview
    await flush();
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preview -> preflight
    (container.querySelector(".production-export-body button") as HTMLButtonElement).click(); // "Correr Preflight"
    await flush();
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preflight -> warnings
    const checkbox = container.querySelector(".production-export-accept-warnings input") as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // warnings -> progress -> (al completar) results
    await waitForStepTitle("Resultado");
  }

  it("recorre el flujo completo: profile -> config -> preview -> preflight -> warnings -> progress -> results, con descarga PDF disponible", async () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    (container.querySelector(".production-export-next") as HTMLButtonElement).click();
    expect(container.querySelector("h2")!.textContent).toBe("Configuración de la imposición");
    expect(container.querySelector(".production-export-body fieldset")).not.toBeNull();

    (container.querySelector(".production-export-next") as HTMLButtonElement).click();
    expect(container.querySelector("h2")!.textContent).toBe("Vista previa de producción");
    await flush();
    expect(container.querySelector(".production-preview")).not.toBeNull();

    (container.querySelector(".production-export-next") as HTMLButtonElement).click();
    expect(container.querySelector("h2")!.textContent).toBe("Revisión (Preflight)");
    (container.querySelector(".production-export-body button") as HTMLButtonElement).click();
    await flush();
    expect(container.querySelector(".production-export-issues-warning")).not.toBeNull();
    expect(container.querySelector(".production-export-issues-error")).toBeNull();
    expect((container.querySelector(".production-export-next") as HTMLButtonElement).disabled).toBe(false);

    (container.querySelector(".production-export-next") as HTMLButtonElement).click();
    expect(container.querySelector("h2")!.textContent).toBe("Advertencias");
    expect((container.querySelector(".production-export-next") as HTMLButtonElement).disabled).toBe(true); // sin aceptar todavía

    const checkbox = container.querySelector(".production-export-accept-warnings input") as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect((container.querySelector(".production-export-next") as HTMLButtonElement).disabled).toBe(false);

    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // -> progress -> results
    await waitForStepTitle("Resultado");
    const downloadButton = container.querySelector(".production-export-body button") as HTMLButtonElement;
    expect(downloadButton.textContent).toContain("Descargar");
  });

  it("cierra el flujo con el botón 'Cerrar' del paso de resultados", async () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    await driveToResults();

    expect((container.querySelector(".production-export-next") as HTMLButtonElement).textContent).toBe("Cerrar");
    (container.querySelector(".production-export-next") as HTMLButtonElement).click();
    expect((container.querySelector(".production-export-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  it("'Atrás' retrocede un paso", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // -> config
    expect(container.querySelector("h2")!.textContent).toBe("Configuración de la imposición");

    (container.querySelector(".production-export-back") as HTMLButtonElement).click();
    expect(container.querySelector("h2")!.textContent).toBe("Perfil de impresión");
  });

  it("accesibilidad: al cambiar de paso, el foco se mueve al título (h2) del nuevo paso", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");

    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // -> config
    expect(document.activeElement).toBe(container.querySelector("h2"));
    expect(document.activeElement!.textContent).toBe("Configuración de la imposición");

    (container.querySelector(".production-export-back") as HTMLButtonElement).click(); // -> profile
    expect(document.activeElement).toBe(container.querySelector("h2"));
    expect(document.activeElement!.textContent).toBe("Perfil de impresión");
  });

  it("accesibilidad: el título (h2) tiene tabIndex -1 (enfocable programáticamente, fuera del orden de tabulación normal)", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    expect((container.querySelector("h2") as HTMLElement).tabIndex).toBe(-1);
  });

  it("cambiar la cantidad en el paso de configuración actualiza el PrintJob en edición", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // -> config

    const quantityInput = container.querySelectorAll("fieldset input[type='number']")[0] as HTMLInputElement;
    quantityInput.value = "8";
    quantityInput.dispatchEvent(new Event("change"));

    // Volver a "config" (re-render) para confirmar que el valor mostrado ya refleja el cambio.
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // -> preview
    (container.querySelector(".production-export-back") as HTMLButtonElement).click(); // -> config
    const updatedInput = container.querySelectorAll("fieldset input[type='number']")[0] as HTMLInputElement;
    expect(updatedInput.value).toBe("8");
  });

  it("el paso de Preflight bloquea 'Siguiente' mientras haya errores bloqueantes", async () => {
    // 2 objects die-line -> ambiguo (`cut_path_multiple_candidates`) --
    // a diferencia de "ningún die-line" (que ahora se resuelve solo,
    // ver comentario de `buildProject`), esto SIEMPRE debe seguir
    // bloqueando: Preflight no puede elegir automáticamente cuál usar.
    const project = buildProject(true);
    project.document.pages[0]!.layers[0]!.objects.push(buildDieLine("die_2"));
    const dialog = mount();
    dialog.open(project, "Mi Sticker");
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // config
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preview
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preflight
    (container.querySelector(".production-export-body button") as HTMLButtonElement).click(); // correr preflight
    await flush();

    expect(container.querySelector(".production-export-issues-error")).not.toBeNull();
    expect((container.querySelector(".production-export-next") as HTMLButtonElement).disabled).toBe(true);
  });

  it("un template SIN die-line no bloquea Preflight con el perfil por defecto (regresión: falso positivo cut_path_missing en templates cuadrados/rectangulares)", async () => {
    const project = buildProject(false); // sin die-line, ej. un template cuadrado/rectangular real del catálogo
    const dialog = mount();
    dialog.open(project, "Mi Sticker"); // pendingProfileId por defecto: "sticker-sheet" (cutPath.mode: "die-cut")
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // profile -> config
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // config -> preview
    (container.querySelector(".production-export-next") as HTMLButtonElement).click(); // preview -> preflight
    (container.querySelector(".production-export-body button") as HTMLButtonElement).click(); // correr preflight
    await flush();

    expect(container.querySelector(".production-export-issues-error")).toBeNull();
    expect((container.querySelector(".production-export-next") as HTMLButtonElement).disabled).toBe(false);
  });

  it("destroy() remueve el overlay del contenedor", () => {
    const dialog = mount();
    dialog.open(buildProject(), "Mi Sticker");
    dialog.destroy();
    expect(container.querySelector(".production-export-dialog-overlay")).toBeNull();
  });
});
