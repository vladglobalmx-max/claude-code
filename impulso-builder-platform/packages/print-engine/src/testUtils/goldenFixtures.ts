import { AssetIdSchema, ObjectIdSchema, type Project, type SceneObject } from "@impulso/document-schema";
import { buildDocument, buildEllipse, buildGroup, buildImage, buildImageAsset, buildLayer, buildPage, buildPath, buildProject, buildRectangle, buildText, NOW } from "./fixtures.js";

/**
 * Fixtures canónicos del pipeline de raster (Epic 9 / Fase 9.2, sección
 * 22 del enunciado) — originalmente 6 escenarios (texto+shape, imagen,
 * transparencia, object cruzando el trim, bleed asimétrico, multipágina);
 * ampliado en Fase 9.5 (Hardening & Golden Tests, sección 3 del
 * enunciado) con los 4 restantes del set de 10 pedido: Circular Sticker,
 * Closed Path Sticker, Sticker Sheet, Font Fallback + un grupo de Failure
 * Cases. No pretenden reemplazar la infraestructura completa de golden
 * OUTPUTS (hash/comparación normalizada, todavía pendiente dentro de esta
 * misma fase) — son los documentos de ENTRADA canónicos y reutilizables
 * que esa infraestructura consumirá, y ya se ejercitan aquí (ver
 * `raster/*.test.ts`, `pdf/*.test.ts`, y el harness de Chromium real en
 * `apps/sticker-builder/src/printEngineHarness.ts`).
 *
 * Nota sobre "piece_does_not_fit"/"sheet_memory_budget_exceeded" (Failure
 * Cases): son puramente configuración de `PrintJob`/`ImpositionSpec` (una
 * hoja demasiado chica, o una `quantity`/resolución que excede el
 * presupuesto) — no necesitan una geometría de `Project` especial, así
 * que NO tienen una función nombrada aparte aquí; cualquier fixture
 * simple (ej. `goldenTextAndShape`) combinado con los overrides correctos
 * de `imposition`/`memoryBudgetBytes` en el test que los consume ya los
 * ejercita (ver `preflight/impositionChecks.test.ts`).
 */

const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

/** 1. Texto + shape en la misma página. */
export function goldenTextAndShape(): Project {
  const rect: SceneObject = {
    id: ObjectIdSchema.parse("gold_rect_1"),
    type: "rectangle",
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 40 },
    cornerRadius: 0,
    style: { ...baseStyle, fill: "#ff0000" },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
    pluginData: {},
    customProperties: {},
  };
  const text = buildText("gold_text_1", { content: "Impulso" });
  return buildProject({ document: buildDocument([buildPage("gold_page_text_shape", [buildLayer("gold_layer_1", [rect, text])])]) });
}

/** 2. Un ImageObject con su Asset resolviendo correctamente. */
export function goldenImage(): Project {
  const asset = buildImageAsset("gold_asset_1");
  const image = buildImage("gold_image_1", { assetId: asset.id });
  return buildProject({
    document: buildDocument([buildPage("gold_page_image", [buildLayer("gold_layer_1", [image])])], { assets: [asset] }),
  });
}

/** 3. Página sin objects, perfil con fondo transparente — para verificar
 * que la transparencia real nunca se convierte en negro. */
export function goldenTransparent(): Project {
  return buildProject({ document: buildDocument([buildPage("gold_page_transparent", [])]) });
}

/** 4. Un object cuya geometría cruza el borde del trim (parcialmente
 * dentro, parcialmente fuera) — nunca clippeado por el Renderer (ver
 * ADR-0021, corrección 7). */
export function goldenObjectCrossingTrim(): Project {
  const rect: SceneObject = {
    id: ObjectIdSchema.parse("gold_rect_crossing"),
    type: "rectangle",
    transform: { x: -10, y: -10, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 30, height: 30 },
    cornerRadius: 0,
    style: { ...baseStyle, fill: "#00ff00" },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
    pluginData: {},
    customProperties: {},
  };
  return buildProject({
    document: buildDocument([buildPage("gold_page_crossing", [buildLayer("gold_layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "px" })]),
  });
}

/** 5. Bleed asimétrico (cada lado distinto) — usado junto a un
 * `PrintJob.bleed` con valores por lado distintos (ver `coordinates.ts`,
 * `pageBoxes.ts`). Este fixture solo define el `Project`; el `PrintJob`
 * con bleed asimétrico se construye en el test que lo consume. */
export function goldenForAsymmetricBleed(): Project {
  return buildProject({
    document: buildDocument([buildPage("gold_page_bleed", [], { size: { width: 50, height: 50 }, unit: "mm" })]),
  });
}

/** 6. Multipágina — 3 páginas, cada una con contenido propio (para
 * confirmar orden determinista de principio a fin). */
export function goldenMultiPage(): Project {
  const image = buildImage("gold_multi_image", { assetId: AssetIdSchema.parse("gold_multi_asset") });
  const group = buildGroup("gold_multi_group", [image]);
  return buildProject({
    document: buildDocument(
      [
        buildPage("gold_page_1", [buildLayer("layer_1", [buildText("gold_multi_text")])]),
        buildPage("gold_page_2", [buildLayer("layer_2", [group])]),
        buildPage("gold_page_3", []),
      ],
      { assets: [buildImageAsset("gold_multi_asset")] },
    ),
  });
}

/** 7. Circular Sticker — die-line circular (`EllipseObject` con
 * `metadata.role: "die-line"`) del tamaño físico completo de la página,
 * bleed y safe area reales, un object de contenido cruzando la mitad del
 * trim (para que safe area también tenga algo real que evaluar). Espejo
 * canónico del preset "Sticker circular" de `apps/sticker-builder`,
 * fijado a una página de 40x40mm (par, sin conversión con resto). */
export function goldenCircularSticker(): Project {
  const dieLine = buildEllipse("gold_circular_dieline", {
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 151.18, height: 151.18 }, // toPixels(40, "mm") ≈ 151.18 — cubre la página completa, por diseño.
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte" },
  });
  const content = buildRectangle("gold_circular_content", {
    transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 100, height: 100 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal", fill: "#3366cc" },
  });
  return buildProject({
    document: buildDocument([buildPage("gold_page_circular", [buildLayer("gold_layer_circular", [content, dieLine])], { size: { width: 40, height: 40 }, unit: "mm" })]),
  });
}

/** 8. Closed Path Sticker — un `PathObject` cerrado (no Rectangle/Ellipse)
 * como die-line, con `offset: 0` (el único caso soportado exactamente
 * para un path arbitrario, ver `cutGeometryOffset.ts`/ADR-0023) — cut
 * path vectorial real, sin degradar a bounding box. */
export function goldenClosedPathSticker(): Project {
  const dieLine = buildPath("gold_path_dieline", {
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    segments: [
      { type: "moveTo", point: { x: 0, y: 20 } },
      { type: "lineTo", point: { x: 20, y: 0 } },
      { type: "lineTo", point: { x: 40, y: 20 } },
      { type: "lineTo", point: { x: 20, y: 40 } },
    ],
    closed: true,
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte (path)" },
  });
  const content = buildRectangle("gold_path_content", {
    transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal", fill: "#e67e22" },
  });
  return buildProject({
    document: buildDocument([buildPage("gold_page_path", [buildLayer("gold_layer_path", [content, dieLine])], { size: { width: 40, height: 40 }, unit: "mm" })]),
  });
}

/** 9. Sticker Sheet — pieza pequeña (20x20mm) con die-line rectangular
 * exacto, pensada para combinarse con `imposition.mode: "grid"` en el
 * test que la consume (ej. `quantity` alta sobre una hoja A4 produce
 * varias hojas reales, con cut paths/marcas por copia) — ver
 * `raster/impositionPerformance.test.ts` para el mismo patrón a escala. */
export function goldenStickerSheet(): Project {
  const dieLine = buildRectangle("gold_sheet_dieline", {
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 75.59, height: 75.59 }, // toPixels(20, "mm") ≈ 75.59
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte" },
  });
  const content = buildEllipse("gold_sheet_content", {
    transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 55, height: 55 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal", fill: "#16a34a" },
  });
  return buildProject({
    document: buildDocument([buildPage("gold_page_sheet", [buildLayer("gold_layer_sheet", [content, dieLine])], { size: { width: 20, height: 20 }, unit: "mm" })]),
  });
}

/** 10a. Font Fallback — un `TextObject` con una fuente que casi
 * seguramente NO está declarada vía `@font-face` en ningún entorno de
 * test (para ejercer `font_unavailable`/`font_verification_uncertain` de
 * forma realista, en vez de con un `FontChecker` fake que simplemente
 * devuelve lo que el test quiere). */
export function goldenFontFallbackUnavailable(): Project {
  const text = buildText("gold_font_missing", { fontFamily: "Esta-Fuente-No-Existe-9F3A1C", content: "Impulso" });
  return buildProject({ document: buildDocument([buildPage("gold_page_font_missing", [buildLayer("gold_layer_font", [text])])]) });
}

/** 10b. Font Fallback — la contraparte con una fuente realmente
 * disponible (`sans-serif`, genérica del navegador, nunca ausente) — el
 * par completo permite un test que confirme que Preflight distingue
 * ambos casos, no que siempre reporta lo mismo. */
export function goldenFontFallbackAvailable(): Project {
  const text = buildText("gold_font_ok", { fontFamily: "sans-serif", content: "Impulso" });
  return buildProject({ document: buildDocument([buildPage("gold_page_font_ok", [buildLayer("gold_layer_font", [text])])]) });
}

/** 10c. Failure Case — Asset referenciado por un `ImageObject` que NO
 * existe en `document.assets` (nunca sustituido silenciosamente, ver
 * ADR-0021) — dispara `asset_reference_missing`. */
export function goldenFailureMissingAsset(): Project {
  const image = buildImage("gold_fail_image", { assetId: AssetIdSchema.parse("gold_fail_asset_nonexistent") });
  return buildProject({ document: buildDocument([buildPage("gold_page_fail_asset", [buildLayer("gold_layer_fail_asset", [image])])]) });
}

/** 10d. Failure Case — un `PathObject` marcado como die-line pero
 * `closed: false` — dispara `cut_path_open` (nunca se cierra
 * silenciosamente un path abierto para tratarlo como cut path). */
export function goldenFailureOpenPathDieLine(): Project {
  const openPath = buildPath("gold_fail_open_path", {
    closed: false,
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte abierta" },
  });
  return buildProject({ document: buildDocument([buildPage("gold_page_fail_open", [buildLayer("gold_layer_fail_open", [openPath])], { size: { width: 30, height: 30 }, unit: "mm" })]) });
}

/** 10e. Failure Case — DOS objects marcados como die-line en la misma
 * página — dispara `cut_path_multiple_candidates` (nunca elige el primero
 * en silencio, ver `resolveDieLineSource`/ADR-0023). */
export function goldenFailureMultipleDieLines(): Project {
  const dieLine1 = buildRectangle("gold_fail_dieline_1", { metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte 1" } });
  const dieLine2 = buildRectangle("gold_fail_dieline_2", {
    transform: { x: 15, y: 15, rotation: 0, scaleX: 1, scaleY: 1 },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line", name: "Línea de corte 2" },
  });
  return buildProject({
    document: buildDocument([buildPage("gold_page_fail_multi", [buildLayer("gold_layer_fail_multi", [dieLine1, dieLine2])], { size: { width: 30, height: 30 }, unit: "mm" })]),
  });
}
