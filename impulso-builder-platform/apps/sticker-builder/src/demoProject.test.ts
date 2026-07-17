import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createDemoProject } from "./demoProject.js";

describe("createDemoProject", () => {
  it("produce un Project válido contra ProjectSchema", () => {
    const project = createDemoProject();
    expect(() => validateProject(project)).not.toThrow();
  });

  it("incluye más de un tipo de SceneObject (rectangle, ellipse, text)", () => {
    const project = createDemoProject();
    const objects = project.document.pages[0]?.layers[0]?.objects ?? [];
    const types = objects.map((object) => object.type);
    expect(types).toEqual(["rectangle", "ellipse", "text"]);
  });

  it("cada llamada produce un Project fresco e independiente", () => {
    const a = createDemoProject();
    const b = createDemoProject();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.document.pages).not.toBe(b.document.pages);
  });
});
