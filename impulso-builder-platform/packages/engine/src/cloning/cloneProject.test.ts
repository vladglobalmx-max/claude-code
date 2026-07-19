import { describe, expect, it } from "vitest";
import { cloneProjectWithNewIds } from "./cloneProject.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, buildGroup, NOW } from "../testUtils/fixtures.js";

const LATER = "2026-08-01T00:00:00.000Z";

function idGeneratorFrom(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++]!;
}

describe("cloneProjectWithNewIds", () => {
  it("asigna un id nuevo a Project/Document/Page/Layer/Object, nunca reutiliza el original", () => {
    const original = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const generateId = idGeneratorFrom(["proj2", "doc2", "page2", "layer2", "rect2"]);

    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId });

    expect(clone.id).toBe("project_proj2");
    expect(clone.document.id).toBe("document_doc2");
    expect(clone.document.pages[0]?.id).toBe("page_page2");
    expect(clone.document.pages[0]?.layers[0]?.id).toBe("layer_layer2");
    expect(clone.document.pages[0]?.layers[0]?.objects[0]?.id).toBe("object_rect2");

    expect(clone.id).not.toBe(original.id);
    expect(clone.document.id).not.toBe(original.document.id);
  });

  it("clona múltiples pages/layers/objects, cada uno con su propio id fresco", () => {
    const original = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
        buildPage("page_2", [buildLayer("layer_2", [buildRectangle("c")])]),
      ]),
    });
    const generateId = idGeneratorFrom(["proj", "doc", "p1", "l1", "a2", "b2", "p2", "l2", "c2"]);

    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId });

    expect(clone.document.pages).toHaveLength(2);
    expect(clone.document.pages[0]?.layers[0]?.objects.map((o) => o.id)).toEqual(["object_a2", "object_b2"]);
    expect(clone.document.pages[1]?.layers[0]?.objects.map((o) => o.id)).toEqual(["object_c2"]);
  });

  it("clona un group recursivamente, con ids frescos en todos los niveles", () => {
    const group = buildGroup("group_1", [buildRectangle("child_a")]);
    const original = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]) });
    const generateId = idGeneratorFrom(["proj", "doc", "page", "layer", "group2", "child2"]);

    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId });
    const clonedGroup = clone.document.pages[0]?.layers[0]?.objects[0];
    expect(clonedGroup?.id).toBe("object_group2");
    if (clonedGroup?.type === "group") {
      expect(clonedGroup.children[0]?.id).toBe("object_child2");
    }
  });

  it("reinicia documentVersion a 1 y el historial a vacío", () => {
    const original = buildProject({
      document: buildDocument([buildPage("page_1")], { documentVersion: 7, history: { entries: [] } }),
    });
    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId: idGeneratorFrom(["p", "d", "pg", "l"]) });

    expect(clone.document.documentVersion).toBe(1);
    expect(clone.document.history.entries).toEqual([]);
  });

  it("actualiza createdAt/updatedAt de Project y Document, sin mutar el original", () => {
    const original = buildProject();
    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId: idGeneratorFrom(["p", "d", "pg", "l"]) });

    expect(clone.metadata.createdAt).toBe(LATER);
    expect(clone.document.metadata.createdAt).toBe(LATER);
    expect(original.metadata.createdAt).toBe(NOW);
  });

  it("preserva document.assets y assetId de ImageObject sin reasignarlos (no hay binario que duplicar)", () => {
    const image = {
      ...buildRectangle("img_1"),
      type: "image" as const,
      assetId: "asset_shared" as never,
      size: { width: 10, height: 10 },
    };
    const original = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], {
        assets: [{ id: "asset_shared", type: "image", name: "logo", mimeType: "image/png", width: 10, height: 10, metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW }, pluginData: {}, customProperties: {} } as never],
      }),
    });

    const clone = cloneProjectWithNewIds(original, { now: LATER, generateId: idGeneratorFrom(["p", "d", "pg", "l", "img2"]) });

    expect(clone.document.assets).toEqual(original.document.assets);
    const clonedObject = clone.document.pages[0]?.layers[0]?.objects[0];
    expect(clonedObject && "assetId" in clonedObject ? clonedObject.assetId : undefined).toBe("asset_shared");
  });

  it("no muta el Project original", () => {
    const original = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const originalId = original.id;
    const originalDocumentId = original.document.id;

    cloneProjectWithNewIds(original, { now: LATER, generateId: idGeneratorFrom(["p", "d", "pg", "l", "o"]) });

    expect(original.id).toBe(originalId);
    expect(original.document.id).toBe(originalDocumentId);
  });
});
