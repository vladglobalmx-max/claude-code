import { describe, expect, it } from "vitest";
import { ProjectSchema } from "./project.js";
import { buildMinimalProject } from "../testUtils/fixtures.js";

describe("ProjectSchema", () => {
  it("valida un proyecto mínimo bien formado, con su Document anidado", () => {
    const project = buildMinimalProject();
    expect(() => ProjectSchema.parse(project)).not.toThrow();
  });

  it("rechaza un moduleId vacío", () => {
    const project = buildMinimalProject();
    expect(() => ProjectSchema.parse({ ...project, moduleId: "" })).toThrow();
  });

  it("rechaza un Document anidado inválido (sin páginas)", () => {
    const project = buildMinimalProject();
    expect(() =>
      ProjectSchema.parse({ ...project, document: { ...project.document, pages: [] } }),
    ).toThrow();
  });
});
