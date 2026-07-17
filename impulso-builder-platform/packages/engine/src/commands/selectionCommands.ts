import type { ObjectId } from "@impulso/document-schema";
import type { SelectionCommand } from "./command.js";

/**
 * La selección es estado de sesión, no contenido persistido — ver la nota
 * en command.ts. Estas funciones no tocan Project/Document en absoluto.
 */
export function applySelectionCommand(
  currentSelection: readonly ObjectId[],
  command: SelectionCommand,
): readonly ObjectId[] {
  switch (command.type) {
    case "setSelection":
      return command.objectIds;
    case "clearSelection":
      return [];
    case "toggleObjectSelection":
      return currentSelection.includes(command.objectId)
        ? currentSelection.filter((id) => id !== command.objectId)
        : [...currentSelection, command.objectId];
  }
}

/** Quita de la selección cualquier objectId que ya no exista en el documento. */
export function pruneSelection(
  selection: readonly ObjectId[],
  stillExists: (objectId: ObjectId) => boolean,
): readonly ObjectId[] {
  const pruned = selection.filter(stillExists);
  return pruned.length === selection.length ? selection : pruned;
}
