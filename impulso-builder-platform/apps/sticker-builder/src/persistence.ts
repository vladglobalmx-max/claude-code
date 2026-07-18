import { serializeProject, deserializeProject, type Project } from "@impulso/document-schema";

/**
 * Persistence local (Milestone 1 — Impulso Alpha). Ver
 * `docs/adr/0009-local-persistence-alpha.md` para el razonamiento completo:
 * por qué vive aquí (app), no en `@impulso/engine` ni en un paquete nuevo,
 * y por qué `localStorage` (un solo slot) en vez de IndexedDB/multi-documento.
 *
 * `serializeProject`/`deserializeProject` (Foundation 1) ya hacen todo el
 * trabajo real — validación Zod y migración de `schemaVersion` incluidas.
 * Este módulo solo los conecta con el Storage del navegador.
 */
const STORAGE_KEY = "impulso:sticker-builder:project";

export function saveProjectLocally(project: Project, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, serializeProject(project));
}

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
