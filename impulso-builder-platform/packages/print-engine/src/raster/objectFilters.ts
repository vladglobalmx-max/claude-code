import type { LayerId, PageId, SceneObject } from "@impulso/document-schema";

export type ShouldRenderObject = (object: SceneObject, context: { pageId: PageId; layerId: LayerId }) => boolean;

/**
 * Política de contenido del raster de impresión (sección 7 del enunciado):
 * un die-line (`metadata.role === "die-line"`, convención ya existente,
 * ver ADR-0021) nunca es parte del contenido visual — es una guía de
 * corte, no algo que deba imprimirse como tinta. Se excluye SIEMPRE del
 * raster de contenido, sin importar el perfil o `cutPath.mode`: en esta
 * fase (9.2) los cut paths todavía no se dibujan como overlay vectorial
 * (eso es Fase 9.3) — incluirlo en el raster aplanado de todos modos
 * imprimiría, sin intención, la línea de construcción del die-line.
 */
export function defaultShouldRenderObject(object: SceneObject): boolean {
  return object.metadata.role !== "die-line";
}

/** Combina la política por defecto con un filtro adicional provisto por
 * el caller (AND lógico — ambos deben aprobar el object). */
export function combineShouldRenderObject(extra: ShouldRenderObject | undefined): ShouldRenderObject {
  if (!extra) return (object) => defaultShouldRenderObject(object);
  return (object, context) => defaultShouldRenderObject(object) && extra(object, context);
}
