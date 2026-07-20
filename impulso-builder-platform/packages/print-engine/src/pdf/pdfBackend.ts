import type { PathSegment } from "@impulso/document-schema";

/**
 * `PdfBackend` — la ÚNICA superficie por la que `@impulso/print-engine`
 * conoce la existencia de un backend PDF real (Epic 9 / Fase 9.2,
 * corrección 1 de la aprobación del usuario, ver ADR-0022 y el ADR de
 * selección del backend PDF): ningún tipo de `pdf-lib` aparece aquí — solo
 * primitivas (`number`, `Uint8Array`, `Date`), `PathSegment` (ya puro en
 * `@impulso/document-schema`) y los boxes ya expresados en puntos PDF
 * (`PdfBoxPt`, calculados por `boxes.ts`/`units.ts`, nunca por este
 * módulo). `@impulso/print-engine`'s API pública, `PrintJob`, Preflight y
 * `apps/sticker-builder` deben depender ÚNICAMENTE de esta interfaz —
 * nunca de `pdf-lib` directamente.
 */
export interface PdfBoxPt {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Un punto en espacio de puntos PDF — origen INFERIOR-izquierda, `y`
 * crece hacia arriba (nunca el espacio canónico/físico de página, que
 * crece hacia abajo — la conversión es responsabilidad de quien arma
 * estas opciones, `raster/exportPrintJobToPdf.ts`, igual que ya hace
 * `pdf/pageBoxes.ts` con `bleedBottomPt`). */
export interface PdfPointPt {
  x: number;
  y: number;
}

/** Una marca de corte vectorial (Fase 9.3, sección 6) — ya en puntos PDF. */
export interface PdfLineOverlay {
  from: PdfPointPt;
  to: PdfPointPt;
  strokeWidthPt: number;
  /** Hex (`#rgb`/`#rrggbb`) — el único formato que este backend sabe
   * convertir a un color real de `pdf-lib` (ver `pdf/color.ts`). */
  colorHex: string;
}

/** Un cut path vectorial (Fase 9.3, sección 18) — `segments` ya en puntos
 * PDF, cualquier geometría (Rectangle/Ellipse/ClosedPath) ya normalizada
 * a `PathSegment[]` por `cutpath/cutGeometryToSegments.ts` antes de llegar
 * aquí; este backend nunca decide qué forma dibujar, solo la traza. */
export interface PdfPathOverlay {
  segments: PathSegment[];
  strokeWidthPt: number;
  colorHex: string;
}

export interface AddRasterPageOptions {
  mediaWidthPt: number;
  mediaHeightPt: number;
  /** Bytes PNG del raster de contenido de esta página, ya generado por el
   * pipeline de raster (`renderPrintPage`) — este backend NUNCA rasteriza
   * nada por sí mismo, solo ensambla. */
  imageBytes: Uint8Array;
  /** Posición/tamaño de la imagen dentro de la página, en puntos PDF —
   * cubre exactamente el BleedBox (ver ADR-0022, "el raster cubre
   * exactamente el área de contenido definida por el contrato"). */
  imageX: number;
  imageY: number;
  imageWidthPt: number;
  imageHeightPt: number;
  mediaBox: PdfBoxPt;
  bleedBox: PdfBoxPt;
  trimBox: PdfBoxPt;
  cropBox: PdfBoxPt;
  /** Marcas de corte de ESTA página (Fase 9.3) — se dibujan DESPUÉS del
   * raster de contenido, nunca se rasterizan junto con él. `undefined`/
   * `[]` si `cropMarks.enabled` es `false`. */
  cropMarks?: PdfLineOverlay[];
  /** Cut path vectorial de ESTA página (Fase 9.3) — se dibuja DESPUÉS de
   * las marcas de corte (orden documentado en ADR-0023). `undefined` si
   * `cutPath.mode === "none"`. */
  cutPath?: PdfPathOverlay;
}

export interface PdfBackendDocument {
  addRasterPage(options: AddRasterPageOptions): Promise<void>;
  save(): Promise<Uint8Array>;
}

export interface PdfBackendCreateDocumentOptions {
  producer?: string;
  /** Inyectable para determinismo (golden tests, sección 18) — mismo
   * patrón que `createPrintJob`'s `now`. Sin esto, la fecha de creación del
   * PDF queda a criterio del backend (con pdf-lib, la hora real). */
  creationDate?: Date;
}

/**
 * Pequeña interfaz interna — deliberadamente NO un sistema de plugins
 * (sección 8: "no crear un sistema de plugins ni registro dinámico de
 * backends"). Un único backend real (`pdfLibBackend`) es el default de
 * `exportPrintJobToPdf`; esta interfaz existe para poder inyectar un fake
 * en tests de dominio que nunca necesitan conocer `pdf-lib`.
 */
export interface PdfBackend {
  createDocument(options?: PdfBackendCreateDocumentOptions): PdfBackendDocument;
}
