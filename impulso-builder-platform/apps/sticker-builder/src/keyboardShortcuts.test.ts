import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountKeyboardShortcuts, type KeyboardShortcutActions } from "./keyboardShortcuts.js";

function fakeActions(): KeyboardShortcutActions {
  return {
    selectTool: vi.fn(),
    textTool: vi.fn(),
    imageTool: vi.fn(),
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    groupSelected: vi.fn(),
    ungroupSelected: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    open: vi.fn(),
    selectAll: vi.fn(),
    escape: vi.fn(),
    nudge: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
  };
}

function press(init: KeyboardEventInit, dispatchTarget: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init });
  dispatchTarget.dispatchEvent(event);
  return event;
}

describe("mountKeyboardShortcuts", () => {
  let actions: KeyboardShortcutActions;

  beforeEach(() => {
    actions = fakeActions();
  });

  it("V/T/I seleccionan la herramienta correspondiente", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "v" });
    press({ key: "T" }); // mayúscula también funciona
    press({ key: "i" });

    expect(actions.selectTool).toHaveBeenCalledOnce();
    expect(actions.textTool).toHaveBeenCalledOnce();
    expect(actions.imageTool).toHaveBeenCalledOnce();
  });

  it("Delete y Backspace llaman a deleteSelected", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "Delete" });
    press({ key: "Backspace" });
    expect(actions.deleteSelected).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+D y Cmd+D llaman a duplicateSelected", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "d", ctrlKey: true });
    press({ key: "d", metaKey: true });
    expect(actions.duplicateSelected).toHaveBeenCalledTimes(2);
  });

  it("Ctrl/Cmd+G agrupa; Ctrl/Cmd+Shift+G desagrupa", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "g", ctrlKey: true });
    expect(actions.groupSelected).toHaveBeenCalledOnce();
    expect(actions.ungroupSelected).not.toHaveBeenCalled();

    press({ key: "g", ctrlKey: true, shiftKey: true });
    expect(actions.ungroupSelected).toHaveBeenCalledOnce();
    expect(actions.groupSelected).toHaveBeenCalledOnce(); // no se llamó de nuevo
  });

  it("Ctrl/Cmd+Z deshace; Ctrl/Cmd+Shift+Z rehace", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "z", ctrlKey: true });
    expect(actions.undo).toHaveBeenCalledOnce();
    expect(actions.redo).not.toHaveBeenCalled();

    press({ key: "z", ctrlKey: true, shiftKey: true });
    expect(actions.redo).toHaveBeenCalledOnce();
    expect(actions.undo).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+S guarda; Ctrl/Cmd+O abre", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "s", ctrlKey: true });
    press({ key: "o", metaKey: true });
    expect(actions.save).toHaveBeenCalledOnce();
    expect(actions.open).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+A selecciona todo", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "a", ctrlKey: true });
    expect(actions.selectAll).toHaveBeenCalledOnce();
  });

  it("Escape llama a escape()", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "Escape" });
    expect(actions.escape).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+] adelanta una capa; Ctrl/Cmd+[ la retrasa", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "]", ctrlKey: true });
    press({ key: "[", ctrlKey: true });
    expect(actions.bringForward).toHaveBeenCalledOnce();
    expect(actions.sendBackward).toHaveBeenCalledOnce();
  });

  it("las flechas mueven 1px; con Shift, 10px", () => {
    mountKeyboardShortcuts(actions);
    press({ key: "ArrowUp" });
    press({ key: "ArrowDown" });
    press({ key: "ArrowLeft" });
    press({ key: "ArrowRight" });
    expect(actions.nudge).toHaveBeenNthCalledWith(1, 0, -1);
    expect(actions.nudge).toHaveBeenNthCalledWith(2, 0, 1);
    expect(actions.nudge).toHaveBeenNthCalledWith(3, -1, 0);
    expect(actions.nudge).toHaveBeenNthCalledWith(4, 1, 0);

    press({ key: "ArrowUp", shiftKey: true });
    expect(actions.nudge).toHaveBeenNthCalledWith(5, 0, -10);
  });

  it("previene el comportamiento por defecto en atajos con Ctrl/Cmd, Delete/Backspace y flechas", () => {
    mountKeyboardShortcuts(actions);
    const saveEvent = press({ key: "s", ctrlKey: true });
    expect(saveEvent.defaultPrevented).toBe(true);

    const deleteEvent = press({ key: "Delete" });
    expect(deleteEvent.defaultPrevented).toBe(true);

    const arrowEvent = press({ key: "ArrowUp" });
    expect(arrowEvent.defaultPrevented).toBe(true);
  });

  it("Escape y V/T/I NO llaman a preventDefault (no interfieren con otros usos del navegador)", () => {
    mountKeyboardShortcuts(actions);
    const escapeEvent = press({ key: "Escape" });
    expect(escapeEvent.defaultPrevented).toBe(false);

    const vEvent = press({ key: "v" });
    expect(vEvent.defaultPrevented).toBe(false);
  });

  it("ignora atajos cuando el target del evento es un <input>", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    mountKeyboardShortcuts(actions);

    press({ key: "Delete" }, input);

    expect(actions.deleteSelected).not.toHaveBeenCalled();
  });

  it("ignora atajos cuando el target del evento es un <textarea>", () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    mountKeyboardShortcuts(actions);

    press({ key: "g", ctrlKey: true }, textarea);

    expect(actions.groupSelected).not.toHaveBeenCalled();
  });

  it("ignora atajos cuando el target del evento es contentEditable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    mountKeyboardShortcuts(actions);

    press({ key: "v" }, div);

    expect(actions.selectTool).not.toHaveBeenCalled();
  });

  it("una combinación con Ctrl/Cmd no mapeada no llama a ninguna acción ni lanza", () => {
    mountKeyboardShortcuts(actions);
    expect(() => press({ key: "x", ctrlKey: true })).not.toThrow();
    for (const fn of Object.values(actions)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("una tecla sin mapeo no llama a ninguna acción ni lanza", () => {
    mountKeyboardShortcuts(actions);
    expect(() => press({ key: "q" })).not.toThrow();
    for (const fn of Object.values(actions)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("acepta un target inyectable distinto de window", () => {
    const customTarget = document.createElement("div");
    mountKeyboardShortcuts(actions, { target: customTarget });

    press({ key: "v" }, customTarget);
    expect(actions.selectTool).toHaveBeenCalledOnce();

    press({ key: "t" }, window); // en window no debería dispararse
    expect(actions.textTool).not.toHaveBeenCalled();
  });

  it("destroy() detiene la escucha de eventos", () => {
    const shortcuts = mountKeyboardShortcuts(actions);
    shortcuts.destroy();

    press({ key: "v" });
    expect(actions.selectTool).not.toHaveBeenCalled();
  });
});
