import type { ObjectId, Project } from "@impulso/document-schema";
import type { EngineError } from "../errors/engineError.js";
import type { ContentCommand, EngineCommand } from "../commands/command.js";

/**
 * Qué causó un cambio de estado: un comando concreto, un batch (Epic 7 /
 * Fase 7.2 — ver `dispatchBatch`), o una operación de undo/redo (que no son
 * "comandos" dispatchables — son métodos propios del Engine sobre su pila
 * de historial en memoria).
 */
export type EngineChangeCause =
  | { type: "command"; command: EngineCommand }
  | { type: "batch"; commands: readonly ContentCommand[]; label?: string }
  | { type: "undo" }
  | { type: "redo" };

/**
 * Eventos que el Engine emite tras cada operación. Este es el mecanismo por
 * el que un futuro Renderer (u otro suscriptor) se entera de los cambios
 * SIN que el Engine conozca su existencia — el Engine emite hacia afuera,
 * nunca llama hacia un Renderer concreto (ver ARCHITECTURE.md, Document
 * Schema -> Engine -> Renderer).
 */
export type EngineEvent =
  | { type: "projectChanged"; project: Project; cause: EngineChangeCause }
  | { type: "selectionChanged"; selection: readonly ObjectId[] }
  | { type: "historyChanged"; canUndo: boolean; canRedo: boolean }
  | { type: "commandRejected"; command: EngineCommand; error: EngineError }
  /** Rechazo de un `dispatchBatch` completo — no se puede señalar "el
   * comando culpable" de forma útil para quien escucha (el batch entero se
   * descarta atómicamente), así que se reporta la lista completa que se
   * intentó aplicar junto con el error concreto que lo detuvo. */
  | { type: "batchRejected"; commands: readonly ContentCommand[]; error: EngineError };
