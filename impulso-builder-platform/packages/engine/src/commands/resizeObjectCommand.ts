import type { Project } from "@impulso/document-schema";
import { engineError, err, type EngineResult } from "../errors/engineError.js";
import { findObjectInDocument } from "../tree/objectTree.js";
import { computeResizedTransform } from "../geometry/resizeMath.js";
import { updateObjectTransform } from "./objectCommands.js";
import type { ContentCommand } from "./command.js";

type ResizeObjectCommand = Extract<ContentCommand, { type: "resizeObject" }>;

/**
 * Delega en `updateObjectTransform` para el merge/validación de `Transform`
 * — este reducer solo aporta la geometría (`computeResizedTransform`), nunca
 * duplica la lógica de fusión ya probada en `objectCommands.ts`.
 */
export function resizeObject(project: Project, command: ResizeObjectCommand): EngineResult<Project> {
  const existing = findObjectInDocument(project.document, command.objectId);
  if (!existing) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }

  const transform = computeResizedTransform({
    transform: existing.transform,
    intrinsicSize: command.intrinsicSize,
    handle: command.handle,
    pointerDelta: command.pointerDelta,
    maintainAspectRatio: command.maintainAspectRatio,
  });

  return updateObjectTransform(project, {
    type: "updateObjectTransform",
    objectId: command.objectId,
    transform,
  });
}
