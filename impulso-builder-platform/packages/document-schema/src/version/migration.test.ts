import { describe, expect, it } from "vitest";
import {
  runMigrations,
  UnsupportedSchemaVersionError,
  type Migration,
} from "./migration.js";
import { MINIMUM_SUPPORTED_SCHEMA_VERSION } from "./constants.js";

describe("runMigrations", () => {
  it("devuelve los datos sin cambios si ya están en la versión objetivo", () => {
    const raw = { schemaVersion: 1, pages: [] };
    const result = runMigrations(raw, { targetVersion: 1 });
    expect(result).toEqual(raw);
  });

  it("lanza UnsupportedSchemaVersionError si falta schemaVersion", () => {
    expect(() => runMigrations({ pages: [] })).toThrow(UnsupportedSchemaVersionError);
  });

  it("lanza UnsupportedSchemaVersionError si schemaVersion es anterior al mínimo soportado", () => {
    expect(() =>
      runMigrations(
        { schemaVersion: MINIMUM_SUPPORTED_SCHEMA_VERSION - 1 },
        { targetVersion: MINIMUM_SUPPORTED_SCHEMA_VERSION },
      ),
    ).toThrow(UnsupportedSchemaVersionError);
  });

  it("lanza UnsupportedSchemaVersionError si no hay un paso de migración registrado para el salto pedido", () => {
    expect(() => runMigrations({ schemaVersion: 1 }, { migrations: [], targetVersion: 2 })).toThrow(
      /No hay una migración registrada/,
    );
  });

  it("aplica una única migración v1 -> v2 (inyectada, sin tocar el registro real)", () => {
    // Simula el día en que exista una v2: por ejemplo, "canvasSize" se
    // renombra a "size". La migración real (cuando exista) viviría en
    // MIGRATIONS; aquí se inyecta para probar el mecanismo sin adelantar un
    // cambio de producto que todavía no ocurrió.
    const renameCanvasSizeToSize: Migration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: (raw) => {
        const { canvasSize, ...rest } = raw;
        return { ...rest, size: canvasSize };
      },
    };

    const result = runMigrations(
      { schemaVersion: 1, canvasSize: { width: 100, height: 100 } },
      { migrations: [renameCanvasSizeToSize], targetVersion: 2 },
    );

    expect(result).toEqual({
      schemaVersion: 2,
      size: { width: 100, height: 100 },
    });
  });

  it("encadena varias migraciones secuenciales (v1 -> v2 -> v3)", () => {
    const steps: Migration[] = [
      {
        fromVersion: 1,
        toVersion: 2,
        migrate: (raw) => ({ ...raw, addedInV2: true }),
      },
      {
        fromVersion: 2,
        toVersion: 3,
        migrate: (raw) => ({ ...raw, addedInV3: true }),
      },
    ];

    const result = runMigrations({ schemaVersion: 1 }, { migrations: steps, targetVersion: 3 });

    expect(result).toEqual({
      schemaVersion: 3,
      addedInV2: true,
      addedInV3: true,
    });
  });

  it("no muta el objeto original", () => {
    const raw = { schemaVersion: 1, pages: [] };
    const snapshot = JSON.parse(JSON.stringify(raw));
    runMigrations(raw, {
      migrations: [{ fromVersion: 1, toVersion: 2, migrate: (r) => ({ ...r, extra: true }) }],
      targetVersion: 2,
    });
    expect(raw).toEqual(snapshot);
  });
});
