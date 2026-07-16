import type { RoleCode } from "@/generated/prisma/enums";

/**
 * Catalogo de permisos del sistema (Modulo 1).
 * Cada codigo se corresponde con una capacidad de la matriz de docs/ARCHITECTURE.md §4.1.
 * Se amplia en modulos posteriores (cotizaciones, folios, autorizaciones, etc.).
 */
export const PERMISSIONS = {
  VIEW_COSTS: "products.view_costs",
  VIEW_MARGIN_AMOUNT: "products.view_margin_amount",
  VIEW_MARGIN_PCT: "products.view_margin_pct",
  MANAGE_PRODUCTS: "products.manage",
  MANAGE_PRODUCT_MARKETING_INFO: "products.manage_marketing_info",
  MANAGE_PRICE_LISTS: "price_lists.manage",
  MANAGE_CUSTOMERS: "customers.manage",
  CREATE_CUSTOMER: "customers.create",
  VIEW_ALL_CUSTOMERS: "customers.view_all",
  VIEW_OWN_CUSTOMERS: "customers.view_own",
  VIEW_ALL_QUOTATIONS: "quotations.view_all",
  VIEW_TEAM_QUOTATIONS: "quotations.view_team",
  VIEW_OWN_QUOTATIONS: "quotations.view_own",
  CREATE_QUOTATION: "quotations.create",
  APPLY_DISCOUNT: "quotations.apply_discount",
  APPROVE_EXCEPTION: "quotations.approve_exception",
  GENERATE_PDF: "quotations.generate_pdf",
  EDIT_APPROVED_QUOTATION: "quotations.edit_approved",
  CANCEL_QUOTATION: "quotations.cancel",
  DELETE_QUOTATION: "quotations.delete",
  CONVERT_TO_ORDER: "quotations.convert_to_order",
  CONFIGURE_SEQUENCES: "admin.configure_sequences",
  CONFIGURE_ROLES: "admin.configure_roles",
  CONFIGURE_BUSINESS_UNITS: "admin.configure_business_units",
  VIEW_AUDIT: "admin.view_audit",
  MANAGE_USERS: "admin.manage_users",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Mapa rol -> permisos, segun la matriz de docs/ARCHITECTURE.md §4.1.
 * Es la fuente de verdad que el seed usa para poblar role_permissions
 * y que el middleware/paginas usan para proyectar la UI y bloquear acciones.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  DIRECCION_GENERAL: [
    PERMISSIONS.VIEW_COSTS,
    PERMISSIONS.VIEW_MARGIN_AMOUNT,
    PERMISSIONS.VIEW_MARGIN_PCT,
    PERMISSIONS.VIEW_ALL_QUOTATIONS,
    PERMISSIONS.APPROVE_EXCEPTION,
    PERMISSIONS.GENERATE_PDF,
    PERMISSIONS.VIEW_AUDIT,
    PERMISSIONS.VIEW_ALL_CUSTOMERS,
  ],
  ADMINISTRACION: [
    PERMISSIONS.VIEW_COSTS,
    PERMISSIONS.VIEW_MARGIN_AMOUNT,
    PERMISSIONS.VIEW_MARGIN_PCT,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_PRICE_LISTS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.CREATE_CUSTOMER,
    PERMISSIONS.VIEW_ALL_CUSTOMERS,
    PERMISSIONS.VIEW_ALL_QUOTATIONS,
    PERMISSIONS.CREATE_QUOTATION,
    PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.APPROVE_EXCEPTION,
    PERMISSIONS.GENERATE_PDF,
    PERMISSIONS.EDIT_APPROVED_QUOTATION,
    PERMISSIONS.CANCEL_QUOTATION,
    PERMISSIONS.CONVERT_TO_ORDER,
    PERMISSIONS.VIEW_AUDIT,
  ],
  GERENTE_VENTAS: [
    PERMISSIONS.VIEW_MARGIN_PCT,
    PERMISSIONS.VIEW_TEAM_QUOTATIONS,
    PERMISSIONS.CREATE_QUOTATION,
    PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.APPROVE_EXCEPTION,
    PERMISSIONS.GENERATE_PDF,
    PERMISSIONS.VIEW_ALL_CUSTOMERS,
  ],
  VENDEDOR: [
    PERMISSIONS.VIEW_OWN_QUOTATIONS,
    PERMISSIONS.CREATE_QUOTATION,
    PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.GENERATE_PDF,
    PERMISSIONS.CREATE_CUSTOMER,
    PERMISSIONS.VIEW_OWN_CUSTOMERS,
  ],
  MARKETING: [PERMISSIONS.MANAGE_PRODUCT_MARKETING_INFO],
  CONSULTA: [],
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: "Super Administrador",
  DIRECCION_GENERAL: "Dirección General",
  ADMINISTRACION: "Administración",
  GERENTE_VENTAS: "Gerente de Ventas",
  VENDEDOR: "Vendedor",
  MARKETING: "Marketing",
  CONSULTA: "Consulta",
};

export function hasPermission(role: RoleCode, permission: PermissionCode): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: RoleCode, permissions: PermissionCode[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** Rutas de /admin y su permiso requerido para entrar. */
export const ADMIN_ROUTE_PERMISSIONS: Record<string, PermissionCode> = {
  "/admin/users": PERMISSIONS.MANAGE_USERS,
  "/admin/sequences": PERMISSIONS.CONFIGURE_SEQUENCES,
  "/admin/business-units": PERMISSIONS.CONFIGURE_BUSINESS_UNITS,
  "/admin/taxes": PERMISSIONS.CONFIGURE_BUSINESS_UNITS,
  "/admin/audit": PERMISSIONS.VIEW_AUDIT,
  "/admin/followups": PERMISSIONS.CONFIGURE_SEQUENCES,
};

export function findRequiredPermissionForPath(pathname: string): PermissionCode | undefined {
  const match = Object.keys(ADMIN_ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return match ? ADMIN_ROUTE_PERMISSIONS[match] : undefined;
}
