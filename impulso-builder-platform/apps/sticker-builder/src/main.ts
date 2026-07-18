import { mountApp } from "./app.js";

function requireElement<T extends Element>(id: string, check: (el: Element) => el is T): T {
  const el = document.getElementById(id);
  if (!el || !check(el)) {
    throw new Error(`No se encontró "#${id}" (o no es del tipo esperado) en index.html.`);
  }
  return el;
}

function isDiv(el: Element): el is HTMLDivElement {
  return el instanceof HTMLDivElement;
}
function isButton(el: Element): el is HTMLButtonElement {
  return el instanceof HTMLButtonElement;
}
function isHTMLElement(el: Element): el is HTMLElement {
  return el instanceof HTMLElement;
}

mountApp({
  elements: {
    canvasViewport: requireElement("canvas-viewport", isHTMLElement),
    canvasContainer: requireElement("canvas-runtime", isDiv),
    layersContainer: requireElement("layers-panel", isHTMLElement),
    assetsContainer: requireElement("assets-panel", isHTMLElement),
    tabLayersButton: requireElement("tab-layers", isButton),
    tabAssetsButton: requireElement("tab-assets", isButton),
    inspectorContainer: requireElement("inspector-panel", isHTMLElement),
    toolsContainer: requireElement("tools-container", isHTMLElement),
    zoomContainer: requireElement("zoom-container", isHTMLElement),
    newProjectDialogContainer: requireElement("new-project-dialog-root", isHTMLElement),
    exportDialogContainer: requireElement("export-dialog-root", isHTMLElement),
    newButton: requireElement("new-btn", isButton),
    undoButton: requireElement("undo-btn", isButton),
    redoButton: requireElement("redo-btn", isButton),
    saveButton: requireElement("save-btn", isButton),
    openButton: requireElement("open-btn", isButton),
    exportButton: requireElement("export-btn", isButton),
    duplicateButton: requireElement("duplicate-btn", isButton),
    deleteButton: requireElement("delete-btn", isButton),
    groupButton: requireElement("group-btn", isButton),
    ungroupButton: requireElement("ungroup-btn", isButton),
    statusElement: requireElement("toolbar-status", isHTMLElement),
  },
});
