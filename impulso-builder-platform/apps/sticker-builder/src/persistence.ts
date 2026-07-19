import { deserializeProject, type Project } from "@impulso/document-schema";

/**
 * Slot único legado de `localStorage` (Milestone 1 — Impulso Alpha, ver
 * ADR-0009). Desde Epic 5 (Project Library / Workspace, ver ADR-0014) la
 * app ya no guarda nada aquí — `@impulso/project-library` reemplaza este
 * mecanismo por completo. Este módulo sobrevive únicamente como la fuente
 * de la migración transparente y de una sola vez hacia el `ProjectStore`
 * nuevo (`workspaceMigration.ts`): de ahí que solo exponga lectura/borrado,
 * nunca escritura — nada vuelve a escribir en este slot.
 */
const STORAGE_KEY = "impulso:sticker-builder:project";

export function hasLocalProject(storage: Storage = localStorage): boolean {
  return storage.getItem(STORAGE_KEY) !== null;
}

/** `null` si no hay nada guardado todavía. Si lo guardado no es un Project
 * válido (corrupción manual del storage, versión no migrable), propaga el
 * error de `deserializeProject` — no hay un estado "silenciosamente vacío"
 * para datos corruptos, solo para la ausencia real de datos. */
export function loadProjectLocally(storage: Storage = localStorage): Project | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  return deserializeProject(raw);
}

export function clearLocalProject(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
