import { describe, expect, it } from "vitest";
import { ProjectSchema } from "@impulso/document-schema";
import { createProjectFromSize } from "./projectPresets.js";

const NOW = "2026-07-18T00:00:00.000Z";

function idGeneratorFrom(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++]!;
}

describe("createProjectFromSize", () => {
  it("produce un Project válido según ProjectSchema", () => {
    const project = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "square", now: NOW });
    expect(() => ProjectSchema.parse(project)).not.toThrow();
  });

  it("usa el ancho/alto dado, en milímetros, como tamaño de la página", () => {
    const project = createProjectFromSize({ widthMm: 70, heightMm: 50, shape: "rectangle", now: NOW });
    expect(project.document.pages[0]?.size).toEqual({ width: 70, height: 50 });
    expect(project.document.pages[0]?.unit).toBe("mm");
  });

  it("shape 'square'/'rectangle'/'custom' no agregan ningún object (el corte es el borde de la página)", () => {
    for (const shape of ["square", "rectangle", "custom"] as const) {
      const project = createProjectFromSize({ widthMm: 50, heightMm: 50, shape, now: NOW });
      expect(project.document.pages[0]?.layers[0]?.objects).toEqual([]);
    }
  });

  it("shape 'circle' agrega un EllipseObject de fondo con metadata.role 'die-line'", () => {
    const project = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "circle", now: NOW });
    const objects = project.document.pages[0]?.layers[0]?.objects ?? [];
    expect(objects).toHaveLength(1);
    expect(objects[0]?.type).toBe("ellipse");
    expect(objects[0]?.metadata.role).toBe("die-line");
    if (objects[0]?.type === "ellipse") {
      expect(objects[0].size).toEqual({ width: 50, height: 50 });
    }
  });

  it("cada llamada produce ids frescos (dos proyectos nunca comparten id)", () => {
    const first = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "square", now: NOW });
    const second = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "square", now: NOW });
    expect(first.id).not.toBe(second.id);
    expect(first.document.id).not.toBe(second.document.id);
    expect(first.document.pages[0]?.id).not.toBe(second.document.pages[0]?.id);
  });

  it("con un generateId inyectado, los ids son determinísticos", () => {
    const generateId = idGeneratorFrom(["p1", "doc1", "page1", "layer1"]);
    const project = createProjectFromSize({ widthMm: 50, heightMm: 50, shape: "square", now: NOW, generateId });

    expect(project.id).toBe("project_p1");
    expect(project.document.id).toBe("document_doc1");
    expect(project.document.pages[0]?.id).toBe("page_page1");
    expect(project.document.pages[0]?.layers[0]?.id).toBe("layer_layer1");
  });
});
