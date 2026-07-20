import type { DocumentId, PageId, Unit } from "@impulso/document-schema";

/** Tamaño físico con su propia unidad — nunca un número suelto sin contexto
 * (fuente de bugs como el ya corregido en `projectPresets.ts`, ver
 * `units.ts`). */
export interface PhysicalSize {
  width: number;
  height: number;
  unit: Unit;
}

/** Sangrado por lado — deliberadamente NO uniforme desde el modelo base
 * (sección 7 del enunciado: "eventualmente valores por lado" — se
 * implementa desde el día 1 porque no tiene costo de migración futura si
 * ya está en el tipo). */
export interface BleedSpec {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: Unit;
}

export interface SafeAreaSpec {
  enabled: boolean;
  margin: number;
  unit: Unit;
}

export interface CropMarksSpec {
  enabled: boolean;
  length: number;
  /** Separación mínima entre el borde del trim y el inicio de la marca —
   * el inicio REAL nunca es menor a esto, pero tampoco invade el bleed (ver
   * `boxes.ts`, `cropMarkStartDistance`). */
  offset: number;
  strokeWidth: number;
  unit: Unit;
  /** Color visual de la marca (string libre, mismo criterio que
   * `Style.stroke`/`fill` en `@impulso/document-schema` — sin formato
   * forzado). Fase 9.3, sección 3. */
  color: string;
}

export type CutPathMode = "none" | "kiss-cut" | "die-cut";

/**
 * "auto" busca objects con `metadata.role === "die-line"` en la página
 * activa, recursivamente (incluye dentro de `group`, Fase 9.3, sección
 * 11); "object" selecciona explícitamente un object por id — reservado
 * para cuando la UI lo ofrezca, ya soportado por el modelo desde el día
 * uno (discriminated union preferido sobre strings paralelos ambiguos).
 */
export type CutPathSource = { type: "auto" } | { type: "object"; objectId: string };

export interface CutPathSpec {
  mode: CutPathMode;
  source: CutPathSource;
  offset: number;
  unit: Unit;
  /** Grosor físico de la línea de corte vectorial (Fase 9.3, sección 18) —
   * mismo `unit` que `offset`. */
  stroke: number;
  /** Color visual (RGB), NUNCA un Spot Color certificado — ver sección 17
   * del enunciado y el ADR de Cut Paths. */
  color: string;
  /** Nombre lógico de capa/grupo de salida (ej. "KissCut"/"DieCut"/
   * "CutContour") — metadata de intención, no garantiza un Optional
   * Content Group real en el PDF (sección 16). */
  logicalLayerName: string;
}

export type PrintOutputFormat = "pdf" | "png";

export type PrintProfileId = "digital-png" | "print-pdf" | "sticker-sheet" | "web-preview";

export interface ImpositionSpec {
  enabled: boolean;
  sheet: PhysicalSize;
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
  orientation: "portrait" | "landscape";
}

export const PRINT_JOB_SCHEMA_VERSION = 1;

/**
 * Modelo explícito de Print Job (sección 4 del enunciado) — efímero por
 * defecto (vive en memoria mientras el diálogo de exportación está
 * abierto); serializable si el usuario decide guardarlo como preset
 * (diferido, no construido en Fase 9.1). Nunca se mezcla con
 * `SceneObject`/`Document` — ninguno de sus campos vive en el Document
 * Schema.
 */
export interface PrintJob {
  schemaVersion: typeof PRINT_JOB_SCHEMA_VERSION;
  documentId: DocumentId;
  pageIds: PageId[];
  output: PrintOutputFormat;
  profile: PrintProfileId;
  dimensions: PhysicalSize;
  /** Factor de escala del diseño respecto al trim — 1 = tamaño real.
   * Nunca se reduce automáticamente (sección 11); un valor distinto de 1
   * es siempre una elección explícita del usuario o de la imposición. */
  scale: number;
  /** `targetPpi`: el objetivo del perfil (ej. 300). `warnBelowPpi`:
   * opcional — si se omite, Preflight usa `targetPpi × 2/3` como umbral de
   * advertencia (sección 14: "el perfil puede definir... mínimo de
   * advertencia"). Nunca hay un `blockBelowPpi` implícito — resolución
   * insuficiente es SIEMPRE advertencia, nunca error (sección 14: "no
   * afirmar que 300 PPI siempre es obligatorio para todos los procesos"). */
  resolution: { targetPpi: number; warnBelowPpi?: number };
  bleed: BleedSpec;
  safeArea: SafeAreaSpec;
  cropMarks: CropMarksSpec;
  cutPath: CutPathSpec;
  /** Política cuando `cutPath.offset !== 0` sobre un `PathObject` cerrado
   * no tiene una solución de offset confiable (Fase 9.3, sección 14) —
   * resuelta al perfil en `createPrintJob`, nunca inferida en Preflight ni
   * en el exportador. */
  offsetUnsupportedPolicy: "block" | "warn" | "use-original";
  imposition: ImpositionSpec;
  background: { type: "transparent" } | { type: "solid"; color: string };
  metadata: { name?: string; createdAt: string };
}
