import type { CurrentProfile } from "./profile";

/**
 * Autoridad de Administración de Usuarios (THÖREN 6R.1B-4B).
 * Espeja EXACTAMENTE el guard backend de 0046 (requireAdminOrUserManager en
 * configuracion/usuarios/actions.ts): admin activo OR can_manage_users
 * activa. Deliberadamente sin rama de ownership — can_manage_users nunca
 * depende de quién creó la cuenta, solo de la organización (impuesto por
 * RLS/RPC, no aquí).
 *
 * `canManageUsers` NUNCA debe usarse como sustituto ciego de "es admin" —
 * cada pantalla que distingue autoridad de negocio de autoridad técnica
 * debe seguir preguntando `isFullAdmin` aparte para decidir qué mostrar
 * (selector de role, acciones sobre cuentas admin, etc.). Este archivo solo
 * expone el dato crudo de autorización, igual que purchase-orders.ts/
 * logistics.ts.
 */

type ManagementProfile = Pick<CurrentProfile, "role" | "active">;

/** Admin pleno — autoridad total, sin restricciones de 0046. */
export function isFullAdmin(profile: ManagementProfile | null): boolean {
  return !!profile && profile.active && profile.role === "admin";
}

/** Puede administrar CUENTAS técnicas (ver/crear/activar/desactivar no-admin) — admin pleno o can_manage_users. */
export function canManageUsers(profile: ManagementProfile | null, capabilities: ReadonlySet<string>): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return capabilities.has("can_manage_users");
}
