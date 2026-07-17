import { describe, expect, it } from "vitest";
import {
  validateDocument,
  serializeDocument,
  deserializeDocument,
  cloneDocument,
} from "./documentSerialization.js";
import { buildMinimalDocument } from "../testUtils/fixtures.js";
import { UnsupportedSchemaVersionError } from "../version/migration.js";

describe("serialización de Document", () => {
  it("serializeDocument -> deserializeDocument produce un documento equivalente", () => {
    const document = buildMinimalDocument();
    const json = serializeDocument(document);
    const roundTripped = deserializeDocument(json);
    expect(roundTripped).toEqual(document);
  });

  it("deserializeDocument aplica migraciones antes de validar (inyectadas en el test)", () => {
    const document = buildMinimalDocument();
    const rawWithOldShape = JSON.stringify({
      ...document,
      schemaVersion: 1,
      pages: undefined,
      legacyPages: document.pages,
    });

    const result = deserializeDocument(rawWithOldShape, {
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

    expect(result.schemaVersion).toBe(2);
    expect(result.pages).toEqual(document.pages);
  });

  it("deserializeDocument rechaza un payload que no es un objeto JSON", () => {
    expect(() => deserializeDocument("[1,2,3]")).toThrow(/objeto JSON/);
    expect(() => deserializeDocument("null")).toThrow(/objeto JSON/);
  });

  it("deserializeDocument lanza UnsupportedSchemaVersionError si falta schemaVersion", () => {
    expect(() => deserializeDocument(JSON.stringify({ pages: [] }))).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it("validateDocument y cloneDocument operan sobre el mismo documento", () => {
    const document = buildMinimalDocument();
    expect(validateDocument(document)).toEqual(document);
    const cloned = cloneDocument(document);
    expect(cloned).toEqual(document);
    expect(cloned).not.toBe(document);
    expect(cloned.pages).not.toBe(document.pages);
  });
});
