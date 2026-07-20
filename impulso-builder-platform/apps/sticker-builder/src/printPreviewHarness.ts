/**
 * Preview técnico MÍNIMO de Fase 9.3 (ver ADR-0023, sección 22-23 del
 * enunciado de la fase) — un harness temporal, NO el flujo final de
 * exportación de 7 pasos (eso queda para una fase futura), que existe
 * únicamente para verificar visualmente que MediaBox/BleedBox/TrimBox/
 * Safe Area/Crop Marks/Cut Path se calculan y posicionan correctamente,
 * usando EXACTAMENTE la misma geometría pura que usan los exportadores
 * reales (`computeBoxes`, `computeCropMarksGeometry`,
 * `computeSafeAreaCanonicalRect`, `resolveDieLineSource` +
 * `normalizeCutGeometry` + `applyCutGeometryOffset` +
 * `cutGeometryToPathSegments`, `cropMarkSegmentToRaster`/
 * `cutPathSegmentsToRaster`) — nunca una reimplementación aproximada.
 *
 * Ninguna ruta de producto navega aquí — mismo estatus que
 * `print-engine-harness.html`/`printEngineHarness.ts` (Fase 9.2): se
 * retira o se transforma en la UI real durante una fase futura.
 *
 * Este preview NUNCA modifica el `Project` ni dispara `dirty-state` — se
 * verifica al final (`projectUnchanged`/`projectChangedEventCount`,
 * mismo patrón que el harness de exportación) y se expone en
 * `window.__printPreviewHarness` para que Playwright lo audite.
 */
import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  segmentsToSvgPathData,
  type Project,
  type Page,
  type SceneObject,
} from "@impulso/document-schema";
import { createEngine } from "@impulso/engine";
import type { ExportAssetResolver } from "@impulso/export-engine";
import {
  createPrintJob,
  runPreflight,
  renderPrintPage,
  createAssetImageCache,
  computeBoxes,
  computeCropMarksGeometry,
  computeSafeAreaCanonicalRect,
  resolveDieLineSource,
  normalizeCutGeometry,
  applyCutGeometryOffset,
  cutGeometryToPathSegments,
  cropMarkSegmentToRaster,
  cutPathSegmentsToRaster,
  canonicalPointToRasterPoint,
  createMediaCanvasWithContent,
  browserFontChecker,
  browserImageDimensionsProbe,
  type PrintJob,
} from "@impulso/print-engine";

const NOW = "2026-07-20T00:00:00.000Z";
const baseMetadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function buildDemoProject(): { project: Project; pageId: ReturnType<typeof PageIdSchema.parse> } {
  const pageId = PageIdSchema.parse(nextId("page"));
  const layerId = LayerIdSchema.parse(nextId("layer"));

  // Rect de contenido — dentro del trim, no invade el safe area.
  const content: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 40, y: 40, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 150, height: 150 },
    cornerRadius: 0,
    style: { ...baseStyle, fill: "#3366cc" },
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  // Rect deliberadamente en la esquina (0,0) — cruza el borde del safe
  // area a propósito, para que el preview tenga algo real que reportar en
  // el resumen textual de warnings (sección 23).
  const invader: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 30, height: 30 },
    cornerRadius: 0,
    style: { ...baseStyle, fill: "#cc3366" },
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  // Ellipse marcada como die-line — único candidato de cut path.
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "ellipse",
    transform: { x: 43, y: 43, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 140, height: 140 },
    style: { ...baseStyle, fill: "transparent" },
    metadata: { ...baseMetadata, role: "die-line" },
    pluginData: {},
    customProperties: {},
  };

  const page: Page = {
    id: pageId,
    size: { width: 60, height: 60 },
    unit: "mm",
    grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
    layers: [{ id: layerId, objects: [content, invader, dieLine], metadata: baseMetadata, pluginData: {}, customProperties: {} }],
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };

  const project: Project = {
    id: ProjectIdSchema.parse(nextId("project")),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(nextId("document")),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [page],
      assets: [],
      metadata: baseMetadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };

  return { project, pageId };
}

function buildDemoPrintJob(project: Project, pageId: ReturnType<typeof PageIdSchema.parse>): PrintJob {
  const page = project.document.pages[0]!;
  return createPrintJob({
    documentId: project.document.id,
    pageIds: [pageId],
    dimensions: { width: page.size.width, height: page.size.height, unit: page.unit },
    profile: "sticker-sheet", // bleed + safe area + crop marks + cut path, todos habilitados por defecto
    now: () => NOW,
    overrides: { resolution: { targetPpi: 96 } }, // preview a resolución baja/media (sección 22), nunca 300 PPI de producción
  });
}

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CutPathSummary {
  status: string;
  svgPath?: string;
}

function svg(tag: string, attrs: Record<string, string | number>, children: string = ""): string {
  const attrString = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<${tag} ${attrString}>${children}</${tag}>`;
}

function rectSvg(rect: OverlayRect, className: string, dash: string, label: string): string {
  return svg("g", { class: className, role: "img", "aria-label": label }, [
    svg("title", {}, label),
    svg("rect", { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fill: "none", "stroke-dasharray": dash, class: "overlay-stroke" }),
  ].join(""));
}

async function buildPreview(): Promise<void> {
  const { project, pageId } = buildDemoProject();
  const printJob = buildDemoPrintJob(project, pageId);
  const page = project.document.pages[0]!;

  // Inmutabilidad (sección 22): se compara el Project ANTES/DESPUÉS de
  // construir todo el preview, y se cuentan eventos `projectChanged` del
  // Engine — el preview nunca debe activar ninguno de los dos.
  const engine = createEngine(project);
  let projectChangedCount = 0;
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") projectChangedCount += 1;
  });
  const beforeJson = JSON.stringify(engine.getProject());

  const preflight = await runPreflight(project, printJob, {
    resolver: noopResolver,
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
  });

  const imageCache = createAssetImageCache(noopResolver);
  const rendered = await renderPrintPage({ project, printJob, pageId, imageCache });
  imageCache.dispose();

  const physicalBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
  const targetPpi = printJob.resolution.targetPpi;
  // Misma fórmula que `exportPrintJobToPng.ts`'s `composeFinalCanvas` (Fase
  // 9.3) — física -> raster px a `targetPpi`, sin encadenar por px canónico.
  const ppiScale = (mm: number) => Math.round((mm / 25.4) * targetPpi);
  const mediaWidthPx = ppiScale(toMm(physicalBoxes.media.width, physicalBoxes.media.unit));
  const mediaHeightPx = ppiScale(toMm(physicalBoxes.media.height, physicalBoxes.media.unit));
  const bleedOffsetRasterPx = {
    x: ppiScale(toMm(physicalBoxes.bleedOffsetWithinMedia.x, physicalBoxes.trim.unit)),
    y: ppiScale(toMm(physicalBoxes.bleedOffsetWithinMedia.y, physicalBoxes.trim.unit)),
  };

  const { canvas: mediaCanvas } = createMediaCanvasWithContent(rendered.canvas, mediaWidthPx, mediaHeightPx, bleedOffsetRasterPx);

  const contentOffsetCanonical = { x: rendered.geometry.offsetCanonicalX, y: rendered.geometry.offsetCanonicalY };
  const toRaster = (p: { x: number; y: number }) => canonicalPointToRasterPoint(p, rendered.geometry.canonicalScale, contentOffsetCanonical, bleedOffsetRasterPx);

  const mediaBoxRect: OverlayRect = { x: 0, y: 0, width: mediaWidthPx, height: mediaHeightPx };
  const bleedBoxRect: OverlayRect = { x: bleedOffsetRasterPx.x, y: bleedOffsetRasterPx.y, width: rendered.canvas.width, height: rendered.canvas.height };
  const trimTopLeft = toRaster({ x: 0, y: 0 });
  const trimBottomRight = toRaster({ x: rendered.geometry.trimCanonicalWidth, y: rendered.geometry.trimCanonicalHeight });
  const trimBoxRect: OverlayRect = { x: trimTopLeft.x, y: trimTopLeft.y, width: trimBottomRight.x - trimTopLeft.x, height: trimBottomRight.y - trimTopLeft.y };

  const safeAreaCanonical = computeSafeAreaCanonicalRect(printJob);
  let safeAreaRect: OverlayRect | undefined;
  if (safeAreaCanonical) {
    const topLeft = toRaster({ x: safeAreaCanonical.x, y: safeAreaCanonical.y });
    const bottomRight = toRaster({ x: safeAreaCanonical.x + safeAreaCanonical.width, y: safeAreaCanonical.y + safeAreaCanonical.height });
    safeAreaRect = { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
  }

  const cropMarkLines = printJob.cropMarks.enabled
    ? computeCropMarksGeometry(physicalBoxes, printJob.cropMarks).map((segment) => cropMarkSegmentToRaster(segment, targetPpi))
    : [];

  let cutPath: CutPathSummary = { status: "none" };
  if (printJob.cutPath.mode !== "none") {
    const resolution = resolveDieLineSource(page, printJob.cutPath.source);
    if (resolution.status === "not-found") cutPath = { status: "not-found" };
    else if (resolution.status === "multiple") cutPath = { status: "multiple" };
    else {
      const geometryResult = normalizeCutGeometry(resolution.candidate);
      if (!geometryResult.ok) cutPath = { status: geometryResult.reason };
      else {
        const offsetPx = 0; // el offset físico del PrintJob ya se resolvió a px canónico en runPreflight/exportadores; el preview usa 0 explícito para mostrar la geometría base del die-line.
        const offsetResult = applyCutGeometryOffset(geometryResult.geometry, offsetPx);
        if (offsetResult.status === "collapsed") cutPath = { status: "collapsed" };
        else {
          const canonicalSegments = cutGeometryToPathSegments(offsetResult.geometry);
          const rasterSegments = cutPathSegmentsToRaster(canonicalSegments, rendered.geometry.canonicalScale, contentOffsetCanonical, bleedOffsetRasterPx);
          cutPath = { status: "ok", svgPath: segmentsToSvgPathData(rasterSegments, true) };
        }
      }
    }
  }

  renderDom({
    mediaCanvas,
    mediaBoxRect,
    bleedBoxRect,
    trimBoxRect,
    safeAreaRect,
    cropMarkLines,
    cutPath,
    printJob,
    preflight,
  });

  const afterJson = JSON.stringify(engine.getProject());
  unsubscribe();

  (window as unknown as { __printPreviewHarness: unknown }).__printPreviewHarness = {
    ready: true,
    projectUnchanged: beforeJson === afterJson,
    projectChangedEventCount: projectChangedCount,
    overlays: { mediaBoxRect, bleedBoxRect, trimBoxRect, safeAreaRect, cropMarkCount: cropMarkLines.length, cutPathStatus: cutPath.status },
    preflightIssueCodes: preflight.issues.map((issue) => issue.code),
  };
}

function toMm(value: number, unit: "mm" | "in" | "px"): number {
  if (unit === "mm") return value;
  if (unit === "in") return value * 25.4;
  return (value / 96) * 25.4;
}

function renderDom(data: {
  mediaCanvas: HTMLCanvasElement;
  mediaBoxRect: OverlayRect;
  bleedBoxRect: OverlayRect;
  trimBoxRect: OverlayRect;
  safeAreaRect: OverlayRect | undefined;
  cropMarkLines: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  cutPath: CutPathSummary;
  printJob: PrintJob;
  preflight: Awaited<ReturnType<typeof runPreflight>>;
}): void {
  const root = document.getElementById("preview-root")!;
  const { mediaCanvas, mediaBoxRect, bleedBoxRect, trimBoxRect, safeAreaRect, cropMarkLines, cutPath, printJob, preflight } = data;

  const overlayGroups: Array<{ id: string; label: string; html: string }> = [
    { id: "mediabox", label: "MediaBox (superficie total exportable)", html: rectSvg(mediaBoxRect, "mediabox", "2 2", "MediaBox") },
    { id: "bleedbox", label: "BleedBox (contenido + sangrado)", html: rectSvg(bleedBoxRect, "bleedbox", "6 3", "BleedBox") },
    { id: "trimbox", label: "TrimBox (tamaño final)", html: rectSvg(trimBoxRect, "trimbox", "none", "TrimBox") },
    ...(safeAreaRect ? [{ id: "safearea", label: "Safe Area", html: rectSvg(safeAreaRect, "safearea", "1 4", "Safe Area") }] : []),
    {
      id: "cropmarks",
      label: `Crop Marks (${cropMarkLines.length} segmentos)`,
      html: svg(
        "g",
        { class: "cropmarks", role: "img", "aria-label": `${cropMarkLines.length} marcas de corte` },
        cropMarkLines.map((l) => svg("line", { x1: l.from.x, y1: l.from.y, x2: l.to.x, y2: l.to.y, class: "overlay-stroke cropmark-line" })).join(""),
      ),
    },
    {
      id: "cutpath",
      label: `Cut Path (${cutPath.status})`,
      html: cutPath.svgPath
        ? svg("g", { class: "cutpath", role: "img", "aria-label": "Cut Path detectado" }, svg("path", { d: cutPath.svgPath, fill: "none", class: "overlay-stroke cutpath-path" }))
        : "",
    },
  ];

  const svgWidth = mediaBoxRect.width;
  const svgHeight = mediaBoxRect.height;

  root.innerHTML = `
    <div id="preview-controls">
      <fieldset>
        <legend>Capas visibles</legend>
        ${overlayGroups
          .map(
            (g) => `
          <label>
            <input type="checkbox" checked data-overlay-toggle="${g.id}" aria-controls="overlay-${g.id}" />
            ${g.label}
          </label>`,
          )
          .join("")}
      </fieldset>
      <label id="zoom-label">
        Zoom
        <input type="range" id="zoom-range" min="50" max="300" value="100" aria-labelledby="zoom-label" />
      </label>
    </div>
    <div id="preview-canvas-wrapper" aria-hidden="true">
      <div id="preview-scale-target" style="position:relative; width:${svgWidth}px; height:${svgHeight}px;">
        <div id="content-canvas-slot"></div>
        <svg id="overlay-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="position:absolute; top:0; left:0;">
          ${overlayGroups.map((g) => `<g id="overlay-${g.id}">${g.html}</g>`).join("")}
        </svg>
      </div>
    </div>
    <dl id="preview-summary">
      <dt>Tamaño final</dt><dd>${printJob.dimensions.width}×${printJob.dimensions.height}${printJob.dimensions.unit}</dd>
      <dt>Sangrado</dt><dd>${printJob.bleed.top}/${printJob.bleed.right}/${printJob.bleed.bottom}/${printJob.bleed.left}${printJob.bleed.unit} (arriba/derecha/abajo/izquierda)</dd>
      <dt>Safe area</dt><dd>${printJob.safeArea.enabled ? `margen ${printJob.safeArea.margin}${printJob.safeArea.unit}` : "deshabilitado"}</dd>
      <dt>Marcas de corte</dt><dd>${printJob.cropMarks.enabled ? `${cropMarkLines.length} segmentos` : "deshabilitadas"}</dd>
      <dt>Cut path detectado</dt><dd>${cutPath.status}</dd>
      <dt>Advertencias de Preflight</dt><dd>${preflight.issues.length === 0 ? "ninguna" : preflight.issues.map((i) => `${i.code} (${i.severity})`).join(", ")}</dd>
    </dl>
  `;

  document.getElementById("content-canvas-slot")!.appendChild(mediaCanvas);

  for (const toggle of root.querySelectorAll<HTMLInputElement>("[data-overlay-toggle]")) {
    toggle.addEventListener("change", () => {
      const target = document.getElementById(`overlay-${toggle.dataset.overlayToggle}`)!;
      target.style.display = toggle.checked ? "" : "none";
    });
  }

  const zoomRange = document.getElementById("zoom-range") as HTMLInputElement;
  const scaleTarget = document.getElementById("preview-scale-target")!;
  zoomRange.addEventListener("input", () => {
    const scale = Number(zoomRange.value) / 100;
    scaleTarget.style.transform = `scale(${scale})`;
    scaleTarget.style.transformOrigin = "top left";
  });
}

buildPreview().catch((error) => {
  document.getElementById("preview-root")!.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  (window as unknown as { __printPreviewHarness: unknown }).__printPreviewHarness = { ready: true, error: error instanceof Error ? error.message : String(error) };
});
