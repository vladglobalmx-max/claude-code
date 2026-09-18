import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DashboardCard } from "./get-role-dashboard-data";

/** Tarjeta de métrica reutilizable para todas las secciones del dashboard de Inicio (0084) — número grande + label + link al módulo. */
export function DashboardMetricCard({ label, count, href }: DashboardCard) {
  return (
    <Link href={href}>
      <Card className="p-4 transition-colors hover:border-accent/40">
        <p className="text-2xl font-bold text-ink">{count}</p>
        <p className="mt-1 text-sm text-ink-faint">{label}</p>
      </Card>
    </Link>
  );
}
