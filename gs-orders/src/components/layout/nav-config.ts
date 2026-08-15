import { FileText, Users, Settings, Home, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

export interface NavGroup {
  /** null = entrada de nivel superior sin agrupar (ej. Inicio, Configuración). */
  label: string | null;
  items: NavItem[];
}

/**
 * Árbol de navegación THÖREN (ver THÖREN Experience 1 Discovery, sección G).
 * Solo incluye entradas de páginas que existen hoy — Comercial > Personas y
 * Organización > Business Units se agregan en Experience 1D cuando esas
 * páginas existan (guardrail explícito de 1A: no crearlas todavía).
 *
 * "Configuración" queda como entrada de nivel superior (no como grupo con
 * un solo hijo "Usuarios"): /configuracion es hoy el hub que también da
 * acceso a Catálogo y Tipos de producto, no solo a Usuarios — cambiar el
 * destino del link a /configuracion/usuarios directamente rompería ese
 * acceso. Se preserva el comportamiento actual exacto (guardrail: no
 * rediseñar contenido interno de Configuración).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/", label: "Inicio", icon: Home, adminOnly: false }],
  },
  {
    label: "Operación",
    items: [{ href: "/pedidos", label: "Pedidos", icon: FileText, adminOnly: false }],
  },
  {
    label: "Comercial",
    items: [{ href: "/vendedores", label: "Vendedores", icon: Users, adminOnly: true }],
  },
  {
    label: null,
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true }],
  },
];
