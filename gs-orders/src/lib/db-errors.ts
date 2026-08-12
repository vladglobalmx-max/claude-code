interface DbErrorLike {
  code?: string | null;
  message: string;
}

/**
 * Convierte errores de Postgres/PostgREST en mensajes que un usuario puede
 * leer. Las excepciones que nosotros mismos lanzamos con RAISE EXCEPTION en
 * plpgsql (folio inmutable, vendedor inactivo, pedido no encontrado…) llegan
 * con code "P0001" y ya están escritas en español legible — esas se
 * muestran tal cual. Todo lo demás (violación de constraint, FK, etc.) se
 * traduce a un mensaje genérico para no exponer detalles técnicos de la
 * base de datos.
 */
export function mapDbError(
  error: DbErrorLike | null | undefined,
  fallback = "No se pudo completar la operación. Intenta de nuevo."
): string {
  if (!error) return fallback;

  if (!error.code || error.code === "P0001") {
    return error.message || fallback;
  }

  switch (error.code) {
    case "23505":
      return "Ya existe un registro con esos datos.";
    case "23503":
      return "No se pudo completar la operación: hay datos relacionados que ya no existen.";
    case "23514":
    case "23502":
      return "Algunos datos no cumplen las reglas del sistema. Revisa los campos e intenta de nuevo.";
    default:
      return fallback;
  }
}
