import type { Document, ObjectId, SceneObject } from "@impulso/document-schema";

/**
 * Utilidades puras para recorrer/actualizar el árbol de SceneObject. Un
 * objeto puede estar anidado a cualquier profundidad dentro de "group"s, así
 * que los comandos que operan "por objectId" (updateObjectTransform,
 * updateObjectStyle, removeObject, updateMetadata a nivel objeto) necesitan
 * buscar en todo el documento, no solo en el nivel superior de una Layer.
 *
 * Nota de rendimiento: estas funciones reconstruyen el sub-árbol completo
 * en el que viven (inmutabilidad ante todo), lo cual es O(n) en el número
 * total de objetos del documento por cada comando. Para los tamaños de
 * documento de Sticker Builder esto es irrelevante; si un módulo futuro
 * maneja documentos con miles de objetos, valdría la pena mantener un
 * índice objectId -> ruta (ver "Riesgos" en el README).
 */

function findInList(objects: readonly SceneObject[], objectId: ObjectId): SceneObject | undefined {
  for (const object of objects) {
    if (object.id === objectId) return object;
    if (object.type === "group") {
      const found = findInList(object.children, objectId);
      if (found) return found;
    }
  }
  return undefined;
}

function updateInList(
  objects: readonly SceneObject[],
  objectId: ObjectId,
  updater: (object: SceneObject) => SceneObject,
): SceneObject[] {
  return objects.map((object) => {
    if (object.id === objectId) return updater(object);
    if (object.type === "group") {
      return { ...object, children: updateInList(object.children, objectId, updater) };
    }
    return object;
  });
}

function removeFromList(objects: readonly SceneObject[], objectId: ObjectId): SceneObject[] {
  return objects
    .filter((object) => object.id !== objectId)
    .map((object) =>
      object.type === "group"
        ? { ...object, children: removeFromList(object.children, objectId) }
        : object,
    );
}

export function findObjectInDocument(document: Document, objectId: ObjectId): SceneObject | undefined {
  for (const page of document.pages) {
    for (const layer of page.layers) {
      const found = findInList(layer.objects, objectId);
      if (found) return found;
    }
  }
  return undefined;
}

export function updateObjectInDocument(
  document: Document,
  objectId: ObjectId,
  updater: (object: SceneObject) => SceneObject,
): Document {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        objects: updateInList(layer.objects, objectId, updater),
      })),
    })),
  };
}

export function removeObjectFromDocument(document: Document, objectId: ObjectId): Document {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        objects: removeFromList(layer.objects, objectId),
      })),
    })),
  };
}
