import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectSaveCoordinator, type SaveState } from "./saveCoordinator.js";
import { buildWorkspaceProject } from "./testUtils/fixtures.js";

const PROJECT_A = buildWorkspaceProject("project_1");

/** Promise controlable manualmente — para simular un guardado que tarda
 * (races) sin depender de temporizadores reales. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createProjectSaveCoordinator — estado inicial", () => {
  it("por defecto (initialStatus omitido) empieza \"clean\"", () => {
    const coordinator = createProjectSaveCoordinator({ persist: vi.fn(), getProject: () => PROJECT_A });
    expect(coordinator.getState()).toEqual({ status: "clean" });
  });

  it("initialStatus: \"dirty\" (Project nuevo/desde Template) empieza sucio y programa autosave", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, initialStatus: "dirty", debounceMs: 500 });
    expect(coordinator.getState().status).toBe("dirty");

    await vi.advanceTimersByTimeAsync(500);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe("createProjectSaveCoordinator — dirty-state y debounce", () => {
  it("notifyChange() marca dirty inmediatamente, sin llamar a persist antes del debounce", () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 1000 });

    coordinator.notifyChange();
    expect(coordinator.getState().status).toBe("dirty");
    expect(persist).not.toHaveBeenCalled();
  });

  it("tras el debounce completo, autosavea y pasa a \"clean\"", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 1000 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("clean");
    expect(coordinator.getState().savedAt).toBeDefined();
  });

  it("múltiples notifyChange() seguidos consolidan en UN solo guardado (reinicia el debounce cada vez)", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 1000 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(600);
    coordinator.notifyChange(); // reinicia el debounce antes de que el primero dispare
    await vi.advanceTimersByTimeAsync(600);
    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("cero cambios nunca dispara un guardado", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 1000 });

    await vi.advanceTimersByTimeAsync(5000);
    expect(persist).not.toHaveBeenCalled();
  });

  it("getProject() se lee en el momento de EJECUTAR el guardado, no al programarlo", async () => {
    let currentProject = PROJECT_A;
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => currentProject, debounceMs: 1000 });

    coordinator.notifyChange();
    currentProject = { ...PROJECT_A, metadata: { ...PROJECT_A.metadata, name: "Cambiado antes de que dispare" } };
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ name: "Cambiado antes de que dispare" }) }));
  });
});

describe("createProjectSaveCoordinator — Caso A: cambio durante un guardado en curso", () => {
  it("un cambio que llega mientras el guardado A está en curso nunca muestra \"clean\" hasta que B también se persista", async () => {
    const save = deferred<void>();
    const persist = vi.fn().mockReturnValueOnce(save.promise).mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange(); // A
    await vi.advanceTimersByTimeAsync(100);
    expect(coordinator.getState().status).toBe("saving");

    coordinator.notifyChange(); // B, llega MIENTRAS A sigue en vuelo
    expect(coordinator.getState().status).toBe("saving"); // sigue mostrando "saving", no "dirty" (evita parpadeo)

    save.resolve(); // termina A
    await Promise.resolve();
    await Promise.resolve();
    // A terminó pero B sigue pendiente — NUNCA debe mostrar "clean" todavía.
    expect(coordinator.getState().status).toBe("dirty");
    expect(persist).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100); // debounce de B
    expect(persist).toHaveBeenCalledTimes(2);
    expect(coordinator.getState().status).toBe("clean");
  });
});

describe("createProjectSaveCoordinator — Caso B/D: guardado manual absorbe el debounce, nunca dos escrituras concurrentes", () => {
  it("flush() con un autosave pendiente lo absorbe y persiste inmediatamente, una sola vez", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 5000 });

    coordinator.notifyChange();
    const outcome = await coordinator.flush();

    expect(outcome.ok).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("clean");

    // El debounce original de 5000ms nunca debe disparar un SEGUNDO guardado.
    await vi.advanceTimersByTimeAsync(5000);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("flush() sin ningún cambio pendiente no dispara ninguna escritura", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A });

    const outcome = await coordinator.flush();

    expect(outcome).toEqual({ ok: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it("flush() mientras un guardado YA está en curso espera a que termine y evalúa la revisión más reciente", async () => {
    const save = deferred<void>();
    const persist = vi.fn().mockReturnValueOnce(save.promise).mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100); // arranca el guardado A
    expect(coordinator.getState().status).toBe("saving");

    const flushPromise = coordinator.flush(); // debería esperar a A, sin iniciar una segunda escritura concurrente
    expect(persist).toHaveBeenCalledTimes(1); // todavía no una segunda llamada

    save.resolve();
    await flushPromise;

    expect(persist).toHaveBeenCalledTimes(1); // A ya cubrió la única revisión pendiente — flush no necesitó una segunda escritura
  });

  it("solo la revisión MÁS NUEVA queda marcada como persistida cuando compiten autosave y manual", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 1000 });

    coordinator.notifyChange();
    await coordinator.flush();
    coordinator.notifyChange(); // un cambio DESPUÉS del flush también debe quedar dirty
    expect(coordinator.getState().status).toBe("dirty");
  });
});

describe("createProjectSaveCoordinator — guardado fallido y reintento", () => {
  it("un guardado fallido pasa a \"error\", conserva el dirty-state, y NO limpia el mensaje hasta el próximo intento", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);

    const state = coordinator.getState();
    expect(state.status).toBe("error");
    expect(state.message).toBeTruthy();
    expect(state.message).not.toMatch(/Error: boom/); // nunca el mensaje técnico crudo
  });

  it("flush() tras un error reintenta y, si tiene éxito, pasa a \"clean\"", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);
    expect(coordinator.getState().status).toBe("error");

    const outcome = await coordinator.flush();

    expect(outcome.ok).toBe(true);
    expect(coordinator.getState().status).toBe("clean");
  });

  it("cuota agotada (QuotaExceededError) produce un mensaje accionable específico", async () => {
    const quotaError = new DOMException("mock", "QuotaExceededError");
    const persist = vi.fn().mockRejectedValueOnce(quotaError);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);

    expect(coordinator.getState().message).toMatch(/espacio/i);
  });

  it("un guardado fallido nunca entra en loop infinito de reintento automático", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("siempre falla"));
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);
    expect(persist).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000); // ningún timer propio debería seguir reintentando solo
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe("createProjectSaveCoordinator — subscribe/destroy", () => {
  it("subscribe() recibe cada transición de estado; el unsubscribe detiene las notificaciones", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });
    const seen: SaveState[] = [];
    const unsubscribe = coordinator.subscribe((state) => seen.push(state));

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);
    unsubscribe();
    coordinator.notifyChange();

    expect(seen.map((s) => s.status)).toEqual(["dirty", "saving", "clean"]);
  });

  it("markRecovered() transiciona a \"recovered\"; el próximo cambio real vuelve a decidir el estado normalmente", () => {
    const coordinator = createProjectSaveCoordinator({ persist: vi.fn(), getProject: () => PROJECT_A });

    coordinator.markRecovered();
    expect(coordinator.getState().status).toBe("recovered");

    coordinator.notifyChange();
    expect(coordinator.getState().status).toBe("dirty");
  });

  it("destroy() cancela el timer de debounce pendiente — notifyChange() posterior es un no-op", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    coordinator.destroy();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).not.toHaveBeenCalled();
  });

  it("destroy() libera los listeners — ninguno vuelve a ser notificado", () => {
    const coordinator = createProjectSaveCoordinator({ persist: vi.fn(), getProject: () => PROJECT_A });
    const listener = vi.fn();
    coordinator.subscribe(listener);

    coordinator.destroy();
    coordinator.notifyChange();

    expect(listener).not.toHaveBeenCalled();
  });
});

// Epic 8, sección 10: la escritura de recovery debe poder ser MÁS
// frecuente que el guardado principal — sin esto, hay una ventana real
// (todo el `debounceMs` del guardado principal, 1200ms por defecto) en la
// que una edición recién hecha no está ni guardada NI recuperable.
describe("createProjectSaveCoordinator — recovery rápido e independiente del guardado principal", () => {
  it("escribe el recovery con SU PROPIO debounce, más corto que el del guardado principal", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const persistRecovery = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({
      persist,
      persistRecovery,
      getProject: () => PROJECT_A,
      debounceMs: 1200,
      recoveryDebounceMs: 400,
    });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(400);

    expect(persistRecovery).toHaveBeenCalledTimes(1);
    expect(persistRecovery).toHaveBeenCalledWith(PROJECT_A);
    expect(persist).not.toHaveBeenCalled(); // el guardado principal (1200ms) todavía no debería haber corrido

    await vi.advanceTimersByTimeAsync(800);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("una ráfaga de cambios rápidos consolida el recovery en una sola escritura, no una por cambio", async () => {
    const persistRecovery = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({
      persist: vi.fn().mockResolvedValue(undefined),
      persistRecovery,
      getProject: () => PROJECT_A,
      recoveryDebounceMs: 400,
    });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);
    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(100);
    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(400);

    expect(persistRecovery).toHaveBeenCalledTimes(1);
  });

  it("sin `persistRecovery` inyectado, el coordinator nunca intenta escribir un recovery propio", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({ persist, getProject: () => PROJECT_A, debounceMs: 100 });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persist).toHaveBeenCalledTimes(1); // el guardado principal sigue funcionando con normalidad
  });

  it("un fallo escribiendo el recovery rápido se registra pero nunca cambia el estado visible ni bloquea el guardado principal", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const persistRecovery = vi.fn().mockRejectedValue(new Error("recovery store roto"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const coordinator = createProjectSaveCoordinator({
      persist,
      persistRecovery,
      getProject: () => PROJECT_A,
      debounceMs: 1200,
      recoveryDebounceMs: 400,
    });

    coordinator.notifyChange();
    await vi.advanceTimersByTimeAsync(400);
    expect(coordinator.getState().status).toBe("dirty"); // nunca "error" — el recovery es puramente aditivo

    await vi.advanceTimersByTimeAsync(800);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("clean");
    consoleError.mockRestore();
  });

  it("flush() cancela el recovery rápido pendiente — no resucita una entrada después de un guardado forzado exitoso", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const persistRecovery = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({
      persist,
      persistRecovery,
      getProject: () => PROJECT_A,
      debounceMs: 1200,
      recoveryDebounceMs: 400,
    });

    coordinator.notifyChange();
    await coordinator.flush();
    persistRecovery.mockClear();

    await vi.advanceTimersByTimeAsync(2000);

    expect(persistRecovery).not.toHaveBeenCalled();
  });

  it("destroy() cancela el timer de recovery rápido pendiente", async () => {
    const persistRecovery = vi.fn().mockResolvedValue(undefined);
    const coordinator = createProjectSaveCoordinator({
      persist: vi.fn().mockResolvedValue(undefined),
      persistRecovery,
      getProject: () => PROJECT_A,
      recoveryDebounceMs: 400,
    });

    coordinator.notifyChange();
    coordinator.destroy();
    await vi.advanceTimersByTimeAsync(1000);

    expect(persistRecovery).not.toHaveBeenCalled();
  });

  it("`initialStatus: \"dirty\"` (Project nuevo) programa también su primer recovery rápido de inmediato", async () => {
    const persistRecovery = vi.fn().mockResolvedValue(undefined);
    createProjectSaveCoordinator({
      persist: vi.fn().mockResolvedValue(undefined),
      persistRecovery,
      getProject: () => PROJECT_A,
      initialStatus: "dirty",
      recoveryDebounceMs: 400,
    });

    await vi.advanceTimersByTimeAsync(400);

    expect(persistRecovery).toHaveBeenCalledTimes(1);
  });
});
