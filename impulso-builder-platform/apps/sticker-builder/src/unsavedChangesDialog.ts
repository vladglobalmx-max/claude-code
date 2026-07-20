/**
 * Epic 8 — Autosave, Recovery & Project Safety, sección 8 ("Salir del
 * editor"). Reemplaza cualquier `window.confirm()` para el caso en que un
 * flush de guardado falla justo antes de abandonar el editor ("Mis
 * proyectos", abrir/crear otro Project, etc.) — un `window.confirm()` no
 * puede describir el problema, no puede ofrecer "Reintentar" como acción
 * propia, y no es accesible más allá de lo que el navegador decida.
 *
 * A diferencia del resto de los diálogos de esta app (`exportDialog.ts`,
 * `saveAsTemplateDialog.ts`, ninguno de los cuales implementa foco
 * atrapado), este SÍ lo hace — el enunciado de producto de esta épica lo
 * exige explícitamente para este diálogo en particular (sección 19): foco
 * atrapado, foco restaurado al cerrar, operable enteramente por teclado,
 * `role="alertdialog"` con título/descripción propios, y la acción
 * destructiva ("Salir sin guardar") marcada visualmente distinta del resto.
 */
export type UnsavedChangesChoice = "retry" | "stay" | "discard";

export interface UnsavedChangesDialog {
  /** Muestra el diálogo con el mensaje de error dado; resuelve con la
   * acción que el usuario elija. Nunca se cierra sola — solo por una de
   * las 3 acciones. */
  open(message: string): Promise<UnsavedChangesChoice>;
  destroy(): void;
}

export function mountUnsavedChangesDialog(container: HTMLElement): UnsavedChangesDialog {
  const titleId = "unsaved-changes-dialog-title";
  const descriptionId = "unsaved-changes-dialog-description";

  const overlay = document.createElement("div");
  overlay.className = "unsaved-changes-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "unsaved-changes-dialog";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.id = titleId;
  title.textContent = "No se pudieron guardar los cambios";
  dialog.appendChild(title);

  const description = document.createElement("p");
  description.id = descriptionId;
  dialog.appendChild(description);

  const actions = document.createElement("div");
  actions.className = "unsaved-changes-dialog-actions";
  dialog.appendChild(actions);

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "unsaved-changes-dialog-retry";
  retryButton.textContent = "Reintentar";
  actions.appendChild(retryButton);

  const stayButton = document.createElement("button");
  stayButton.type = "button";
  stayButton.className = "unsaved-changes-dialog-stay";
  stayButton.textContent = "Permanecer en el editor";
  actions.appendChild(stayButton);

  const discardButton = document.createElement("button");
  discardButton.type = "button";
  discardButton.className = "unsaved-changes-dialog-discard";
  discardButton.textContent = "Salir sin guardar";
  discardButton.setAttribute("aria-describedby", descriptionId);
  actions.appendChild(discardButton);

  container.appendChild(overlay);

  let previouslyFocused: HTMLElement | null = null;
  let resolveChoice: ((choice: UnsavedChangesChoice) => void) | undefined;

  function focusableElements(): HTMLElement[] {
    return [retryButton, stayButton, discardButton];
  }

  function handleKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      evt.preventDefault();
      settle("stay");
      return;
    }
    if (evt.key !== "Tab") return;
    const elements = focusableElements();
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  }

  function settle(choice: UnsavedChangesChoice): void {
    if (!resolveChoice) return;
    const resolve = resolveChoice;
    resolveChoice = undefined;
    overlay.style.display = "none";
    dialog.removeEventListener("keydown", handleKeydown);
    previouslyFocused?.focus();
    previouslyFocused = null;
    resolve(choice);
  }

  retryButton.addEventListener("click", () => settle("retry"));
  stayButton.addEventListener("click", () => settle("stay"));
  discardButton.addEventListener("click", () => settle("discard"));

  function open(message: string): Promise<UnsavedChangesChoice> {
    description.textContent = message;
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.style.display = "flex";
    dialog.addEventListener("keydown", handleKeydown);
    // "Permanecer en el editor" como foco inicial: es la acción más segura
    // (nunca pierde trabajo) — mismo criterio que un diálogo de
    // confirmación destructiva estándar (el botón no-destructivo recibe
    // el foco por defecto).
    stayButton.focus();
    return new Promise((resolve) => {
      resolveChoice = resolve;
    });
  }

  return {
    open,
    destroy: () => {
      dialog.removeEventListener("keydown", handleKeydown);
      overlay.remove();
    },
  };
}
