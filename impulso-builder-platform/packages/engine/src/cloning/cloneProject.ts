import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  type Project,
} from "@impulso/document-schema";
import { cloneSceneObjectWithNewIds } from "./cloneSceneObject.js";

export interface CloneProjectOptions {
  now: string;
  /** El Engine nunca inventa identidad (mismo principio que
   * `cloneSceneObjectWithNewIds`/`addObject`) — quien llama SIEMPRE provee
   * el generador (ej. `() => crypto.randomUUID()` en la app, un contador
   * incremental en tests). Este paquete es deliberadamente DOM-free y no
   * asume `crypto` disponible. */
  generateId: () => string;
}

/**
 * Clona un `Project` completo asignando ids NUEVOS a cada entidad
 * (Project, Document, cada Page, cada Layer, y cada Object vía
 * `cloneSceneObjectWithNewIds` — recursivo para `group`) — nunca reutiliza
 * ningún id del original. Reinicia `documentVersion` a 1 y el historial a
 * vacío: la copia es un documento nuevo, sin el pasado del original. Nace
 * para instanciar un Project nuevo a partir de una plantilla (Templates
 * Foundation, ver ADR-0013), pero es una utilidad genérica — cualquier
 * "duplicar este proyecto completo" futuro la reutiliza igual.
 *
 * `document.assets` y cada `ImageObject.assetId` se preservan TAL CUAL,
 * a propósito: esta es una función pura y síncrona sin acceso a
 * `AssetBinaryStore`, así que no puede duplicar el binario real de un
 * Asset — reasignarle un id nuevo sin duplicar su binario dejaría
 * referencias rotas. La copia resultante comparte los mismos Assets (y
 * sus binarios) que el original; ver README para el riesgo aceptado de
 * que ambos proyectos ahora referencian el mismo binario compartido.
 */
export function cloneProjectWithNewIds(project: Project, options: CloneProjectOptions): Project {
  const { now, generateId } = options;
  const generateObjectId = () => ObjectIdSchema.parse(`object_${generateId()}`);

  return {
    ...project,
    id: ProjectIdSchema.parse(`project_${generateId()}`),
    metadata: { ...project.metadata, createdAt: now, updatedAt: now },
    document: {
      ...project.document,
      id: DocumentIdSchema.parse(`document_${generateId()}`),
      documentVersion: 1,
      pages: project.document.pages.map((page) => ({
        ...page,
        id: PageIdSchema.parse(`page_${generateId()}`),
        layers: page.layers.map((layer) => ({
          ...layer,
          id: LayerIdSchema.parse(`layer_${generateId()}`),
          objects: layer.objects.map((object) => cloneSceneObjectWithNewIds(object, generateObjectId, now)),
        })),
      })),
      metadata: { ...project.document.metadata, createdAt: now, updatedAt: now },
      history: { entries: [] },
    },
  };
}
