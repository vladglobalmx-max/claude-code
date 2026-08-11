"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Plus, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/pedidos", label: "Pedidos", icon: FileText },
  { href: "/vendedores", label: "Vendedores", icon: Users },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-ink">
          GS
        </div>
        <span className="text-sm font-semibold text-ink">GS Orders</span>
      </div>

      <div className="px-3 pt-4">
        <Link
          href="/pedidos/nuevo"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-ink shadow-sm transition-colors hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo Pedido
        </Link>
      </div>

      <nav className="mt-5 flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent/10 text-accent" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3 text-xs text-ink-faint">
        Thunder Safety Solutions
      </div>
    </aside>
  );
}
