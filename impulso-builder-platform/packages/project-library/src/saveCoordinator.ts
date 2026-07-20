import type { Project } from "@impulso/document-schema";

/**
 * Epic 8 — Autosave, Recovery & Project Safety. Coordina TODA la escritura
 * de un `Project` (autosave con debounce + guardado manual) detrás de una
 * sola pieza explícita y testeable — ningún listener ad hoc disperso en la
 * app decide por su cuenta cuándo guardar.
 *
 * Modelo de revisión: un contador monotónico de SESIÓN (`revision`), nunca
 * `document.documentVersion` — ese número puede bajar tras un `undo`
 * (Fase 7.2), y este módulo necesita una comparación "¿es esto más nuevo
 * que lo último persistido?" que nunca dé ambigüedad. `notifyChange()` se
 * llama una vez por cada evento `projectChanged` real del Engine (comando,
 * `dispatchBatch`, `undo`, `redo` — todos lo emiten de forma idéntica); la
 * selección, el zoom/pan, Smart Guides, Rulers, el indicador de puntero y
 * cualquier preview cancelado nunca pasan por `dispatch`, así que
 * estructuralmente nunca llegan a ensuciar el estado (ver ADR de esta
 * Epic).
 */

export interface SaveOutcome {
  ok: boolean;
  error?: Error;
}

export type SaveStatus = "clean" | "dirty" | "saving" | "error" | "recovered";

export interface SaveState {
  status: SaveStatus;
  /** Presente solo cuando `status === "error"` — ya traducido a lenguaje de
   * usuario, nunca un stack trace ni el nombre técnico de la excepción. */
  message?: string;
  /** ISO timestamp del último guardado exitoso — presente en `"clean"`
   * (y se conserva en `"dirty"`/`"saving"`/`"error"` como "última vez que
   * SÍ se guardó", útil si la UI quiere mostrarlo). */
  savedAt?: string;
}

export interface ProjectSaveCoordinatorOptions {
  /** Persiste el `Project` (y cualquier efecto secundario que la app
   * decida, ej. thumbnail + recovery) — inyectado por la app; este módulo
   * no sabe nada de `ProjectStore` ni de Export Engine. */
  persist: (project: Project) => Promise<void>;
  /** Siempre debe devolver el `Project` MÁS RECIENTE disponible en el
   * instante en que se llama — nunca un snapshot capturado antes. Es lo
   * que permite que un `dragmove`/edición ocurrida DURANTE el debounce (o
   * durante un guardado en curso) quede incluida en el próximo intento sin
   * que este módulo tenga que rastrear el `Project` por sí mismo. */
  getProject: () => Project;
  /** ms de debounce tras un cambio antes de autosavear. Default 1200 — ver
   * ADR de esta Epic para la justificación completa (pausa natural tras
   * una ráfaga de ediciones, sin sentirse "no automático"; más cerca de
   * 1500 que de 800 porque el guardado incluye regenerar el thumbnail). */
  debounceMs?: number;
  /** Reloj inyectable para tests determinísticos — por defecto `Date.now`. */
  clock?: () => number;
  /** `"clean"` (default) para un Project ya persistido que se abre tal
   * cual (apertura de Project existente); `"dirty"` para un Project que
   * todavía NO existe en el store (nuevo, o creado desde un Template —
   * ver sección 3 del enunciado de producto: ambos casos deben
   * considerarse con cambios pendientes desde el primer instante, para que
   * el primer autosave los persista y escriba su primer recovery). */
  initialStatus?: "clean" | "dirty";
  /**
   * Epic 8, sección 10: escritura de recovery independiente del guardado
   * principal, con su PROPIO debounce más corto (`recoveryDebounceMs`) —
   * nunca incluye thumbnail ni pasa por `persist`, así que puede
   * ejecutarse mucho más seguido sin el costo de este último. Sin esto,
   * habría una ventana real (todo el `debounceMs` del guardado principal)
   * en la que una edición recién hecha no estaría ni guardada NI
   * recuperable — justo el caso que un cierre inesperado segundos después
   * de escribir algo dejaría sin red de seguridad. Opcional: si se omite,
   * este coordinator no escribe ningún recovery por su cuenta (compatible
   * con tests que no lo necesitan). Nunca limpia el recovery — eso sigue
   * siendo responsabilidad exclusiva de un guardado principal exitoso (ver
   * `persist`/`app.ts`), nunca de este camino, que es puramente aditivo.
   */
  persistRecovery?: (project: Project) => Promise<void>;
  /** ms de debounce para `persistRecovery`. Default 400 — deliberadamente
   * más corto que `debounceMs` (sección 10: "distinta/más frecuente"),
   * pero no cero: sigue coalesciendo una ráfaga rápida (ej. nudge repetido
   * con flechas, o tipeo) en una sola escritura en vez de una por cambio. */
  recoveryDebounceMs?: number;
}

export interface ProjectSaveCoordinator {
  /** Se llama una vez por cada cambio de contenido real (ver el listener
   * de `projectChanged` en `app.ts`) — nunca por cambios efímeros. */
  notifyChange(): void;
  /**
   * Guardado inmediato: cancela/absorbe cualquier debounce pendiente,
   * espera cualquier guardado ya en curso (nunca dos escrituras
   * concurrentes), y si sigue habiendo cambios sin persistir, ejecuta un
   * guardado ahora mismo. Usado tanto por "Guardar" manual como por el
   * flush al salir del editor. Si no hay nada que guardar, resuelve
   * `{ ok: true }` sin tocar el store.
   */
  flush(): Promise<SaveOutcome>;
  getState(): SaveState;
  subscribe(listener: (state: SaveState) => void): () => void;
  /** Transición explícita a `"recovered"` — la UI la usa justo después de
   * aceptar un snapshot de recovery, antes de que cualquier cambio o
   * guardado real vuelva a decidir el estado normalmente. */
  markRecovered(): void;
  /** Cancela el timer de debounce pendiente y libera los listeners. NO
   * intenta guardar — quien llama debe invocar `flush()` antes si quiere
   * garantizar persistencia (ver "Salir del editor", sección 8). */
  destroy(): void;
}

const DEFAULT_DEBOUNCE_MS = 1200;
const DEFAULT_RECOVERY_DEBOUNCE_MS = 400;

/** Traduce el error técnico a un mensaje que un usuario no técnico pueda
 * actuar — nunca el nombre de la excepción ni un stack trace (sección 12
 * del enunciado de producto). */
function toUserMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === "QuotaExceededError") {
    return "No hay espacio suficiente para guardar. Libera espacio o exporta tu proyecto como respaldo.";
  }
  return "No se pudo guardar el proyecto. Intenta de nuevo.";
}

export function createProjectSaveCoordinator(options: ProjectSaveCoordinatorOptions): ProjectSaveCoordinator {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const recoveryDebounceMs = options.recoveryDebounceMs ?? DEFAULT_RECOVERY_DEBOUNCE_MS;
  const clock = options.clock ?? (() => Date.now());

  let revision = 0;
  let persistedRevision = options.initialStatus === "dirty" ? -1 : 0;
  let lastSavedAt: string | undefined;
  let state: SaveState = { status: persistedRevision === revision ? "clean" : "dirty" };
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let recoveryDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlightSave: Promise<SaveOutcome> | undefined;
  let rerunRequested = false;
  let destroyed = false;
  const listeners = new Set<(state: SaveState) => void>();

  function setState(next: SaveState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  function clearDebounceTimer(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
  }

  function scheduleDebounced(): void {
    clearDebounceTimer();
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      if (revision === persistedRevision) return; // nada que guardar (no debería pasar, defensivo)
      void startSave();
    }, debounceMs);
  }

  function clearRecoveryDebounceTimer(): void {
    if (recoveryDebounceTimer) {
      clearTimeout(recoveryDebounceTimer);
      recoveryDebounceTimer = undefined;
    }
  }

  /** Camino aditivo e independiente del guardado principal (sección 10) —
   * nunca cambia `state`, nunca marca error, nunca reintenta: es
   * puramente una red de seguridad best-effort, así que un fallo aquí solo
   * se registra. Nunca hay dos escrituras de recovery en vuelo pisándose
   * de forma dañina porque cada una siempre escribe la entrada MÁS
   * reciente (`getProject()` al momento de ejecutarse), nunca una
   * acumulación. */
  function scheduleRecoveryDebounced(): void {
    if (!options.persistRecovery) return;
    clearRecoveryDebounceTimer();
    recoveryDebounceTimer = setTimeout(() => {
      recoveryDebounceTimer = undefined;
      options.persistRecovery!(options.getProject()).catch((error: unknown) => {
        console.error("[ProjectSaveCoordinator] No se pudo escribir el recovery rápido:", error);
      });
    }, recoveryDebounceMs);
  }

  /** Único punto que ejecuta `persist()` — nunca hay dos invocaciones en
   * vuelo a la vez (`inFlightSave` lo garantiza). */
  async function runSave(): Promise<SaveOutcome> {
    const targetRevision = revision;
    setState({ status: "saving", savedAt: lastSavedAt });
    try {
      const project = options.getProject();
      await options.persist(project);
      persistedRevision = targetRevision;
      lastSavedAt = new Date(clock()).toISOString();
      if (rerunRequested || revision !== persistedRevision) {
        // Cambió de nuevo mientras este guardado estaba en curso — se
        // consolida en un ciclo de autosave normal (debounced), nunca se
        // muestra "Guardado" todavía (sigue habiendo una revisión más
        // nueva sin persistir).
        rerunRequested = false;
        scheduleDebounced();
        setState({ status: "dirty", savedAt: lastSavedAt });
      } else {
        setState({ status: "clean", savedAt: lastSavedAt });
      }
      return { ok: true };
    } catch (error) {
      rerunRequested = false;
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[ProjectSaveCoordinator] El guardado falló:", err);
      setState({ status: "error", message: toUserMessage(error), savedAt: lastSavedAt });
      return { ok: false, error: err };
    }
  }

  function startSave(): Promise<SaveOutcome> {
    if (inFlightSave) return inFlightSave;
    const promise = runSave().finally(() => {
      inFlightSave = undefined;
    });
    inFlightSave = promise;
    return promise;
  }

  function notifyChange(): void {
    if (destroyed) return;
    revision += 1;
    scheduleRecoveryDebounced();
    if (inFlightSave) {
      // El guardado en curso ya está persistiendo una revisión más vieja
      // — se pide un ciclo extra al terminar, sin mostrar "dirty" todavía
      // (evita el parpadeo saving->dirty->saving de una ráfaga rápida).
      rerunRequested = true;
      return;
    }
    setState({ status: "dirty", savedAt: lastSavedAt });
    scheduleDebounced();
  }

  async function flush(): Promise<SaveOutcome> {
    if (destroyed) return { ok: false, error: new Error("El coordinator ya fue destruido.") };
    clearDebounceTimer();
    // El guardado forzado ya deja al recovery en su estado correcto (lo
    // escribe y, si tiene éxito, lo limpia — ver `persist`/`app.ts`): el
    // camino rápido independiente queda redundante, y dejarlo pendiente
    // resucitaría una entrada de recovery después de un flush exitoso.
    clearRecoveryDebounceTimer();
    if (inFlightSave) {
      await inFlightSave;
    }
    clearDebounceTimer(); // el guardado recién terminado pudo haber programado un ciclo más — flush() actúa YA, no espera ese debounce.
    if (revision === persistedRevision) {
      return { ok: true };
    }
    rerunRequested = false;
    return startSave();
  }

  // `initialStatus: "dirty"` (Project nuevo/desde Template, ver la opción)
  // ya empieza con una revisión pendiente de persistir — programa su
  // primer autosave de inmediato, igual que si `notifyChange()` ya
  // hubiera corrido una vez.
  if (revision !== persistedRevision) {
    scheduleDebounced();
    scheduleRecoveryDebounced();
  }

  return {
    notifyChange,
    flush,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    markRecovered() {
      setState({ status: "recovered", savedAt: lastSavedAt });
    },
    destroy() {
      destroyed = true;
      clearDebounceTimer();
      clearRecoveryDebounceTimer();
      listeners.clear();
    },
  };
}
