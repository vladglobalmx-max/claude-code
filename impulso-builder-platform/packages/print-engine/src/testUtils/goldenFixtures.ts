import { AssetIdSchema, ObjectIdSchema, type Project, type SceneObject } from "@impulso/document-schema";
import { buildDocument, buildGroup, buildImage, buildImageAsset, buildLayer, buildPage, buildProject, buildText, NOW } from "./fixtures.js";

/**
 * Fixtures canónicos del pipeline de raster (Epic 9 / Fase 9.2, sección
 * 22 del enunciado) — los 6 escenarios nombrados explícitamente:
 * texto+shape, imagen, transparencia, object cruzando el trim, bleed
 * asimétrico, multipágina. No pretenden reemplazar la infraestructura
 * completa de golden files (deliberadamente diferida a Fase 9.5,
 * "Hardening & Golden Tests") — son un punto de partida nombrado y
 * reutilizable para esa fase, y ya se ejercitan en esta (ver
 * `raster/*.test.ts`, `pdf/*.test.ts`, y el harness de Chromium real en
 * `apps/sticker-builder/src/printEngineHarness.ts`).
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
