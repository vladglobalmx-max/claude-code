import { describe, expect, it } from "vitest";
import { instantiateTemplate } from "./instantiateTemplate.js";
import { buildTemplateProject } from "./testUtils/fixtures.js";

const LATER = "2026-08-01T00:00:00.000Z";

function idGeneratorFrom(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++]!;
}

describe("instantiateTemplate", () => {
  it("produce un Project con ids frescos, nunca los del template original", () => {
    const template = buildTemplateProject();
    const generateId = idGeneratorFrom(["proj2", "doc2", "page2", "layer2"]);

    const instance = instantiateTemplate(template, { now: LATER, generateId });

    expect(instance.id).not.toBe(template.id);
    expect(instance.document.id).not.toBe(template.document.id);
    expect(instance.document.pages[0]?.id).not.toBe(template.document.pages[0]?.id);
  });

  it("no muta el Project del template", () => {
    const template = buildTemplateProject();
    const originalId = template.id;

    instantiateTemplate(template, { now: LATER, generateId: idGeneratorFrom(["a", "b", "c", "d"]) });

    expect(template.id).toBe(originalId);
  });

  it("preserva moduleId — la instancia sigue perteneciendo al mismo módulo que el template", () => {
    const template = buildTemplateProject({ moduleId: "planner-builder" });
    const instance = instantiateTemplate(template, { now: LATER, generateId: idGeneratorFrom(["a", "b", "c", "d"]) });
    expect(instance.moduleId).toBe("planner-builder");
  });
});
