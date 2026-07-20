/**
 * Harness TEMPORAL de verificación en Chromium real — Epic 9 / Fase 9.2
 * (ver ADR-0022, sección "Verificación en Chromium", y sección 21 del
 * enunciado de la fase: los 12 escenarios que deben confirmarse en un
 * navegador real, nunca solo en jsdom/mocks). Ejercita el pipeline REAL de
 * `@impulso/print-engine`: Konva real (vía `@impulso/renderer-konva`),
 * `HTMLCanvasElement`/`Image`/`createImageBitmap` reales, `pdf-lib` real —
 * nada de esto se mockea aquí, a diferencia de los tests unitarios de
 * `packages/print-engine` (que sí mockean `renderPageToStage` para
 * aislar la orquestación de la rasterización real).
 *
 * No forma parte de ningún flujo de producto — ninguna pantalla de la app
 * navega aquí. Se retira o se transforma en la UI real de exportación a
 * producción durante la Fase 9.4 (ver `print-engine-harness.html`).
 */
import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type Page,
  type SceneObject,
  type ImageAsset,
} from "@impulso/document-schema";
import { createEngine } from "@impulso/engine";
import type { ExportAssetResolver } from "@impulso/export-engine";
import {
  createPrintJob,
  exportPrintJobToPng,
  exportPrintJobToPdf,
  browserFontChecker,
  browserImageDimensionsProbe,
  computePdfPageBoxes,
  computeBoxes,
  computeCropMarksGeometry,
  resolveDieLineSource,
  normalizeCutGeometry,
  applyCutGeometryOffset,
  physicalToPixels,
  type PrintJob,
  type PrintProfileId,
} from "@impulso/print-engine";
import { PDFDocument, PDFArray, PDFName, PDFStream, PDFRawStream, decodePDFRawStream } from "pdf-lib";

const NOW = "2026-07-20T00:00:00.000Z";
const baseMetadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function buildProject(pageSize: { width: number; height: number; unit: "mm" | "in" | "px" }, objects: SceneObject[], assets: ImageAsset[] = []): Project {
  const pageId = PageIdSchema.parse(nextId("page"));
  const layerId = LayerIdSchema.parse(nextId("layer"));
  const page: Page = {
    id: pageId,
    size: { width: pageSize.width, height: pageSize.height },
    unit: pageSize.unit,
    grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
    layers: [{ id: layerId, objects, metadata: baseMetadata, pluginData: {}, customProperties: {} }],
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  return {
    id: ProjectIdSchema.parse(nextId("project")),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(nextId("document")),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [page],
      assets,
      metadata: baseMetadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
}

function buildPrintJobFor(project: Project, profile: PrintProfileId, overrides: Parameters<typeof createPrintJob>[0]["overrides"] = {}): PrintJob {
  const page = project.document.pages[0]!;
  return createPrintJob({
    documentId: project.document.id,
    pageIds: [page.id],
    dimensions: { width: page.size.width, height: page.size.height, unit: page.unit },
    profile,
    now: () => NOW,
    overrides,
  });
}

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

async function readPixel(blob: Blob, x: number, y: number): Promise<{ r: number; g: number; b: number; a: number }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
  return { r: r!, g: g!, b: b!, a: a! };
}

/** Texto crudo (operadores PDF) del content stream de una página, leído de
 * un PDF REAL ya guardado/recargado — misma técnica mínima que usa la
 * propia suite de `@impulso/print-engine` (`testUtils/pdfContentInspection.ts`,
 * Fase 9.3 sección 30) para confirmar que algo se dibujó como VECTOR real,
 * nunca como parte del raster incrustado — usa solo API pública de
 * `pdf-lib`, sin duplicar la composición de matrices (eso ya está
 * exhaustivamente cubierto por los tests jsdom del paquete). */
function getPdfPageContentText(doc: PDFDocument, pageIndex: number): string {
  const page = doc.getPages()[pageIndex]!;
  const contentsRef = page.node.get(PDFName.of("Contents"));
  const resolved = doc.context.lookup(contentsRef);
  const decodeOne = (ref: unknown): string => {
    const stream = doc.context.lookup(ref as never, PDFStream);
    if (!(stream instanceof PDFRawStream)) throw new Error("content stream inesperado (no PDFRawStream)");
    return new TextDecoder("utf-8").decode(decodePDFRawStream(stream).decode());
  };
  if (resolved instanceof PDFArray) {
    const parts: string[] = [];
    for (let i = 0; i < resolved.size(); i++) parts.push(decodeOne(resolved.get(i)));
    return parts.join("\n");
  }
  return decodeOne(contentsRef);
}

type ScenarioResult = Record<string, unknown>;

async function scenario1_pngDimensions(): Promise<ScenarioResult> {
  const project = buildProject({ width: 100, height: 100, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "digital-png", { resolution: { targetPpi: 300 } });
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const page = result.pages[0]!;
  return { widthPx: page.widthPx, heightPx: page.heightPx, expected: 1181, pass: page.widthPx === 1181 && page.heightPx === 1181 };
}

async function scenario2_pdfPhysicalSize(): Promise<ScenarioResult> {
  const project = buildProject({ width: 210, height: 297, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "digital-png"); // sin bleed, MediaBox == TrimBox
  const boxes = computePdfPageBoxes(printJob);
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const reloaded = await PDFDocument.load(bytes);
  const page = reloaded.getPages()[0]!;
  const mediaBox = page.getMediaBox();
  return {
    expectedWidthPt: boxes.mediaWidthPt,
    expectedHeightPt: boxes.mediaHeightPt,
    actualWidthPt: mediaBox.width,
    actualHeightPt: mediaBox.height,
    pass: Math.abs(mediaBox.width - boxes.mediaWidthPt) < 0.01 && Math.abs(mediaBox.height - boxes.mediaHeightPt) < 0.01,
  };
}

async function scenario3_pdfMultipage(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
  const secondPage: Page = { ...project.document.pages[0]!, id: PageIdSchema.parse(nextId("page")) };
  project.document.pages.push(secondPage);
  const printJob = buildPrintJobFor(project, "print-pdf");
  printJob.pageIds = [project.document.pages[0]!.id, project.document.pages[1]!.id];
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const reloaded = await PDFDocument.load(bytes);
  return { pageCount: reloaded.getPageCount(), expected: 2, pass: reloaded.getPageCount() === 2 };
}

async function scenario4_bleedContainsRealGeometry(): Promise<ScenarioResult> {
  // Rect que cubre TODO el sangrado + trim (transform muy por fuera del
  // trim) — a targetPpi=96 (canonicalScale=1) el raster es 1:1 con px
  // canónico, así que el pixel (0,0) del PNG final debe mostrar el color
  // del rect si el sangrado realmente rasteriza contenido fuera del trim.
  const bleedRect: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: -20, y: -20, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 300, height: 300 },
    cornerRadius: 0,
    style: { fill: "#0000ff", strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 100, height: 100, unit: "px" }, [bleedRect]);
  // Marcas de corte desactivadas deliberadamente (Fase 9.3 cambió el
  // default de "print-pdf" a `cropMarks.enabled: true`) — este escenario
  // verifica el sangrado, no el espacio de marcas: con marcas activas, el
  // canvas final es del tamaño de MediaBox y el pixel (0,0) cae en el
  // margen transparente de marcas, no en la esquina del BleedBox.
  const printJob = buildPrintJobFor(project, "print-pdf", {
    resolution: { targetPpi: 96 },
    background: { type: "solid", color: "#ffff00" },
    cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
  });
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const pixel = await readPixel(result.pages[0]!.blob, 0, 0);
  return { pixelAtBleedCorner: pixel, pass: pixel.b > 200 && pixel.r < 50 };
}

async function scenario5_solidBackground(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "px" }, []);
  const printJob = buildPrintJobFor(project, "digital-png", { background: { type: "solid", color: "#112233" } });
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const pixel = await readPixel(result.pages[0]!.blob, 25, 25);
  return { pixel, expected: { r: 0x11, g: 0x22, b: 0x33, a: 255 }, pass: pixel.r === 0x11 && pixel.g === 0x22 && pixel.b === 0x33 && pixel.a === 255 };
}

async function scenario6_transparencyNeverBlack(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "px" }, []);
  const printJob = buildPrintJobFor(project, "digital-png"); // fondo transparente
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const pixel = await readPixel(result.pages[0]!.blob, 25, 25);
  return { pixel, pass: pixel.a === 0 };
}

async function scenario7_cancelledExportProducesNoFile(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "print-pdf");
  const controller = new AbortController();
  let threw: string | undefined;
  let code: string | undefined;
  try {
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
      signal: controller.signal,
      onProgress: (event) => {
        if (event.stage === "preparing-assets") controller.abort();
      },
    });
    threw = "no-throw";
  } catch (error) {
    threw = "threw";
    code = (error as { code?: string }).code;
  }
  return { threw, code, pass: threw === "threw" && code === "aborted" };
}

async function scenario8_memoryBudgetBlocked(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "print-pdf");
  let code: string | undefined;
  let issueCode: string | undefined;
  try {
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
      memoryBudgetBytes: 100,
    });
  } catch (error) {
    code = (error as { code?: string }).code;
    issueCode = (error as { preflightIssues?: Array<{ code: string }> }).preflightIssues?.[0]?.code;
  }
  return { code, issueCode, pass: code === "preflight-blocked" && issueCode === "raster_too_large" };
}

async function scenario9_fontDetectionIsCoherentSignalNeverAbsolute(): Promise<ScenarioResult> {
  // Hallazgo real confirmado en este Chromium (verificado manualmente
  // antes de escribir este test): `document.fonts.check()` devuelve
  // SIEMPRE `true`, incluso para un nombre de fuente completamente
  // inventado que nunca se declaró vía @font-face — el UA simplemente usa
  // su fallback y considera que "puede renderizar" el texto. Esto NO es
  // un bug de `browserFontChecker` — es exactamente la razón por la que
  // la corrección 6 de Fase 9.1 prohibió tratar esta API como garantía
  // absoluta. Este escenario verifica ambas ramas reales, sin mockear
  // nada más que la AUSENCIA de la API (para forzar honestamente la
  // degradación, tal como le pasaría a un navegador que no la implemente):
  const text: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "text",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    content: "hola",
    fontFamily: "ImpulsoHarnessNonExistentFont9000",
    fontSize: 16,
    fontWeight: 400,
    textAlign: "left",
    lineHeight: 1.2,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [text]);
  const printJob = buildPrintJobFor(project, "print-pdf");

  // Rama real (a): document.fonts SÍ existe en este Chromium — el
  // resultado real (confirmado empíricamente) es "available" para
  // CUALQUIER nombre, así que Preflight coherentemente no reporta ningún
  // issue de fuente (no está mintiendo — refleja fielmente lo que el
  // propio navegador reportó, con todas sus limitaciones).
  const realCheckValue = document.fonts.check('12px "ImpulsoHarnessNonExistentFont9000"');
  const resultWithRealApi = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const issueWithRealApi = resultWithRealApi.warnings.find((w) => w.code === "font_unavailable" || w.code === "font_verification_uncertain");

  // Rama (b): simula un navegador SIN la API de Font Loading — degradación
  // honesta obligatoria a "verification-uncertain" (nunca "available" por
  // defecto), que Preflight expone como un issue `info` coherente.
  const originalFonts = document.fonts;
  // `document.fonts` es un getter-only real en Chromium (a diferencia de
  // jsdom, donde `delete` alcanza) — `defineProperty` es la forma real de
  // sustituirlo temporalmente en un navegador de verdad.
  Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
  let issueWithoutApi: string | undefined;
  try {
    const resultWithoutApi = await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness-no-fonts-api",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });
    issueWithoutApi = resultWithoutApi.warnings.find((w) => w.code === "font_verification_uncertain")?.code;
  } finally {
    Object.defineProperty(document, "fonts", { value: originalFonts, configurable: true });
  }

  return {
    realCheckValueForNonExistentFont: realCheckValue,
    issueWithRealApi: issueWithRealApi?.code,
    issueWithoutApi,
    pass: realCheckValue === true && issueWithRealApi === undefined && issueWithoutApi === "font_verification_uncertain",
  };
}

async function scenario10_missingAssetNeverSubstituted(): Promise<ScenarioResult> {
  const image: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "image",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    assetId: AssetIdSchema.parse("asset_ghost_9000"),
    size: { width: 20, height: 20 },
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [image]); // sin assets
  const printJob = buildPrintJobFor(project, "print-pdf");
  let code: string | undefined;
  let issueCode: string | undefined;
  try {
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });
  } catch (error) {
    code = (error as { code?: string }).code;
    issueCode = (error as { preflightIssues?: Array<{ code: string }> }).preflightIssues?.find((i) => i.code === "asset_reference_missing")?.code;
  }
  return { code, issueCode, pass: code === "preflight-blocked" && issueCode === "asset_reference_missing" };
}

async function scenario11And12_projectImmutableAndNoDirtyState(): Promise<ScenarioResult> {
  const rect: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [rect]);
  const printJob = buildPrintJobFor(project, "print-pdf");

  const engine = createEngine(project);
  let projectChangedCount = 0;
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") projectChangedCount += 1;
  });

  const before = JSON.stringify(engine.getProject());
  await exportPrintJobToPng({
    project: engine.getProject(),
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  await exportPrintJobToPdf({
    project: engine.getProject(),
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const after = JSON.stringify(engine.getProject());
  unsubscribe();

  return {
    projectUnchanged: before === after,
    projectChangedEventCount: projectChangedCount,
    pass: before === after && projectChangedCount === 0,
  };
}

// ---------------------------------------------------------------------
// Fase 9.3 (Marks, Safe Area & Cut Paths) — sección 29: 15 escenarios de
// verificación en Chromium real, sobre el pipeline REAL (Konva real,
// Canvas real, pdf-lib real) — ninguno mockeado, igual que los 12
// escenarios de Fase 9.2 de arriba.
// ---------------------------------------------------------------------

function dieLineMetadata(): SceneObject["metadata"] {
  return { ...baseMetadata, role: "die-line" };
}

async function scenario13_bleedMarksMediaBoxLargerThanTrim(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "print-pdf"); // bleed 3mm + marcas activadas por defecto
  const boxes = computePdfPageBoxes(printJob);
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const reloaded = await PDFDocument.load(bytes);
  const page = reloaded.getPages()[0]!;
  const mediaBox = page.getMediaBox();
  const trimBox = page.getTrimBox();
  return {
    mediaWidthPt: mediaBox.width,
    trimWidthPt: trimBox.width,
    expectedMediaWidthPt: boxes.mediaWidthPt,
    pass: mediaBox.width > trimBox.width && Math.abs(mediaBox.width - boxes.mediaWidthPt) < 0.01,
  };
}

async function scenario14_marksNeverInvadeTrimRealPixels(): Promise<ScenarioResult> {
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
  const printJob = buildPrintJobFor(project, "print-pdf"); // fondo blanco sólido, marcas negras por defecto
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const page = result.pages[0]!;

  const physicalBoxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
  const segments = computeCropMarksGeometry(physicalBoxes, printJob.cropMarks);
  const targetPpi = printJob.resolution.targetPpi;
  const firstMark = segments[0]!;
  const markMidX = Math.round(physicalToPixels((firstMark.from.x + firstMark.to.x) / 2, firstMark.unit, targetPpi));
  const markMidY = Math.round(physicalToPixels((firstMark.from.y + firstMark.to.y) / 2, firstMark.unit, targetPpi));

  const markPixel = await readPixel(page.blob, markMidX, markMidY);
  const centerPixel = await readPixel(page.blob, Math.round(page.widthPx / 2), Math.round(page.heightPx / 2));

  return {
    markPixel,
    centerPixel,
    pass: markPixel.r < 50 && markPixel.g < 50 && markPixel.b < 50 && centerPixel.r > 200 && centerPixel.g > 200 && centerPixel.b > 200,
  };
}

async function scenario15_safeAreaNeverLeaksIntoFinalRaster(): Promise<ScenarioResult> {
  const buildJob = (safeAreaEnabled: boolean) => {
    const project = buildProject({ width: 50, height: 50, unit: "mm" }, []);
    const printJob = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: safeAreaEnabled, margin: 3, unit: "mm" } });
    return { project, printJob };
  };
  const enabled = buildJob(true);
  const disabled = buildJob(false);

  const exportOnce = async ({ project, printJob }: { project: Project; printJob: PrintJob }) =>
    exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });

  const resultEnabled = await exportOnce(enabled);
  const resultDisabled = await exportOnce(disabled);
  const bytesEnabled = new Uint8Array(await resultEnabled.pages[0]!.blob.arrayBuffer());
  const bytesDisabled = new Uint8Array(await resultDisabled.pages[0]!.blob.arrayBuffer());

  const identical = bytesEnabled.length === bytesDisabled.length && bytesEnabled.every((b, i) => b === bytesDisabled[i]);
  return { byteLengthEnabled: bytesEnabled.length, byteLengthDisabled: bytesDisabled.length, pass: identical };
}

async function scenario16_ellipseDieLineExportsSuccessfully(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "ellipse",
    transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 140, height: 140 },
    style: { ...baseStyle, fill: "transparent" },
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "sticker-sheet"); // cutPath.mode "die-cut", source auto
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  return { format: result.format, pageCount: result.pageCount, pass: result.format === "pdf" && result.pageCount === 1 };
}

async function scenario17_dieLineAbsentFromFlattenedRaster(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 30, height: 30 },
    cornerRadius: 0,
    style: { ...baseStyle, fill: "#ff0000" }, // rojo bien distinto del fondo, para detectar visualmente si se coló en el raster
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "px" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "digital-png", { background: { type: "solid", color: "#00ff00" } });
  const result = await exportPrintJobToPng({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const pixel = await readPixel(result.pages[0]!.blob, 25, 25); // centro del die-line
  return { pixel, pass: pixel.g > 200 && pixel.r < 50 }; // fondo verde, NUNCA el rojo del die-line
}

async function scenario18_cutPathAppearsAsRealPdfVector(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "sticker-sheet", { cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" } });
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const reloaded = await PDFDocument.load(bytes);
  const text = getPdfPageContentText(reloaded, 0);
  const imageDrawCount = (text.match(/\bDo\b/g) ?? []).length;
  const hasStroke = /\bS\b/.test(text);
  return { imageDrawCount, hasStroke, pass: imageDrawCount === 1 && hasStroke };
}

async function scenario19_pngCutPathIncludedOrExcludedPerConfig(): Promise<ScenarioResult> {
  const buildDieLineProject = () => {
    const dieLine: SceneObject = {
      id: ObjectIdSchema.parse(nextId("obj")),
      type: "rectangle",
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 30, height: 30 },
      cornerRadius: 0,
      style: baseStyle,
      metadata: dieLineMetadata(),
      pluginData: {},
      customProperties: {},
    };
    return buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  };

  const withCutPathProject = buildDieLineProject();
  const withCutPathJob = buildPrintJobFor(withCutPathProject, "sticker-sheet");
  const withoutCutPathProject = buildDieLineProject();
  const withoutCutPathJob = buildPrintJobFor(withoutCutPathProject, "sticker-sheet", {
    cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
  });

  const exportAndSamplePoint = async (project: Project, printJob: PrintJob) => {
    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });
    const page = result.pages[0]!;
    // Punto sobre el borde IZQUIERDO del die-line (10,10)-(40,40) canónico —
    // el trazo del cut path pasa exactamente por ahí cuando está activo.
    // Réplica de `canonicalPointToRasterPoint`: hay que sumar el offset
    // canónico del sangrado (TrimBox dentro del BleedBox ya rasterizado)
    // ANTES de escalar — el punto (10,10) del die-line es relativo al
    // TrimBox, no a la esquina del canvas.
    const targetPpi = printJob.resolution.targetPpi;
    const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
    const offsetXPx = Math.round(physicalToPixels(boxes.bleedOffsetWithinMedia.x, boxes.trim.unit, targetPpi));
    const offsetYPx = Math.round(physicalToPixels(boxes.bleedOffsetWithinMedia.y, boxes.trim.unit, targetPpi));
    const bleedCanonicalX = physicalToPixels(printJob.bleed.left, printJob.bleed.unit, 96);
    const bleedCanonicalY = physicalToPixels(printJob.bleed.top, printJob.bleed.unit, 96);
    const canonicalScale = targetPpi / 96;
    const x = offsetXPx + Math.round((bleedCanonicalX + 10) * canonicalScale);
    const y = offsetYPx + Math.round((bleedCanonicalY + 25) * canonicalScale);
    return readPixel(page.blob, x, y);
  };

  const pixelWith = await exportAndSamplePoint(withCutPathProject, withCutPathJob);
  const pixelWithout = await exportAndSamplePoint(withoutCutPathProject, withoutCutPathJob);
  const differs = pixelWith.r !== pixelWithout.r || pixelWith.g !== pixelWithout.g || pixelWith.b !== pixelWithout.b;

  return { pixelWith, pixelWithout, pass: differs };
}

async function scenario20_openPathBlocksExport(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "path",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    segments: [
      { type: "moveTo", point: { x: 0, y: 0 } },
      { type: "lineTo", point: { x: 10, y: 0 } },
      { type: "lineTo", point: { x: 10, y: 10 } },
    ],
    closed: false,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "sticker-sheet");
  let code: string | undefined;
  let issueCode: string | undefined;
  try {
    await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });
  } catch (error) {
    code = (error as { code?: string }).code;
    issueCode = (error as { preflightIssues?: Array<{ code: string }> }).preflightIssues?.find((i) => i.code === "cut_path_open")?.code;
  }
  return { code, issueCode, pass: code === "preflight-blocked" && issueCode === "cut_path_open" };
}

async function scenario21_multipleDieLinesBlockExport(): Promise<ScenarioResult> {
  const dieLine1: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const dieLine2: SceneObject = { ...dieLine1, id: ObjectIdSchema.parse(nextId("obj")) };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine1, dieLine2]);
  const printJob = buildPrintJobFor(project, "sticker-sheet");
  let code: string | undefined;
  let issueCode: string | undefined;
  try {
    await exportPrintJobToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
    });
  } catch (error) {
    code = (error as { code?: string }).code;
    issueCode = (error as { preflightIssues?: Array<{ code: string }> }).preflightIssues?.find((i) => i.code === "cut_path_multiple_candidates")?.code;
  }
  return { code, issueCode, pass: code === "preflight-blocked" && issueCode === "cut_path_multiple_candidates" };
}

async function scenario22_rectOffsetPreservesExactPhysicalDimensions(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const offsetMm = 5;
  const printJob = buildPrintJobFor(project, "sticker-sheet", {
    cutPath: { mode: "die-cut", source: { type: "auto" }, offset: offsetMm, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
  });

  const page = project.document.pages[0]!;
  const resolution = resolveDieLineSource(page, printJob.cutPath.source);
  if (resolution.status !== "found") return { pass: false, reason: resolution.status };
  const geometryResult = normalizeCutGeometry(resolution.candidate);
  if (!geometryResult.ok) return { pass: false, reason: geometryResult.reason };
  const offsetPx = physicalToPixels(offsetMm, "mm", 96); // canónico: 96dpi-equivalente
  const offsetResult = applyCutGeometryOffset(geometryResult.geometry, offsetPx);
  if (offsetResult.status !== "ok" || offsetResult.geometry.type !== "rectangle") return { pass: false, offsetResult };

  const expectedWidth = 40 + 2 * offsetPx;
  const widthMatches = Math.abs(offsetResult.geometry.width - expectedWidth) < 0.01;

  // Confirma también que el pipeline REAL (Konva/pdf-lib reales) exporta sin error con esta configuración.
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });

  return { expectedWidth, actualWidth: offsetResult.geometry.width, exportFormat: result.format, pass: widthMatches && result.format === "pdf" };
}

async function scenario23_unsupportedPathOffsetGeneratesExpectedIssue(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "path",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    segments: [
      { type: "moveTo", point: { x: 0, y: 0 } },
      { type: "lineTo", point: { x: 30, y: 0 } },
      { type: "lineTo", point: { x: 30, y: 30 } },
      { type: "lineTo", point: { x: 0, y: 30 } },
    ],
    closed: true,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "sticker-sheet", {
    cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 3, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
    offsetUnsupportedPolicy: "warn",
  });
  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const hasIssue = result.warnings.some((w) => w.code === "cut_path_offset_unsupported");
  return { warningCodes: result.warnings.map((w) => w.code), pass: hasIssue };
}

async function scenario24_multipagePreservesPerPageOverlays(): Promise<ScenarioResult> {
  const rectDieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const ellipseDieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "ellipse",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    style: { ...baseStyle, fill: "transparent" },
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };

  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [rectDieLine]);
  const page2Id = PageIdSchema.parse(nextId("page"));
  const page2Layer = LayerIdSchema.parse(nextId("layer"));
  project.document.pages.push({ ...project.document.pages[0]!, id: page2Id, layers: [{ id: page2Layer, objects: [ellipseDieLine], metadata: baseMetadata, pluginData: {}, customProperties: {} }] });

  const printJob = buildPrintJobFor(project, "sticker-sheet", {
    cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
  });
  printJob.pageIds = [project.document.pages[0]!.id, page2Id];

  const result = await exportPrintJobToPdf({
    project,
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const reloaded = await PDFDocument.load(bytes);
  const page1Text = getPdfPageContentText(reloaded, 0);
  const page2Text = getPdfPageContentText(reloaded, 1);
  const page1HasBezier = /\bc\b/.test(page1Text);
  const page2HasBezier = /\bc\b/.test(page2Text);

  return {
    pageCount: result.pageCount,
    page1HasBezier,
    page2HasBezier,
    pass: result.pageCount === 2 && !page1HasBezier && page2HasBezier,
  };
}

async function scenario25And26_projectImmutableAndNoDirtyStateWithOverlays(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const invader: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine, invader]);
  const printJob = buildPrintJobFor(project, "sticker-sheet"); // marks + safeArea + cutPath, todos activos

  const engine = createEngine(project);
  let projectChangedCount = 0;
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") projectChangedCount += 1;
  });

  const before = JSON.stringify(engine.getProject());
  await exportPrintJobToPng({
    project: engine.getProject(),
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  await exportPrintJobToPdf({
    project: engine.getProject(),
    printJob,
    resolver: noopResolver,
    projectName: "harness",
    fontChecker: browserFontChecker,
    imageProbe: browserImageDimensionsProbe,
    now: () => NOW,
  });
  const after = JSON.stringify(engine.getProject());
  unsubscribe();

  return {
    projectUnchanged: before === after,
    projectChangedEventCount: projectChangedCount,
    pass: before === after && projectChangedCount === 0,
  };
}

async function scenario27_cancellationDuringOverlayStageCleansUp(): Promise<ScenarioResult> {
  const dieLine: SceneObject = {
    id: ObjectIdSchema.parse(nextId("obj")),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: dieLineMetadata(),
    pluginData: {},
    customProperties: {},
  };
  const project = buildProject({ width: 50, height: 50, unit: "mm" }, [dieLine]);
  const printJob = buildPrintJobFor(project, "sticker-sheet"); // marks + cutPath activos: ejercita la composición de overlays
  const controller = new AbortController();
  let threw: string | undefined;
  let code: string | undefined;
  try {
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "harness",
      fontChecker: browserFontChecker,
      imageProbe: browserImageDimensionsProbe,
      now: () => NOW,
      signal: controller.signal,
      onProgress: (event) => {
        if (event.stage === "encoding-page") controller.abort();
      },
    });
    threw = "no-throw";
  } catch (error) {
    threw = "threw";
    code = (error as { code?: string }).code;
  }
  return { threw, code, pass: threw === "threw" && code === "aborted" };
}

async function run(): Promise<void> {
  const scenarios: Array<[string, () => Promise<ScenarioResult>]> = [
    ["1_pngDimensions_100mm_300ppi", scenario1_pngDimensions],
    ["2_pdfPhysicalSize_A4", scenario2_pdfPhysicalSize],
    ["3_pdfMultipage", scenario3_pdfMultipage],
    ["4_bleedContainsRealGeometry", scenario4_bleedContainsRealGeometry],
    ["5_solidBackground", scenario5_solidBackground],
    ["6_transparencyNeverBlack", scenario6_transparencyNeverBlack],
    ["7_cancelledExportProducesNoFile", scenario7_cancelledExportProducesNoFile],
    ["8_memoryBudgetBlocked", scenario8_memoryBudgetBlocked],
    ["9_fontDetectionIsCoherentSignalNeverAbsolute", scenario9_fontDetectionIsCoherentSignalNeverAbsolute],
    ["10_missingAssetNeverSubstituted", scenario10_missingAssetNeverSubstituted],
    ["11And12_projectImmutableAndNoDirtyState", scenario11And12_projectImmutableAndNoDirtyState],
    // Fase 9.3 (Marks, Safe Area & Cut Paths) — sección 29, 15 escenarios.
    ["13_bleedMarksMediaBoxLargerThanTrim", scenario13_bleedMarksMediaBoxLargerThanTrim],
    ["14_marksNeverInvadeTrimRealPixels", scenario14_marksNeverInvadeTrimRealPixels],
    ["15_safeAreaNeverLeaksIntoFinalRaster", scenario15_safeAreaNeverLeaksIntoFinalRaster],
    ["16_ellipseDieLineExportsSuccessfully", scenario16_ellipseDieLineExportsSuccessfully],
    ["17_dieLineAbsentFromFlattenedRaster", scenario17_dieLineAbsentFromFlattenedRaster],
    ["18_cutPathAppearsAsRealPdfVector", scenario18_cutPathAppearsAsRealPdfVector],
    ["19_pngCutPathIncludedOrExcludedPerConfig", scenario19_pngCutPathIncludedOrExcludedPerConfig],
    ["20_openPathBlocksExport", scenario20_openPathBlocksExport],
    ["21_multipleDieLinesBlockExport", scenario21_multipleDieLinesBlockExport],
    ["22_rectOffsetPreservesExactPhysicalDimensions", scenario22_rectOffsetPreservesExactPhysicalDimensions],
    ["23_unsupportedPathOffsetGeneratesExpectedIssue", scenario23_unsupportedPathOffsetGeneratesExpectedIssue],
    ["24_multipagePreservesPerPageOverlays", scenario24_multipagePreservesPerPageOverlays],
    ["25And26_projectImmutableAndNoDirtyStateWithOverlays", scenario25And26_projectImmutableAndNoDirtyStateWithOverlays],
    ["27_cancellationDuringOverlayStageCleansUp", scenario27_cancellationDuringOverlayStageCleansUp],
  ];

  const results: Record<string, ScenarioResult | { error: string }> = {};
  for (const [name, fn] of scenarios) {
    try {
      results[name] = await fn();
    } catch (error) {
      results[name] = { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
    }
  }

  const allPass = Object.values(results).every((r) => "pass" in r && r.pass === true);
  const output = { allPass, results };
  (window as unknown as { __printEngineHarnessResults: unknown }).__printEngineHarnessResults = output;
  document.getElementById("result")!.textContent = JSON.stringify(output, null, 2);
}

run();
