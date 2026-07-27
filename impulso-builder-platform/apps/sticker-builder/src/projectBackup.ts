import { ProjectSchema, type AssetId, type Project } from "@impulso/document-schema";
import type { AssetBinaryStore } from "@impulso/asset-library";

/**
 * Respaldo/portabilidad de un Project (Fase 4.2, sección 18): sin esto, un
 * `Project` exportado como JSON crudo perdería sus assets — `Document.assets`
 * solo guarda DESCRIPTORES (ver document-schema/asset/asset.ts); el binario
 * real vive aparte, en `AssetBinaryStore` (Asset Library), keyeado por
 * `assetId`. Este módulo empaqueta ambos en un único archivo autocontenido,
 * para que actualizar manualmente (nueva descarga, posible cambio de
 * origen — ver ADR-0028/sección 15/17) nunca implique perder un proyecto.
 *
 * Sin ZIP: un solo JSON con los binarios en base64 — más simple para un
 * comprador no técnico (un archivo, no un contenedor que explorar) y sin
 * agregar una dependencia nueva solo para esto.
 */
export const PROJECT_BACKUP_SCHEMA_VERSION = 1;

interface ProjectBackupAssetEntry {
  assetId: AssetId;
  mimeType: string;
  base64: string;
}

interface ProjectBackupEnvelope {
  backupSchemaVersion: number;
  exportedAt: string;
  project: Project;
  assets: ProjectBackupAssetEntry[];
}

export class ProjectBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectBackupError";
  }
}

export interface ImportedProjectBackup {
  project: Project;
  /** Cuántos assets referenciados por el proyecto no se encontraron en el
   * respaldo (ya faltaban en el origen al exportar) — nunca bloquea la
   * importación, pero se reporta para que el usuario lo sepa. */
  missingAssetIds: string[];
}

// FileReader (no Blob.arrayBuffer()) a propósito — más ampliamente
// compatible (incluida la implementación de Blob de jsdom, que carece de
// `arrayBuffer()`) sin sacrificar nada en navegadores reales.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el asset."));
    reader.onload = () => {
      const result = reader.result as string; // "data:<mime>;base64,<data>"
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function collectAssetIds(project: Project): AssetId[] {
  return project.document.assets.map((asset) => asset.id);
}

/**
 * Serializa un Project + los binarios de sus assets referenciados en un
 * único string JSON. Un asset cuyo binario ya faltaba en `assetStore` (ej.
 * quedó huérfano) se omite del respaldo sin abortar el resto — se refleja
 * como `missingAssetIds` al importar de vuelta.
 */
export async function serializeProjectBackup(
  project: Project,
  assetStore: AssetBinaryStore,
  now: () => string = () => new Date().toISOString(),
): Promise<string> {
  const assetIds = collectAssetIds(project);
  const assets: ProjectBackupAssetEntry[] = [];
  for (const assetId of assetIds) {
    const blob = await assetStore.get(assetId);
    if (!blob) continue;
    const base64 = await blobToBase64(blob);
    assets.push({ assetId, mimeType: blob.type || "application/octet-stream", base64 });
  }

  const envelope: ProjectBackupEnvelope = {
    backupSchemaVersion: PROJECT_BACKUP_SCHEMA_VERSION,
    exportedAt: now(),
    project,
    assets,
  };
  return JSON.stringify(envelope);
}

/**
 * Parsea + valida un respaldo (`ProjectSchema.safeParse`, nunca confía en
 * el JSON crudo) y escribe cada asset de vuelta en `assetStore` — un
 * upsert por `assetId` original, para que la importación deje el store
 * exactamente como estaba al exportar. Nunca lanza por un asset individual
 * faltante; sí lanza (`ProjectBackupError`) si el archivo no tiene el
 * formato esperado o el Project embebido es inválido.
 */
export async function importProjectBackup(
  raw: string,
  assetStore: AssetBinaryStore,
): Promise<ImportedProjectBackup> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ProjectBackupError("El archivo no es un respaldo válido de THÖREN (no es JSON).");
  }

  if (typeof json !== "object" || json === null || !("project" in json) || !("backupSchemaVersion" in json)) {
    throw new ProjectBackupError("El archivo no tiene el formato de un respaldo de proyecto de THÖREN.");
  }

  const envelope = json as Partial<ProjectBackupEnvelope>;
  if (envelope.backupSchemaVersion !== PROJECT_BACKUP_SCHEMA_VERSION) {
    throw new ProjectBackupError(
      `Este respaldo usa una versión no soportada (${String(envelope.backupSchemaVersion)}). Esta versión de THÖREN solo admite la versión ${PROJECT_BACKUP_SCHEMA_VERSION}.`,
    );
  }

  const parsedProject = ProjectSchema.safeParse(envelope.project);
  if (!parsedProject.success) {
    throw new ProjectBackupError("El proyecto dentro del respaldo no es válido o está corrupto.");
  }

  const assetEntries = Array.isArray(envelope.assets) ? envelope.assets : [];
  for (const entry of assetEntries) {
    const blob = base64ToBlob(entry.base64, entry.mimeType);
    await assetStore.set(entry.assetId, blob);
  }

  const restoredAssetIds = new Set(assetEntries.map((entry) => entry.assetId));
  const missingAssetIds = collectAssetIds(parsedProject.data).filter((id) => !restoredAssetIds.has(id));

  return { project: parsedProject.data, missingAssetIds };
}
