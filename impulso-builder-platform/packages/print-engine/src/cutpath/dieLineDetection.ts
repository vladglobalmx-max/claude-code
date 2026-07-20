import type { Page } from "@impulso/document-schema";
import type { CutPathSource } from "../types.js";
import { findObjectById, traverseObjects, type TraversedObject } from "./objectTraversal.js";

export type DieLineResolution =
  | { status: "found"; candidate: TraversedObject }
  | { status: "not-found" }
  | { status: "multiple"; candidates: TraversedObject[] };

/**
 * Resuelve la fuente de un cut path (Fase 9.3, sección 11) — nunca elige
 * silenciosamente el primer candidato. Para `{ type: "auto" }`, busca
 * TODOS los objects con `metadata.role === "die-line"` recursivamente
 * (incluye dentro de `group`, a cualquier profundidad) — deliberadamente
 * sin filtrar por tipo soportado todavía: un die-line taggeado sobre un
 * tipo no soportado (ej. Text) debe reportarse como
 * `cut_path_unsupported_object` (más accionable), no confundirse con
 * "no hay ningún die-line" — esa decisión la toma `normalizeCutGeometry`
 * después de resolver exactamente un candidato. Para
 * `{ type: "object"; objectId }`, busca ese id exacto a cualquier
 * profundidad, sin restringir por `metadata.role` (selección manual
 * explícita).
 */
export function resolveDieLineSource(page: Page, source: CutPathSource): DieLineResolution {
  if (source.type === "object") {
    const found = findObjectById(page, source.objectId);
    return found ? { status: "found", candidate: found } : { status: "not-found" };
  }

  const candidates = traverseObjects(page, (object) => object.metadata.role === "die-line");
  if (candidates.length === 0) return { status: "not-found" };
  if (candidates.length > 1) return { status: "multiple", candidates };
  return { status: "found", candidate: candidates[0]! };
}
