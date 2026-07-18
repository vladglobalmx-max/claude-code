import type { Project } from "@impulso/document-schema";
import { engineError, err, type EngineResult } from "../errors/engineError.js";
import { findObjectInDocument } from "../tree/objectTree.js";
import { computeRotatedTransform } from "../geometry/rotateMath.js";
import { updateObjectTransform } from "./objectCommands.js";
import type { ContentCommand } from "./command.js";

type RotateObjectCommand = Extract<ContentCommand, { type: "rotateObject" }>;

/**
 * Delega en `updateObjectTransform` para el merge/validación de `Transform`
 * — este reducer solo aporta la geometría (`computeRotatedTransform`), nunca
 * duplica la lógica de fusión ya probada en `objectCommands.ts`.
 */
export function rotateObject(project: Project, command: RotateObjectCommand): EngineResult<Project> {
  const existing = findObjectInDocument(project.document, command.objectId);
  if (!existing) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }

  const transform = computeRotatedTransform({
    pointerAngleDegrees: command.pointerAngleDegrees,
    snapToIncrement: command.snapToIncrement,
  });

  return updateObjectTransform(project, {
    type: "updateObjectTransform",
    objectId: command.objectId,
    transform,
  });
}
