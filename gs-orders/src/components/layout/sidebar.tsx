"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/types/domain";
import type { ToggleableModuleKey } from "@/lib/organization-modules";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * THÖREN | SIDEBAR DESPLEGABLE — qué grupo (de los 5 departamentos:
 * Ventas/Logística/Compras/Almacén/Administración, los únicos con
 * `group.label` no-null) contiene la ruta activa. Inicio/Configuración
 * (`label: null`) nunca son colapsables — quedan fuera de esta búsqueda a
 * propósito, siempre visibles (requisito "Inicio siempre visible").
 */
function findActiveGroupLabel(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (!group.label) continue;
    if (group.items.some((item) => isActive(pathname, item.href))) return group.label;
  }
  return null;
}

/**
 * Ocultar entradas admin-only para VENDEDOR es solo UX — no es la
 * protección real. Las rutas siguen protegidas server-side en
 * middleware.ts y en RLS (los datos mismos). Un VENDEDOR que escriba la
 * URL a mano de todas formas es rechazado ahí.
 *
 * THÖREN 0084 — lo mismo aplica a `disabledModules`: ocultar el link es
 * solo UX, la protección real por URL vive en middleware.ts
 * (MODULE_KEY_BY_PATH_PREFIX + organization_modules). Un admin cuya propia
 * organización deshabilitó un módulo tampoco lo ve — el filtro de módulo
 * corre ANTES que el de rol/capability, sin excepción de rol.
 */
export function Sidebar({
  role,
  canManageUsers,
  canManageCommissions,
  canViewOwnCommissions,
  disabledModules,
  organizationName,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  role: UserRole;
  canManageUsers: boolean;
  canManageCommissions: boolean;
  /** THÖREN 0083 — vista propia de solo lectura de comisiones (vendedor). Ver DECISIÓN en nav-config.ts. */
  canViewOwnCommissions: boolean;
  /** THÖREN 0084 — module_key deshabilitados para la organización activa (organization_modules, default-on: ausente = habilitado). Array (no Set) para cruzar limpio la frontera server/client component. Ver DECISIÓN en nav-config.ts. */
  disabledModules: ToggleableModuleKey[];
  /** THÖREN 7B — nombre real de la organización activa (ver src/lib/auth/organization.ts), nunca hardcodeado. */
  organizationName: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  // THÖREN | SIDEBAR DESPLEGABLE — un Set de labels de grupo ABIERTOS,
  // nunca de rutas/permisos: puramente visual, independiente del filtrado
  // de `items` de abajo (que sigue intacto). Inicializa con el
  // departamento de la página con la que se carga la sesión (lazy
  // initializer, usePathname() ya resuelto en el primer render) — y el
  // efecto de abajo agrega (nunca quita) el departamento activo en cada
  // navegación subsecuente dentro de la SPA, sin recargar la página. Cada
  // grupo se abre/cierra de forma independiente (requisito 2): el usuario
  // puede tener varios abiertos a la vez, o cerrar el que está activo —
  // el efecto solo garantiza que, AL ENTRAR a una página, su departamento
  // aparezca abierto (requisito 3), nunca fuerza a cerrar los demás.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeLabel = findActiveGroupLabel(pathname);
    return new Set(activeLabel ? [activeLabel] : []);
  });

  useEffect(() => {
    const activeLabel = findActiveGroupLabel(pathname);
    if (!activeLabel) return;
    setOpenGroups((prev) => (prev.has(activeLabel) ? prev : new Set(prev).add(activeLabel)));
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/45 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            "no-print fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col bg-sidebar-bg transition-transform duration-200 lg:static lg:translate-x-0",
            collapsed ? "w-60 lg:w-16" : "w-60",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
            {/*
              Símbolo oficial THÖREN: Þ (thorn), color Ember fijo (ver
              THOREN_Manual_de_Marca.pdf sección 02/04 — "No cambiar el
              color Ember", "No usar otra tipografía ni minúsculas"). No
              disponemos del PNG/SVG fuente aprobado (03simboloaisladogrande.png)
              en este repo — se usa el carácter Unicode Þ como wordmark
              tipográfico provisional, NO una recreación del trazo/curva
              del símbolo original. Ver docs/THOREN_BRAND_SYSTEM.md.
            */}
            <div
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-border text-lg font-bold leading-none text-accent"
            >
              Þ
            </div>
            {!collapsed && (
              <span className="text-sm font-extrabold uppercase tracking-wide text-sidebar-ink">
                THÖREN
              </span>
            )}
            <button
              type="button"
              onClick={onCloseMobile}
              className="ml-auto rounded-md p-1 text-sidebar-ink-soft hover:bg-white/5 hover:text-sidebar-ink lg:hidden"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar menú</span>
            </button>
          </div>

          <nav className="mt-5 flex-1 space-y-4 overflow-y-auto px-3">
            {NAV_GROUPS.map((group, groupIndex) => {
              // THÖREN 0073 (ajuste post-review) / 0083 — `commissionsOnly`
              // ignora por completo `adminOnly`/rol: se resuelve ANTES y en
              // vez de la lógica normal, para que un admin sin ninguna de
              // las dos capabilities de comisiones NO vea la entrada (a
              // diferencia de `visibleForUserManager`, que es una
              // excepción ADICIONAL a "admin siempre ve adminOnly", no un
              // reemplazo). can_manage_commissions (gestión) y
              // can_view_own_commissions (0083, solo lectura propia) son
              // alternativas — cualquiera de las dos muestra la entrada.
              const items = group.items.filter((item) => {
                if (item.moduleKey && disabledModules.includes(item.moduleKey)) return false;
                if (item.commissionsOnly) return canManageCommissions || canViewOwnCommissions;
                return !item.adminOnly || role === "admin" || (item.visibleForUserManager && canManageUsers);
              });
              if (items.length === 0) return null;

              // THÖREN | SIDEBAR DESPLEGABLE — solo los 5 departamentos
              // (`group.label` no-null) son colapsables; Inicio/
              // Configuración (`label: null`) siguen siempre visibles,
              // sin encabezado ni chevron, exactamente como antes. En
              // modo colapsado (riel de iconos, desktop) el acordeón se
              // omite por completo — mismo criterio que ya usaba la
              // etiqueta de grupo (`!collapsed`): no hay espacio para
              // texto/chevron, así que los items se muestran siempre,
              // igual que ya funcionaba.
              const isCollapsibleGroup = Boolean(group.label) && !collapsed;
              const isOpen = !isCollapsibleGroup || openGroups.has(group.label!);

              return (
                <div key={group.label ?? `group-${groupIndex}`} className="space-y-0.5">
                  {isCollapsibleGroup ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label!)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-ink-soft/70 transition-colors hover:text-sidebar-ink-soft"
                    >
                      <span>{group.label}</span>
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  ) : null}
                  {isOpen && items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onCloseMobile}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-accent/20 text-white"
                            : "text-sidebar-ink-soft hover:bg-white/5 hover:text-sidebar-ink"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && item.label}
                      </Link>
                    );

                    if (!collapsed) return link;

                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border px-3 py-3">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              className={cn(
                "hidden w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-ink-soft transition-colors hover:bg-white/5 hover:text-sidebar-ink lg:flex",
                collapsed && "justify-center px-0"
              )}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4 shrink-0" /> : <ChevronsLeft className="h-4 w-4 shrink-0" />}
              {!collapsed && "Colapsar"}
            </button>
            {!collapsed && (
              <p className="mt-2 truncate px-3 text-xs text-sidebar-ink-soft/70">{organizationName}</p>
            )}
          </div>
        </aside>
      </TooltipProvider>
    </>
  );
}
