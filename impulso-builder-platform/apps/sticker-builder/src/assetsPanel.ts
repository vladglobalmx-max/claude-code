import type { Engine } from "@impulso/engine";
import type { ResolvedAssetCache } from "./assetResolution.js";
import type { ToolsController } from "./tools.js";

export interface AssetsPanel {
  destroy(): void;
}

/**
 * Sidebar izquierda, pestaña "Assets": grid de miniaturas de
 * `document.assets` + botón "Subir imagen". Click en una miniatura inserta
 * ese Asset en el canvas (`insertImageFromAsset`, reutilizando el binario
 * ya guardado — sin volver a subir el archivo); el ícono de eliminar quita
 * el Asset del registro. No valida si el Asset está en uso por algún
 * object — el Renderer ya degrada correctamente a un placeholder ante un
 * `assetId` sin resolver (ver README de `@impulso/renderer-konva`).
 */
export function mountAssetsPanel(
  container: HTMLElement,
  engine: Engine,
  toolsController: ToolsController,
  resolvedCache: ResolvedAssetCache,
): AssetsPanel {
  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "assets-upload";
  uploadButton.textContent = "Subir imagen";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "assets-upload-input";
  fileInput.accept = "image/png,image/svg+xml";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void toolsController.uploadAsset(file);
  });
  uploadButton.addEventListener("click", () => fileInput.click());

  const grid = document.createElement("div");
  grid.className = "assets-grid";

  function render(): void {
    grid.innerHTML = "";
    for (const asset of engine.getProject().document.assets) {
      const item = document.createElement("div");
      item.className = "asset-item";
      item.dataset.assetId = asset.id;

      const thumbnail = document.createElement("img");
      thumbnail.className = "asset-thumbnail";
      thumbnail.alt = asset.name;
      const resolvedImage = asset.type === "image" ? resolvedCache.resolve(asset.id) : undefined;
      if (resolvedImage) thumbnail.src = resolvedImage.src;
      item.appendChild(thumbnail);

      const name = document.createElement("span");
      name.className = "asset-name";
      name.textContent = asset.name;
      item.appendChild(name);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "asset-delete";
      deleteButton.textContent = "🗑";
      deleteButton.title = "Eliminar de la Biblioteca";
      deleteButton.addEventListener("click", (evt) => {
        evt.stopPropagation();
        engine.dispatch({ type: "removeAsset", assetId: asset.id });
      });
      item.appendChild(deleteButton);

      item.addEventListener("click", () => {
        if (asset.type === "image") toolsController.insertImageFromAsset(asset.id);
      });

      grid.appendChild(item);
    }
  }

  container.appendChild(uploadButton);
  container.appendChild(fileInput);
  container.appendChild(grid);

  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") render();
  });
  render();

  return {
    destroy: () => {
      unsubscribe();
      uploadButton.remove();
      fileInput.remove();
      grid.remove();
    },
  };
}
