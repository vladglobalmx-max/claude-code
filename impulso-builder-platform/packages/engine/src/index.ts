// Motor
export { createEngine, type Engine, type CreateEngineOptions } from "./engine.js";

// Comandos
export {
  EngineCommandSchema,
  ContentCommandSchema,
  SelectionCommandSchema,
  ResizeHandleSchema,
  isSelectionCommand,
  type EngineCommand,
  type ContentCommand,
  type SelectionCommand,
  type EntityRef,
  EntityRefSchema,
} from "./commands/command.js";

// Geometría de manipulación (resize/rotate) — funciones puras, sin estado ni
// dependencia del Project. El Renderer las usa para previsualizar en vivo
// durante un drag (sin `dispatch`) y el comando `resizeObject`/`rotateObject`
// las usa internamente para calcular el `Transform` final a commitear —
// mismo cálculo en ambos casos, preview y estado final nunca divergen.
export {
  computeResizedTransform,
  RESIZE_HANDLES,
  MIN_RESIZE_SIZE,
  type ResizeHandle,
  type ResizeGestureInput,
} from "./geometry/resizeMath.js";
export {
  computeRotatedTransform,
  ROTATION_SNAP_INCREMENT_DEGREES,
  type RotateGestureInput,
} from "./geometry/rotateMath.js";

// Errores (Result pattern — ver errors/engineError.ts)
export { engineError, ok, err, type EngineError, type EngineErrorCode, type EngineResult } from "./errors/engineError.js";

// Eventos
export type { EngineEvent, EngineChangeCause } from "./events/engineEvent.js";
export type { Unsubscribe } from "./events/eventEmitter.js";

// Utilidades de árbol de Object (útiles para un futuro Renderer/UI de solo lectura)
export { findObjectInDocument } from "./tree/objectTree.js";
