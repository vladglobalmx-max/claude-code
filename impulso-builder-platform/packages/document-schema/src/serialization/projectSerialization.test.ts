import { describe, expect, it } from "vitest";
import {
  validateProject,
  serializeProject,
  deserializeProject,
  cloneProject,
} from "./projectSerialization.js";
import { buildMinimalProject } from "../testUtils/fixtures.js";

describe("serialización de Project", () => {
  it("serializeProject -> deserializeProject produce un proyecto equivalente", () => {
    const project = buildMinimalProject();
    const json = serializeProject(project);
    const roundTripped = deserializeProject(json);
    expect(roundTripped).toEqual(project);
  });

  it("deserializeProject migra el Document embebido antes de validar el Project completo", () => {
    const project = buildMinimalProject();
    const rawWithOldDocumentShape = JSON.stringify({
      ...project,
      document: {
        ...project.document,
        schemaVersion: 1,
        pages: undefined,
        legacyPages: project.document.pages,
      },
    });

    const result = deserializeProject(rawWithOldDocumentShape, {
      migrations: [
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: (raw) => {
            const rest = { ...raw };
            delete rest.legacyPages;
            return { ...rest, pages: raw.legacyPages };
          },
        },
      ],
      targetVersion: 2,
    });

    expect(result.document.schemaVersion).toBe(2);
    expect(result.document.pages).toEqual(project.document.pages);
  });

  it("deserializeProject rechaza un payload sin campo 'document'", () => {
    expect(() => deserializeProject(JSON.stringify({ id: "x", moduleId: "y" }))).toThrow(
      /document/,
    );
  });

  it("deserializeProject rechaza un payload que no es un objeto JSON", () => {
    expect(() => deserializeProject("[1,2,3]")).toThrow(/objeto JSON/);
    expect(() => deserializeProject("null")).toThrow(/objeto JSON/);
  });

  it("validateProject y cloneProject operan sobre el mismo proyecto", () => {
    const project = buildMinimalProject();
    expect(validateProject(project)).toEqual(project);
    const cloned = cloneProject(project);
    expect(cloned).toEqual(project);
    expect(cloned).not.toBe(project);
  });
});
