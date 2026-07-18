import type { Project } from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import type { ContentCommand } from "./command.js";

type AddAssetCommand = Extract<ContentCommand, { type: "addAsset" }>;
type RemoveAssetCommand = Extract<ContentCommand, { type: "removeAsset" }>;
type RenameAssetCommand = Extract<ContentCommand, { type: "renameAsset" }>;

/**
 * `document.assets` es el registro de descriptores de Asset Library — el
 * binario real vive fuera del Document Schema (ver
 * `@impulso/document-schema` `asset/base.ts`). Estos reducers son
 * genéricos sobre `AssetSchema` (la unión completa: hoy `image`/`font`,
 * mañana cualquier variante nueva) sin necesitar saber de qué tipo
 * concreto es cada Asset.
 */
export function addAsset(project: Project, command: AddAssetCommand): EngineResult<Project> {
  if (project.document.assets.some((asset) => asset.id === command.asset.id)) {
    return err(engineError("duplicate_asset_id", `Ya existe un Asset con id "${command.asset.id}".`));
  }
  return ok({
    ...project,
    document: { ...project.document, assets: [...project.document.assets, command.asset] },
  });
}

export function removeAsset(project: Project, command: RemoveAssetCommand): EngineResult<Project> {
  const { assets } = project.document;
  if (!assets.some((asset) => asset.id === command.assetId)) {
    return err(engineError("asset_not_found", `No existe un Asset con id "${command.assetId}".`));
  }
  // No se valida si algún ImageObject sigue referenciando este assetId: el
  // Renderer ya degrada de forma correcta (placeholder) ante un assetId sin
  // resolver, el mismo camino que ya existe desde Foundation 3 para un
  // `resolveAssetSource` que no encuentra nada — ver README de
  // @impulso/renderer-konva.
  return ok({
    ...project,
    document: { ...project.document, assets: assets.filter((asset) => asset.id !== command.assetId) },
  });
}

export function renameAsset(project: Project, command: RenameAssetCommand): EngineResult<Project> {
  const { assets } = project.document;
  const index = assets.findIndex((asset) => asset.id === command.assetId);
  if (index === -1) {
    return err(engineError("asset_not_found", `No existe un Asset con id "${command.assetId}".`));
  }
  const updatedAssets = [...assets];
  updatedAssets[index] = { ...updatedAssets[index]!, name: command.name };
  return ok({ ...project, document: { ...project.document, assets: updatedAssets } });
}
