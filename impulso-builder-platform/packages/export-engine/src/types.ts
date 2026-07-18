import type { AssetId, ObjectId, Page, Project } from "@impulso/document-schema";

/**
 * Lo único que el Export Engine necesita para leer el binario real de un
 * Asset — deliberadamente más angosto que `AssetBinaryStore`
 * (`@impulso/asset-library`): este paquete no depende de Asset Library en
 * absoluto, así un consumidor puede satisfacer esta interfaz con
 * CUALQUIER fuente (IndexedDB, memoria, un mock de test) con un adaptador
 * de una línea. Ver ADR-0012.
 */
export interface ExportAssetResolver {
  resolve(assetId: AssetId): Promise<Blob | undefined>;
}

export type ExportBackground = { type: "transparent" } | { type: "solid"; color: string };

/** 1x/2x/3x/4x — ver ADR-0012 sobre por qué la V1 no expone un DPI/escala arbitraria. */
export type ExportScale = 1 | 2 | 3 | 4;

export interface PngExportOptions {
  format: "png";
  pageId?: Page["id"];
  scale: ExportScale;
  background: ExportBackground;
}

export interface SvgExportOptions {
  format: "svg";
  pageId?: Page["id"];
}

export type ExportOptions = PngExportOptions | SvgExportOptions;

export type ExportWarningCode = "asset_reference_missing" | "asset_binary_missing" | "invalid_svg" | "font_unavailable";

/**
 * Degradación controlada: la exportación SIGUE produciendo un archivo,
 * pero algo no pudo resolverse con fidelidad completa (un Asset
 * eliminado-pero-referenciado, un binario ausente, un SVG corrupto, una
 * fuente no instalada). El caller debe mostrarle esto al usuario — nunca
 * es un fallo silencioso (ver ADR-0012, "Casos de error").
 */
export interface ExportWarning {
  code: ExportWarningCode;
  message: string;
  objectId?: ObjectId;
  assetId?: AssetId;
}

export interface ExportResult {
  format: "png" | "svg";
  blob: Blob;
  /** Dimensiones finales del archivo — para PNG, ya multiplicadas por la escala. */
  width: number;
  height: number;
  byteSize: number;
  warnings: ExportWarning[];
  /** Solo presente para `format: "svg"` — el mismo string ya empaquetado en `blob`,
   * expuesto aparte para que un caller (ej. la UI) pueda mostrar tamaño/contenido
   * sin tener que releer el Blob de forma asíncrona. */
  svgString?: string;
}

export type { Project };
