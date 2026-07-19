// Motor
export {
  createEngine,
  type Engine,
  type CreateEngineOptions,
  type DispatchBatchMetadata,
} from "./engine.js";

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
// Composición de transforms (Group -> hijo) — usada internamente por
// `ungroupObject`; se expone porque un Renderer podría necesitar la misma
// matemática para previsualizar un ungroup antes de despachar el comando.
export { composeChildTransformIntoParent } from "./geometry/composeTransform.js";

// Bounding boxes rotados (Epic 7 / Fase 7.2) — función pura sin Konva/DOM;
// `renderer-konva` la consume para no reimplementar la misma trigonometría
// al medir la geometría real de un object vía Konva.
export { computeRotatedBoundingBox, unionBoundingBox, type BoundingBox, type RotatedBoxInput } from "./geometry/boundingBox.js";

// Alignment/Distribution (Epic 7 / Fase 7.2) — funciones puras que calculan
// patches de `Transform`, nunca mutan ni dispatchan por sí solas. Quien
// llama arma los `updateObjectTransform` y los aplica con `dispatchBatch`.
export {
  alignLeft,
  alignRight,
  alignCenterHorizontal,
  alignTop,
  alignBottom,
  alignCenterVertical,
  distributeHorizontal,
  distributeVertical,
  centerOnPageHorizontal,
  centerOnPageVertical,
  type AlignmentTarget,
  type AlignmentPatch,
} from "./geometry/alignment.js";

// Errores (Result pattern — ver errors/engineError.ts)
export { engineError, ok, err, type EngineError, type EngineErrorCode, type EngineResult } from "./errors/engineError.js";

// Eventos
export type { EngineEvent, EngineChangeCause } from "./events/engineEvent.js";
export type { Unsubscribe } from "./events/eventEmitter.js";

// Utilidades de árbol de Object (útiles para un futuro Renderer/UI de solo lectura)
export { findObjectInDocument } from "./tree/objectTree.js";

// Clonado con identidad fresca (Sticker Creation Experience: "Duplicar").
// Función pura, no un comando — el Engine nunca inventa ids; quien llama
// provee el generador. El resultado se despacha con el `addObject` ya
// existente, sin necesitar un comando nuevo.
export { cloneSceneObjectWithNewIds, type CloneSceneObjectOptions } from "./cloning/cloneSceneObject.js";
export { cloneProjectWithNewIds, type CloneProjectOptions } from "./cloning/cloneProject.js";
