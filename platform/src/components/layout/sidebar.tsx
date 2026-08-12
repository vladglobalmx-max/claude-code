"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ROLE_PERMISSIONS, type RoleKey } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

export function Sidebar({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const permissions = ROLE_PERMISSIONS[role] ?? [];

  const items = NAV_ITEMS.filter(
    (item) => !item.requiresAnyOf || item.requiresAnyOf.some((p) => permissions.includes(p))
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-ink">
          G
        </div>
        <span className="text-sm font-semibold tracking-wide">GAIOS</span>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-ink-faint">
        Global Supplier MTY
      </div>
    </aside>
  );
}
