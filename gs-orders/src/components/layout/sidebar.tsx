"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/types/domain";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Ocultar entradas admin-only para VENDEDOR es solo UX — no es la
 * protección real. Las rutas siguen protegidas server-side en
 * middleware.ts y en RLS (los datos mismos). Un VENDEDOR que escriba la
 * URL a mano de todas formas es rechazado ahí.
 */
export function Sidebar({
  role,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  role: UserRole;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

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

          <div className="px-3 pt-4">
            <Link
              href="/pedidos/nuevo"
              className={cn(
                "flex h-10 w-full items-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-ink shadow-sm transition-colors hover:bg-accent/90",
                collapsed ? "justify-center px-0" : "justify-center"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && "Nuevo Pedido"}
            </Link>
          </div>

          <nav className="mt-5 flex-1 space-y-4 overflow-y-auto px-3">
            {NAV_GROUPS.map((group, groupIndex) => {
              const items = group.items.filter((item) => !item.adminOnly || role === "admin");
              if (items.length === 0) return null;

              return (
                <div key={group.label ?? `group-${groupIndex}`} className="space-y-0.5">
                  {group.label && !collapsed && (
                    <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-ink-soft/70">
                      {group.label}
                    </p>
                  )}
                  {items.map((item) => {
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
              <p className="mt-2 px-3 text-xs text-sidebar-ink-soft/70">Global Supplier MTY</p>
            )}
          </div>
        </aside>
      </TooltipProvider>
    </>
  );
}
