import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./catalogTemplates/kit/projectFactory.js";
import { createDieLineObjects } from "./catalogTemplates/kit/dieLine.js";

export type StickerShape = "square" | "circle" | "rectangle";

export interface CreateProjectFromSizeOptions {
  widthMm: number;
  heightMm: number;
  shape: StickerShape | "custom";
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

/** Construye un Project completamente nuevo — un Page/Layer, y (solo para
 * `shape: "circle"`) un `EllipseObject` de fondo con la línea de corte ya
 * modelada (`createDieLineObjects`, `catalogTemplates/kit/dieLine.ts` — el
 * mismo helper que usan los templates del catálogo de contenido, ver
 * `THOREN_PRODUCTION_INFRASTRUCTURE.md`). Cada llamada produce ids
 * frescos, nunca reutiliza los de un proyecto anterior. */
export function createProjectFromSize(options: CreateProjectFromSizeOptions): Project {
  const { widthMm, heightMm, shape, now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sticker sin título",
    widthMm,
    heightMm,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) =>
      // `SceneObject.size`/`transform` viven SIEMPRE en px canónico (el
      // mismo espacio que usa el Inspector vía `fromPixels`/`toPixels`, ver
      // Fase 7.1) — NUNCA en `page.unit` crudo, a diferencia de
      // `page.size` (que sí es el valor físico crudo, convertido recién
      // por el Renderer/Stage). Antes de Epic 9 esta línea usaba
      // `widthMm`/`heightMm` sin convertir: la línea de corte quedaba
      // ~3.78x más chica que la página (un círculo de 50 CSS-px dentro de
      // un Stage de ~189px), un bug real confirmado empíricamente al
      // verificar el modelo de coordenadas para el Print Engine (ver ADR
      // de Fase 9.1). `createDieLineObjects` ya aplica `toPixels`
      // internamente.
      createDieLineObjects({ ids, now, shape, widthMm, heightMm }),
  });
}
