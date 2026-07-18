import { mountToolbar } from "./toolbar.js";

const canvasContainer = document.getElementById("canvas-runtime");
if (!(canvasContainer instanceof HTMLDivElement)) {
  throw new Error('No se encontró el contenedor "#canvas-runtime" en index.html.');
}

function requireButton(id: string): HTMLButtonElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`No se encontró el botón "#${id}" en index.html.`);
  }
  return el;
}

const statusElement = document.getElementById("toolbar-status");
if (!statusElement) {
  throw new Error('No se encontró "#toolbar-status" en index.html.');
}

mountToolbar({
  canvasContainer,
  elements: {
    newButton: requireButton("new-btn"),
    undoButton: requireButton("undo-btn"),
    redoButton: requireButton("redo-btn"),
    saveButton: requireButton("save-btn"),
    openButton: requireButton("open-btn"),
    statusElement,
  },
});
