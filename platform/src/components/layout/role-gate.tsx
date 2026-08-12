import { roleHasPermission, type Permission, type RoleKey } from "@/lib/auth/permissions";

/**
 * Oculta contenido en el servidor si el rol actual no tiene el permiso
 * requerido. No reemplaza RLS ni la validación en los Route Handlers —
 * es una capa de UX, la seguridad real vive en la base de datos y en /api.
 */
export function RoleGate({
  role,
  anyOf,
  children,
  fallback = null,
}: {
  role: RoleKey;
  anyOf: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = anyOf.some((permission) => roleHasPermission(role, permission));
  return <>{allowed ? children : fallback}</>;
}
