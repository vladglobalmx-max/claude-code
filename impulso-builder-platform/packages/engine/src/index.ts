// Motor
export { createEngine, type Engine, type CreateEngineOptions } from "./engine.js";

// Comandos
export {
  EngineCommandSchema,
  ContentCommandSchema,
  SelectionCommandSchema,
  isSelectionCommand,
  type EngineCommand,
  type ContentCommand,
  type SelectionCommand,
  type EntityRef,
  EntityRefSchema,
} from "./commands/command.js";

// Errores (Result pattern — ver errors/engineError.ts)
export { engineError, ok, err, type EngineError, type EngineErrorCode, type EngineResult } from "./errors/engineError.js";

// Eventos
export type { EngineEvent, EngineChangeCause } from "./events/engineEvent.js";
export type { Unsubscribe } from "./events/eventEmitter.js";

// Utilidades de árbol de Object (útiles para un futuro Renderer/UI de solo lectura)
export { findObjectInDocument } from "./tree/objectTree.js";
