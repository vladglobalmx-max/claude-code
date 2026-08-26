import {
  Boxes,
  Briefcase,
  Building2,
  Contact,
  FileSpreadsheet,
  FileText,
  Package,
  PackageCheck,
  Truck,
  Users,
  Settings,
  Home,
  type LucideIcon,
} from "lucide-react";

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
 *
 * Comercial > Personas y Organización > Unidades de Negocio se agregaron en
 * Experience 1D (READ-ONLY). Comercial > Clientes se agregó en THÖREN
 * Quotes Q1 (0018_core_customers.sql). `adminOnly` refleja exactamente lo
 * que RLS ya impone, no una restricción inventada aquí:
 * - Personas: `people`/`person_business_units` solo tienen policy SELECT
 *   para admin (ver 0015/0017_core_*.sql) — VENDEDOR no puede leer nada de
 *   esto, así que el link ni se muestra.
 * - Unidades de Negocio: `business_units_select_member` sí permite leer a
 *   cualquier miembro de la organización (filtrado a `active = true` para
 *   no-admin) — por eso NO es adminOnly, a diferencia de Personas.
 * - Clientes: `customers_select_member`/`customers_insert_member` permiten
 *   a cualquier miembro activo ver (activos, o todos si es admin) y crear
 *   — por eso tampoco es adminOnly. Solo editar es admin-only
 *   (`customers_update_admin`), gateado dentro de la propia página
 *   /clientes/[id]/editar, no a nivel de todo el árbol de navegación.
 * - Cotizaciones (THÖREN Quotes Q4, 0020_core_quotes.sql): mismo criterio
 *   que Clientes — `quotes_select_own_or_admin`/`quotes_insert_own_or_admin`
 *   permiten a cualquier miembro activo ver (las propias, o todas si es
 *   admin) y crear, así que tampoco es adminOnly. La administración de
 *   `salesperson_quote_sequences` (Folios de Cotización) SÍ es admin-only,
 *   pero vive como Card dentro de /configuracion (ya admin-only), no como
 *   entrada propia de este árbol — mismo patrón que Catálogo/Tipos de
 *   producto/Usuarios.
 * - Compras (THÖREN Fase 6L, 0035_purchases_suppliers.sql):
 *   `purchase_orders_select` permite a VENDEDOR ver las Purchase Orders de
 *   Pedidos que le pertenecen (visibilidad heredada, nunca un acceso
 *   nuevo) — por eso NO es adminOnly, aunque solo ADMIN puede crear/
 *   gestionar (gateado dentro de las propias páginas, no a nivel de nav).
 * - Proveedores: mismo criterio que Clientes —
 *   `suppliers_select_member`/`suppliers_insert_member` permiten a
 *   cualquier miembro activo ver y crear; solo editar es admin-only
 *   (`suppliers_update_admin`).
 * - Inventario (THÖREN Fase 6M, 0036_inventory_mvp.sql):
 *   `inventory_movements_select` permite a CUALQUIER miembro activo ver
 *   los movimientos/existencias de su organización (Inventory es una vista
 *   de organización, no de vendedor/Pedido propio, a diferencia de
 *   Compras) — por eso no es adminOnly, aunque solo ADMIN puede registrar
 *   movimientos (gateado dentro de la página, no a nivel de nav).
 * - Almacenes: `warehouses_select_member` también permite a cualquier
 *   miembro activo ver los almacenes activos — no es adminOnly, aunque a
 *   diferencia de Proveedores/Clientes, CREAR también es admin-only
 *   (`warehouses_insert_admin`, ver DECISIÓN en 0036).
 * - Entregas (THÖREN Fase 6P, 0039_deliveries.sql): `deliveries_select_own_or_admin`
 *   sigue EXACTAMENTE el mismo criterio que Pedidos — VENDEDOR ve/gestiona
 *   las Entregas de sus propios Pedidos, ADMIN todas — por eso NO es
 *   adminOnly (a diferencia de Compras/Inventario/Almacenes, aquí no hay
 *   restricción de gestión adicional: crear/editar/cambiar estado ya está
 *   disponible a VENDEDOR sobre lo suyo, ver DECISIÓN de permisos en 0039).
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
    items: [{ href: "/inicio", label: "Inicio", icon: Home, adminOnly: false }],
  },
  {
    label: "Operación",
    items: [
      { href: "/pedidos", label: "Pedidos", icon: FileText, adminOnly: false },
      { href: "/entregas", label: "Entregas", icon: PackageCheck, adminOnly: false },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/clientes", label: "Clientes", icon: Briefcase, adminOnly: false },
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet, adminOnly: false },
      { href: "/personas", label: "Personas", icon: Contact, adminOnly: true },
      { href: "/vendedores", label: "Vendedores", icon: Users, adminOnly: true },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/compras", label: "Compras", icon: Package, adminOnly: false },
      { href: "/proveedores", label: "Proveedores", icon: Truck, adminOnly: false },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/inventario", label: "Inventario", icon: Boxes, adminOnly: false },
      { href: "/almacenes", label: "Almacenes", icon: Building2, adminOnly: false },
    ],
  },
  {
    label: "Organización",
    items: [{ href: "/unidades-negocio", label: "Unidades de Negocio", icon: Building2, adminOnly: false }],
  },
  {
    label: null,
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true }],
  },
];
