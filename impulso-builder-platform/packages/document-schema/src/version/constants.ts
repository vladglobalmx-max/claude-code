/**
 * Versión actual del Document Schema. Se incrementa cada vez que se hace un
 * cambio incompatible con versiones anteriores (ej. renombrar un campo,
 * cambiar un tipo). Cambios compatibles hacia atrás (agregar un campo
 * opcional con default) NO requieren incrementar esto.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * La versión más antigua que este código todavía sabe migrar. Documentos
 * con `schemaVersion` menor a este valor se consideran irrecuperables sin
 * una herramienta de migración fuera de banda — no existe tal versión
 * todavía, así que hoy coincide con `CURRENT_SCHEMA_VERSION`.
 */
export const MINIMUM_SUPPORTED_SCHEMA_VERSION = 1;
