import type { Document, GroupObject, ObjectId, Project } from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import { findObjectInDocument } from "../tree/objectTree.js";
import { composeChildTransformIntoParent } from "../geometry/composeTransform.js";
import type { ContentCommand } from "./command.js";

type GroupObjectsCommand = Extract<ContentCommand, { type: "groupObjects" }>;
type UngroupObjectCommand = Extract<ContentCommand, { type: "ungroupObject" }>;

/**
 * `groupObjects`/`ungroupObject` operan exclusivamente sobre hijos
 * DIRECTOS de una Layer — agrupar objects ya anidados en otro group, o
 * desagrupar un group anidado en otro group, no está soportado en esta
 * primera versión (ver ADR-0010, alcance). Reordenar ya tenía la misma
 * restricción (`reorderObjects`, Foundation 2) por la misma razón: mantener
 * la superficie de la primera versión acotada, no una limitación de la
 * estructura recursiva del Document Schema en sí.
 */
function findLayerWhereAllAreTopLevel(
  document: Document,
  objectIds: readonly ObjectId[],
): { pageIndex: number; layerIndex: number } | undefined {
  for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
    const page = document.pages[pageIndex]!;
    for (let layerIndex = 0; layerIndex < page.layers.length; layerIndex++) {
      const idsInLayer = new Set(page.layers[layerIndex]!.objects.map((object) => object.id));
      if (objectIds.every((id) => idsInLayer.has(id))) {
        return { pageIndex, layerIndex };
      }
    }
  }
  return undefined;
}

/**
 * El nuevo Group nace con el `transform`/`style`/`metadata` que trae el
 * comando (provistos por quien despacha, ver command.ts) y `children` en
 * su orden real dentro de la layer — si ese `transform` es la identidad
 * (x:0,y:0,rotation:0,scale:1), como hace el Renderer al agrupar desde la
 * UI, ningún hijo se mueve visualmente: agrupar es, por diseño, una
 * operación puramente estructural, nunca una transformación.
 */
export function groupObjects(project: Project, command: GroupObjectsCommand): EngineResult<Project> {
  const { objectIds, group } = command;

  const uniqueIds = new Set(objectIds);
  if (uniqueIds.size !== objectIds.length) {
    return err(engineError("invalid_group", "groupObjects no acepta ids repetidos en objectIds."));
  }
  if (findObjectInDocument(project.document, group.id)) {
    return err(engineError("invalid_group", `Ya existe un Object con id "${group.id}" en el documento.`));
  }

  const location = findLayerWhereAllAreTopLevel(project.document, objectIds);
  if (!location) {
    return err(
      engineError(
        "invalid_group",
        "Los objects a agrupar deben ser todos hijos directos de la misma layer (no anidados dentro de otro group).",
      ),
    );
  }

  const { pageIndex, layerIndex } = location;
  const page = project.document.pages[pageIndex]!;
  const layer = page.layers[layerIndex]!;

  const children = layer.objects.filter((object) => uniqueIds.has(object.id));
  const remaining = layer.objects.filter((object) => !uniqueIds.has(object.id));
  const maxIndex = Math.max(...objectIds.map((id) => layer.objects.findIndex((object) => object.id === id)));
  // Cuántos objects NO agrupados quedan antes (o en) `maxIndex` en el orden
  // original — es la posición donde el Group debe insertarse en `remaining`
  // para conservar el mismo lugar relativo (frente/fondo) que ya tenía el
  // más "adelante" de sus miembros.
  const insertIndex = layer.objects.slice(0, maxIndex + 1).filter((object) => !uniqueIds.has(object.id)).length;

  const groupObject: GroupObject = { ...group, type: "group", children };
  const objects = [...remaining.slice(0, insertIndex), groupObject, ...remaining.slice(insertIndex)];

  const layers = [...page.layers];
  layers[layerIndex] = { ...layer, objects };
  const pages = [...project.document.pages];
  pages[pageIndex] = { ...page, layers };

  return ok({ ...project, document: { ...project.document, pages } });
}

/**
 * "Hornea" el transform del Group en cada hijo (`composeChildTransformIntoParent`)
 * antes de reinsertarlos en su lugar — así ningún object se mueve
 * visualmente al desagrupar, incluso si el Group fue movido/redimensionado/
 * rotado después de creado.
 */
export function ungroupObject(project: Project, command: UngroupObjectCommand): EngineResult<Project> {
  const { objectId } = command;

  for (let pageIndex = 0; pageIndex < project.document.pages.length; pageIndex++) {
    const page = project.document.pages[pageIndex]!;
    for (let layerIndex = 0; layerIndex < page.layers.length; layerIndex++) {
      const layer = page.layers[layerIndex]!;
      const index = layer.objects.findIndex((object) => object.id === objectId);
      if (index === -1) continue;

      const target = layer.objects[index]!;
      if (target.type !== "group") {
        return err(engineError("invalid_group", `El Object "${objectId}" no es un group.`));
      }

      const bakedChildren = target.children.map((child) => ({
        ...child,
        transform: composeChildTransformIntoParent(target.transform, child.transform),
      }));

      const objects = [...layer.objects.slice(0, index), ...bakedChildren, ...layer.objects.slice(index + 1)];
      const layers = [...page.layers];
      layers[layerIndex] = { ...layer, objects };
      const pages = [...project.document.pages];
      pages[pageIndex] = { ...page, layers };

      return ok({ ...project, document: { ...project.document, pages } });
    }
  }

  if (findObjectInDocument(project.document, objectId)) {
    return err(
      engineError(
        "invalid_group",
        `El Object "${objectId}" no es un hijo directo de una layer — desagrupar un group anidado no está soportado.`,
      ),
    );
  }
  return err(engineError("object_not_found", `No existe un Object con id "${objectId}".`));
}
