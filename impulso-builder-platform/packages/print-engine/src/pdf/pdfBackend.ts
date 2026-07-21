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

/** Handle OPACO de una imagen ya embebida en el documento (Fase 9.4,
 * sección 15) — permite dibujarla N veces (misma página o páginas
 * distintas) sin volver a embeber los mismos bytes. Nunca expone el tipo
 * real de la implementación (ej. `PDFImage` de `pdf-lib`) — cada backend
 * decide internamente cómo resolver el handle de vuelta a su propio
 * recurso (`pdfLibBackend.ts` usa un `WeakMap` privado). */
export interface PdfEmbeddedImage {
  readonly kind: "pdf-embedded-image";
}

/** Una imagen YA embebida (`embedImage`), colocada en una posición física
 * concreta dentro de una hoja impuesta. */
export interface PlacedImage {
  image: PdfEmbeddedImage;
  x: number;
  y: number;
  widthPt: number;
  heightPt: number;
}

export interface AddImposedSheetPageOptions {
  mediaWidthPt: number;
  mediaHeightPt: number;
  /** `CropBox` se fija igual a `mediaBox` (misma política que
   * `AddRasterPageOptions` — nunca oculta contenido por defecto). Una
   * hoja impuesta NO tiene `TrimBox`/`BleedBox` propios (esos conceptos
   * viven por PIEZA, no por hoja, sección 6: "no inventar un 5º box no
   * estándar") — se omiten deliberadamente. */
  mediaBox: PdfBoxPt;
  images: PlacedImage[];
  /** Marcas de corte de ESTA hoja (por pieza y/o por hoja, ya combinadas
   * y posicionadas por el caller) — `undefined`/`[]` si `marksMode ===
   * "none"`. */
  cropMarks?: PdfLineOverlay[];
  /** Un cut path por pieza colocada, ya transformado a su posición dentro
   * de la hoja — nunca una única ruta reutilizada en coordenadas de
   * origen (sección 17: "si existen 20 piezas, deben existir 20 rutas de
   * corte colocadas"). */
  cutPaths?: PdfPathOverlay[];
}

export interface PdfBackendDocument {
  addRasterPage(options: AddRasterPageOptions): Promise<void>;
  /** Embebe una imagen UNA sola vez — el handle devuelto puede dibujarse
   * N veces vía `addImposedSheetPage` sin volver a embeber los mismos
   * bytes (Fase 9.4, sección 15: "reutilizar la imagen embebida"). */
  embedImage(imageBytes: Uint8Array): Promise<PdfEmbeddedImage>;
  /** Agrega UNA página de hoja impuesta — múltiples copias de imágenes
   * YA embebidas, cada una en su posición física, más overlays de
   * marcas/cut path ya resueltos por el caller. */
  addImposedSheetPage(options: AddImposedSheetPageOptions): Promise<void>;
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
