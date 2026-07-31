import { DocumentSchema, type Document } from "../document/document.js";
import { runMigrations, type RunMigrationsOptions } from "../version/migration.js";
import {
  validateWithSchema,
  serializeWithSchema,
  cloneWithSchema,
} from "./core.js";

function parseJsonRecord(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("El payload de Document debe ser un objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

export function validateDocument(raw: unknown): Document {
  return validateWithSchema(DocumentSchema, raw);
}

export function serializeDocument(document: Document): string {
  return serializeWithSchema(DocumentSchema, document);
}

/**
 * A diferencia de `deserializeWithSchema` genérico, este paso corre
 * `runMigrations` ANTES de validar — un Document guardado con un
 * `schemaVersion` anterior debe poder migrarse, no solo rechazarse.
 */
export function deserializeDocument(
  raw: string,
  migrationOptions?: RunMigrationsOptions,
): Document {
  const record = parseJsonRecord(raw);
  const migrated = runMigrations(record, migrationOptions);
  return DocumentSchema.parse(migrated);
}

export function cloneDocument(document: Document): Document {
  return cloneWithSchema(DocumentSchema, document);
}
