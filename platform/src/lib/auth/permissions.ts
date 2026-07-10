/**
 * Mapa rol → permisos. Usado por middleware.ts (guard de ruta), por RoleGate
 * (ocultar UI) y por los Route Handlers de IA (autorizar antes de ejecutar).
 * Los 7 roles y sus permisos vienen directo de la Instrucción Maestra §5.
 */

export const ROLE_KEYS = [
  "superadmin",
  "director_general",
  "director_comercial",
  "vendedor",
  "marketing",
  "operaciones",
  "admin_ia",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  "manage_companies",
  "manage_users",
  "manage_roles",
  "manage_agents",
  "manage_tools",
  "manage_prompts",
  "view_audit",
  "view_ai_usage",
  "view_all_business_units",
  "manage_clients",
  "manage_opportunities",
  "assign_tasks",
  "view_pipeline",
  "use_commercial_tools",
  "use_technical_tools",
  "use_marketing_tools",
  "manage_campaigns",
  "manage_content",
  "view_technical_docs",
  "register_operations_data",
  "test_tools",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  superadmin: ALL_PERMISSIONS,
  director_general: [
    "view_all_business_units",
    "view_pipeline",
    "manage_opportunities",
    "use_commercial_tools",
    "use_technical_tools",
    "use_marketing_tools",
    "view_audit",
  ],
  director_comercial: [
    "manage_clients",
    "manage_opportunities",
    "view_pipeline",
    "use_commercial_tools",
    "assign_tasks",
  ],
  vendedor: ["manage_clients", "manage_opportunities", "use_commercial_tools"],
  marketing: ["use_marketing_tools", "manage_campaigns", "manage_content"],
  operaciones: ["view_technical_docs", "use_technical_tools", "register_operations_data"],
  admin_ia: ["manage_agents", "manage_tools", "manage_prompts", "test_tools", "view_ai_usage"],
};

export function roleHasPermission(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Rutas de /admin/** requieren al menos uno de estos permisos. */
export const ADMIN_SECTION_PERMISSION: Record<string, Permission> = {
  users: "manage_users",
  roles: "manage_roles",
  agents: "manage_agents",
  tools: "manage_tools",
  prompts: "manage_prompts",
  audit: "view_audit",
};
