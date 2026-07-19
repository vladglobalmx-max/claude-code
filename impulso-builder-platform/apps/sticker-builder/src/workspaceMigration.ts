import type { AssetBinaryStore } from "@impulso/asset-library";
import type { ProjectStore } from "@impulso/project-library";
import { hasLocalProject, loadProjectLocally, clearLocalProject } from "./persistence.js";
import { migrateLegacyEmbeddedImages } from "./legacyMigration.js";

export interface MigrateLegacyLocalProjectOptions {
  /** Inyectable para tests; por defecto `localStorage` real. */
  storage?: Storage;
  now?: () => string;
  generateId?: () => string;
}

export interface MigrateLegacyLocalProjectResult {
  /** `false` si no había nada que migrar — `projectStore` queda intacto. */
  migrated: boolean;
  /** Cuántas imágenes embebidas (formato Epic 1) se convirtieron a Assets reales de paso. */
  migratedImageCount: number;
}

/**
 * Migración transparente y de una sola vez del slot único legado de
 * `localStorage` (Milestone 1 — Impulso Alpha, ver ADR-0009) hacia el
 * `ProjectStore` nuevo (ver ADR-0014) — mismo patrón que
 * `legacyMigration.ts` (Epic 2, imágenes embebidas), que de hecho se
 * reutiliza aquí: el único proyecto que podría seguir teniendo imágenes en
 * el formato viejo (data URL embebida) es precisamente este, así que la
 * migración de imágenes se ejecuta como parte de esta migración, no en
 * cada apertura de proyecto (ya no hace falta — ningún proyecto guardado en
 * `ProjectStore` pudo haberse guardado nunca en el formato viejo).
 *
 * Se corre una vez al arrancar la app, antes de mostrar la Workspace, para
 * que un usuario con un proyecto de una sesión Alpha nunca lo pierda. Si el
 * slot legado está corrupto (storage manipulado a mano), se descarta
 * silenciosamente en vez de bloquear el arranque de la app.
 */
export async function migrateLegacyLocalProject(
  projectStore: ProjectStore,
  binaryStore: AssetBinaryStore,
  options: MigrateLegacyLocalProjectOptions = {},
): Promise<MigrateLegacyLocalProjectResult> {
  const { storage } = options;
  const now = options.now ?? (() => new Date().toISOString());
  if (!hasLocalProject(storage)) return { migrated: false, migratedImageCount: 0 };

  let loaded;
  try {
    loaded = loadProjectLocally(storage);
  } catch (error) {
    console.error("El proyecto guardado en el slot legado está corrupto; se descarta:", error);
    clearLocalProject(storage);
    return { migrated: false, migratedImageCount: 0 };
  }
  if (!loaded) return { migrated: false, migratedImageCount: 0 };

  const { project, migratedCount } = await migrateLegacyEmbeddedImages(loaded, binaryStore, {
    now: now(),
    generateId: options.generateId,
  });
  await projectStore.save(project);
  clearLocalProject(storage);
  return { migrated: true, migratedImageCount: migratedCount };
}
