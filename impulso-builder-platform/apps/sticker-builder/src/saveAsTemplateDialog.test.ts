import { describe, expect, it, vi } from "vitest";
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
import { createMemoryTemplateStore, type TemplateStore } from "@impulso/template-library";
import { mountSaveAsTemplateDialog } from "./saveAsTemplateDialog.js";

const NOW = "2026-07-19T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

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

function buildProject(): Project {
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

const fakeThumbnail = async () => new Blob(["png"], { type: "image/png" });

describe("mountSaveAsTemplateDialog", () => {
  it("está oculto al montar", () => {
    const div = container();
    mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: createMemoryTemplateStore(),
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  it("open()/close() alternan la visibilidad", () => {
    const div = container();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: createMemoryTemplateStore(),
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).not.toBe("none");
    dialog.close();
    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  it("nombre vacío muestra un error y no guarda nada", async () => {
    const div = container();
    const templateStore = createMemoryTemplateStore();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore,
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement).click();
    await Promise.resolve();

    expect((div.querySelector(".save-as-template-dialog-error") as HTMLElement).style.display).toBe("block");
    expect(await templateStore.listDescriptors()).toEqual([]);
  });

  it("guarda un Template nuevo (builtIn:false) con el nombre/descripción dados", async () => {
    const div = container();
    const templateStore = createMemoryTemplateStore();
    const onSaved = vi.fn();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore,
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
      onSaved,
      now: () => NOW,
      generateId: () => "tpl_new",
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value = "Mi plantilla";
    (div.querySelector(".save-as-template-dialog-description") as HTMLTextAreaElement).value = "Una descripción";
    (div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const descriptor = await templateStore.getDescriptor("tpl_new");
    expect(descriptor).toMatchObject({ name: "Mi plantilla", description: "Una descripción", moduleId: "sticker-builder", builtIn: false });
    const content = await templateStore.getContent("tpl_new");
    expect(content?.project.id).toBe("project_1");
    expect(content?.thumbnail).toBeInstanceOf(Blob);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("descripción vacía se guarda como undefined, no como string vacío", async () => {
    const div = container();
    const templateStore = createMemoryTemplateStore();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore,
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
      now: () => NOW,
      generateId: () => "tpl_new",
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value = "Sin descripción";
    (div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const descriptor = await templateStore.getDescriptor("tpl_new");
    expect(descriptor?.description).toBeUndefined();
  });

  it("guardar cierra el diálogo", async () => {
    const div = container();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: createMemoryTemplateStore(),
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value = "x";
    (div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  it("si templateStore.save falla, muestra un error y reactiva el botón sin cerrar el diálogo", async () => {
    const div = container();
    const failingStore: TemplateStore = {
      ...createMemoryTemplateStore(),
      save: async () => {
        throw new Error("cuota agotada");
      },
    };
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: failingStore,
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value = "x";
    const saveButton = div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement;
    saveButton.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const errorMessage = div.querySelector(".save-as-template-dialog-error") as HTMLElement;
    expect(errorMessage.style.display).toBe("block");
    expect(errorMessage.textContent).toContain("cuota agotada");
    expect(saveButton.disabled).toBe(false);
    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).not.toBe("none");
  });

  it("cancelar cierra el diálogo sin guardar", async () => {
    const div = container();
    const templateStore = createMemoryTemplateStore();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore,
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value = "x";
    (div.querySelector(".save-as-template-dialog-cancel") as HTMLButtonElement).click();

    expect((div.querySelector(".save-as-template-dialog-overlay") as HTMLElement).style.display).toBe("none");
    expect(await templateStore.listDescriptors()).toEqual([]);
  });

  it("open() limpia el nombre/descripción/errores de un uso previo", async () => {
    const div = container();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: createMemoryTemplateStore(),
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.open();
    (div.querySelector(".save-as-template-dialog-save") as HTMLButtonElement).click();
    await Promise.resolve();
    expect((div.querySelector(".save-as-template-dialog-error") as HTMLElement).style.display).toBe("block");

    dialog.open();

    expect((div.querySelector(".save-as-template-dialog-name") as HTMLInputElement).value).toBe("");
    expect((div.querySelector(".save-as-template-dialog-error") as HTMLElement).style.display).toBe("none");
  });

  it("destroy() remueve el overlay del DOM", () => {
    const div = container();
    const dialog = mountSaveAsTemplateDialog(div, {
      getProject: buildProject,
      templateStore: createMemoryTemplateStore(),
      moduleId: "sticker-builder",
      generateThumbnail: fakeThumbnail,
    });
    dialog.destroy();
    expect(div.querySelector(".save-as-template-dialog-overlay")).toBeNull();
  });
});
