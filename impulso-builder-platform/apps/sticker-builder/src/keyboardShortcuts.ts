/**
 * Mapa de atajos de teclado -> acciones, desacoplado del Engine: no
 * dispatcha comandos directamente, solo traduce el evento de teclado a una
 * llamada sobre `KeyboardShortcutActions` (que `app.ts` implementa con la
 * lógica real de Engine/Renderer). Esto permite testear el mapa completo
 * de atajos sin construir un Project/Engine real — ver ADR-0010.
 */
export interface KeyboardShortcutActions {
  selectTool(): void;
  textTool(): void;
  imageTool(): void;
  deleteSelected(): void;
  duplicateSelected(): void;
  groupSelected(): void;
  ungroupSelected(): void;
  undo(): void;
  redo(): void;
  save(): void;
  /** Ctrl/Cmd+O ahora navega a la Workspace ("Mis proyectos") en vez de
   * cargar el slot único legado de `localStorage` (ver ADR-0014) — abrir
   * un proyecto distinto siempre pasa primero por elegir cuál. */
  goToWorkspace(): void;
  selectAll(): void;
  escape(): void;
  nudge(dx: number, dy: number): void;
  bringForward(): void;
  sendBackward(): void;
  /** Epic 7 / Fase 7.3 — Assisted Placement (atajos "G"/"R", sección 11). */
  toggleGrid(): void;
  toggleRulers(): void;
}

export interface MountKeyboardShortcutsOptions {
  /** Inyectable para tests; por defecto `window`. */
  target?: EventTarget;
}

export interface KeyboardShortcuts {
  destroy(): void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  // `isContentEditable` no está implementado en jsdom (siempre `undefined`),
  // así que se revisa también el atributo directamente.
  return target.isContentEditable || target.getAttribute("contenteditable") === "true";
}

function arrowDelta(key: string, step: number): [number, number] | undefined {
  switch (key) {
    case "ArrowUp":
      return [0, -step];
    case "ArrowDown":
      return [0, step];
    case "ArrowLeft":
      return [-step, 0];
    case "ArrowRight":
      return [step, 0];
    default:
      return undefined;
  }
}

/**
 * Instala los atajos globales de la Épica (V/T/I/G/R, Supr/Backspace,
 * Ctrl/Cmd+D/G/Shift+G/Z/Shift+Z/S/O/A, Escape, flechas +/- Shift, Ctrl/Cmd+[/]).
 * "G" (sin Ctrl/Cmd) alterna Grid visible; "R" alterna Rulers — Epic 7 /
 * Fase 7.3 (Assisted Placement). No chocan con Ctrl/Cmd+G (Agrupar) ni
 * Ctrl/Cmd+Shift+G (Desagrupar): esas ramas ya retornan antes de llegar
 * aquí abajo.
 * Ignora por completo cualquier evento cuyo `target` sea un campo editable
 * (input, textarea, contentEditable) — así no compite con el renombrado
 * inline del panel de capas, los campos del Inspector, ni el `<textarea>`
 * de edición de texto in-canvas.
 */
export function mountKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  options: MountKeyboardShortcutsOptions = {},
): KeyboardShortcuts {
  const target = options.target ?? window;

  function handleKeyDown(evt: Event): void {
    const keyboardEvent = evt as KeyboardEvent;
    if (isEditableTarget(keyboardEvent.target)) return;

    const meta = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
    const key = keyboardEvent.key;
    const lower = key.toLowerCase();

    if (meta && lower === "z" && keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      actions.redo();
      return;
    }
    if (meta && lower === "z") {
      keyboardEvent.preventDefault();
      actions.undo();
      return;
    }
    if (meta && lower === "d") {
      keyboardEvent.preventDefault();
      actions.duplicateSelected();
      return;
    }
    if (meta && keyboardEvent.shiftKey && lower === "g") {
      keyboardEvent.preventDefault();
      actions.ungroupSelected();
      return;
    }
    if (meta && lower === "g") {
      keyboardEvent.preventDefault();
      actions.groupSelected();
      return;
    }
    if (meta && lower === "s") {
      keyboardEvent.preventDefault();
      actions.save();
      return;
    }
    if (meta && lower === "o") {
      keyboardEvent.preventDefault();
      actions.goToWorkspace();
      return;
    }
    if (meta && lower === "a") {
      keyboardEvent.preventDefault();
      actions.selectAll();
      return;
    }
    if (meta && key === "]") {
      keyboardEvent.preventDefault();
      actions.bringForward();
      return;
    }
    if (meta && key === "[") {
      keyboardEvent.preventDefault();
      actions.sendBackward();
      return;
    }
    if (meta) return; // ninguna otra combinación con Ctrl/Cmd está mapeada.

    if (key === "Delete" || key === "Backspace") {
      keyboardEvent.preventDefault();
      actions.deleteSelected();
      return;
    }
    if (key === "Escape") {
      actions.escape();
      return;
    }
    if (lower === "v") {
      actions.selectTool();
      return;
    }
    if (lower === "t") {
      actions.textTool();
      return;
    }
    if (lower === "i") {
      actions.imageTool();
      return;
    }
    if (lower === "g") {
      actions.toggleGrid();
      return;
    }
    if (lower === "r") {
      actions.toggleRulers();
      return;
    }

    const delta = arrowDelta(key, keyboardEvent.shiftKey ? 10 : 1);
    if (delta) {
      keyboardEvent.preventDefault();
      actions.nudge(delta[0], delta[1]);
    }
  }

  target.addEventListener("keydown", handleKeyDown);

  return {
    destroy: () => target.removeEventListener("keydown", handleKeyDown),
  };
}
