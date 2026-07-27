import type { ProductManifest } from "@impulso/commercial-schema";

/**
 * Primera experiencia del comprador (Fase 4.2, sección 12) — bienvenida
 * breve y cerrable, nunca un onboarding largo. Se muestra UNA vez por
 * navegador/instalación (preferencia en `localStorage`, separado por
 * completo de IndexedDB/`ProjectStore` — perderla en el peor caso solo
 * significa volver a ver la bienvenida, nunca perder un proyecto).
 */
const WELCOME_SEEN_KEY = "impulso:welcome-seen:v1";

export function hasSeenWelcome(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    // Storage bloqueado/inaccesible (modo privado estricto, política del
    // navegador) — degradar mostrando la bienvenida cada vez, nunca
    // lanzar. No es un caso que valga la pena resolver más a fondo en V1.
    return false;
  }
}

export function markWelcomeSeen(storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    // Igual que arriba — si no se puede persistir, simplemente reaparece
    // la próxima vez; no es un error que deba interrumpir al usuario.
  }
}

export interface WelcomeDialog {
  /** Muestra la bienvenida si no se vio antes en este navegador. No hace
   * nada (incluido no tocar el DOM) si ya se vio. */
  showIfFirstRun(): void;
  destroy(): void;
}

export interface MountWelcomeDialogOptions {
  manifest: ProductManifest | null;
  storage?: Storage;
}

export function mountWelcomeDialog(container: HTMLElement, options: MountWelcomeDialogOptions): WelcomeDialog {
  const storage = options.storage ?? window.localStorage;
  const titleId = "welcome-dialog-title";

  const overlay = document.createElement("div");
  overlay.className = "welcome-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "welcome-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.id = titleId;
  title.tabIndex = -1;
  const displayName = options.manifest?.branding.displayName ?? "THÖREN Sticker Builder";
  const version = options.manifest?.productVersion;
  title.textContent = version ? `Bienvenido a ${displayName} (v${version})` : `Bienvenido a ${displayName}`;
  dialog.appendChild(title);

  const body = document.createElement("div");
  body.className = "welcome-dialog-body";
  body.innerHTML = `
    <p>Diseña stickers y expórtalos listos para imprenta: PNG/SVG para pantalla, o PDF profesional con sangrado, marcas de corte e imposición en hoja.</p>
    <p><strong>Para empezar:</strong> crea un proyecto nuevo o abre una plantilla desde "Mis proyectos". Tu trabajo se guarda automáticamente.</p>
    <p><strong>Para exportar:</strong> usa "Exportar" (PNG/SVG rápido) o "Exportar para impresión" (flujo completo de producción).</p>
  `;
  dialog.appendChild(body);

  if (options.manifest?.support.email) {
    const support = document.createElement("p");
    support.className = "welcome-dialog-support";
    support.textContent = `¿Dudas o problemas? Escribe a ${options.manifest.support.email}.`;
    dialog.appendChild(support);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "welcome-dialog-close";
  closeButton.textContent = "Comenzar";
  dialog.appendChild(closeButton);

  container.appendChild(overlay);

  let previouslyFocused: HTMLElement | null = null;

  function close(): void {
    overlay.style.display = "none";
    markWelcomeSeen(storage);
    document.removeEventListener("keydown", handleKeydown);
    if (previouslyFocused) previouslyFocused.focus();
  }

  function handleKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      evt.preventDefault();
      close();
      return;
    }
    // Único elemento realmente enfocable además del título (tabIndex=-1,
    // solo para el foco inicial/anuncio) — Tab/Shift+Tab siempre vuelven
    // al botón "Comenzar", nunca escapan del diálogo.
    if (evt.key === "Tab") {
      evt.preventDefault();
      closeButton.focus();
    }
  }

  closeButton.addEventListener("click", close);

  return {
    showIfFirstRun(): void {
      if (hasSeenWelcome(storage)) return;
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      overlay.style.display = "";
      document.addEventListener("keydown", handleKeydown);
      title.focus();
    },
    destroy(): void {
      document.removeEventListener("keydown", handleKeydown);
      overlay.remove();
    },
  };
}
