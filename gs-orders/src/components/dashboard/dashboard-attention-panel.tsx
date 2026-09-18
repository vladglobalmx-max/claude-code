"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AttentionItem, AttentionSeverity } from "./get-role-dashboard-data";

const SEVERITY_BADGE_VARIANT: Record<AttentionSeverity, "danger" | "warning" | "neutral"> = {
  vencido: "danger",
  atencion: "warning",
  pendiente: "neutral",
};

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  vencido: "Vencido",
  atencion: "Próximo",
  pendiente: "Informativo",
};

const INITIAL_VISIBLE = 8;

/**
 * THÖREN 0085 — "Requiere atención" como elemento principal de trabajo:
 * tipo/folio/contraparte/motivo/antigüedad + badge de severidad, click
 * abre el registro. Muestra 8 inicialmente con botón "Ver todo" (hasta 15,
 * ya resueltos por get-role-dashboard-data.ts — client component SOLO para
 * el toggle de visibilidad, sin refetch de datos). En móvil, cada ítem es
 * su propia card (ticket, punto 7) — mismo patrón sm:hidden/hidden sm:block
 * ya usado en /comisiones y /compras.
 */
export function DashboardAttentionPanel({ items }: { items: AttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, INITIAL_VISIBLE);

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title="Nada requiere atención por ahora" description="Los pendientes urgentes de todo el pipeline aparecerán aquí." />
      </Card>
    );
  }

  return (
    <div>
      <div className="space-y-2 sm:hidden">
        {visibleItems.map((item) => (
          <Link key={item.id} href={item.href}>
            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{item.type}</p>
                  <p className="truncate text-sm font-semibold text-ink">{item.folio}</p>
                  {item.counterparty && <p className="truncate text-xs text-ink-faint">{item.counterparty}</p>}
                </div>
                <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
                  {SEVERITY_LABEL[item.severity]}
                </Badge>
              </div>
              <p className="mt-2 truncate text-xs text-ink-faint">
                {item.reason} · {item.agingLabel}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="hidden divide-y divide-border overflow-hidden sm:block">
        {visibleItems.map((item) => (
          <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-faint">{item.type}</span>
                <span className="truncate text-sm font-semibold text-ink">{item.folio}</span>
                {item.counterparty && <span className="truncate text-sm text-ink-faint">· {item.counterparty}</span>}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-faint">
                {item.reason} · {item.agingLabel}
              </p>
            </div>
            <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
              {SEVERITY_LABEL[item.severity]}
            </Badge>
          </Link>
        ))}
      </Card>

      {items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 text-sm font-medium text-accent hover:underline"
        >
          {expanded ? "Ver menos" : `Ver todo (${items.length})`}
        </button>
      )}
    </div>
  );
}
