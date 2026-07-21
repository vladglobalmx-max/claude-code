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

export type ImpositionAlignment =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** "none": sin marcas en la hoja impuesta. "per-piece": cada copia
 * colocada recibe sus propias 8 marcas (expande su footprint — Fase 9.4,
 * sección 8/16). "per-sheet": marcas alrededor del área útil general de
 * la hoja — un contorno de producción, NUNCA una guía de corte individual
 * por pieza (documentado honestamente, sección 16). Ignorado si
 * `mode === "single"`: `PrintJob.cropMarks` sigue siendo la única
 * autoridad para una exportación sin imposición. */
export type ImpositionMarksMode = "none" | "per-piece" | "per-sheet";

/** "automatic": el motor calcula la capacidad máxima (filas/columnas) que
 * cabe en el área útil. "fixed-grid": el usuario fija `rows`/`columns`
 * explícitos — si no caben, es un error bloqueante, nunca se reducen
 * silenciosamente (Fase 9.4, sección 7). */
export type ImpositionPlacementMode = "automatic" | "fixed-grid";

/**
 * Imposición (Fase 9.4, sección 3) — discriminated union explícito:
 * `"single"` es el comportamiento de Fases 9.1-9.3 sin cambios (una
 * página, sin repetición); `"grid"` reparte copias de UNA página de
 * origen en una hoja física. Si `PrintJob.pageIds` tiene varias páginas,
 * cada una genera su PROPIO grupo de hojas independiente — nunca mezcla
 * diseños distintos en la misma hoja (ver ADR de imposición).
 */
export type ImpositionSpec = { mode: "single" } | GridImpositionSpec;

export interface GridImpositionSpec {
  mode: "grid";
  sheet: PhysicalSize;
  /** "portrait" usa `sheet.width`/`sheet.height` tal cual; "landscape"
   * intercambia esas dimensiones físicas — nunca rota ninguna pieza ni
   * modifica el `Project` (sección 5). */
  orientation: "portrait" | "landscape";
  /** Entero positivo — cuántas copias de la pieza se necesitan en total,
   * repartidas en cuantas hojas hagan falta. Nunca se generan copias de
   * más para "llenar" la última hoja (sección 6). */
  quantity: number;
  placementMode: ImpositionPlacementMode;
  /** Solo relevantes (y validados) cuando `placementMode === "fixed-grid"`;
   * ignorados en `"automatic"`, donde el motor los calcula. */
  rows?: number;
  columns?: number;
  /** Distancia física entre el footprint de una pieza y la siguiente —
   * misma `unit` que `sheet` (sección 9). */
  gapX: number;
  gapY: number;
  /** Márgenes físicos por lado, en la misma `unit` que `sheet` — reducen
   * el área útil; NUNCA deben confundirse con el bleed de la pieza
   * (sección 10). */
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  /** Cómo se posiciona el grid completo dentro del área útil cuando no la
   * ocupa por completo — desplaza el conjunto, nunca altera gaps/escala
   * (sección 11). Default recomendado: `"center"`. */
  alignment: ImpositionAlignment;
  marksMode: ImpositionMarksMode;
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
