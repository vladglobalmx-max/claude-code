import { CURRENT_SCHEMA_VERSION, MINIMUM_SUPPORTED_SCHEMA_VERSION } from "./constants.js";

/**
 * Un paso de migración puro: recibe los datos crudos (todavía sin validar
 * contra el esquema actual, por eso `Record<string, unknown>` y no un tipo
 * de dominio) en la forma de `fromVersion`, y devuelve datos crudos en la
 * forma de `toVersion`. No valida ni lanza — eso lo hace quien orquesta el
 * pipeline (`runMigrations`) al final, una sola vez.
 */
export interface Migration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(raw: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Migraciones reales registradas, en orden. Vacío hoy porque
 * `CURRENT_SCHEMA_VERSION` es 1 y no existe una versión anterior — no se
 * inventan migraciones especulativas. El array queda tipado y exportado
 * para que agregar la primera migración futura sea only sumar un elemento
 * aquí, sin tocar `runMigrations`.
 */
export const MIGRATIONS: readonly Migration[] = [];

/**
 * Se lanza cuando un documento no puede migrarse a la versión objetivo:
 * o es más viejo que `MINIMUM_SUPPORTED_SCHEMA_VERSION`, o falta un paso de
 * migración intermedio. Es una subclase de `Error` (el único uso de
 * `class` en este paquete) porque así es como el lenguaje modela errores
 * lanzables con `stack`/`instanceof` — no es una clase de dominio.
 */
export class UnsupportedSchemaVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSchemaVersionError";
  }
}

export interface RunMigrationsOptions {
  /** Migraciones a aplicar. Por defecto, las reales (`MIGRATIONS`). Se puede
   * inyectar un set distinto en tests para simular una migración futura sin
   * tocar el estado real del paquete. */
  migrations?: readonly Migration[];
  /** Versión a la que migrar. Por defecto, `CURRENT_SCHEMA_VERSION`. */
  targetVersion?: number;
}

function readSchemaVersion(raw: Record<string, unknown>): number {
  const value = raw.schemaVersion;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new UnsupportedSchemaVersionError(
      'Los datos no tienen un "schemaVersion" numérico entero.',
    );
  }
  return value;
}

/**
 * Aplica secuencialmente los pasos de `migrations` necesarios para llevar
 * `raw` desde su `schemaVersion` actual hasta `targetVersion`. Función pura:
 * mismo input, mismo output, sin efectos secundarios ni estado oculto.
 */
export function runMigrations(
  raw: Record<string, unknown>,
  options: RunMigrationsOptions = {},
): Record<string, unknown> {
  const { migrations = MIGRATIONS, targetVersion = CURRENT_SCHEMA_VERSION } = options;

  const initialVersion = readSchemaVersion(raw);

  if (initialVersion < MINIMUM_SUPPORTED_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(
      `schemaVersion ${initialVersion} es anterior a la versión mínima soportada ` +
        `(${MINIMUM_SUPPORTED_SCHEMA_VERSION}).`,
    );
  }

  let current = raw;
  let currentVersion = initialVersion;

  while (currentVersion < targetVersion) {
    const step = migrations.find((migration) => migration.fromVersion === currentVersion);
    if (!step) {
      throw new UnsupportedSchemaVersionError(
        `No hay una migración registrada desde schemaVersion ${currentVersion} ` +
          `hacia una versión más nueva (objetivo: ${targetVersion}).`,
      );
    }
    current = step.migrate(current);
    currentVersion = step.toVersion;
  }

  return { ...current, schemaVersion: currentVersion };
}
