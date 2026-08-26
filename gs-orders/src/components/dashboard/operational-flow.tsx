import { Fragment } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  FileSpreadsheet,
  FileText,
  Package,
  Warehouse,
  Boxes,
  PackageCheck,
} from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

/**
 * THÖREN Fase 6Q/6Q.1/6Q.2/6Q.3 — Command Center: pieza distintiva "Flujo
 * Operativo" (Cotizaciones → Pedidos → Compras → Recepción → Inventario →
 * Entrega). Cada indicador es un número YA calculado en
 * get-dashboard-data.ts — ningún cálculo nuevo vive aquí, solo
 * presentación. Mapeo 1:1 etapa->métrica real (ver DECISIÓN en
 * get-dashboard-data.ts):
 *   Cotizaciones -> cotizaciones activas (borrador/enviada)
 *   Pedidos      -> pedidos activos (operational_status, mismo número que
 *                   el KPI y "Requieren atención")
 *   Compras      -> Purchase Orders abiertas
 *   Recepción    -> unidades en camino (rpc_inventory_incoming_by_product)
 *   Inventario   -> unidades comprometidas (rpc_inventory_committed_levels)
 *   Entrega      -> unidades surtidas pendientes de entregar (0038 menos 0039)
 *
 * Fase 6Q.3 — DECISIÓN: cada etapa es clickable hacia una ruta EXISTENTE
 * (nunca inventada). "Recepción" no tiene ruta propia en la app — recibir
 * mercancía ocurre dentro del detalle de una Purchase Order — así que
 * enlaza a /compras (misma decisión que el resto del proyecto: recepción
 * vive dentro de Compras, ver 0035/0036). El resto es 1:1 con su módulo:
 * Cotizaciones->/cotizaciones, Pedidos->/pedidos, Compras->/compras,
 * Inventario->/inventario, Entrega->/entregas.
 */
export interface OperationalFlowStage {
  label: string;
  value: number;
  unit?: string;
  icon: LucideIcon;
  href: string;
}

export function buildOperationalFlowStages(data: {
  quotesActiveCount: number;
  activeOperationalOrderCount: number;
  purchaseOrdersOpenCount: number;
  incomingUnitsTotal: number;
  committedUnitsTotal: number;
  pendingToDeliverUnitsTotal: number;
}): OperationalFlowStage[] {
  return [
    { label: "Cotizaciones", value: data.quotesActiveCount, unit: "activas", icon: FileSpreadsheet, href: "/cotizaciones" },
    { label: "Pedidos", value: data.activeOperationalOrderCount, unit: "activos", icon: FileText, href: "/pedidos" },
    { label: "Compras", value: data.purchaseOrdersOpenCount, unit: "abiertas", icon: Package, href: "/compras" },
    { label: "Recepción", value: data.incomingUnitsTotal, unit: "unidades en camino", icon: Warehouse, href: "/compras" },
    { label: "Inventario", value: data.committedUnitsTotal, unit: "unidades comprometidas", icon: Boxes, href: "/inventario" },
    {
      label: "Entrega",
      value: data.pendingToDeliverUnitsTotal,
      unit: "unidades por entregar",
      icon: PackageCheck,
      href: "/entregas",
    },
  ];
}

/**
 * Mapa vivo de la operación: iconos grandes, cifras protagonistas, y una
 * línea de progreso en cobre que conecta físicamente cada etapa. Sin card/
 * borde propio: vive directamente sobre el fondo de la página. Cada etapa
 * es un Link — hover cambia borde/color del ícono y del número, nada más
 * (sin escala/sombra exagerada).
 */
export function OperationalFlow({ stages }: { stages: OperationalFlowStage[] }) {
  return (
    <div>
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">Flujo operativo</p>
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-0">
        <div aria-hidden="true" className="absolute left-7 right-7 top-7 hidden h-[1.5px] bg-accent/35 lg:block" />
        {stages.map((stage, index) => (
          <Fragment key={stage.label}>
            <Link
              href={stage.href}
              className="group relative flex flex-1 items-center gap-4 rounded-lg lg:flex-col lg:items-center lg:gap-0 lg:text-center"
            >
              <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-bg text-accent transition-colors group-hover:border-accent/50 group-hover:bg-accent/10">
                <stage.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 lg:mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{stage.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-ink transition-colors group-hover:text-accent lg:text-4xl">
                  {formatNumber(stage.value)}
                </p>
                {stage.unit && <p className="mt-0.5 truncate text-xs text-ink-faint">{stage.unit}</p>}
              </div>
            </Link>
            {index < stages.length - 1 && (
              <div className="ml-7 h-6 w-px shrink-0 bg-accent/25 lg:hidden" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
