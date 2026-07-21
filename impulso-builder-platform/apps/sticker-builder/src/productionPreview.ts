/**
 * Production Preview (Epic 9 / Fase 9.4, secciones 20-22 del enunciado) —
 * vista previa REAL de una imposición, reutilizando EXACTAMENTE la misma
 * geometría pura que `exportImpositionToPdf`/`exportImpositionToPng`
 * (`computeImpositionLayout`, `computeBoxes`, `computeCropMarksGeometry`,
 * `resolveDieLineSource`/`normalizeCutGeometry`/`applyCutGeometryOffset`/
 * `cutGeometryToPathSegments` — todo de `@impulso/print-engine`), nunca
 * una reimplementación aproximada. A diferencia del harness técnico de
 * Fase 9.3 (`printPreviewHarness.ts`, un `Project` fijo de demo), este
 * componente es DATA-DRIVEN — recibe el `Project`/`PrintJob` reales del
 * usuario y se re-renderiza en cada llamada a `render()`.
 *
 * Renderiza a `PREVIEW_PPI` (72), deliberadamente MENOR al `targetPpi` de
 * producción del `PrintJob` — sección 21: "clara etiqueta de que no es una
 * promesa de pixel-perfecto", sección 38: "evitar preview a resolución
 * final". La pieza de origen se rasteriza UNA sola vez por hoja mostrada y
 * se compone N veces sobre el canvas de esa hoja — mismo principio de
 * reutilización que los exportadores reales (sección 13), aunque aquí no
 * hace falta una cache entre navegaciones: cada `render()`/cambio de hoja
 * dispara un único raster de la pieza actual.
 *
 * Nunca permite edición manual de objects (sección 22: "nunca editar
 * objects desde aquí") — únicamente zoom/fit/navegación/toggle de capas.
 * Nunca modifica el `Project` ni el `PrintJob` recibidos.
 */
import { segmentsToSvgPathData, type PageId, type PathSegment, type Project } from "@impulso/document-schema";
import { toPixels } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import {
  computeImpositionLayout,
  computeBoxes,
  computeSafeAreaCanonicalRect,
  computeCropMarksGeometry,
  cropMarkSegmentToRaster,
  canonicalPointToRasterPoint,
  cutPathSegmentsToRaster,
  resolveDieLineSource,
  normalizeCutGeometry,
  applyCutGeometryOffset,
  cutGeometryToPathSegments,
  renderPrintPage,
  createAssetImageCache,
  runPreflight,
  browserFontChecker,
  browserImageDimensionsProbe,
  physicalToPixels,
  convertUnit,
  type ImpositionLayout,
  type PlacedPiece,
  type PrintJob,
  type PreflightIssue,
} from "@impulso/print-engine";

/** PPI fijo de la vista previa — nunca el `targetPpi` real del `PrintJob`
 * (sección 21/38: ver comentario de módulo). */
const PREVIEW_PPI = 72;

export interface MountProductionPreviewOptions {
  resolver: ExportAssetResolver;
}

export interface ProductionPreviewSnapshot {
  ready: boolean;
  error?: string;
  pageGroupIndex: number;
  pageGroupCount: number;
  sheetIndex: number;
  sheetCount: number;
  pieceCountOnSheet: number;
  capacityPerSheet: number;
}

export interface ProductionPreview {
  /** Calcula y muestra la hoja actual para este `Project`/`PrintJob` —
   * reinicia la navegación a la primera página/hoja. Nunca modifica
   * ninguno de los dos argumentos. */
  render(project: Project, printJob: PrintJob): Promise<void>;
  nextSheet(): Promise<void>;
  prevSheet(): Promise<void>;
  nextPageGroup(): Promise<void>;
  prevPageGroup(): Promise<void>;
  destroy(): void;
  readonly snapshot: ProductionPreviewSnapshot;
}

interface OverlayRectPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayLinePx {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function svg(tag: string, attrs: Record<string, string | number>, children = ""): string {
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<${tag} ${attrString}>${children}</${tag}>`;
}

function rectSvg(rect: OverlayRectPx, className: string): string {
  return svg("rect", { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fill: "none", class: `production-preview-overlay-stroke ${className}` });
}

/** Base cut path de la página de origen (canónico, ya normalizado y
 * offseteado) — se calcula UNA sola vez por hoja mostrada, nunca por
 * copia colocada (mismo principio que los exportadores, sección 17).
 * `undefined` si `cutPath.mode === "none"` o si el die-line no se puede
 * resolver de forma inequívoca (la Preflight ya reporta por qué). */
function buildBaseCutPathSegments(project: Project, pageId: PageId, printJob: PrintJob): PathSegment[] | undefined {
  if (printJob.cutPath.mode === "none") return undefined;
  const page = project.document.pages.find((p) => p.id === pageId);
  if (!page) return undefined;
  const resolution = resolveDieLineSource(page, printJob.cutPath.source);
  if (resolution.status !== "found") return undefined;
  const geometryResult = normalizeCutGeometry(resolution.candidate);
  if (!geometryResult.ok) return undefined;
  const offsetCanonicalPx = toPixels(printJob.cutPath.offset, printJob.cutPath.unit);
  const offsetResult = applyCutGeometryOffset(geometryResult.geometry, offsetCanonicalPx);
  if (offsetResult.status === "collapsed") return undefined;
  return cutGeometryToPathSegments(offsetResult.geometry);
}

export function mountProductionPreview(container: HTMLElement, options: MountProductionPreviewOptions): ProductionPreview {
  const { resolver } = options;

  let project: Project | undefined;
  let printJob: PrintJob | undefined;
  let pageGroupIndex = 0;
  let sheetIndex = 0;
  let preflightIssues: PreflightIssue[] = [];
  let destroyed = false;

  const root = document.createElement("div");
  root.className = "production-preview";
  container.appendChild(root);

  const controls = document.createElement("div");
  controls.className = "production-preview-controls";
  root.appendChild(controls);

  const pageNav = document.createElement("div");
  pageNav.className = "production-preview-nav";
  const prevPageButton = document.createElement("button");
  prevPageButton.type = "button";
  prevPageButton.textContent = "◀ Página";
  prevPageButton.className = "production-preview-prev-page";
  const pageLabel = document.createElement("span");
  pageLabel.className = "production-preview-page-label";
  const nextPageButton = document.createElement("button");
  nextPageButton.type = "button";
  nextPageButton.textContent = "Página ▶";
  nextPageButton.className = "production-preview-next-page";
  pageNav.append(prevPageButton, pageLabel, nextPageButton);
  controls.appendChild(pageNav);

  const sheetNav = document.createElement("div");
  sheetNav.className = "production-preview-nav";
  const prevSheetButton = document.createElement("button");
  prevSheetButton.type = "button";
  prevSheetButton.textContent = "◀ Hoja";
  prevSheetButton.className = "production-preview-prev-sheet";
  const sheetLabel = document.createElement("span");
  sheetLabel.className = "production-preview-sheet-label";
  const nextSheetButton = document.createElement("button");
  nextSheetButton.type = "button";
  nextSheetButton.textContent = "Hoja ▶";
  nextSheetButton.className = "production-preview-next-sheet";
  sheetNav.append(prevSheetButton, sheetLabel, nextSheetButton);
  controls.appendChild(sheetNav);

  const overlayFieldset = document.createElement("fieldset");
  overlayFieldset.className = "production-preview-layers";
  const overlayLegend = document.createElement("legend");
  overlayLegend.textContent = "Capas visibles";
  overlayFieldset.appendChild(overlayLegend);
  controls.appendChild(overlayFieldset);

  const zoomWrapper = document.createElement("div");
  zoomWrapper.className = "production-preview-zoom";
  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.textContent = "Ajustar";
  fitButton.className = "production-preview-zoom-fit";
  const oneToOneButton = document.createElement("button");
  oneToOneButton.type = "button";
  oneToOneButton.textContent = "100%";
  oneToOneButton.className = "production-preview-zoom-100";
  const zoomLabel = document.createElement("label");
  zoomLabel.className = "production-preview-zoom-label";
  zoomLabel.textContent = "Zoom";
  const zoomRange = document.createElement("input");
  zoomRange.type = "range";
  zoomRange.min = "25";
  zoomRange.max = "300";
  zoomRange.value = "100";
  zoomLabel.appendChild(zoomRange);
  const zoomReadout = document.createElement("span");
  zoomReadout.className = "production-preview-zoom-readout";
  zoomReadout.textContent = "100%";
  zoomWrapper.append(fitButton, oneToOneButton, zoomLabel, zoomReadout);
  controls.appendChild(zoomWrapper);

  const errorBanner = document.createElement("p");
  errorBanner.className = "production-preview-error";
  errorBanner.style.display = "none";
  root.appendChild(errorBanner);

  const canvasWrapper = document.createElement("div");
  canvasWrapper.className = "production-preview-canvas-wrapper";
  root.appendChild(canvasWrapper);

  const scaleTarget = document.createElement("div");
  scaleTarget.className = "production-preview-scale-target";
  canvasWrapper.appendChild(scaleTarget);

  const canvasSlot = document.createElement("div");
  canvasSlot.className = "production-preview-canvas-slot";
  scaleTarget.appendChild(canvasSlot);

  const overlaySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlaySvg.setAttribute("class", "production-preview-overlay-svg");
  scaleTarget.appendChild(overlaySvg);

  const summary = document.createElement("dl");
  summary.className = "production-preview-summary";
  root.appendChild(summary);

  function applyZoom(percent: number): void {
    const clamped = Math.min(300, Math.max(25, percent));
    zoomRange.value = String(clamped);
    zoomReadout.textContent = `${clamped}%`;
    scaleTarget.style.transform = `scale(${clamped / 100})`;
    scaleTarget.style.transformOrigin = "top left";
  }

  zoomRange.addEventListener("input", () => applyZoom(Number(zoomRange.value)));
  oneToOneButton.addEventListener("click", () => applyZoom(100));
  fitButton.addEventListener("click", () => {
    // `clientWidth` es 0 en jsdom (sin layout real) — en ese caso, no hay
    // ancho real que "ajustar", así que se mantiene el zoom actual en vez
    // de forzar un 0% sin sentido (verificado en Chromium real, sección
    // 42, donde `clientWidth` sí refleja el layout).
    const availableWidth = canvasWrapper.clientWidth;
    const sheetWidthPx = scaleTarget.dataset.sheetWidthPx ? Number(scaleTarget.dataset.sheetWidthPx) : 0;
    if (availableWidth > 0 && sheetWidthPx > 0) {
      applyZoom(Math.round((availableWidth / sheetWidthPx) * 100));
    }
  });

  prevPageButton.addEventListener("click", () => void api.prevPageGroup());
  nextPageButton.addEventListener("click", () => void api.nextPageGroup());
  prevSheetButton.addEventListener("click", () => void api.prevSheet());
  nextSheetButton.addEventListener("click", () => void api.nextSheet());

  function currentSnapshot(layout: ImpositionLayout | undefined, error: string | undefined): ProductionPreviewSnapshot {
    return {
      ready: true,
      error,
      pageGroupIndex,
      pageGroupCount: printJob?.pageIds.length ?? 0,
      sheetIndex,
      sheetCount: layout?.sheetCount ?? 0,
      pieceCountOnSheet: layout?.sheets[sheetIndex]?.pieces.length ?? 0,
      capacityPerSheet: layout?.capacityPerSheet ?? 0,
    };
  }

  let snapshot: ProductionPreviewSnapshot = { ready: false, pageGroupIndex: 0, pageGroupCount: 0, sheetIndex: 0, sheetCount: 0, pieceCountOnSheet: 0, capacityPerSheet: 0 };

  function showError(message: string): void {
    errorBanner.textContent = message;
    errorBanner.style.display = "block";
    canvasSlot.replaceChildren();
    overlaySvg.replaceChildren();
    summary.replaceChildren();
    snapshot = currentSnapshot(undefined, message);
  }

  async function renderCurrentSheet(): Promise<void> {
    if (!project || !printJob) return;
    if (printJob.imposition.mode !== "grid") {
      showError("Esta vista previa solo aplica a exportaciones con imposición (mode: \"grid\").");
      return;
    }

    const pageId = printJob.pageIds[pageGroupIndex];
    if (!pageId) {
      showError("El Print Job no tiene páginas.");
      return;
    }

    const layoutResult = computeImpositionLayout(printJob, pageId);
    if (!layoutResult.ok) {
      showError(`La imposición de esta página no es válida (${layoutResult.reason}). Corrígela antes de continuar.`);
      return;
    }
    const layout = layoutResult.layout;
    sheetIndex = Math.max(0, Math.min(sheetIndex, layout.sheetCount - 1));
    const sheet = layout.sheets[sheetIndex]!;

    errorBanner.style.display = "none";

    const previewPrintJob: PrintJob = { ...printJob, resolution: { targetPpi: PREVIEW_PPI, warnBelowPpi: printJob.resolution.warnBelowPpi } };
    const imageCache = createAssetImageCache(resolver);
    const rendered = await renderPrintPage({ project, printJob: previewPrintJob, pageId, imageCache });
    imageCache.dispose();

    const includePerPieceMarks = printJob.imposition.marksMode === "per-piece";
    const pieceBoxesUnit = printJob.dimensions.unit;
    const pieceBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, { ...printJob.cropMarks, enabled: includePerPieceMarks });
    const perPieceMarkSegments = includePerPieceMarks ? computeCropMarksGeometry(pieceBoxes, { ...printJob.cropMarks, enabled: true }) : [];
    const safeAreaCanonical = printJob.safeArea.enabled ? computeSafeAreaCanonicalRect(printJob) : undefined;
    const baseCutPathSegments = buildBaseCutPathSegments(project, pageId, printJob);

    const sheetWidthPx = Math.round(physicalToPixels(layout.sheet.width, layout.unit, PREVIEW_PPI));
    const sheetHeightPx = Math.round(physicalToPixels(layout.sheet.height, layout.unit, PREVIEW_PPI));
    scaleTarget.style.width = `${sheetWidthPx}px`;
    scaleTarget.style.height = `${sheetHeightPx}px`;
    scaleTarget.dataset.sheetWidthPx = String(sheetWidthPx);

    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = sheetWidthPx;
    sheetCanvas.height = sheetHeightPx;
    const ctx = sheetCanvas.getContext("2d");

    const footprintRects: OverlayRectPx[] = [];
    const trimRects: OverlayRectPx[] = [];
    const safeAreaRects: OverlayRectPx[] = [];
    const cropMarkLines: OverlayLinePx[] = [];
    const cutPaths: string[] = [];

    for (const piece of sheet.pieces) {
      const bleedTopLeftX = piece.footprintPosition.x + layout.footprint.contentOffset.x;
      const bleedTopLeftY = piece.footprintPosition.y + layout.footprint.contentOffset.y;
      const originPx = { x: Math.round(physicalToPixels(bleedTopLeftX, layout.unit, PREVIEW_PPI)), y: Math.round(physicalToPixels(bleedTopLeftY, layout.unit, PREVIEW_PPI)) };
      ctx?.drawImage(rendered.canvas, originPx.x, originPx.y, rendered.widthPx, rendered.heightPx);

      const footprintOriginPx = { x: Math.round(physicalToPixels(piece.footprintPosition.x, layout.unit, PREVIEW_PPI)), y: Math.round(physicalToPixels(piece.footprintPosition.y, layout.unit, PREVIEW_PPI)) };
      footprintRects.push({ x: footprintOriginPx.x, y: footprintOriginPx.y, width: Math.round(physicalToPixels(layout.footprint.width, layout.unit, PREVIEW_PPI)), height: Math.round(physicalToPixels(layout.footprint.height, layout.unit, PREVIEW_PPI)) });

      const trimOffsetInFootprint = {
        x: layout.footprint.contentOffset.x + convertUnit(pieceBoxes.trimOffsetWithinBleed.x, pieceBoxesUnit, layout.unit),
        y: layout.footprint.contentOffset.y + convertUnit(pieceBoxes.trimOffsetWithinBleed.y, pieceBoxesUnit, layout.unit),
      };
      const trimOriginPx = { x: Math.round(physicalToPixels(piece.footprintPosition.x + trimOffsetInFootprint.x, layout.unit, PREVIEW_PPI)), y: Math.round(physicalToPixels(piece.footprintPosition.y + trimOffsetInFootprint.y, layout.unit, PREVIEW_PPI)) };
      trimRects.push({
        x: trimOriginPx.x,
        y: trimOriginPx.y,
        width: Math.round(physicalToPixels(convertUnit(pieceBoxes.trim.width, pieceBoxesUnit, layout.unit), layout.unit, PREVIEW_PPI)),
        height: Math.round(physicalToPixels(convertUnit(pieceBoxes.trim.height, pieceBoxesUnit, layout.unit), layout.unit, PREVIEW_PPI)),
      });

      if (safeAreaCanonical) {
        const contentOffsetCanonical = { x: rendered.geometry.offsetCanonicalX, y: rendered.geometry.offsetCanonicalY };
        const toRaster = (p: { x: number; y: number }) => canonicalPointToRasterPoint(p, rendered.geometry.canonicalScale, contentOffsetCanonical, originPx);
        const topLeft = toRaster({ x: safeAreaCanonical.x, y: safeAreaCanonical.y });
        const bottomRight = toRaster({ x: safeAreaCanonical.x + safeAreaCanonical.width, y: safeAreaCanonical.y + safeAreaCanonical.height });
        safeAreaRects.push({ x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y });
      }

      if (includePerPieceMarks) {
        for (const segment of perPieceMarkSegments) {
          const translated = {
            ...segment,
            unit: layout.unit,
            from: { x: piece.footprintPosition.x + convertUnit(segment.from.x, segment.unit, layout.unit), y: piece.footprintPosition.y + convertUnit(segment.from.y, segment.unit, layout.unit) },
            to: { x: piece.footprintPosition.x + convertUnit(segment.to.x, segment.unit, layout.unit), y: piece.footprintPosition.y + convertUnit(segment.to.y, segment.unit, layout.unit) },
          };
          const raster = cropMarkSegmentToRaster(translated, PREVIEW_PPI);
          cropMarkLines.push({ from: raster.from, to: raster.to });
        }
      }

      if (baseCutPathSegments) {
        const contentOffsetCanonical = { x: rendered.geometry.offsetCanonicalX, y: rendered.geometry.offsetCanonicalY };
        const rasterSegments = cutPathSegmentsToRaster(baseCutPathSegments, rendered.geometry.canonicalScale, contentOffsetCanonical, originPx);
        cutPaths.push(segmentsToSvgPathData(rasterSegments, true));
      }
    }

    canvasSlot.replaceChildren(sheetCanvas);
    renderOverlaysAndSummary(layout, sheet.pieces, footprintRects, trimRects, safeAreaRects, cropMarkLines, cutPaths);

    snapshot = currentSnapshot(layout, undefined);
  }

  function renderOverlaysAndSummary(
    layout: ImpositionLayout,
    pieces: PlacedPiece[],
    footprintRects: OverlayRectPx[],
    trimRects: OverlayRectPx[],
    safeAreaRects: OverlayRectPx[],
    cropMarkLines: OverlayLinePx[],
    cutPaths: string[],
  ): void {
    const sheetWidthPx = Number(scaleTarget.dataset.sheetWidthPx ?? "0");
    const sheetHeightPx = Math.round(physicalToPixels(layout.sheet.height, layout.unit, PREVIEW_PPI));
    const usefulAreaPx: OverlayRectPx = {
      x: Math.round(physicalToPixels(layout.sheet.usefulArea.x, layout.unit, PREVIEW_PPI)),
      y: Math.round(physicalToPixels(layout.sheet.usefulArea.y, layout.unit, PREVIEW_PPI)),
      width: Math.round(physicalToPixels(layout.sheet.usefulArea.width, layout.unit, PREVIEW_PPI)),
      height: Math.round(physicalToPixels(layout.sheet.usefulArea.height, layout.unit, PREVIEW_PPI)),
    };
    const sheetRectPx: OverlayRectPx = { x: 0, y: 0, width: sheetWidthPx, height: sheetHeightPx };

    const groups: Array<{ id: string; label: string; html: string }> = [
      { id: "sheet", label: "Límite de la hoja", html: svg("g", {}, rectSvg(sheetRectPx, "production-preview-sheet")) },
      { id: "usefularea", label: "Área útil (después de márgenes)", html: svg("g", {}, rectSvg(usefulAreaPx, "production-preview-usefularea")) },
      { id: "footprint", label: "Footprint por pieza", html: svg("g", {}, footprintRects.map((r) => rectSvg(r, "production-preview-footprint")).join("")) },
      { id: "trim", label: "TrimBox por pieza", html: svg("g", {}, trimRects.map((r) => rectSvg(r, "production-preview-trim")).join("")) },
      ...(safeAreaRects.length > 0 ? [{ id: "safearea", label: "Safe Area por pieza", html: svg("g", {}, safeAreaRects.map((r) => rectSvg(r, "production-preview-safearea")).join("")) }] : []),
      {
        id: "cropmarks",
        label: `Marcas de corte (${cropMarkLines.length} segmentos)`,
        html: svg("g", {}, cropMarkLines.map((l) => svg("line", { x1: l.from.x, y1: l.from.y, x2: l.to.x, y2: l.to.y, class: "production-preview-overlay-stroke production-preview-cropmark" })).join("")),
      },
      {
        id: "cutpath",
        label: `Cut path (${cutPaths.length} piezas)`,
        html: svg("g", {}, cutPaths.map((d) => svg("path", { d, fill: "none", class: "production-preview-overlay-stroke production-preview-cutpath" })).join("")),
      },
    ];

    overlaySvg.setAttribute("width", String(sheetWidthPx));
    overlaySvg.setAttribute("height", String(sheetHeightPx));
    overlaySvg.setAttribute("viewBox", `0 0 ${sheetWidthPx} ${sheetHeightPx}`);
    overlaySvg.innerHTML = groups.map((g) => `<g id="production-preview-overlay-${g.id}">${g.html}</g>`).join("");

    overlayFieldset.replaceChildren(overlayLegend);
    for (const group of groups) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.overlayToggle = group.id;
      checkbox.addEventListener("change", () => {
        const target = overlaySvg.querySelector(`#production-preview-overlay-${group.id}`) as SVGElement | null;
        if (target) target.style.display = checkbox.checked ? "" : "none";
      });
      label.append(checkbox, document.createTextNode(group.label));
      overlayFieldset.appendChild(label);
    }

    pageLabel.textContent = `Página ${pageGroupIndex + 1} de ${printJob!.pageIds.length}`;
    prevPageButton.disabled = pageGroupIndex <= 0;
    nextPageButton.disabled = pageGroupIndex >= printJob!.pageIds.length - 1;

    sheetLabel.textContent = `Hoja ${sheetIndex + 1} de ${layout.sheetCount}`;
    prevSheetButton.disabled = sheetIndex <= 0;
    nextSheetButton.disabled = sheetIndex >= layout.sheetCount - 1;

    const marksModeLabel = printJob!.imposition.mode === "grid" ? printJob!.imposition.marksMode : "none";
    const cutPathLabel = printJob!.cutPath.mode === "none" ? "sin cut path" : cutPaths.length > 0 ? `${cutPaths.length} pieza(s) con cut path` : "no se pudo resolver (ver Preflight)";

    summary.innerHTML = `
      <dt>Vista previa</dt><dd>${PREVIEW_PPI} PPI — resolución reducida, NO una promesa de resultado pixel-perfecto</dd>
      <dt>Piezas en esta hoja</dt><dd>${pieces.length} de ${layout.capacityPerSheet} (capacidad máxima)</dd>
      <dt>Marcas de corte</dt><dd>${marksModeLabel}</dd>
      <dt>Cut path</dt><dd>${cutPathLabel}</dd>
      <dt>Advertencias de Preflight</dt><dd>${preflightIssues.length === 0 ? "ninguna" : preflightIssues.map((issue) => issue.message).join(" — ")}</dd>
    `;
  }

  const api: ProductionPreview = {
    async render(nextProject: Project, nextPrintJob: PrintJob): Promise<void> {
      project = nextProject;
      printJob = nextPrintJob;
      pageGroupIndex = 0;
      sheetIndex = 0;
      preflightIssues = await runPreflight(nextProject, nextPrintJob, { resolver, fontChecker: browserFontChecker, imageProbe: browserImageDimensionsProbe }).then((result) => result.issues);
      await renderCurrentSheet();
    },
    async nextSheet(): Promise<void> {
      sheetIndex += 1;
      await renderCurrentSheet();
    },
    async prevSheet(): Promise<void> {
      sheetIndex = Math.max(0, sheetIndex - 1);
      await renderCurrentSheet();
    },
    async nextPageGroup(): Promise<void> {
      if (!printJob || pageGroupIndex >= printJob.pageIds.length - 1) return;
      pageGroupIndex += 1;
      sheetIndex = 0;
      await renderCurrentSheet();
    },
    async prevPageGroup(): Promise<void> {
      pageGroupIndex = Math.max(0, pageGroupIndex - 1);
      sheetIndex = 0;
      await renderCurrentSheet();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.remove();
    },
    get snapshot(): ProductionPreviewSnapshot {
      return snapshot;
    },
  };

  return api;
}
