import { describe, expect, it } from "vitest";
import { mountUnsavedChangesDialog } from "./unsavedChangesDialog.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function overlayOf(root: HTMLElement): HTMLElement {
  return root.querySelector(".unsaved-changes-dialog-overlay") as HTMLElement;
}

describe("mountUnsavedChangesDialog", () => {
  it("open() muestra el mensaje dado y el overlay", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);

    const pending = dialog.open("No se pudo guardar: fallo simulado.");
    const overlay = overlayOf(root);

    expect(overlay.style.display).not.toBe("none");
    expect(root.querySelector("p")?.textContent).toBe("No se pudo guardar: fallo simulado.");

    (root.querySelector(".unsaved-changes-dialog-stay") as HTMLButtonElement).click();
    await pending;
  });

  it("el foco inicial cae en 'Permanecer en el editor' (la opción más segura)", () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);

    void dialog.open("mensaje");

    expect(document.activeElement).toBe(root.querySelector(".unsaved-changes-dialog-stay"));
  });

  it("'Reintentar' resuelve 'retry', 'Permanecer' resuelve 'stay', 'Salir sin guardar' resuelve 'discard'", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);

    const first = dialog.open("mensaje");
    (root.querySelector(".unsaved-changes-dialog-retry") as HTMLButtonElement).click();
    expect(await first).toBe("retry");

    const second = dialog.open("mensaje");
    (root.querySelector(".unsaved-changes-dialog-stay") as HTMLButtonElement).click();
    expect(await second).toBe("stay");

    const third = dialog.open("mensaje");
    (root.querySelector(".unsaved-changes-dialog-discard") as HTMLButtonElement).click();
    expect(await third).toBe("discard");
  });

  it("Escape resuelve 'stay' (la opción más segura) y oculta el overlay", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);

    const pending = dialog.open("mensaje");
    const dialogEl = root.querySelector(".unsaved-changes-dialog") as HTMLElement;
    dialogEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(await pending).toBe("stay");
    expect(overlayOf(root).style.display).toBe("none");
  });

  it("Tab desde el último botón (Salir sin guardar) cicla al primero (Reintentar)", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);
    const pending = dialog.open("mensaje");

    const retryButton = root.querySelector(".unsaved-changes-dialog-retry") as HTMLButtonElement;
    const discardButton = root.querySelector(".unsaved-changes-dialog-discard") as HTMLButtonElement;
    const dialogEl = root.querySelector(".unsaved-changes-dialog") as HTMLElement;

    discardButton.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    dialogEl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(retryButton);

    retryButton.click();
    await pending;
  });

  it("Shift+Tab desde el primer botón (Reintentar) cicla al último (Salir sin guardar)", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);
    const pending = dialog.open("mensaje");

    const retryButton = root.querySelector(".unsaved-changes-dialog-retry") as HTMLButtonElement;
    const discardButton = root.querySelector(".unsaved-changes-dialog-discard") as HTMLButtonElement;
    const dialogEl = root.querySelector(".unsaved-changes-dialog") as HTMLElement;

    retryButton.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    dialogEl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(discardButton);

    discardButton.click();
    await pending;
  });

  it("Tab entre los botones intermedios no hace nada especial (deja que el navegador cicle normalmente)", () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);
    void dialog.open("mensaje");

    const stayButton = root.querySelector(".unsaved-changes-dialog-stay") as HTMLButtonElement;
    const dialogEl = root.querySelector(".unsaved-changes-dialog") as HTMLElement;

    stayButton.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    dialogEl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("restaura el foco al elemento previamente enfocado después de resolver", async () => {
    const root = container();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const dialog = mountUnsavedChangesDialog(root);
    const pending = dialog.open("mensaje");
    expect(document.activeElement).not.toBe(trigger);

    (root.querySelector(".unsaved-changes-dialog-discard") as HTMLButtonElement).click();
    await pending;

    expect(document.activeElement).toBe(trigger);
  });

  it("destroy() remueve el overlay del DOM y el listener de teclado", () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);
    void dialog.open("mensaje");

    dialog.destroy();

    expect(root.querySelector(".unsaved-changes-dialog-overlay")).toBeNull();
  });

  it("open() nunca se resuelve por sí solo — solo una de las 3 acciones lo hace", async () => {
    const root = container();
    const dialog = mountUnsavedChangesDialog(root);
    let resolved = false;
    const pending = dialog.open("mensaje").then((choice) => {
      resolved = true;
      return choice;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolved).toBe(false);

    (root.querySelector(".unsaved-changes-dialog-stay") as HTMLButtonElement).click();
    await pending;
    expect(resolved).toBe(true);
  });
});
