import type { ObjectId, Project } from "@impulso/document-schema";
import type { EngineError } from "../errors/engineError.js";
import type { EngineCommand } from "../commands/command.js";

/**
 * Qué causó un cambio de estado: un comando concreto, o una operación de
 * undo/redo (que no son "comandos" dispatchables — son métodos propios del
 * Engine sobre su pila de historial en memoria).
 */
export type EngineChangeCause =
  | { type: "command"; command: EngineCommand }
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
  | { type: "commandRejected"; command: EngineCommand; error: EngineError };
