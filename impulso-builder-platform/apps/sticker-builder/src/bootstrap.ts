import { createEngine, type Engine } from "@impulso/engine";
import { createKonvaRenderer, type RendererAdapter } from "@impulso/renderer-konva";
import type { AssetId, Project } from "@impulso/document-schema";
import { createDemoProject } from "./demoProject.js";

export interface CanvasRuntime {
  engine: Engine;
  renderer: RendererAdapter;
}

export interface MountCanvasRuntimeOptions {
  /** Ver `@impulso/renderer-konva` `KonvaRendererOptions.resolveAssetSource`
   * — este paquete es quien decide cómo resolver una Image (ver
   * `imageAssets.ts`, Sticker Creation Experience), sin que el Renderer ni
   * el Engine necesiten saber que existe. */
  resolveAssetSource?: (assetId: AssetId) => CanvasImageSource | undefined;
  /** Ver `@impulso/renderer-konva` `KonvaRendererOptions.getZoom` (Epic 7 /
   * Fase 7.3 — Assisted Placement): normaliza la tolerancia de snapping por
   * zoom. El zoom en sí vive en `zoom.ts`, montado DESPUÉS del runtime — se
   * pasa como un getter (no un valor) precisamente para no depender de ese
   * orden de montaje. */
  getZoom?: () => number;
}

/**
 * El cableado completo y unidireccional del pipeline:
 *
 *   Document Schema (project)  ->  Engine (createEngine)  ->  Renderer
 *   (createKonvaRenderer)  ->  Canvas (mount)
 *
 * Separado de `main.ts` (que solo llama a esta función contra el DOM real)
 * para que sea testable sin un entry point de Vite de por medio.
 */
export function mountCanvasRuntime(
  container: HTMLDivElement,
  project: Project = createDemoProject(),
  options: MountCanvasRuntimeOptions = {},
): CanvasRuntime {
  const engine = createEngine(project);
  const renderer = createKonvaRenderer(engine, {
    resolveAssetSource: options.resolveAssetSource,
    getZoom: options.getZoom,
  });
  renderer.mount(container);
  return { engine, renderer };
}
