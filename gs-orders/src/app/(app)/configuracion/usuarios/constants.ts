/**
 * THÖREN 6R.1B-4B — código de error en el query string del listado cuando
 * [id]/editar/page.tsx rebota a un titular de can_manage_users (no admin)
 * que intentó abrir directamente la URL de edición de una cuenta admin.
 * Vive aparte de actions.ts (server actions solo pueden exportar funciones
 * async) y aparte de page.tsx (evita que otro módulo importe de un archivo
 * de página).
 */
export const ADMIN_PROTECTED_ERROR = "admin-protegido";
