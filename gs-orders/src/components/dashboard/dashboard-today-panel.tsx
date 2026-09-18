import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { TodayPanelItem } from "./get-role-dashboard-data";

/**
 * THÖREN 0085 — panel derecho "Hoy" (30-35% en desktop, ver
 * role-dashboard-view.tsx). Solo counts + accesos rápidos, ningún dato
 * nuevo: reempaqueta cifras ya calculadas en get-role-dashboard-data.ts.
 */
export function DashboardTodayPanel({ items }: { items: TodayPanelItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2/50"
          >
            <span className="text-ink-faint">{item.label}</span>
            <span className="text-base font-semibold tabular-nums text-ink">{item.count}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
