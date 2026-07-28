import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  type ProjectId,
  type DocumentId,
  type PageId,
  type LayerId,
  type ObjectId,
} from "@impulso/document-schema";

/**
 * Reemplaza el patrón `XxxIdSchema.parse(\`prefix_${generateId()}\`)`
 * repetido literalmente en cada builder de Project (`projectPresets.ts`,
 * `serumFacialPremium.ts`) por una sola fábrica — mismo `generateId`
 * inyectado, un método por tipo de id. No cambia el formato de ningún id
 * existente (mismos prefijos, mismo schema de validación) ni el tipo
 * "brandeado" que cada campo del schema espera.
 */
export interface CatalogIdFactory {
  projectId(): ProjectId;
  documentId(): DocumentId;
  pageId(): PageId;
  layerId(): LayerId;
  objectId(): ObjectId;
}

export function createIdFactory(generateId: () => string): CatalogIdFactory {
  return {
    projectId: () => ProjectIdSchema.parse(`project_${generateId()}`),
    documentId: () => DocumentIdSchema.parse(`document_${generateId()}`),
    pageId: () => PageIdSchema.parse(`page_${generateId()}`),
    layerId: () => LayerIdSchema.parse(`layer_${generateId()}`),
    objectId: () => ObjectIdSchema.parse(`object_${generateId()}`),
  };
}
