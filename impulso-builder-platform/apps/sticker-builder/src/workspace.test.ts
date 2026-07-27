import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { createMemoryProjectStore, type ProjectStore } from "@impulso/project-library";
import { createMemoryTemplateStore, type TemplateStore } from "@impulso/template-library";
import { createMemoryAssetStore, type AssetBinaryStore } from "@impulso/asset-library";
import { mountWorkspace } from "./workspace.js";
import { BUILT_IN_STICKER_TEMPLATES } from "./builtInTemplates.js";
import { createProjectFromSize } from "./projectPresets.js";
import { serializeProjectBackup } from "./projectBackup.js";

const triggerBrowserDownloadMock = vi.fn();
vi.mock("@impulso/export-engine", async () => {
  const actual = await vi.importActual<typeof import("@impulso/export-engine")>("@impulso/export-engine");
  return {
    ...actual,
    triggerBrowserDownload: (...args: unknown[]) => triggerBrowserDownloadMock(...args),
  };
});

/** Pre-siembra el store con los 3 Templates incorporados ya "existentes" —
 * evita que `mountWorkspace`'s propio sembrado perezoso (ver ADR-0014)
 * dispare la rasterización real de un PNG (`HTMLCanvasElement.toBlob`, no
 * implementado por jsdom — cuelga la Promise para siempre, no la rechaza,
 * ver `builtInTemplates.test.ts`/ADR-0013). */
async function preSeedBuiltIns(store: TemplateStore, now: string): Promise<void> {
  for (const seed of BUILT_IN_STICKER_TEMPLATES) {
    await store.save(
      { id: seed.id, moduleId: "sticker-builder", name: seed.name, tags: [], builtIn: true, createdAt: now, updatedAt: now },
      { project: createProjectFromSize({ widthMm: seed.widthMm, heightMm: seed.heightMm, shape: seed.shape, now }) },
    );
  }
}

const metadata = { tags: [], visible: true, locked: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

function buildRect(id: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

function buildProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectIdSchema.parse(id),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(`document_${id}`),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 100, height: 100 },
          unit: "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [buildRect("rect_1")], metadata, pluginData: {}, customProperties: {} }],
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
    metadata: { ...metadata, name: "Proyecto sin nombre especial" },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

/** jsdom no implementa `HTMLCanvasElement.toBlob` — mismo criterio que
 * `app.test.ts`/`shell.test.ts` para evitar la rasterización real de Konva
 * al ejercitar `handleImportBackup` (regresión RC1: genera un thumbnail
 * real para el proyecto importado). */
const fakeGenerateThumbnail = async () => new Blob(["png"], { type: "image/png" });

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe("mountWorkspace", () => {
  let projectStore: ProjectStore;
  let templateStore: TemplateStore;
  let assetStore: AssetBinaryStore;

  beforeEach(() => {
    projectStore = createMemoryProjectStore();
    templateStore = createMemoryTemplateStore();
    assetStore = createMemoryAssetStore();
    // La bienvenida de primera ejecución (Fase 4.2) se guarda en
    // localStorage — sin limpiarlo, un test que la cierre "contaminaría" el
    // resto de la suite (dejaría de mostrarse), y viceversa.
    window.localStorage.clear();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("muestra el mensaje vacío cuando no hay proyectos guardados", async () => {
    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    expect((div.querySelector(".workspace-empty") as HTMLElement).style.display).toBe("block");
    expect(div.querySelectorAll(".workspace-card")).toHaveLength(0);
  });

  it("lista los proyectos guardados, ordenados por última edición (más reciente primero)", async () => {
    await projectStore.save(buildProject("project_old", { metadata: { ...metadata, name: "Viejo", updatedAt: "2026-01-01T00:00:00.000Z" } }));
    await projectStore.save(buildProject("project_new", { metadata: { ...metadata, name: "Nuevo", updatedAt: "2026-06-01T00:00:00.000Z" } }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    const names = Array.from(div.querySelectorAll(".workspace-card-name")).map((el) => el.textContent);
    expect(names).toEqual(["Nuevo", "Viejo"]);
    expect((div.querySelector(".workspace-empty") as HTMLElement).style.display).toBe("none");
  });

  it("filtra proyectos por moduleId", async () => {
    await projectStore.save(buildProject("project_sticker", { moduleId: "sticker-builder" }));
    await projectStore.save(buildProject("project_planner", { moduleId: "planner-builder" }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    expect(div.querySelectorAll(".workspace-card")).toHaveLength(1);
  });

  it("clic en 'Abrir' llama a onOpenProject con el Project completo", async () => {
    const project = buildProject("project_1");
    await projectStore.save(project);
    const onOpenProject = vi.fn();

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject });
    await flush();

    (div.querySelector(".workspace-card-open") as HTMLButtonElement).click();
    await flush();

    expect(onOpenProject).toHaveBeenCalledWith(project, { isNew: false });
  });

  // Epic 8 — Autosave, Recovery & Project Safety, sección 10/11.
  describe("banner de recovery", () => {
    it("muestra una recovery más reciente que el último guardado, y 'Recuperar cambios' abre con isNew: true", async () => {
      const saved = buildProject("project_1", { metadata: { ...metadata, name: "Guardado", updatedAt: "2026-07-19T10:00:00.000Z" } });
      await projectStore.save(saved);
      const recovered = { ...saved, metadata: { ...saved.metadata, name: "Con cambios sin guardar" } };
      await projectStore.saveRecovery(recovered, "2026-07-20T09:00:00.000Z");
      const onOpenProject = vi.fn();

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject });
      await flush();

      const banner = div.querySelector(".workspace-recovery-banner") as HTMLElement;
      expect(banner.style.display).not.toBe("none");
      expect(banner.textContent).toContain("Guardado");

      (div.querySelector(".workspace-recovery-recover") as HTMLButtonElement).click();
      expect(onOpenProject).toHaveBeenCalledWith(recovered, { isNew: true });
    });

    it("una recovery ya obsoleta (más vieja que el último guardado) se limpia en silencio y no se muestra", async () => {
      const saved = buildProject("project_1", { metadata: { ...metadata, updatedAt: "2026-07-20T09:00:00.000Z" } });
      await projectStore.save(saved);
      await projectStore.saveRecovery(saved, "2026-07-19T09:00:00.000Z");

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();

      const banner = div.querySelector(".workspace-recovery-banner") as HTMLElement;
      expect(banner.style.display).toBe("none");
      expect(await projectStore.getRecovery(saved.id)).toBeUndefined();
    });

    it("'Descartar' limpia la recovery sin abrir nada", async () => {
      const saved = buildProject("project_1", { metadata: { ...metadata, updatedAt: "2026-07-19T00:00:00.000Z" } });
      await projectStore.save(saved);
      await projectStore.saveRecovery(saved, "2026-07-20T09:00:00.000Z");
      const onOpenProject = vi.fn();

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject });
      await flush();

      (div.querySelector(".workspace-recovery-discard") as HTMLButtonElement).click();
      await flush();

      expect(onOpenProject).not.toHaveBeenCalled();
      expect(await projectStore.getRecovery(saved.id)).toBeUndefined();
      expect((div.querySelector(".workspace-recovery-banner") as HTMLElement).style.display).toBe("none");
    });

    it("'Abrir versión guardada' descarta la recovery y abre el Project persistido con isNew: false", async () => {
      const saved = buildProject("project_1", { metadata: { ...metadata, name: "Guardado", updatedAt: "2026-07-19T00:00:00.000Z" } });
      await projectStore.save(saved);
      await projectStore.saveRecovery({ ...saved, metadata: { ...saved.metadata, name: "Sin guardar" } }, "2026-07-20T09:00:00.000Z");
      const onOpenProject = vi.fn();

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject });
      await flush();

      (div.querySelector(".workspace-recovery-open-saved") as HTMLButtonElement).click();
      await flush();

      expect(onOpenProject).toHaveBeenCalledWith(saved, { isNew: false });
      expect(await projectStore.getRecovery(saved.id)).toBeUndefined();
    });

    it("una recovery de un Project que nunca se guardó (sin descriptor) se muestra sin la opción 'Abrir versión guardada'", async () => {
      const neverSaved = buildProject("project_nuevo", { metadata: { ...metadata, name: "Nunca guardado" } });
      await projectStore.saveRecovery(neverSaved, "2026-07-20T09:00:00.000Z");

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();

      const banner = div.querySelector(".workspace-recovery-banner") as HTMLElement;
      expect(banner.style.display).not.toBe("none");
      expect(banner.querySelector(".workspace-recovery-open-saved")).toBeNull();
      expect(banner.querySelector(".workspace-recovery-recover")).not.toBeNull();
    });
  });

  it("renombrar: clic en el lápiz, escribir, Enter guarda el nuevo nombre", async () => {
    await projectStore.save(buildProject("project_1", { metadata: { ...metadata, name: "Original" } }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-rename") as HTMLButtonElement).click();
    const input = div.querySelector(".workspace-card-name-input") as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "Nuevo nombre";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();

    expect((await projectStore.getDescriptor(ProjectIdSchema.parse("project_1")))?.name).toBe("Nuevo nombre");
    expect(div.querySelector(".workspace-card-name")?.textContent).toBe("Nuevo nombre");
  });

  it("renombrar con nombre vacío no cambia el nombre guardado", async () => {
    await projectStore.save(buildProject("project_1", { metadata: { ...metadata, name: "Original" } }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-rename") as HTMLButtonElement).click();
    const input = div.querySelector(".workspace-card-name-input") as HTMLInputElement;
    input.value = "   ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();

    expect((await projectStore.getDescriptor(ProjectIdSchema.parse("project_1")))?.name).toBe("Original");
  });

  it("Escape durante el renombrado cancela sin guardar", async () => {
    await projectStore.save(buildProject("project_1", { metadata: { ...metadata, name: "Original" } }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-rename") as HTMLButtonElement).click();
    const input = div.querySelector(".workspace-card-name-input") as HTMLInputElement;
    input.value = "Esto no debe guardarse";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();

    expect((await projectStore.getDescriptor(ProjectIdSchema.parse("project_1")))?.name).toBe("Original");
  });

  it("duplicar proyecto crea una entrada nueva con '(copia)' en el nombre", async () => {
    await projectStore.save(buildProject("project_1", { metadata: { ...metadata, name: "Original" } }));

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-duplicate") as HTMLButtonElement).click();
    await flush();

    const names = Array.from(div.querySelectorAll(".workspace-card-name")).map((el) => el.textContent).sort();
    expect(names).toEqual(["Original", "Original (copia)"].sort());
    expect(await projectStore.listDescriptors()).toHaveLength(2);
  });

  it("eliminar pide confirmación; si se confirma, remueve el proyecto", async () => {
    await projectStore.save(buildProject("project_1"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-delete") as HTMLButtonElement).click();
    await flush();

    expect(div.querySelectorAll(".workspace-card")).toHaveLength(0);
    expect(await projectStore.listDescriptors()).toEqual([]);
  });

  it("eliminar no hace nada si se cancela la confirmación", async () => {
    await projectStore.save(buildProject("project_1"));
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-card-delete") as HTMLButtonElement).click();
    await flush();

    expect(div.querySelectorAll(".workspace-card")).toHaveLength(1);
    expect(await projectStore.listDescriptors()).toHaveLength(1);
  });

  it("'Nuevo proyecto' abre la galería de Templates existente", async () => {
    await preSeedBuiltIns(templateStore, "2026-01-01T00:00:00.000Z");
    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    (div.querySelector(".workspace-new-btn") as HTMLButtonElement).click();
    await flush();

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none");
  });

  it("crear un proyecto Personalizado desde la galería llama a onOpenProject (sin guardarlo automáticamente)", async () => {
    await preSeedBuiltIns(templateStore, "2026-01-01T00:00:00.000Z");
    const onOpenProject = vi.fn();
    const div = container();
    mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject });
    await flush();

    (div.querySelector(".workspace-new-btn") as HTMLButtonElement).click();
    await flush();
    (div.querySelector(".new-project-card-custom") as HTMLElement).click();
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    await flush();

    expect(onOpenProject).toHaveBeenCalledOnce();
    expect(await projectStore.listDescriptors()).toEqual([]);
  });

  it("muestra un mensaje de error si listDescriptors() falla, sin romper la pantalla", async () => {
    const failingStore: ProjectStore = {
      ...createMemoryProjectStore(),
      listDescriptors: async () => {
        throw new Error("fallo simulado");
      },
    };
    const div = container();
    mountWorkspace(div, { projectStore: failingStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    const error = div.querySelector(".workspace-error") as HTMLElement;
    expect(error.style.display).toBe("block");
    expect(error.textContent).toContain("fallo simulado");
  });

  it("destroy() remueve la pantalla completa del DOM", async () => {
    const div = container();
    const workspace = mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();

    workspace.destroy();

    expect(div.querySelector(".workspace-screen")).toBeNull();
  });

  it("refresh() vuelve a cargar la grilla manualmente", async () => {
    const div = container();
    const workspace = mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
    await flush();
    expect(div.querySelectorAll(".workspace-card")).toHaveLength(0);

    await projectStore.save(buildProject("project_1"));
    await workspace.refresh();

    expect(div.querySelectorAll(".workspace-card")).toHaveLength(1);
  });

  // Fase 4.2, sección 12/13 (Primera experiencia + estado comercial).
  describe("Bienvenida de primera ejecución + estado comercial", () => {
    it("muestra la bienvenida en el primer montaje, y ya no en un remontaje tras cerrarla", async () => {
      const div1 = container();
      const workspace1 = mountWorkspace(div1, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();
      expect((div1.querySelector(".welcome-dialog-overlay") as HTMLElement).style.display).not.toBe("none");

      (div1.querySelector(".welcome-dialog-close") as HTMLButtonElement).click();
      workspace1.destroy();

      const div2 = container();
      mountWorkspace(div2, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();
      expect((div2.querySelector(".welcome-dialog-overlay") as HTMLElement).style.display).toBe("none");
    });

    it("muestra el estado comercial (producto/versión/licencia/canal) con lenguaje honesto, sin decir 'activado'", async () => {
      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();

      const status = div.querySelector(".workspace-commercial-status") as HTMLElement;
      expect(status).not.toBeNull();
      expect(status.textContent).toContain("THÖREN Sticker Builder");
      expect(status.textContent).toContain("Gumroad");
      expect(status.textContent).not.toContain("activado");
    });
  });

  // Fase 4.2, sección 18 (Backup y portabilidad).
  describe("Exportar respaldo / Importar proyecto", () => {
    beforeEach(() => triggerBrowserDownloadMock.mockReset());

    it("'Exportar respaldo' descarga un JSON con el Project (vía triggerBrowserDownload)", async () => {
      await projectStore.save(buildProject("project_1", { metadata: { ...metadata, name: "Mi sticker" } }));
      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();

      (div.querySelector(".workspace-card-export-backup") as HTMLButtonElement).click();
      await flush();

      expect(triggerBrowserDownloadMock).toHaveBeenCalledTimes(1);
      const [blob, filename] = triggerBrowserDownloadMock.mock.calls[0]!;
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toContain("respaldo");
    });

    it("'Importar proyecto' agrega un proyecto nuevo a la Workspace a partir de un respaldo válido", async () => {
      const original = buildProject("project_imported", { metadata: { ...metadata, name: "Proyecto restaurado" } });
      const raw = await serializeProjectBackup(original, assetStore, () => "2026-07-25T00:00:00.000Z");
      const file = new File([raw], "respaldo.json", { type: "application/json" });

      const div = container();
      mountWorkspace(div, {
        projectStore,
        templateStore,
        assetStore,
        moduleId: "sticker-builder",
        onOpenProject: vi.fn(),
        generateThumbnail: fakeGenerateThumbnail,
      });
      await flush();

      const input = div.querySelector(".workspace-import-btn + input[type='file']") as HTMLInputElement;
      Object.defineProperty(input, "files", { value: [file], writable: false });
      input.dispatchEvent(new Event("change"));
      // FileReader (usado internamente para leer el archivo) resuelve vía un
      // macrotask real en jsdom, no solo microtasks — un setTimeout real es
      // necesario además de flush().
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flush();

      const names = Array.from(div.querySelectorAll(".workspace-card-name")).map((el) => el.textContent);
      expect(names).toContain("Proyecto restaurado");
    });

    it("regresión RC1: 'Importar proyecto' genera una miniatura real para la tarjeta nueva (antes quedaba con el ícono de imagen rota)", async () => {
      // Bug real encontrado en la validación de comprador en vivo de RC1:
      // `handleImportBackup` nunca generaba un thumbnail para el proyecto
      // importado (a diferencia de guardar/editar en el editor, que sí lo
      // hace en cada autosave vía `persistProject`) — su tarjeta en "Mis
      // proyectos" se quedaba con el ícono de imagen rota hasta que el
      // comprador la abría y guardaba manualmente al menos una vez.
      const original = buildProject("project_for_thumbnail", { metadata: { ...metadata, name: "Con miniatura" } });
      const raw = await serializeProjectBackup(original, assetStore, () => "2026-07-25T00:00:00.000Z");
      const file = new File([raw], "respaldo.json", { type: "application/json" });
      const generateThumbnail = vi.fn(fakeGenerateThumbnail);

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn(), generateThumbnail });
      await flush();

      const input = div.querySelector(".workspace-import-btn + input[type='file']") as HTMLInputElement;
      Object.defineProperty(input, "files", { value: [file], writable: false });
      input.dispatchEvent(new Event("change"));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flush();

      expect(generateThumbnail).toHaveBeenCalledTimes(1);
      const thumbnail = div.querySelector(".workspace-card-thumbnail") as HTMLImageElement;
      expect(thumbnail.src).not.toBe("");
    });

    it("regresión RC1: importar un respaldo cuyo proyecto original SIGUE existiendo agrega una tarjeta nueva, no sobrescribe la existente", async () => {
      // Bug real encontrado durante la validación de Release Candidate 1.0:
      // `handleImportBackup` guardaba `imported.project` con el mismo id
      // que el original — si ese id ya existía en el ProjectStore (el caso
      // más común: un comprador re-importando su propio respaldo para
      // comprobar que funciona), `projectStore.save` lo sobrescribía en
      // silencio en vez de agregar una entrada nueva e independiente.
      const original = buildProject("project_still_here", { metadata: { ...metadata, name: "Original" } });
      await projectStore.save(original);
      const raw = await serializeProjectBackup(original, assetStore, () => "2026-07-25T00:00:00.000Z");
      const file = new File([raw], "respaldo.json", { type: "application/json" });

      const div = container();
      mountWorkspace(div, {
        projectStore,
        templateStore,
        assetStore,
        moduleId: "sticker-builder",
        onOpenProject: vi.fn(),
        generateThumbnail: fakeGenerateThumbnail,
      });
      await flush();

      const input = div.querySelector(".workspace-import-btn + input[type='file']") as HTMLInputElement;
      Object.defineProperty(input, "files", { value: [file], writable: false });
      input.dispatchEvent(new Event("change"));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flush();

      const cards = div.querySelectorAll(".workspace-card");
      expect(cards).toHaveLength(2);
      const names = Array.from(div.querySelectorAll(".workspace-card-name")).map((el) => el.textContent);
      expect(names.filter((name) => name === "Original")).toHaveLength(2);
    });

    it("'Importar proyecto' con un archivo corrupto muestra un error (window.alert) sin agregar nada", async () => {
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);
      const file = new File(["esto no es un respaldo"], "roto.json", { type: "application/json" });

      const div = container();
      mountWorkspace(div, { projectStore, templateStore, assetStore, moduleId: "sticker-builder", onOpenProject: vi.fn() });
      await flush();

      const input = div.querySelector(".workspace-import-btn + input[type='file']") as HTMLInputElement;
      Object.defineProperty(input, "files", { value: [file], writable: false });
      input.dispatchEvent(new Event("change"));
      // FileReader (usado internamente para leer el archivo) resuelve vía un
      // macrotask real en jsdom, no solo microtasks — un setTimeout real es
      // necesario además de flush().
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flush();

      expect(alertMock).toHaveBeenCalled();
      expect(div.querySelectorAll(".workspace-card")).toHaveLength(0);
    });
  });
});
