import { mountShell } from "./shell.js";
import { getCommercialManifest } from "./commercialManifest.js";

// Fase 4.2 — carga el manifest comercial una sola vez al iniciar la app.
// `getCommercialManifest()` ya registra por consola (console.warn) si el
// manifest resultara inválido — este log es la confirmación honesta del
// caso feliz, nunca "activado" (ver docs/platform/CAPABILITY_MODEL.md).
{
  const { manifest } = getCommercialManifest();
  if (manifest) {
    console.info(
      `[commercial] ${manifest.branding.displayName} v${manifest.productVersion} — edición comercial, licencia de pago único.`,
    );
  }
}

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
function isCanvas(el: Element): el is HTMLCanvasElement {
  return el instanceof HTMLCanvasElement;
}

mountShell({
  elements: {
    workspaceScreen: requireElement("workspace-screen", isHTMLElement),
    workspaceContainer: requireElement("workspace-container", isHTMLElement),
    editorScreen: requireElement("editor-screen", isHTMLElement),
    editor: {
      canvasViewport: requireElement("canvas-viewport", isHTMLElement),
      canvasContainer: requireElement("canvas-runtime", isDiv),
      layersContainer: requireElement("layers-panel", isHTMLElement),
      assetsContainer: requireElement("assets-panel", isHTMLElement),
      tabLayersButton: requireElement("tab-layers", isButton),
      tabAssetsButton: requireElement("tab-assets", isButton),
      inspectorContainer: requireElement("inspector-content", isHTMLElement),
      alignmentContainer: requireElement("alignment-panel", isHTMLElement),
      toolsContainer: requireElement("tools-container", isHTMLElement),
      gridSnapContainer: requireElement("grid-snap-container", isHTMLElement),
      zoomContainer: requireElement("zoom-container", isHTMLElement),
      rulerHorizontal: requireElement("ruler-horizontal", isCanvas),
      rulerVertical: requireElement("ruler-vertical", isCanvas),
      pointerIndicator: requireElement("pointer-indicator", isHTMLElement),
      canvasArea: requireElement("canvas-area", isHTMLElement),
      newProjectDialogContainer: requireElement("new-project-dialog-root", isHTMLElement),
      exportDialogContainer: requireElement("export-dialog-root", isHTMLElement),
      productionExportDialogContainer: requireElement("production-export-dialog-root", isHTMLElement),
      saveAsTemplateDialogContainer: requireElement("save-as-template-dialog-root", isHTMLElement),
      newButton: requireElement("new-btn", isButton),
      undoButton: requireElement("undo-btn", isButton),
      redoButton: requireElement("redo-btn", isButton),
      saveButton: requireElement("save-btn", isButton),
      backToWorkspaceButton: requireElement("back-to-workspace-btn", isButton),
      exportButton: requireElement("export-btn", isButton),
      productionExportButton: requireElement("production-export-btn", isButton),
      saveAsTemplateButton: requireElement("save-as-template-btn", isButton),
      duplicateButton: requireElement("duplicate-btn", isButton),
      deleteButton: requireElement("delete-btn", isButton),
      groupButton: requireElement("group-btn", isButton),
      ungroupButton: requireElement("ungroup-btn", isButton),
      statusElement: requireElement("toolbar-status", isHTMLElement),
      saveStatusElement: requireElement("save-status", isHTMLElement),
      saveStatusAnnouncer: requireElement("save-status-announcer", isHTMLElement),
      unsavedChangesDialogContainer: requireElement("unsaved-changes-dialog-root", isHTMLElement),
    },
  },
});
