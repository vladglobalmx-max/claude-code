import type { Engine } from "@impulso/engine";
import type { ObjectId, SceneObject } from "@impulso/document-schema";

export interface LayersPanel {
  destroy(): void;
}

/** Reordena `underlyingIds` (orden real del documento: índice 0 = más al
 * fondo) para que `draggedId` termine en la posición VISUAL (frente ->
 * fondo, el orden en que se listan las filas) que hoy ocupa `dropTargetId`
 * — función pura, separada de la manipulación del DOM para poder
 * testearla sin simular eventos de drag reales. */
export function computeReorderedIds(
  underlyingIds: readonly ObjectId[],
  draggedId: ObjectId,
  dropTargetId: ObjectId,
): ObjectId[] {
  const visual = [...underlyingIds].reverse(); // frente -> fondo
  const withoutDragged = visual.filter((id) => id !== draggedId);
  const dropIndex = withoutDragged.indexOf(dropTargetId);
  if (dropIndex === -1) return [...underlyingIds];
  const newVisual = [...withoutDragged.slice(0, dropIndex), draggedId, ...withoutDragged.slice(dropIndex)];
  return newVisual.reverse();
}

function objectLabel(object: SceneObject): string {
  if (object.metadata.name) return object.metadata.name;
  switch (object.type) {
    case "text":
      return object.content || "Texto";
    case "image":
      return "Imagen";
    case "group":
      return "Grupo";
    case "rectangle":
      return "Rectángulo";
    case "ellipse":
      return "Elipse";
    case "path":
      return "Trazo";
  }
}

/**
 * Panel de capas (Sidebar izquierda): lista los objects de nivel superior
 * de la primera Layer de la primera Page, de frente hacia fondo — esta
 * épica no construye gestión de múltiples Layers del Document Schema (no
 * se pidió), así que "capas" en esta UI significa "objects apilados", el
 * sentido en el que cualquier herramienta de diseño usa ese término. Ver
 * ADR-0010.
 */
export function mountLayersPanel(container: HTMLElement, engine: Engine): LayersPanel {
  const expandedGroups = new Set<ObjectId>();
  let draggedId: ObjectId | null = null;
  // Fila por objectId, repoblado en cada `render()` completo — permite que
  // un `selectionChanged` (ej. el propio click de una fila) actualice solo
  // la clase `.selected` en vez de reconstruir todo el DOM. Reconstruirlo
  // en cada click rompía la detección nativa de doble-click del navegador
  // para el renombrado inline: el segundo click de un doble-click aterriza
  // sobre un elemento recién creado, distinto del que recibió el primero,
  // así que el navegador nunca cuenta 2 clicks sobre el "mismo" elemento y
  // jamás dispara `dblclick` (ver ADR-0010).
  let rowElements = new Map<ObjectId, HTMLElement>();

  function activeObjects(): readonly SceneObject[] {
    return engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
  }

  function buildRow(object: SceneObject, depth: number, selected: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.objectId = object.id;
    row.style.paddingLeft = `${depth * 16}px`;
    if (selected) row.classList.add("selected");
    row.draggable = depth === 0;

    if (object.type === "group") {
      const expandButton = document.createElement("button");
      expandButton.type = "button";
      expandButton.className = "layer-expand";
      expandButton.textContent = expandedGroups.has(object.id) ? "▾" : "▸";
      expandButton.addEventListener("click", (evt) => {
        evt.stopPropagation();
        if (expandedGroups.has(object.id)) expandedGroups.delete(object.id);
        else expandedGroups.add(object.id);
        render();
      });
      row.appendChild(expandButton);
    }

    const label = document.createElement("span");
    label.className = "layer-label";
    label.textContent = objectLabel(object);
    if (depth === 0) {
      label.addEventListener("dblclick", (evt) => {
        evt.stopPropagation();
        startRename(label, object);
      });
    }
    row.appendChild(label);

    if (depth === 0) {
      const visibilityButton = document.createElement("button");
      visibilityButton.type = "button";
      visibilityButton.className = "layer-visibility";
      visibilityButton.textContent = object.metadata.visible ? "👁" : "🚫";
      visibilityButton.title = object.metadata.visible ? "Ocultar" : "Mostrar";
      visibilityButton.addEventListener("click", (evt) => {
        evt.stopPropagation();
        engine.dispatch({
          type: "updateMetadata",
          target: { level: "object", objectId: object.id },
          metadata: { visible: !object.metadata.visible },
        });
      });
      row.appendChild(visibilityButton);

      const lockButton = document.createElement("button");
      lockButton.type = "button";
      lockButton.className = "layer-lock";
      lockButton.textContent = object.metadata.locked ? "🔒" : "🔓";
      lockButton.title = object.metadata.locked ? "Desbloquear" : "Bloquear";
      lockButton.addEventListener("click", (evt) => {
        evt.stopPropagation();
        engine.dispatch({
          type: "updateMetadata",
          target: { level: "object", objectId: object.id },
          metadata: { locked: !object.metadata.locked },
        });
      });
      row.appendChild(lockButton);
    }

    if (depth === 0) {
      // Los hijos de un group (depth > 0) son informativos únicamente: no
      // se pueden seleccionar de forma individual, ni desde el canvas (ver
      // `interactive: false` en @impulso/renderer-konva) ni desde este
      // panel — el group siempre se selecciona/edita como una sola unidad
      // (ver ADR-0010).
      row.addEventListener("click", (evt) => {
        if (evt.shiftKey) {
          engine.dispatch({ type: "toggleObjectSelection", objectId: object.id });
        } else {
          engine.dispatch({ type: "setSelection", objectIds: [object.id] });
        }
      });
    }

    if (depth === 0) {
      row.addEventListener("dragstart", () => {
        draggedId = object.id;
      });
      row.addEventListener("dragover", (evt) => {
        evt.preventDefault();
      });
      row.addEventListener("drop", (evt) => {
        evt.preventDefault();
        if (!draggedId || draggedId === object.id) return;
        const currentIds = activeObjects().map((o) => o.id);
        const pageId = engine.getProject().document.pages[0]?.id;
        const layerId = engine.getProject().document.pages[0]?.layers[0]?.id;
        if (!pageId || !layerId) return;
        engine.dispatch({
          type: "reorderObjects",
          pageId,
          layerId,
          objectIds: computeReorderedIds(currentIds, draggedId, object.id),
        });
        draggedId = null;
      });
    }

    return row;
  }

  function startRename(label: HTMLSpanElement, object: SceneObject): void {
    const input = document.createElement("input");
    input.type = "text";
    input.value = object.metadata.name ?? "";
    input.className = "layer-rename-input";
    label.replaceWith(input);
    input.focus();
    input.select();

    function commit(): void {
      engine.dispatch({
        type: "updateMetadata",
        target: { level: "object", objectId: object.id },
        metadata: { name: input.value || undefined },
      });
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") input.blur();
      if (evt.key === "Escape") {
        input.removeEventListener("blur", commit);
        render();
      }
    });
  }

  function render(): void {
    container.innerHTML = "";
    const newRowElements = new Map<ObjectId, HTMLElement>();
    const selection = new Set(engine.getSelection());
    const objects = [...activeObjects()].reverse(); // frente -> fondo
    for (const object of objects) {
      const row = buildRow(object, 0, selection.has(object.id));
      newRowElements.set(object.id, row);
      container.appendChild(row);
      if (object.type === "group" && expandedGroups.has(object.id)) {
        for (const child of object.children) {
          const childRow = buildRow(child, 1, selection.has(child.id));
          newRowElements.set(child.id, childRow);
          container.appendChild(childRow);
        }
      }
    }
    rowElements = newRowElements;
  }

  /** Solo alterna la clase `.selected` sobre las filas ya existentes — no
   * reconstruye el DOM (ver comentario en `rowElements`). */
  function updateSelectionHighlight(): void {
    const selection = new Set(engine.getSelection());
    for (const [objectId, row] of rowElements) {
      row.classList.toggle("selected", selection.has(objectId));
    }
  }

  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") render();
    else if (event.type === "selectionChanged") updateSelectionHighlight();
  });
  render();

  return {
    destroy: () => unsubscribe(),
  };
}
