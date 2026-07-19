import { describe, expect, it } from "vitest";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema, AssetIdSchema } from "@impulso/document-schema";
import { applyContentCommand, applyContentCommandBatch } from "./applyCommand.js";
import {
  buildProject,
  buildDocument,
  buildPage,
  buildLayer,
  buildRectangle,
  buildText,
  buildGroup,
  buildImageAsset,
  NOW,
} from "../testUtils/fixtures.js";

function options(now = NOW) {
  let counter = 0;
  return { now, generateHistoryEntryId: () => `history_${++counter}` };
}

/** Documento con 2 páginas y una página con 2 layers/2 objects, para poder
 * ejercitar los comandos de "reorder" de forma significativa. */
function richProject() {
  return buildProject({
    document: buildDocument([
      buildPage("page_1", [
        buildLayer("layer_1", [buildRectangle("rect_1"), buildRectangle("rect_2")]),
        buildLayer("layer_2"),
      ]),
      buildPage("page_2"),
    ]),
  });
}

describe("applyContentCommand — versionado e historial", () => {
  it("camino feliz: updateMetadata a nivel documento incrementa documentVersion y agrega history", () => {
    const project = buildProject();
    const before = project.document.documentVersion;

    const result = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Renombrado" } },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.documentVersion).toBe(before + 1);
      expect(result.value.document.history.entries).toHaveLength(1);
      expect(result.value.document.history.entries[0]).toMatchObject({
        documentVersionBefore: before,
        documentVersionAfter: before + 1,
        description: "Actualizar metadata (document)",
      });
      expect(result.value.document.metadata.updatedAt).toBe(NOW);
      expect(result.value.metadata.updatedAt).toBe(NOW);
    }
  });

  it("updateMetadata a nivel project NO incrementa documentVersion ni agrega history", () => {
    const project = buildProject();
    const before = project.document.documentVersion;

    const result = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "project" }, metadata: { name: "Solo el proyecto" } },
      options(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.documentVersion).toBe(before);
      expect(result.value.document.history.entries).toHaveLength(0);
      expect(result.value.metadata.name).toBe("Solo el proyecto");
      expect(result.value.metadata.updatedAt).toBe(NOW);
    }
  });

  it("acumula múltiples entradas de historial en orden", () => {
    let project = buildProject();
    const opts = options();

    const first = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Uno" } },
      opts,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    project = first.value;

    const second = applyContentCommand(
      project,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "Dos" } },
      opts,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.value.document.history.entries.map((e) => e.id)).toEqual(["history_1", "history_2"]);
    expect(second.value.document.documentVersion).toBe(project.document.documentVersion + 1);
  });

  it("propaga el error del reducer sin tocar version/historial", () => {
    const project = buildProject();
    const result = applyContentCommand(
      project,
      { type: "removePage", pageId: "no_existe" as never },
      options(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_not_found");
  });

  it("la red de seguridad rechaza un Project que quedaría inválido, aunque el reducer específico no lo detecte", () => {
    // Se corrompe el documento a propósito (pages: []) SIN pasar por
    // removePage (que sí lo impediría) para probar que applyContentCommand
    // no confía ciegamente en cada reducer individual.
    const project = buildProject();
    const corrupted = { ...project, document: { ...project.document, pages: [] } };

    const result = applyContentCommand(
      corrupted,
      { type: "updateMetadata", target: { level: "document" }, metadata: { name: "x" } },
      options(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invariant_violation");
  });
});

describe("applyContentCommand — cada tipo de ContentCommand a través del pipeline completo", () => {
  it("removePage", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "removePage", pageId: PageIdSchema.parse("page_2") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Eliminar página "page_2"');
    }
  });

  it("reorderPages", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "reorderPages", pageIds: [PageIdSchema.parse("page_2"), PageIdSchema.parse("page_1")] },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_2", "page_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar páginas");
    }
  });

  it("removeLayer", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "removeLayer", pageId: PageIdSchema.parse("page_1"), layerId: LayerIdSchema.parse("layer_2") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Eliminar layer "layer_2"');
    }
  });

  it("reorderLayers", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "reorderLayers",
        pageId: PageIdSchema.parse("page_1"),
        layerIds: [LayerIdSchema.parse("layer_2"), LayerIdSchema.parse("layer_1")],
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers.map((l) => l.id)).toEqual(["layer_2", "layer_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar layers");
    }
  });

  it("updateObjectStyle", () => {
    const result = applyContentCommand(
      richProject(),
      { type: "updateObjectStyle", objectId: ObjectIdSchema.parse("rect_1"), style: { fill: "#ff00ff" } },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.style.fill).toBe("#ff00ff");
      expect(result.value.document.history.entries[0]?.description).toBe('Cambiar estilo de object "rect_1"');
    }
  });

  it("reorderObjects", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "reorderObjects",
        pageId: PageIdSchema.parse("page_1"),
        layerId: LayerIdSchema.parse("layer_1"),
        objectIds: [ObjectIdSchema.parse("rect_2"), ObjectIdSchema.parse("rect_1")],
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["rect_2", "rect_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe("Reordenar objects");
    }
  });

  it("resizeObject", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "resizeObject",
        objectId: ObjectIdSchema.parse("rect_1"),
        handle: "bottom-right",
        pointerDelta: { x: 5, y: 5 },
        intrinsicSize: { width: 10, height: 10 },
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1.5, scaleY: 1.5 });
      expect(result.value.document.history.entries[0]?.description).toBe(
        'Redimensionar object "rect_1" (handle: bottom-right)',
      );
    }
  });

  it("rotateObject", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "rotateObject",
        objectId: ObjectIdSchema.parse("rect_1"),
        pointerAngleDegrees: 45,
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.rotation).toBe(45);
      expect(result.value.document.history.entries[0]?.description).toBe('Rotar object "rect_1"');
    }
  });

  it("updateObjectContent", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildText("text_1")])])]),
    });
    const result = applyContentCommand(
      project,
      { type: "updateObjectContent", objectId: ObjectIdSchema.parse("text_1"), content: "Hola" },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.type === "text" && object.content).toBe("Hola");
      expect(result.value.document.history.entries[0]?.description).toBe('Cambiar contenido de object "text_1"');
    }
  });

  it("updateTextStyle", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildText("text_1")])])]),
    });
    const result = applyContentCommand(
      project,
      { type: "updateTextStyle", objectId: ObjectIdSchema.parse("text_1"), textStyle: { fontSize: 24 } },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.type === "text" && object.fontSize).toBe(24);
      expect(result.value.document.history.entries[0]?.description).toBe('Cambiar estilo de texto de object "text_1"');
    }
  });

  it("groupObjects", () => {
    const result = applyContentCommand(
      richProject(),
      {
        type: "groupObjects",
        objectIds: [ObjectIdSchema.parse("rect_1"), ObjectIdSchema.parse("rect_2")],
        group: {
          id: ObjectIdSchema.parse("group_1"),
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
          metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
          pluginData: {},
          customProperties: {},
        },
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["group_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Agrupar 2 objects en "group_1"');
    }
  });

  it("ungroupObject", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [buildRectangle("rect_1")])])]),
      ]),
    });
    const result = applyContentCommand(
      project,
      { type: "ungroupObject", objectId: ObjectIdSchema.parse("group_1") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["rect_1"]);
      expect(result.value.document.history.entries[0]?.description).toBe('Desagrupar "group_1"');
    }
  });

  it("addAsset", () => {
    const asset = buildImageAsset("asset_1");
    const result = applyContentCommand(buildProject(), { type: "addAsset", asset }, options());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets).toEqual([asset]);
      expect(result.value.document.history.entries[0]?.description).toBe('Agregar asset "asset_1" (image)');
    }
  });

  it("removeAsset", () => {
    const project = buildProject({
      document: { ...buildProject().document, assets: [buildImageAsset("asset_1")] },
    });
    const result = applyContentCommand(
      project,
      { type: "removeAsset", assetId: AssetIdSchema.parse("asset_1") },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets).toEqual([]);
      expect(result.value.document.history.entries[0]?.description).toBe('Eliminar asset "asset_1"');
    }
  });

  it("renameAsset", () => {
    const project = buildProject({
      document: { ...buildProject().document, assets: [buildImageAsset("asset_1", { name: "viejo.png" })] },
    });
    const result = applyContentCommand(
      project,
      { type: "renameAsset", assetId: AssetIdSchema.parse("asset_1"), name: "nuevo.png" },
      options(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets[0]?.name).toBe("nuevo.png");
      expect(result.value.document.history.entries[0]?.description).toBe('Renombrar asset "asset_1"');
    }
  });
});

/** Documento con 2 rectangles top-level, para ejercitar batches multi-object. */
function twoRectProject() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])])]),
  });
}

describe("applyContentCommandBatch — Epic 7 / Fase 7.2 (Batch Operations)", () => {
  it("batch exitoso: aplica los N comandos y produce una sola entrada de historial", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const objects = result.value.document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.transform.x)).toEqual([10, 20]);
    expect(result.value.document.history.entries).toHaveLength(1);
    expect(result.value.document.documentVersion).toBe(project.document.documentVersion + 1);
  });

  it("batch de un solo comando: mismo resultado observable que dispatch() de ese comando", () => {
    const project = twoRectProject();
    const single = applyContentCommand(
      project,
      { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
      options(),
    );
    const batch = applyContentCommandBatch(
      project,
      [{ type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } }],
      options(),
    );
    expect(single.ok).toBe(true);
    expect(batch.ok).toBe(true);
    if (!single.ok || !batch.ok) return;
    expect(batch.value.document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(10);
    expect(batch.value.document.history.entries[0]?.description).toBe(
      single.value.document.history.entries[0]?.description,
    );
    expect(batch.value.document.history.entries).toHaveLength(1);
  });

  it("batch vacío: no-op explícito, mismo project, sin entrada de historial", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(project, [], options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(project); // misma referencia: ni siquiera se reconstruyó
    expect(result.value.document.history.entries).toHaveLength(0);
    expect(result.value.document.documentVersion).toBe(project.document.documentVersion);
  });

  it("falla en el primer comando: el batch entero se rechaza, nada se aplica", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("object_not_found");
  });

  it("falla en un comando intermedio: el batch entero se rechaza, nada se aplica", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b"), buildRectangle("c")])]),
      ]),
    });
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 20 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("c"), transform: { x: 30 } },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("object_not_found");
  });

  it("falla en el último comando: el batch entero se rechaza, nada se aplica", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
  });

  it("estado intacto después de un fallo: el project original no se modifica ni siquiera parcialmente", () => {
    const project = twoRectProject();
    const snapshot = JSON.parse(JSON.stringify(project));
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 999 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    expect(project).toEqual(snapshot);
    expect(project.document.pages[0]?.layers[0]?.objects[0]?.transform.x).toBe(0);
  });

  it("orden de ejecución: los comandos se aplican en el orden dado, cada uno viendo el efecto del anterior", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        // Depende del resultado del comando anterior sobre el MISMO object.
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { y: 5 } },
      ],
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const object = result.value.document.pages[0]?.layers[0]?.objects[0];
    expect(object?.transform.x).toBe(10);
    expect(object?.transform.y).toBe(5);
  });

  it("comandos que afectan distintos objects: cada uno recibe su propio patch de forma independiente", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectStyle", objectId: ObjectIdSchema.parse("a"), style: { opacity: 0.5 } },
        { type: "updateObjectStyle", objectId: ObjectIdSchema.parse("b"), style: { opacity: 0.2 } },
      ],
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const objects = result.value.document.pages[0]?.layers[0]?.objects;
    expect(objects?.map((o) => o.style.opacity)).toEqual([0.5, 0.2]);
  });

  it("IDs inexistentes: se rechaza con object_not_found, sin aplicar el resto del batch", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [{ type: "removeObject", objectId: ObjectIdSchema.parse("fantasma") }],
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("object_not_found");
  });

  it("valores inválidos: un patch que dejaría el object en un estado inválido rechaza todo el batch", () => {
    const project = twoRectProject();
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectStyle", objectId: ObjectIdSchema.parse("b"), style: { opacity: 5 } }, // fuera de [0,1]
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_style");
  });

  it("no deja entradas de historial parciales: un batch fallido no agrega ninguna entrada", () => {
    const project = twoRectProject();
    const historyBefore = project.document.history.entries.length;
    const result = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("no-existe"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(result.ok).toBe(false);
    expect(project.document.history.entries).toHaveLength(historyBefore);
  });

  it("la red de seguridad rechaza un batch cuyo resultado combinado sea inválido, aunque cada reducer individual lo haya aceptado", () => {
    // Mismo criterio que el equivalente singular de `applyContentCommand`:
    // se corrompe el documento a propósito (pages: []) sin pasar por un
    // reducer que lo detectaría, para probar que la validación final del
    // batch no confía ciegamente en el éxito de cada comando individual.
    const project = twoRectProject();
    const corrupted = { ...project, document: { ...project.document, pages: [] } };

    const result = applyContentCommandBatch(
      corrupted,
      [{ type: "updateMetadata", target: { level: "document" }, metadata: { name: "x" } }],
      options(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invariant_violation");
  });

  it("usa la etiqueta dada en `label`, o describe el batch por defecto (N cambios)", () => {
    const project = twoRectProject();
    const withLabel = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
      ],
      { ...options(), label: "Alinear a la izquierda" },
    );
    expect(withLabel.ok && withLabel.value.document.history.entries[0]?.description).toBe("Alinear a la izquierda");

    const withoutLabel = applyContentCommandBatch(
      project,
      [
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("a"), transform: { x: 10 } },
        { type: "updateObjectTransform", objectId: ObjectIdSchema.parse("b"), transform: { x: 20 } },
      ],
      options(),
    );
    expect(withoutLabel.ok && withoutLabel.value.document.history.entries[0]?.description).toBe(
      "Operación por lotes (2 cambios)",
    );
  });
});
