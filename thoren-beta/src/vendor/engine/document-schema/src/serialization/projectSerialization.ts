import { ProjectSchema, type Project } from "../project/project.js";
import { runMigrations, type RunMigrationsOptions } from "../version/migration.js";
import {
  validateWithSchema,
  serializeWithSchema,
  cloneWithSchema,
} from "./core.js";

function parseJsonRecord(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("El payload de Project debe ser un objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

export function validateProject(raw: unknown): Project {
  return validateWithSchema(ProjectSchema, raw);
}

export function serializeProject(project: Project): string {
  return serializeWithSchema(ProjectSchema, project);
}

/**
 * Un Project embebe un Document, así que también embebe su
 * `schemaVersion` — la migración corre sobre `record.document` antes de
 * validar el Project completo.
 */
export function deserializeProject(
  raw: string,
  migrationOptions?: RunMigrationsOptions,
): Project {
  const record = parseJsonRecord(raw);
  const documentValue = record.document;
  if (typeof documentValue !== "object" || documentValue === null || Array.isArray(documentValue)) {
    throw new Error('El Project no tiene un campo "document" válido.');
  }
  const migratedDocument = runMigrations(
    documentValue as Record<string, unknown>,
    migrationOptions,
  );
  return ProjectSchema.parse({ ...record, document: migratedDocument });
}

export function cloneProject(project: Project): Project {
  return cloneWithSchema(ProjectSchema, project);
}
