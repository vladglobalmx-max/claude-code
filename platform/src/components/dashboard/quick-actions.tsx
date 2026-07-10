import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Accesos rápidos</h3>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 bg-surface px-3 py-5 text-center transition-colors hover:bg-surface-2"
            >
              <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
              <span className="text-xs text-ink-soft">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
