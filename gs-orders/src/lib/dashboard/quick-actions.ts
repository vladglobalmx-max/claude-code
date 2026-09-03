import type { UserRole } from "@/types/domain";

/**
 * THÖREN 6R.1C — accesos rápidos del Home, derivados ÚNICAMENTE de
 * role/capabilities (nunca de email/nombre — ver DECISIÓN abajo). Admin
 * pleno tiene su propia lista fija (autoridad ejecutiva completa, sin
 * relación con capabilities de negocio); todo lo demás sale de un único
 * catálogo de candidatos evaluado en orden de prioridad.
 */
export interface QuickAction {
  id: string;
  label: string;
  href: string;
}

export const MAX_QUICK_ACTIONS = 3;

interface QuickActionCandidate {
  id: string;
  label: string;
  href: string;
  /** Primer segmento de la ruta — usado solo para el dedup de candidatos base (ver DECISIÓN). */
  family: string;
  /** true = acción de respaldo genérica de vendedor (Nueva cotización/Mis pedidos/Clientes); false = derivada de una capability específica. */
  isBase: boolean;
  appliesWhen: (capabilities: ReadonlySet<string>) => boolean;
}

const ADMIN_ACTIONS: QuickAction[] = [
  { id: "compras", label: "Compras", href: "/compras" },
  { id: "inventario", label: "Inventario", href: "/inventario" },
  { id: "configuracion", label: "Configuración", href: "/configuracion" },
];

/**
 * DECISIÓN — orden de prioridad y dedup:
 * Los candidatos derivados de una capability específica (deliveries,
 * receive, view_all_sales, prepare/approve, manage_users) NUNCA se
 * excluyen entre sí aunque compartan "familia" de ruta (ej. Recepciones y
 * Preparar OC ambas viven bajo /compras — Rodolfo debe poder ver las dos).
 * Los candidatos BASE (Nueva cotización/Mis pedidos/Clientes) sí se
 * excluyen si su familia de ruta ya quedó cubierta por CUALQUIER acción ya
 * incluida — así Diana (can_view_all_sales) no ve "Mis pedidos" duplicando
 * "Pedidos", y Alexandro (can_manage_users, sin capability comercial) sí
 * conserva sus 2 acciones base de mayor prioridad antes de Usuarios.
 */
const CANDIDATES: QuickActionCandidate[] = [
  {
    id: "entregas",
    label: "Entregas",
    href: "/entregas",
    family: "entregas",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_manage_deliveries"),
  },
  {
    id: "recepciones",
    label: "Recepciones pendientes",
    href: "/compras",
    family: "compras",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_receive_inventory"),
  },
  {
    id: "pedidos-globales",
    label: "Pedidos",
    href: "/pedidos",
    family: "pedidos",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_view_all_sales"),
  },
  {
    id: "cotizaciones-globales",
    label: "Cotizaciones",
    href: "/cotizaciones",
    family: "cotizaciones",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_view_all_sales"),
  },
  {
    id: "preparar-oc",
    label: "Preparar Purchase Orders",
    // Filtro real ya soportado por /compras (searchParams.estado, ver
    // page.tsx) — nunca un query param inventado.
    href: "/compras?estado=borrador",
    family: "compras",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_prepare_purchase_orders") || caps.has("can_approve_purchase_orders"),
  },
  {
    id: "nueva-cotizacion",
    label: "Nueva cotización",
    href: "/cotizaciones/nueva",
    family: "cotizaciones",
    isBase: true,
    appliesWhen: () => true,
  },
  {
    id: "mis-pedidos",
    label: "Mis pedidos",
    href: "/pedidos",
    family: "pedidos",
    isBase: true,
    appliesWhen: () => true,
  },
  {
    id: "usuarios",
    label: "Usuarios y accesos",
    href: "/configuracion/usuarios",
    family: "configuracion",
    isBase: false,
    appliesWhen: (caps) => caps.has("can_manage_users"),
  },
  {
    id: "clientes",
    label: "Clientes",
    href: "/clientes",
    family: "clientes",
    isBase: true,
    appliesWhen: () => true,
  },
];

/**
 * Accesos rápidos del Home — máximo MAX_QUICK_ACTIONS, en orden de
 * prioridad, sin duplicados de "familia" entre acciones base. Admin pleno
 * usa su lista fija (autoridad ejecutiva, no derivada de capabilities de
 * negocio); cualquier otro actor recorre el catálogo de candidatos.
 * Capabilities desconocidas/no reconocidas simplemente no matchean ningún
 * `appliesWhen` — no rompen el helper.
 */
export function buildQuickActions(role: UserRole, capabilities: ReadonlySet<string>): QuickAction[] {
  if (role === "admin") {
    return ADMIN_ACTIONS.slice(0, MAX_QUICK_ACTIONS);
  }

  const result: QuickAction[] = [];
  const includedFamilies = new Set<string>();

  for (const candidate of CANDIDATES) {
    if (result.length >= MAX_QUICK_ACTIONS) break;
    if (!candidate.appliesWhen(capabilities)) continue;
    if (candidate.isBase && includedFamilies.has(candidate.family)) continue;

    result.push({ id: candidate.id, label: candidate.label, href: candidate.href });
    includedFamilies.add(candidate.family);
  }

  return result;
}
