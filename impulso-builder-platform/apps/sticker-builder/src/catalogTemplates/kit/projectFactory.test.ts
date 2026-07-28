import { describe, expect, it } from "vitest";
import { ProjectSchema } from "@impulso/document-schema";
import { createCatalogProject } from "./projectFactory.js";

const NOW = "2026-07-28T00:00:00.000Z";
function idGeneratorFrom(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++]!;
}

describe("createCatalogProject", () => {
  it("produce un Project válido según ProjectSchema, incluso sin objetos", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "Vacío",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      buildObjects: () => [],
    });
    expect(() => ProjectSchema.parse(project)).not.toThrow();
  });

  it("usa moduleId/name/tamaño exactamente como se pasan", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "Mi Template",
      widthMm: 70,
      heightMm: 50,
      now: NOW,
      buildObjects: () => [],
    });
    expect(project.moduleId).toBe("sticker-builder");
    expect(project.metadata.name).toBe("Mi Template");
    expect(project.document.pages[0]?.size).toEqual({ width: 70, height: 50 });
    expect(project.document.pages[0]?.unit).toBe("mm");
  });

  it("unit es 'mm' por defecto pero puede sobreescribirse", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      unit: "px",
      buildObjects: () => [],
    });
    expect(project.document.pages[0]?.unit).toBe("px");
  });

  it("invoca buildObjects con la fábrica de ids y coloca su resultado en la única Layer", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      buildObjects: ({ ids, now }) => [
        {
          id: ids.objectId(),
          type: "rectangle",
          size: { width: 1, height: 1 },
          cornerRadius: 0,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
          metadata: { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now, role: "test" },
          pluginData: {},
          customProperties: {},
        },
      ],
    });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects).toHaveLength(1);
    expect(objects[0]?.metadata.role).toBe("test");
  });

  it("assets: [] y history vacío siempre, sin importar buildObjects", () => {
    const project = createCatalogProject({ moduleId: "m", name: "n", widthMm: 40, heightMm: 40, now: NOW, buildObjects: () => [] });
    expect(project.document.assets).toEqual([]);
    expect(project.document.history.entries).toEqual([]);
  });

  it("cada llamada produce ids frescos (dos proyectos nunca comparten id)", () => {
    const build = () =>
      createCatalogProject({ moduleId: "m", name: "n", widthMm: 40, heightMm: 40, now: NOW, buildObjects: () => [] });
    const first = build();
    const second = build();
    expect(first.id).not.toBe(second.id);
    expect(first.document.id).not.toBe(second.document.id);
  });

  it("con un generateId inyectado: buildObjects consume ids ANTES que Project/Document/Page/Layer (mismo orden que el código original)", () => {
    const generateId = idGeneratorFrom(["obj1", "p1", "doc1", "page1", "layer1"]);
    const project = createCatalogProject({
      moduleId: "m",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      generateId,
      buildObjects: ({ ids }) => [
        {
          id: ids.objectId(),
          type: "rectangle",
          size: { width: 1, height: 1 },
          cornerRadius: 0,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
          metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
          pluginData: {},
          customProperties: {},
        },
      ],
    });

    expect(project.document.pages[0]!.layers[0]!.objects[0]!.id).toBe("object_obj1");
    expect(project.id).toBe("project_p1");
    expect(project.document.id).toBe("document_doc1");
    expect(project.document.pages[0]?.id).toBe("page_page1");
    expect(project.document.pages[0]?.layers[0]?.id).toBe("layer_layer1");
  });
});
