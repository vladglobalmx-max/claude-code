import { describe, expect, it, vi } from "vitest";
import { ProjectSchema } from "@impulso/document-schema";
import { mountNewProjectDialog } from "./newProjectDialog.js";
import { STICKER_SIZE_PRESETS } from "./projectPresets.js";

const NOW = "2026-07-18T00:00:00.000Z";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("mountNewProjectDialog", () => {
  it("está oculto al montar", () => {
    const div = container();
    mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("open() lo muestra; close() lo oculta", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });

    dialog.open();
    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none");

    dialog.close();
    expect(overlay.style.display).toBe("none");
  });

  it("lista los 3 presets curados + 'Personalizado'", () => {
    const div = container();
    mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });

    const radios = div.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(STICKER_SIZE_PRESETS.length + 1);
    const labels = Array.from(div.querySelectorAll(".new-project-dialog-options label")).map((l) => l.textContent);
    expect(labels).toEqual([...STICKER_SIZE_PRESETS.map((p) => p.label), "Personalizado"]);
  });

  it("los campos de Personalizado están ocultos por defecto (el primer preset viene preseleccionado)", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });
    dialog.open();

    const customFields = div.querySelector(".new-project-dialog-custom-fields") as HTMLElement;
    expect(customFields.style.display).toBe("none");
  });

  it("seleccionar 'Personalizado' muestra los campos de ancho/alto", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });
    dialog.open();

    const customRadio = div.querySelector(".new-project-dialog-custom-radio") as HTMLInputElement;
    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change"));

    const customFields = div.querySelector(".new-project-dialog-custom-fields") as HTMLElement;
    expect(customFields.style.display).toBe("block");
  });

  it("crear con un preset llama a onCreate con un Project válido de ese tamaño/forma", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();

    const circlePreset = STICKER_SIZE_PRESETS.find((p) => p.shape === "circle")!;
    const circleRadio = Array.from(div.querySelectorAll('input[type="radio"]')).find(
      (r) => (r as HTMLInputElement).value === circlePreset.id,
    ) as HTMLInputElement;
    circleRadio.checked = true;

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).toHaveBeenCalledOnce();
    const project = onCreate.mock.calls[0]![0];
    expect(() => ProjectSchema.parse(project)).not.toThrow();
    expect(project.document.pages[0].size).toEqual({ width: circlePreset.widthMm, height: circlePreset.heightMm });
    expect(project.document.pages[0].layers[0].objects).toHaveLength(1); // die-line del círculo
  });

  it("crear con 'Personalizado' usa el ancho/alto ingresados y forma 'custom' (sin objects)", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();

    const customRadio = div.querySelector(".new-project-dialog-custom-radio") as HTMLInputElement;
    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change"));
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "120";
    (div.querySelector(".new-project-dialog-height") as HTMLInputElement).value = "80";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).toHaveBeenCalledOnce();
    const project = onCreate.mock.calls[0]![0];
    expect(project.document.pages[0].size).toEqual({ width: 120, height: 80 });
    expect(project.document.pages[0].layers[0].objects).toEqual([]);
  });

  it("crear cierra el diálogo", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });
    dialog.open();

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("'Personalizado' con ancho/alto inválidos muestra un error y NO llama a onCreate", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();

    const customRadio = div.querySelector(".new-project-dialog-custom-radio") as HTMLInputElement;
    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change"));
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "0";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
    const errorMessage = div.querySelector(".new-project-dialog-error") as HTMLElement;
    expect(errorMessage.style.display).toBe("block");
    expect(errorMessage.textContent).not.toBe("");

    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("none"); // sigue abierto
  });

  it("'Personalizado' con texto no numérico también muestra error", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();

    const customRadio = div.querySelector(".new-project-dialog-custom-radio") as HTMLInputElement;
    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change"));
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "abc";

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("cancelar cierra el diálogo sin llamar a onCreate", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();

    (div.querySelector(".new-project-dialog-cancel") as HTMLButtonElement).click();

    expect(onCreate).not.toHaveBeenCalled();
    const overlay = div.querySelector(".new-project-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("abrir de nuevo tras un uso previo resetea la selección al primer preset y limpia el error", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate, now: () => NOW });
    dialog.open();
    const customRadio = div.querySelector(".new-project-dialog-custom-radio") as HTMLInputElement;
    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change"));
    (div.querySelector(".new-project-dialog-width") as HTMLInputElement).value = "0";
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    expect((div.querySelector(".new-project-dialog-error") as HTMLElement).style.display).toBe("block");

    dialog.open();

    const firstRadio = div.querySelectorAll('input[type="radio"]')[0] as HTMLInputElement;
    expect(firstRadio.checked).toBe(true);
    expect((div.querySelector(".new-project-dialog-error") as HTMLElement).style.display).toBe("none");
    expect((div.querySelector(".new-project-dialog-custom-fields") as HTMLElement).style.display).toBe("none");
  });

  it("destroy() remueve el overlay del DOM", () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { onCreate: vi.fn(), now: () => NOW });

    dialog.destroy();

    expect(div.querySelector(".new-project-dialog-overlay")).toBeNull();
  });

  it("sin `now` inyectado, usa la fecha real por defecto", () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { onCreate });
    dialog.open();

    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();

    const project = onCreate.mock.calls[0]![0];
    expect(project.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
