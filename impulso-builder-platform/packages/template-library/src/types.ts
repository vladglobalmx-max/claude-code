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
 * Forma de troquel — mismo vocabulario que `StickerShape` de la app
 * (`projectPresets.ts`) más `"custom"` para troqueles no geométricos
 * simples (ej. corazón, calavera — ver catálogo de contenido). Vive aquí
 * (no solo en la app) porque es un campo de metadata de catálogo, no una
 * decisión de UI de un módulo en particular.
 */
export type TemplateShape = "circle" | "square" | "rectangle" | "custom";

/** Mismos 3 niveles ya usados en todo `TEMPLATE_CATALOG_v1.md` — se dejan
 * como literales en español (no traducidos a inglés) porque son exactamente
 * el vocabulario que ya usa el catálogo de contenido fuente; introducir una
 * traducción interna sería una capa de indirección sin beneficio real. */
export type TemplateDifficulty = "Básico" | "Intermedio" | "Avanzado";

/**
 * Metadata de catálogo — liviana, siempre cargada para listar una galería
 * de plantillas sin necesidad de traer el `Project` completo de cada una
 * (mismo razonamiento que separar el descriptor de Asset de su binario,
 * ver ADR-0011, aplicado aquí a nivel de catálogo global en vez de
 * `Document.assets`).
 *
 * Los campos de `category` en adelante son la extensión diseñada en
 * `docs/product/TEMPLATE_LIBRARY_ARCHITECTURE.md` §1.3 — todos opcionales
 * y aditivos a propósito: un `TemplateDescriptor` guardado antes de esta
 * extensión (los 3 built-in originales, cualquier plantilla de usuario ya
 * guardada) se sigue leyendo sin error, sin necesitar ninguna migración.
 * `category` se deja como `string` libre (no un enum cerrado) porque el
 * propio catálogo está diseñado para crecer con categorías nuevas sin
 * requerir un cambio de schema (mismo principio ya aplicado a `tags`).
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
  /** Categoría de industria/uso del catálogo (ej. "Cosmetics", "Wedding") —
   * string libre, ver nota de la clase de arriba. */
  category?: string;
  shape?: TemplateShape;
  difficulty?: TemplateDifficulty;
  /** "Público objetivo" del catálogo (ej. "Marcas de skincare independientes"). */
  targetAudience?: string;
  /** "Caso de uso" del catálogo (ej. "Frasco gotero de serum de 30ml"). */
  useCase?: string;
  /** Colores sugeridos como hex (`#rrggbb`) — punto de partida editable,
   * nunca un límite (el editor permite cambiar cualquier color libremente,
   * ver nota de cierre de `TEMPLATE_CATALOG_v1.md`). */
  suggestedColors?: string[];
  /** Reservado para Marketplace Ready (arquitectura §8) — sin consumidor
   * real todavía; ningún Template de este catálogo es premium en v1.1. */
  premium?: boolean;
  packId?: string;
  authorId?: string;
  popularity?: number;
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
  /**
   * `category`/`shape` son opcionales y combinables con `moduleId` (AND
   * lógico, igual criterio que si hubiera más de un filtro) — se agregan
   * ahora como parte del piloto del Serum Facial Premium para probar que
   * la metadata extendida de `TemplateDescriptor` es realmente consultable
   * y no solo almacenamiento inerte. Construir la UI de búsqueda/filtro de
   * `UX_TEMPLATE_LIBRARY.md` sigue fuera de alcance de este cambio — sólo
   * se extiende el puerto, no la galería.
   */
  listDescriptors(filter?: { moduleId?: string; category?: string; shape?: TemplateShape }): Promise<TemplateDescriptor[]>;
  getDescriptor(id: TemplateId): Promise<TemplateDescriptor | undefined>;
  getContent(id: TemplateId): Promise<TemplateContent | undefined>;
  save(descriptor: TemplateDescriptor, content: TemplateContent): Promise<void>;
  delete(id: TemplateId): Promise<void>;
  clear(): Promise<void>;
}
