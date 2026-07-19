import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProjectSchema } from "@impulso/document-schema";
import { createMemoryTemplateStore, type TemplateStore } from "@impulso/template-library";
import { mountNewProjectDialog } from "./newProjectDialog.js";
import { createProjectFromSize } from "./projectPresets.js";

const NOW = "2026-07-18T00:00:00.000Z";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

async function seededStore(): Promise<TemplateStore> {
  const store = createMemoryTemplateStore();
  const builtInProject = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "circle", now: NOW, generateId: () => "builtin" });
  await store.save(
    { id: "tpl_builtin", moduleId: "sticker-builder", name: "Círculo incorporado", tags: [], builtIn: true, createdAt: NOW, updatedAt: NOW },
    { project: builtInProject, thumbnail: new Blob(["png"], { type: "image/png" }) },
  );
  const userProject = createProjectFromSize({ widthMm: 80, heightMm: 60, shape: "rectangle", now: NOW, generateId: () => "user" });
  await store.save(
    { id: "tpl_user", moduleId: "sticker-builder", name: "Mi plantilla", tags: [], builtIn: false, createdAt: NOW, updatedAt: NOW },
    { project: userProject },
  );
  return store;
}

describe("mountNewProjectDialog", () => {
  let templateStore: TemplateStore;

  beforeEach(async () => {
    templateStore = await seededStore();
    // jsdom no implementa `URL.createObjectURL`/`revokeObjectURL` — se
    // stubean para poder resolver los thumbnails de la galería sin un
    // navegador real (mismo workaround ya usado en assetsPanel.test.ts).
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("está oculto al montar", () => {
    const div = container();
    mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("open() lo muestra y carga la galería; close() lo oculta", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });

    await dialog.open();
    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none");

    dialog.close();
    expect(overlay.style.display).toBe("none");
  });

  it("lista los Templates del módulo + una tarjeta 'Personalizado'", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const names = Array.from(div.querySelectorAll(".new-project-card-name")).map((n) => n.textContent);
    expect(names).toEqual(["Círculo incorporado", "Mi plantilla", "Personalizado"]);
  });

  it("filtra por moduleId — un Template de otro módulo no aparece", async () => {
    await templateStore.save(
      { id: "tpl_other", moduleId: "planner-builder", name: "De otro módulo", tags: [], builtIn: false, createdAt: NOW, updatedAt: NOW },
      { project: createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "square", now: NOW }) },
    );
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const names = Array.from(div.querySelectorAll(".new-project-card-name")).map((n) => n.textContent);
    expect(names).not.toContain("De otro módulo");
  });

  it("los Templates incorporados no tienen botón de eliminar; los del usuario sí", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const cards = Array.from(div.querySelectorAll(".new-project-card"));
    const builtInCard = cards.find((c) => c.textContent?.includes("Círculo incorporado"));
    const userCard = cards.find((c) => c.textContent?.includes("Mi plantilla"));
    expect(builtInCard?.querySelector(".new-project-card-delete")).toBeNull();
    expect(userCard?.querySelector(".new-project-card-delete")).not.toBeNull();
  });

  it("el primer Template se preselecciona; los campos de Personalizado están ocultos", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    expect(div.querySelector(".new-project-card.selected")?.textContent).toContain("Círculo incorporado");
    expect((div.querySelector(".new-project-dialog-custom-fields") as HTMLElement).style.display).toBe("none");
  });

  it("seleccionar 'Personalizado' muestra los campos de ancho/alto", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();

    expect((div.querySelector(".new-project-dialog-custom-fields") as HTMLElement).style.display).toBe("block");
    expect(customCard.classList.contains("selected")).toBe(true);
  });

  it("crear con un Template seleccionado instancia su Project con ids frescos", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const userCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent?.includes("Mi plantilla"))!;
    (userCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onCreate).toHaveBeenCalledOnce();
    const project = onCreate.mock.calls[0]![0];
    expect(() => ProjectSchema.parse(project)).not.toThrow();
    expect(project.document.pages[0].size).toEqual({ width: 80, height: 60 });

    const originalContent = await templateStore.getContent("tpl_user");
    expect(project.id).not.toBe(originalContent!.project.id);
  });

  it("crear con 'Personalizado' usa el ancho/alto ingresados y forma 'custom' (sin objects)", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "120";
    (div.querySelector(".new-project-dialog-height") as HTMLInputElement).value = "80";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).toHaveBeenCalledOnce();
    const project = onCreate.mock.calls[0]![0];
    expect(project.document.pages[0].size).toEqual({ width: 120, height: 80 });
    expect(project.document.pages[0].layers[0].objects).toEqual([]);
  });

  it("crear con un Template cierra el diálogo", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("'Personalizado' con ancho/alto inválidos muestra un error y NO llama a onCreate", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "0";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
    const errorMessage = div.querySelector(".new-project-dialog-error") as HTMLElement;
    expect(errorMessage.style.display).toBe("block");
    expect(errorMessage.textContent).not.toBe("");

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none");
  });

  it("'Personalizado' con texto no numérico también muestra error", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "abc";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("cancelar cierra el diálogo sin llamar a onCreate", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    (div.querySelector(".new-project-dialog-cancel") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("eliminar una plantilla del usuario la quita de la galería y del store", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const userCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent?.includes("Mi plantilla"))!;
    (userCard.querySelector(".new-project-card-delete") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(await templateStore.getDescriptor("tpl_user")).toBeUndefined();
    const names = Array.from(div.querySelectorAll(".new-project-card-name")).map((n) => n.textContent);
    expect(names).not.toContain("Mi plantilla");
  });

  it("abrir de nuevo tras un uso previo limpia el error y recarga la galería", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();
    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "0";
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    expect((div.querySelector(".new-project-dialog-error") as HTMLElement).style.display).toBe("block");

    await dialog.open();

    expect((div.querySelector(".new-project-dialog-error") as HTMLElement).style.display).toBe("none");
    expect((div.querySelector(".new-project-dialog-custom-fields") as HTMLElement).style.display).toBe("none");
  });

  it("si listDescriptors falla, muestra un error en vez de romper el diálogo", async () => {
    const failingStore: TemplateStore = {
      ...templateStore,
      listDescriptors: async () => {
        throw new Error("fallo de red");
      },
    };
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore: failingStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const errorMessage = div.querySelector(".new-project-dialog-error") as HTMLElement;
    expect(errorMessage.style.display).toBe("block");
    // Igual muestra la tarjeta "Personalizado" — no queda un diálogo vacío e inutilizable.
    expect(div.querySelector(".new-project-card-custom")).not.toBeNull();
  });

  it("destroy() remueve el overlay del DOM", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });

    dialog.destroy();

    expect(div.querySelector(".new-project-dialog-overlay")).toBeNull();
  });

  it("sin `now`/`generateId` inyectados, usa los valores reales por defecto", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate });
    await dialog.open();

    const customCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent === "Personalizado")!;
    (customCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    const project = onCreate.mock.calls[0]![0];
    expect(project.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
