import { ProjectSchema, type Project, type ObjectId } from "@impulso/document-schema";
import { EngineCommandSchema, isSelectionCommand, type ContentCommand, type EngineCommand } from "./commands/command.js";
import { applyContentCommand, applyContentCommandBatch } from "./commands/applyCommand.js";
import { applySelectionCommand, pruneSelection } from "./commands/selectionCommands.js";
import { findObjectInDocument } from "./tree/objectTree.js";
import { engineError, type EngineResult } from "./errors/engineError.js";
import { createEventEmitter, type Unsubscribe } from "./events/eventEmitter.js";
import type { EngineEvent } from "./events/engineEvent.js";
import { createIncrementingIdGenerator } from "./history/idGenerator.js";

const DEFAULT_HISTORY_LIMIT = 100;

export interface CreateEngineOptions {
  /** Provee el timestamp usado para `updatedAt`/`createdAt` de History. Por
   * defecto `() => new Date().toISOString()`; inyectable para tests
   * determinísticos y para que los reducers sigan siendo funciones puras. */
  clock?: () => string;
  /** Genera el `id` de cada `HistoryEntry`. Por defecto un contador
   * incremental — ver history/idGenerator.ts. */
  historyEntryIdGenerator?: () => string;
  /** Cuántos estados anteriores conservar para undo. Por defecto 100. */
  historyLimit?: number;
}

export interface DispatchBatchMetadata {
  /** Etiqueta legible para la única entrada de historial que produce el
   * batch (ej. "Alinear a la izquierda"). Si se omite, se genera
   * describiendo los comandos — ver `describeBatch` en `applyCommand.ts`.
   * Deliberadamente sin más campos: esta fase no es un sistema de
   * analytics, solo una etiqueta para historial/depuración. */
  label?: string;
}

export interface Engine {
  /** Snapshot inmutable del Project actual. */
  getProject(): Project;
  /** IDs de Object actualmente seleccionados (estado de sesión, no persistido). */
  getSelection(): readonly ObjectId[];
  /** Aplica un comando. Nunca lanza: los fallos esperados vuelven como `{ ok: false, error }`. */
  dispatch(command: EngineCommand): EngineResult<Project>;
  /**
   * Aplica N `ContentCommand` como una única transacción lógica (Epic 7 /
   * Fase 7.2): una sola entrada de historial, un solo `Ctrl/Cmd+Z` revierte
   * todo el batch, un solo Redo lo restaura completo. Atómico — si
   * cualquier comando falla, ningún cambio del batch se aplica. No admite
   * comandos de selección (nunca participaron de historial/undo). Un
   * batch vacío es un no-op explícito: no cambia nada, no agrega historial.
   * Reutilizable por Alignment/Distribution (ver `geometry/alignment.ts`)
   * y cualquier operación futura sobre múltiples objects.
   */
  dispatchBatch(commands: readonly ContentCommand[], metadata?: DispatchBatchMetadata): EngineResult<Project>;
  undo(): EngineResult<Project>;
  redo(): EngineResult<Project>;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Se notifica tras cada dispatch/undo/redo exitoso o rechazado. */
  subscribe(listener: (event: EngineEvent) => void): Unsubscribe;
}

/**
 * Punto de entrada del paquete. Se usa una función factoría (no una clase)
 * que devuelve un objeto respaldado por closures: el estado mutable
 * (`project`, `selection`, las pilas de undo/redo) queda encapsulado y solo
 * es alcanzable a través de los métodos expuestos — nunca mutable
 * directamente desde afuera. Los reducers que hacen el trabajo real
 * (`commands/*Commands.ts`) siguen siendo funciones puras; esta función es
 * la única pieza con estado, y es deliberadamente delgada.
 */
export function createEngine(initialProject: Project, options: CreateEngineOptions = {}): Engine {
  // Única excepción a "nunca lanza": construir el Engine con un Project
  // inválido es un error de programación, no un caso de uso esperado.
  let project = ProjectSchema.parse(initialProject);
  let selection: readonly ObjectId[] = [];
  const undoStack: Project[] = [];
  const redoStack: Project[] = [];

  const clock = options.clock ?? (() => new Date().toISOString());
  const generateHistoryEntryId = options.historyEntryIdGenerator ?? createIncrementingIdGenerator("history");
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;

  const emitter = createEventEmitter<EngineEvent>();

  function emitHistoryChanged(): void {
    emitter.emit({ type: "historyChanged", canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  }

  /** Quita de la selección cualquier objectId que el nuevo Project ya no contenga. */
  function syncSelectionWith(nextProject: Project): void {
    const pruned = pruneSelection(
      selection,
      (objectId) => findObjectInDocument(nextProject.document, objectId) !== undefined,
    );
    if (pruned !== selection) {
      selection = pruned;
      emitter.emit({ type: "selectionChanged", selection });
    }
  }

  function dispatch(command: EngineCommand): EngineResult<Project> {
    const parsed = EngineCommandSchema.safeParse(command);
    if (!parsed.success) {
      const error = engineError("invalid_command", parsed.error.message);
      emitter.emit({ type: "commandRejected", command, error });
      return { ok: false, error };
    }
    const validCommand = parsed.data;

    if (isSelectionCommand(validCommand)) {
      selection = applySelectionCommand(selection, validCommand);
      emitter.emit({ type: "selectionChanged", selection });
      return { ok: true, value: project };
    }

    const result = applyContentCommand(project, validCommand, { now: clock(), generateHistoryEntryId });
    if (!result.ok) {
      emitter.emit({ type: "commandRejected", command: validCommand, error: result.error });
      return result;
    }

    undoStack.push(project);
    if (undoStack.length > historyLimit) undoStack.shift();
    redoStack.length = 0;
    project = result.value;

    syncSelectionWith(project);
    emitter.emit({ type: "projectChanged", project, cause: { type: "command", command: validCommand } });
    emitHistoryChanged();

    return { ok: true, value: project };
  }

  function dispatchBatch(
    commands: readonly ContentCommand[],
    metadata: DispatchBatchMetadata = {},
  ): EngineResult<Project> {
    if (commands.length === 0) return { ok: true, value: project };

    const parsedCommands: ContentCommand[] = [];
    for (const command of commands) {
      const parsed = EngineCommandSchema.safeParse(command);
      if (!parsed.success) {
        const error = engineError("invalid_command", parsed.error.message);
        emitter.emit({ type: "batchRejected", commands, error });
        return { ok: false, error };
      }
      if (isSelectionCommand(parsed.data)) {
        const error = engineError(
          "invalid_command",
          "dispatchBatch no admite comandos de selección (no participan de historial/undo).",
        );
        emitter.emit({ type: "batchRejected", commands, error });
        return { ok: false, error };
      }
      parsedCommands.push(parsed.data);
    }

    const result = applyContentCommandBatch(project, parsedCommands, {
      now: clock(),
      generateHistoryEntryId,
      label: metadata.label,
    });
    if (!result.ok) {
      emitter.emit({ type: "batchRejected", commands, error: result.error });
      return result;
    }

    undoStack.push(project);
    if (undoStack.length > historyLimit) undoStack.shift();
    redoStack.length = 0;
    project = result.value;

    syncSelectionWith(project);
    emitter.emit({
      type: "projectChanged",
      project,
      cause: { type: "batch", commands: parsedCommands, label: metadata.label },
    });
    emitHistoryChanged();

    return { ok: true, value: project };
  }

  function undo(): EngineResult<Project> {
    const previous = undoStack.pop();
    if (!previous) {
      return { ok: false, error: engineError("nothing_to_undo", "No hay cambios para deshacer.") };
    }
    redoStack.push(project);
    project = previous;
    syncSelectionWith(project);
    emitter.emit({ type: "projectChanged", project, cause: { type: "undo" } });
    emitHistoryChanged();
    return { ok: true, value: project };
  }

  function redo(): EngineResult<Project> {
    const next = redoStack.pop();
    if (!next) {
      return { ok: false, error: engineError("nothing_to_redo", "No hay cambios para rehacer.") };
    }
    undoStack.push(project);
    project = next;
    syncSelectionWith(project);
    emitter.emit({ type: "projectChanged", project, cause: { type: "redo" } });
    emitHistoryChanged();
    return { ok: true, value: project };
  }

  return {
    getProject: () => project,
    getSelection: () => selection,
    dispatch,
    dispatchBatch,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    subscribe: emitter.subscribe,
  };
}
