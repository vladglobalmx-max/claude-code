import { randomUUID } from "node:crypto";
import {
  DocumentIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  PageIdSchema,
  ProjectIdSchema,
  type DocumentId,
  type LayerId,
  type ObjectId,
  type PageId,
  type ProjectId,
} from "@impulso/document-schema";

/**
 * @impulso/document-schema deliberadamente no genera IDs — ver su comentario
 * en primitives/identifiers.ts. Mismo patrón mínimo ya usado en
 * apps/sticker-builder/src/catalogTemplates/kit/ids.ts (ahí vía
 * `crypto.randomUUID()` del navegador; aquí vía `node:crypto` porque este
 * paquete corre en Node/Vitest, no en un navegador).
 */
export function nextDocumentId(): DocumentId {
  return DocumentIdSchema.parse(`document_${randomUUID()}`);
}
export function nextPageId(): PageId {
  return PageIdSchema.parse(`page_${randomUUID()}`);
}
export function nextLayerId(): LayerId {
  return LayerIdSchema.parse(`layer_${randomUUID()}`);
}
export function nextObjectId(): ObjectId {
  return ObjectIdSchema.parse(`object_${randomUUID()}`);
}
export function nextProjectId(): ProjectId {
  return ProjectIdSchema.parse(`project_${randomUUID()}`);
}
