import type { Project } from "@impulso/document-schema";

/**
 * Sin validación Zod/brand propia (a diferencia de los ids de
 * `@impulso/document-schema`) — un Template no vive DENTRO de ningún
 * `Document`/`Project` persistido (nunca se deserializa como parte de
 * ellos), así que no necesita el mismo nivel de guarda en el límite. Lo
 * genera quien llama (típicamente `crypto.randomUUID()` en la app).
 */
export type TemplateId = string;

/**
 * Metadata de catálogo — liviana, siempre cargada para listar una galería
 * de plantillas sin necesidad de traer el `Project` completo de cada una
 * (mismo razonamiento que separar el descriptor de Asset de su binario,
 * ver ADR-0011, aplicado aquí a nivel de catálogo global en vez de
 * `Document.assets`).
 */
export interface TemplateDescriptor {
  id: TemplateId;
  /** Qué módulo de Impulso Platform consume este Template — "sticker-builder",
   * "planner-builder", etc. Un Template es agnóstico al módulo en su diseño,
   * pero cada instancia SÍ pertenece a uno (mismo campo que `Project.moduleId`). */
  moduleId: string;
  name: string;
  description?: string;
  tags: string[];
  /** `true` para los Templates incorporados que trae cada módulo (no se
   * pueden eliminar desde la UI) — `false` para los guardados por un
   * usuario desde su propio proyecto. */
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * El contenido real de un Template: un `Project` completo (arranca con
 * IDs propios, nunca los del original — ver `instantiateTemplate`), más
 * un thumbnail opcional. El thumbnail es un `Blob` opaco — este paquete
 * no sabe ni le importa cómo se generó (la app lo produce, típicamente
 * con `@impulso/export-engine`); ver ADR-0013 para el límite completo.
 */
export interface TemplateContent {
  project: Project;
  thumbnail?: Blob;
}

/**
 * Puerto de almacenamiento de Templates — descriptor y contenido separados
 * deliberadamente (ver `TemplateDescriptor`), pero UN solo store: a
 * diferencia de Asset (cuyo descriptor vive DENTRO de `Document.assets`,
 * versionado con el documento, y el binario vive afuera), un Template
 * completo — descriptor Y contenido — vive siempre afuera de cualquier
 * documento: es un catálogo global, no contenido de un proyecto
 * particular.
 */
export interface TemplateStore {
  listDescriptors(filter?: { moduleId?: string }): Promise<TemplateDescriptor[]>;
  getDescriptor(id: TemplateId): Promise<TemplateDescriptor | undefined>;
  getContent(id: TemplateId): Promise<TemplateContent | undefined>;
  save(descriptor: TemplateDescriptor, content: TemplateContent): Promise<void>;
  delete(id: TemplateId): Promise<void>;
  clear(): Promise<void>;
}
